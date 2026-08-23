import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type InFlightStore, memoizeInFlight } from './single-flight.js';

/** A promise whose settlement the test controls explicitly. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('memoizeInFlight', () => {
  it('collapses concurrent callers onto a single producer call', async () => {
    const store: InFlightStore<string, number> = new Map();
    let calls = 0;
    const d = deferred<number>();
    const produce = () => {
      calls++;
      return d.promise;
    };

    const all = Promise.all(
      Array.from({ length: 10 }, () =>
        memoizeInFlight(store, 'k', 60_000, produce),
      ),
    );
    d.resolve(7);

    assert.deepEqual(await all, Array(10).fill(7));
    assert.equal(calls, 1, '10 concurrent callers should produce once');
  });

  it('reuses a settled value for the TTL, then re-produces once expired', async () => {
    const store: InFlightStore<string, number> = new Map();
    let calls = 0;
    const produce = async () => ++calls;

    assert.equal(await memoizeInFlight(store, 'k', 50, produce), 1);
    assert.equal(await memoizeInFlight(store, 'k', 50, produce), 1, 'cached');

    await sleep(70);
    assert.equal(
      await memoizeInFlight(store, 'k', 50, produce),
      2,
      'expired entry should be replaced',
    );
  });

  it('does not cache rejections, and every concurrent caller sees the error', async () => {
    const store: InFlightStore<string, number> = new Map();
    let calls = 0;
    const produce = async () => {
      calls++;
      throw new Error(`boom ${calls}`);
    };

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        memoizeInFlight(store, 'k', 60_000, produce),
      ),
    );
    assert.equal(calls, 1, 'the failing fetch is still shared');
    for (const s of settled) {
      assert.equal(s.status, 'rejected');
      assert.match((s as PromiseRejectedResult).reason.message, /boom 1/);
    }
    assert.equal(store.size, 0, 'a rejection must be evicted, not cached');

    // A transient failure must not poison the key for the rest of the TTL.
    await assert.rejects(() => memoizeInFlight(store, 'k', 60_000, produce), {
      message: 'boom 2',
    });
    assert.equal(calls, 2, 'next caller retries after a failure');
  });

  it('shares an in-flight value that keep() rejects, but does not retain it', async () => {
    const store: InFlightStore<string, { exists: boolean }> = new Map();
    let calls = 0;
    const produce = async () => {
      calls++;
      return { exists: false };
    };
    const keep = (v: { exists: boolean }) => v.exists;

    // This is the "misses are not cached" rule from getCachedAccount: the
    // concurrent burst still costs ONE fetch...
    await Promise.all(
      Array.from({ length: 4 }, () =>
        memoizeInFlight(store, 'k', 60_000, produce, keep),
      ),
    );
    assert.equal(calls, 1);
    assert.equal(store.size, 0, 'a non-kept value is evicted once settled');

    // ...but a later caller re-checks rather than trusting a stale miss.
    await memoizeInFlight(store, 'k', 60_000, produce, keep);
    assert.equal(calls, 2);
  });

  it('a late settlement never evicts a newer entry for the same key', async () => {
    // Real timers rather than `mock.timers`: that API needs Node >= 20.4 and
    // this package supports Node >= 18. A short TTL plus a real sleep gets the
    // same interleaving without the version floor.
    const store: InFlightStore<string, string> = new Map();
    const slow = deferred<string>();
    let calls = 0;

    const first = memoizeInFlight(store, 'k', 10, () => {
      calls++;
      return slow.promise;
    });
    const firstSettled = first.catch(() => 'failed');

    // Let the TTL lapse while the first request is still in flight.
    await sleep(30);
    const second = await memoizeInFlight(store, 'k', 60_000, async () => {
      calls++;
      return 'fresh';
    });
    assert.equal(second, 'fresh');
    assert.equal(calls, 2);

    // The stale request now fails. Its eviction must not drop 'fresh'.
    slow.reject(new Error('stale'));
    await firstSettled;

    const third = await memoizeInFlight(store, 'k', 60_000, async () => {
      calls++;
      return 'should not happen';
    });
    assert.equal(third, 'fresh', 'newer entry survived the stale eviction');
    assert.equal(calls, 2);
  });
});
