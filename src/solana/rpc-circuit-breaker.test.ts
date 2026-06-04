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
