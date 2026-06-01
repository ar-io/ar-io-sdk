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
