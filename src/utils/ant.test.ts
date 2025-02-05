import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { sortANTRecords } from './ant.js';

describe('sortANTRecordsByPriority', () => {
  it('should sort records by priority and then lexicographically', () => {
    const records = {
      undername01: { priority: 1, transactionId: 'test', ttlSeconds: 1 }, // same priority, lexicographic sorting applied to the name
      undername1: { priority: 1, transactionId: 'test', ttlSeconds: 1 },
      undername11: { priority: 1, transactionId: 'test', ttlSeconds: 1 }, // same priority, lexicographic sorting applied to the name
      undername2: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
      undername3: { priority: 3, transactionId: 'test', ttlSeconds: 1 }, // colliding priorities default to lexicographic sorting
      undername4: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername5: { priority: 100, transactionId: 'test', ttlSeconds: 1 }, // priority does not represent the index or position of the record, just the order of resolution relative to other records
      noPriority: { transactionId: 'test', ttlSeconds: 1 },
      noPriority01: { transactionId: 'test', ttlSeconds: 1 },
      noPriority11: { transactionId: 'test', ttlSeconds: 1 },
      '@': { transactionId: 'test', ttlSeconds: 1 }, // always first, even if no priority
    };
    const sorted = sortANTRecords(records);
    assert.deepStrictEqual(sorted, {
      '@': { transactionId: 'test', ttlSeconds: 1, index: 0 }, // always first, even if no priority
      undername01: {
        priority: 1,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 1,
      },
      undername1: {
        priority: 1,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 2,
      },
      undername11: {
        priority: 1,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 3,
      },
      undername2: {
        priority: 2,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 4,
      },
      undername3: {
        priority: 3,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 5,
      },
      undername4: {
        priority: 3,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 6,
      },
      undername5: {
        priority: 100,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 7,
      },
      noPriority: { transactionId: 'test', ttlSeconds: 1, index: 8 },
      noPriority01: { transactionId: 'test', ttlSeconds: 1, index: 9 },
      noPriority11: { transactionId: 'test', ttlSeconds: 1, index: 10 },
    });
  });

  it('should always return @ as the first, regardless of priority', () => {
    const scenarios = [
      {
        records: {
          '@': { priority: 5, transactionId: 'test', ttlSeconds: 1 }, //  priorities set on '@' are ignored, they are always first
          undername1: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
        },
        expected: {
          '@': { priority: 5, transactionId: 'test', ttlSeconds: 1, index: 0 },
          undername1: {
            priority: 2,
            transactionId: 'test',
            ttlSeconds: 1,
            index: 1,
          },
        },
      },
      {
        records: {
          '@': { transactionId: 'test', ttlSeconds: 1 }, // priority 0 is missing, but '@' is always first
          undername1: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
        },
        expected: {
          '@': { transactionId: 'test', ttlSeconds: 1, index: 0 },
          undername1: {
            priority: 2,
            transactionId: 'test',
            ttlSeconds: 1,
            index: 1,
          },
        },
      },
    ];
    for (const scenario of scenarios) {
      const sorted = sortANTRecords(scenario.records);
      assert.deepStrictEqual(sorted, scenario.expected);
    }
  });
});
