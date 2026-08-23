import { strict as assert } from 'node:assert';
import http from 'node:http';
import { afterEach, describe, it } from 'node:test';

import {
  createCircuitBreakerRpc,
  defaultFallbackUrl,
} from './rpc-circuit-breaker.js';

/**
 * Spin up a tiny HTTP server that responds to JSON-RPC requests.
 * `handler` controls what each request returns.
 */
function createMockRpcServer(
  handler: () => { result: unknown } | { error: unknown },
): Promise<{ url: string; server: http.Server; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const { id } = JSON.parse(body);
        const response = handler();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id, ...response }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        server,
        close: () => new Promise((r) => server.close(r as () => void)),
      });
    });
  });
}

/**
 * Like {@link createMockRpcServer} but lets the handler control the HTTP
 * status code and response headers — used to simulate 429 rate limits.
 */
function createStatusMockServer(
  handler: () => {
    statusCode: number;
    headers?: Record<string, string>;
    result?: unknown;
    error?: unknown;
  },
): Promise<{ url: string; server: http.Server; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const { id } = JSON.parse(body);
        const r = handler();
        res.writeHead(r.statusCode, {
          'Content-Type': 'application/json',
          ...r.headers,
        });
        if (r.statusCode >= 400) {
          res.end('');
        } else {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              ...(r.result !== undefined ? { result: r.result } : {}),
              ...(r.error !== undefined ? { error: r.error } : {}),
            }),
          );
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        server,
        close: () => new Promise((r) => server.close(r as () => void)),
      });
    });
  });
}

describe('createCircuitBreakerRpc', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((s) => s.close()));
    servers.length = 0;
  });

  it('returns primary result when healthy', async () => {
    const primary = await createMockRpcServer(() => ({
      result: { value: 'primary' },
    }));
    const fallback = await createMockRpcServer(() => ({
      result: { value: 'fallback' },
    }));
    servers.push(primary, fallback);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: primary.url,
      fallbackUrl: fallback.url,
      circuitBreakerOptions: { volumeThreshold: 1, timeout: false },
    });

    const result = await rpc
      .getLatestBlockhash()
      .send({ abortSignal: AbortSignal.timeout(5000) });
    assert.deepStrictEqual(result, { value: 'primary' });
  });

  it('does NOT circuit-break on JSON-RPC-level errors (transport succeeded)', async () => {
    const primary = await createMockRpcServer(() => ({
      error: { code: -32603, message: 'Internal error' },
    }));
    const fallback = await createMockRpcServer(() => ({
      result: { value: 'fallback' },
    }));
    servers.push(primary, fallback);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: primary.url,
      fallbackUrl: fallback.url,
      circuitBreakerOptions: { volumeThreshold: 1, timeout: false },
    });

    await assert.rejects(
      () =>
        rpc
          .getLatestBlockhash()
          .send({ abortSignal: AbortSignal.timeout(5000) }),
      (err: Error) => {
        assert.match(err.message, /Internal error/);
        return true;
      },
    );
  });

  it('falls back when primary is unreachable', async () => {
    const fallback = await createMockRpcServer(() => ({
      result: { value: 'fallback' },
    }));
    servers.push(fallback);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: 'http://127.0.0.1:1',
      fallbackUrl: fallback.url,
      circuitBreakerOptions: { volumeThreshold: 1, timeout: false },
    });

    const result = await rpc
      .getLatestBlockhash()
      .send({ abortSignal: AbortSignal.timeout(5000) });
    assert.deepStrictEqual(result, { value: 'fallback' });
  });

  it('throttles requests to ~maxRequestsPerSecond', async () => {
    let n = 0;
    const primary = await createStatusMockServer(() => ({
      statusCode: 200,
      result: { value: ++n },
    }));
    servers.push(primary);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: primary.url,
      fallbackUrl: primary.url,
      circuitBreakerOptions: {
        volumeThreshold: 100,
        timeout: false,
        maxRequestsPerSecond: 4,
      },
    });

    const start = Date.now();
    // Sequential (not concurrent) so kit doesn't coalesce them into one call.
    for (let i = 0; i < 8; i++) {
      await rpc
        .getLatestBlockhash()
        .send({ abortSignal: AbortSignal.timeout(10_000) });
    }
    const elapsed = Date.now() - start;
    // Burst of 4, then 4 more at 4/s ≈ 1s. Lower-bound assert (timing-safe).
    assert.ok(elapsed >= 700, `expected throttling >=700ms, got ${elapsed}ms`);
  });

  it('throttles by default (10 r/s) with no maxRequestsPerSecond set', async () => {
    let n = 0;
    const primary = await createStatusMockServer(() => ({
      statusCode: 200,
      result: { value: ++n },
    }));
    servers.push(primary);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: primary.url,
      fallbackUrl: primary.url,
      circuitBreakerOptions: { volumeThreshold: 100, timeout: false },
    });

    const start = Date.now();
    // Default burst of 10, then 10 more at 10/s ≈ 1s.
    for (let i = 0; i < 20; i++) {
      await rpc
        .getLatestBlockhash()
        .send({ abortSignal: AbortSignal.timeout(10_000) });
    }
    const elapsed = Date.now() - start;
    assert.ok(
      elapsed >= 700,
      `expected default throttling >=700ms, got ${elapsed}ms`,
    );
  });

  it('backs off on a 429 (Retry-After) even when fallback masks it', async () => {
    const primary = await createStatusMockServer(() => ({
      statusCode: 429,
      headers: { 'retry-after': '1' },
    }));
    const fallback = await createStatusMockServer(() => ({
      statusCode: 200,
      result: { value: 'fallback' },
    }));
    servers.push(primary, fallback);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: primary.url,
      fallbackUrl: fallback.url,
      circuitBreakerOptions: {
        volumeThreshold: 100, // keep the circuit closed so primary keeps 429ing
        timeout: false,
        maxRequestsPerSecond: 50,
      },
    });

    // Primary 429s → opossum 'failure' fires (→ pauseFor Retry-After) → the
    // fallback then masks it, so the call still resolves.
    const r1 = await rpc
      .getLatestBlockhash()
      .send({ abortSignal: AbortSignal.timeout(10_000) });
    assert.deepStrictEqual(r1, { value: 'fallback' });

    // The next request should be held by the ~1s cooldown from Retry-After.
    const start = Date.now();
    await rpc
      .getLatestBlockhash()
      .send({ abortSignal: AbortSignal.timeout(10_000) });
    const waited = Date.now() - start;
    assert.ok(waited >= 800, `expected cooldown >=800ms, got ${waited}ms`);
  });
});

describe('createCircuitBreakerRpc — adaptive throttle', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((s) => s.close()));
    servers.length = 0;
  });

  /** A port with nothing listening, so the primary transport always fails. */
  async function deadUrl(): Promise<string> {
    const s = await createStatusMockServer(() => ({ statusCode: 200 }));
    await s.close();
    return s.url;
  }

  /** Drive `concurrency` callers for `ms`, swallowing the expected errors. */
  async function drive(
    rpc: ReturnType<typeof createCircuitBreakerRpc>,
    ms: number,
    concurrency: number,
  ) {
    const stop = Date.now() + ms;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (Date.now() < stop) {
          try {
            await rpc
              .getSlot()
              .send({ abortSignal: AbortSignal.timeout(5_000) });
          } catch {
            /* 429s and dead-primary errors are the point of these tests */
          }
        }
      }),
    );
  }

  it('throttles when the FALLBACK 429s and the circuit is open', async () => {
    // The existing 429 test pins volumeThreshold high to keep the circuit
    // CLOSED. That path works: opossum emits `failure`, which feeds the
    // backoff. When the circuit is OPEN it emits `reject` and calls the
    // fallback directly — no `failure` — so fallback 429s were invisible to
    // the throttle and it stayed pinned at the ceiling for as long as the
    // primary was down.
    let fallbackHits = 0;
    const fallback = await createStatusMockServer(() => {
      fallbackHits++;
      return { statusCode: 429, headers: { 'retry-after': '1' } };
    });
    servers.push(fallback);

    const rpc = createCircuitBreakerRpc({
      primaryUrl: await deadUrl(),
      fallbackUrl: fallback.url,
      circuitBreakerOptions: {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        timeout: false,
        maxRequestsPerSecond: 20,
        resetTimeout: 60_000,
      },
    });

    await drive(rpc, 2_500, 4);

    // At 20 r/s with no backoff this is ~50 requests. Backing off on the
    // fallback's 429s should keep it far below that.
    assert.ok(
      fallbackHits < 20,
      `fallback took ${fallbackHits} requests in 2.5s — the throttle never ` +
        'saw its 429s (ceiling 20 r/s would allow ~50)',
    );
  });

  it('treats an advertised rps-limit as a ceiling, never as permission to keep going', async () => {
    // A 429 always means slow down. When the provider advertises a limit far
    // above our ceiling (api.mainnet-beta.solana.com sends 250 against a
    // default ceiling of 10) the header path resolved to the ceiling itself,
    // so the rate never moved.
    //
    // `retry-after: 0` is deliberate: the per-429 cooldown otherwise dominates
    // throughput and masks the rate entirely — measured, an absolute-count
    // assertion could not tell the two cases apart. Removing the cooldown
    // leaves throughput governed purely by the adaptive rate, which is what
    // this bug is about. Compared against the known-good headerless case
    // rather than an absolute number, so the assertion does not depend on
    // machine speed.
    async function hitsOver(headers: Record<string, string>): Promise<number> {
      let hits = 0;
      const primary = await createStatusMockServer(() => {
        hits++;
        return { statusCode: 429, headers: { 'retry-after': '0', ...headers } };
      });
      const fallback = await createStatusMockServer(() => ({
        statusCode: 429,
        headers: { 'retry-after': '0' },
      }));
      servers.push(primary, fallback);
      const rpc = createCircuitBreakerRpc({
        primaryUrl: primary.url,
        fallbackUrl: fallback.url,
        circuitBreakerOptions: {
          volumeThreshold: 100, // keep the circuit closed so the primary keeps 429ing
          timeout: false,
          maxRequestsPerSecond: 20,
          resetTimeout: 60_000,
        },
      });
      await drive(rpc, 3_000, 4);
      return hits;
    }

    const headerless = await hitsOver({});
    const advertised = await hitsOver({ 'x-ratelimit-rps-limit': '250' });

    assert.ok(
      advertised <= headerless * 2,
      `429s advertising rps-limit 250 served ${advertised} requests versus ` +
        `${headerless} for identical headerless 429s — the advertised limit ` +
        'is holding the rate at the ceiling instead of lowering it',
    );
  });
});

describe('defaultFallbackUrl', () => {
  it('returns devnet URL for devnet primary', () => {
    assert.equal(
      defaultFallbackUrl('https://api.devnet.solana.com'),
      'https://api.devnet.solana.com',
    );
    assert.equal(
      defaultFallbackUrl('https://my-rpc.example.com/devnet'),
      'https://api.devnet.solana.com',
    );
  });

  it('returns mainnet URL for mainnet/custom primary', () => {
    assert.equal(
      defaultFallbackUrl('https://api.mainnet-beta.solana.com'),
      'https://api.mainnet-beta.solana.com',
    );
    assert.equal(
      defaultFallbackUrl('https://my-custom-rpc.example.com'),
      'https://api.mainnet-beta.solana.com',
    );
  });
});
