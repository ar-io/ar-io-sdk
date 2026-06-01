import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { isRetryableError, withRetry } from './retry.js';

describe('isRetryableError', () => {
  it('returns true for fetch failed TypeError', () => {
    const err = new TypeError('fetch failed');
    assert.equal(isRetryableError(err), true);
  });

  it('returns true for HTTP 429 (rate-limit)', () => {
    const err = Object.assign(
      new Error('HTTP error (429): Too Many Requests'),
      {
        name: 'SolanaError',
      },
    );
    assert.equal(isRetryableError(err), true);
  });

  it('returns true for HTTP 5xx', () => {
    const err = Object.assign(
      new Error('HTTP error (503): Service Unavailable'),
      { name: 'SolanaError' },
    );
    assert.equal(isRetryableError(err), true);
  });

  it('returns true for ECONNRESET', () => {
    const err = Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET',
    });
    assert.equal(isRetryableError(err), true);
  });

  it('returns true for ETIMEDOUT', () => {
    const err = Object.assign(new Error('connect ETIMEDOUT'), {
      code: 'ETIMEDOUT',
    });
    assert.equal(isRetryableError(err), true);
  });

  it('returns true for AbortError', () => {
    const err = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    });
    assert.equal(isRetryableError(err), true);
  });

  it('returns false for generic errors', () => {
    assert.equal(isRetryableError(new Error('account not found')), false);
  });

  it('returns false for null/undefined', () => {
    assert.equal(isRetryableError(null), false);
    assert.equal(isRetryableError(undefined), false);
  });

  it('returns false for circuit breaker open', () => {
    const err = new Error('Breaker is open');
    assert.equal(isRetryableError(err), false);
  });
});

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(calls, 1);
  });

  it('retries on retryable errors then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new TypeError('fetch failed');
        return 'ok';
      },
      { maxAttempts: 3, baseDelayMs: 10 },
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('throws immediately on non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            calls++;
            throw new Error('account not found');
          },
          { maxAttempts: 3, baseDelayMs: 10 },
        ),
      { message: 'account not found' },
    );
    assert.equal(calls, 1);
  });

  it('throws after exhausting all attempts', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            calls++;
            throw new TypeError('fetch failed');
          },
          { maxAttempts: 3, baseDelayMs: 10 },
        ),
      { message: 'fetch failed' },
    );
    assert.equal(calls, 3);
  });

  it('respects custom isRetryable predicate', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 2) throw new Error('custom retryable');
        return 'done';
      },
      {
        maxAttempts: 3,
        baseDelayMs: 10,
        isRetryable: (err) => (err as Error).message === 'custom retryable',
      },
    );
    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });

  it('defaults to 6 maxAttempts', async () => {
    let calls = 0;
    await assert.rejects(() =>
      withRetry(
        async () => {
          calls++;
          throw new TypeError('fetch failed');
        },
        { baseDelayMs: 10, maxDelayMs: 50 },
      ),
    );
    assert.equal(calls, 6);
  });
});
