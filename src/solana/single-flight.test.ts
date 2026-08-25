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

  it('does not start a duplicate request while one is still in flight, even past the TTL', async () => {
    // Reported by CodeRabbit on #712. The TTL used to be measured from when
    // the request STARTED, so a request slower than its own TTL was treated as
    // expired while still in flight and later callers began a second one —
    // reopening the exact stampede this helper exists to close.
    //
    // Not theoretical: CLUSTER_CLOCK_CACHE_TTL_MS is 1s and the cluster-clock
    // read is two SEQUENTIAL RPCs, each wrapped in withRetry (3 attempts, 1s
    // base backoff). One retry is enough to exceed the TTL.
    const store: InFlightStore<string, number> = new Map();
    let calls = 0;
    const slow = deferred<number>();
    const produce = () => {
      calls++;
      return slow.promise;
    };

    const first = memoizeInFlight(store, 'k', 10, produce);
    await sleep(40); // TTL has lapsed, but the request has NOT settled
    const second = memoizeInFlight(store, 'k', 10, produce);

    slow.resolve(5);
    assert.equal(await first, 5);
    assert.equal(await second, 5);
    assert.equal(
      calls,
      1,
      'a caller arriving during a slow request must join it, not start another',
    );
  });

  it('starts the TTL when the request settles, not when it began', async () => {
    const store: InFlightStore<string, number> = new Map();
    let calls = 0;
    const produce = async () => {
      calls++;
      await sleep(40);
      return calls;
    };

    // ttl 60ms against a 40ms request: measured from the start it would have
    // only ~20ms of life left, measured from settlement it has the full 60ms.
    assert.equal(await memoizeInFlight(store, 'k', 60, produce), 1);
    await sleep(30);
    assert.equal(
      await memoizeInFlight(store, 'k', 60, produce),
      1,
      'the settled value should still be within its TTL',
    );
    assert.equal(calls, 1);
  });

  it('a late settlement never evicts a newer entry for the same key', async () => {
    // Now that pending entries never expire, two promises can only coexist for
    // a key if one is swapped in directly — so drive that explicitly rather
    // than via a TTL race, to keep the identity guard covered.
    const store: InFlightStore<string, string> = new Map();
    const slow = deferred<string>();
    const stale = memoizeInFlight(store, 'k', 60_000, () => slow.promise);
    const staleSettled = stale.catch(() => 'failed');

    // Replace the entry as though a newer request had taken over the key.
    const fresh = Promise.resolve('fresh');
    store.set('k', { promise: fresh, expiresAt: Date.now() + 60_000 });

    slow.reject(new Error('stale'));
    await staleSettled;

    let calls = 0;
    const after = await memoizeInFlight(store, 'k', 60_000, async () => {
      calls++;
      return 'should not happen';
    });
    assert.equal(after, 'fresh', 'newer entry survived the stale eviction');
    assert.equal(calls, 0);
  });
});
