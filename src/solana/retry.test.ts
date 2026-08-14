import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { Logger } from '../common/logger.js';
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

  it('defaults to 3 maxAttempts', async () => {
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
    assert.equal(calls, 3);
  });
});

/**
 * Regression guard for the silenced-logger bug.
 *
 * `retry.ts` and `rpc-circuit-breaker.ts` each built a private
 * `new Logger({ level: 'error' })`. Because the Logger suppresses any level
 * numerically below its own, every `logger.debug`/`info`/`warn` in those
 * modules was dead code — and, critically, `Logger.default.setLogLevel()`
 * (which ar-io-node drives from AR_IO_SDK_LOG_LEVEL) had no effect on them.
 * Operators had no way to observe retries or circuit transitions at all.
 */
describe('withRetry logging', () => {
  const collect = () => {
    const lines: { level: string; message: string }[] = [];
    return {
      lines,
      logger: {
        setLogLevel: () => undefined,
        debug: (message: string) => lines.push({ level: 'debug', message }),
        info: (message: string) => lines.push({ level: 'info', message }),
        warn: (message: string) => lines.push({ level: 'warn', message }),
        error: (message: string) => lines.push({ level: 'error', message }),
      },
    };
  };

  it('logs a debug line for each retried attempt', async () => {
    const { lines, logger } = collect();
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new TypeError('fetch failed');
        return 'ok';
      },
      { baseDelayMs: 1, maxDelayMs: 5, logger },
    );

    assert.equal(result, 'ok');
    const debugs = lines.filter((l) => l.level === 'debug');
    // two failures -> two retry logs
    assert.equal(debugs.length, 2);
    assert.match(debugs[0].message, /\[retry\] attempt 1\/3 failed/);
    assert.match(debugs[1].message, /\[retry\] attempt 2\/3 failed/);
  });

  it('warns once when every attempt is exhausted', async () => {
    const { lines, logger } = collect();
    await assert.rejects(() =>
      withRetry(
        async () => {
          throw new TypeError('fetch failed');
        },
        { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, logger },
      ),
    );

    const warns = lines.filter((l) => l.level === 'warn');
    assert.equal(warns.length, 1);
    assert.match(warns[0].message, /exhausted 3 attempt\(s\)/);
  });

  it('does not warn when the error was never retryable', async () => {
    const { lines, logger } = collect();
    await assert.rejects(() =>
      withRetry(
        async () => {
          throw new Error('account not found');
        },
        { baseDelayMs: 1, logger },
      ),
    );
    assert.equal(lines.filter((l) => l.level === 'warn').length, 0);
    assert.equal(lines.filter((l) => l.level === 'debug').length, 0);
  });

  it('defaults to the shared Logger so setLogLevel() reaches it', async () => {
    // The actual regression: a private error-level logger made this impossible.
    const seen: string[] = [];
    const original = Logger.default.debug.bind(Logger.default);
    Logger.default.setLogLevel('debug');
    (Logger.default as unknown as { debug: (m: string) => void }).debug = (
      m: string,
    ) => seen.push(m);

    try {
      let calls = 0;
      await withRetry(
        async () => {
          calls++;
          if (calls < 2) throw new TypeError('fetch failed');
          return 'ok';
        },
        // no logger injected -> must fall back to Logger.default
        { baseDelayMs: 1, maxDelayMs: 5 },
      );
    } finally {
      (Logger.default as unknown as { debug: unknown }).debug = original;
    }

    assert.equal(seen.length, 1);
    assert.match(seen[0], /\[retry\] attempt 1\/3 failed/);
  });
});
