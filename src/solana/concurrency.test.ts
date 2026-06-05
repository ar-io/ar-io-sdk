import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { mapWithConcurrency } from './concurrency.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mapWithConcurrency', () => {
  it('returns an empty array for empty input without invoking fn', async () => {
    let calls = 0;
    const result = await mapWithConcurrency([], 4, async (x) => {
      calls++;
      return x;
    });
    assert.deepEqual(result, []);
    assert.equal(calls, 0);
  });

  it('preserves input order regardless of completion order', async () => {
    const items = [0, 1, 2, 3, 4, 5];
    // Earlier items resolve LATER so completion order is reversed.
    const result = await mapWithConcurrency(items, 3, async (x) => {
      await delay((items.length - x) * 5);
      return x * 10;
    });
    assert.deepEqual(result, [0, 10, 20, 30, 40, 50]);
  });

  it('respects the concurrency cap', async () => {
    const limit = 3;
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, limit, async (x) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(10);
      inFlight--;
      return x;
    });

    assert.ok(
      maxInFlight <= limit,
      `expected at most ${limit} in flight, saw ${maxInFlight}`,
    );
    // Sanity: with enough work the pool should actually saturate the cap.
    assert.equal(maxInFlight, limit);
  });

  it('clamps limit to at least 1', async () => {
    const order: number[] = [];
    const result = await mapWithConcurrency([1, 2, 3], 0, async (x) => {
      order.push(x);
      return x;
    });
    assert.deepEqual(result, [1, 2, 3]);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('does not spawn more workers than items', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const result = await mapWithConcurrency([1, 2], 100, async (x) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(5);
      inFlight--;
      return x;
    });
    assert.deepEqual(result, [1, 2]);
    assert.ok(maxInFlight <= 2);
  });

  it('passes the correct index to fn', async () => {
    const result = await mapWithConcurrency(
      ['a', 'b', 'c'],
      2,
      async (item, index) => `${index}:${item}`,
    );
    assert.deepEqual(result, ['0:a', '1:b', '2:c']);
  });
});
