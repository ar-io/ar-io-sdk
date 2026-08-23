import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { mapWithConcurrency } from './concurrency.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mapWithConcurrency', () => {
  it('returns results in INPUT order, not completion order', async () => {
    // Reverse the delays so completion order is the opposite of input order —
    // the bulk readers index positionally, so this is the property that keeps
    // decoded accounts matched to the right mint.
    const items = [0, 1, 2, 3, 4, 5, 6, 7];
    const out = await mapWithConcurrency(items, 4, async (n) => {
      await sleep((items.length - n) * 3);
      return n * 10;
    });
    assert.deepEqual(out, [0, 10, 20, 30, 40, 50, 60, 70]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 30 }, (_, i) => i),
      4,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await sleep(2);
        inFlight--;
      },
    );
    assert.ok(peak <= 4, `peak concurrency ${peak} exceeded the limit of 4`);
    assert.ok(peak > 1, 'work should actually run in parallel');
  });

  it('runs every item exactly once', async () => {
    const seen: number[] = [];
    await mapWithConcurrency(
      Array.from({ length: 25 }, (_, i) => i),
      4,
      async (n) => {
        await sleep(1);
        seen.push(n);
      },
    );
    assert.deepEqual(
      [...seen].sort((a, b) => a - b),
      Array.from({ length: 25 }, (_, i) => i),
    );
  });

  it('rejects on the first failure, like a sequential loop', async () => {
    await assert.rejects(
      () =>
        mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
          if (n === 3) throw new Error('chunk 3 failed');
          return n;
        }),
      { message: 'chunk 3 failed' },
    );
  });

  it('handles an empty input and a limit larger than the input', async () => {
    assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
    assert.deepEqual(
      await mapWithConcurrency([1, 2], 99, async (n) => n * 2),
      [2, 4],
    );
  });
});
