import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { sortedANTRecords } from './ant.js';

describe('sortANTRecordsByPriority', () => {
  it('should sort records by priority and then lexicographically', () => {
    const records = {
      undername1: { priority: 1, transactionId: 'test', ttlSeconds: 1 },
      undername2: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
      undername3: { priority: 3, transactionId: 'test', ttlSeconds: 1 }, // colliding priorities default to lexicographic sorting
      undername4: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername5: { priority: 100, transactionId: 'test', ttlSeconds: 1 }, // priority does not represent the index or position of the record, just the order of resolution relative to other records
      noPriority: { transactionId: 'test', ttlSeconds: 1 },
      '@': { transactionId: 'test', ttlSeconds: 1 }, // always first, even if no priority
    };
    const sorted = sortedANTRecords(records);
    assert.deepStrictEqual(sorted, {
      '@': { transactionId: 'test', ttlSeconds: 1, index: 0 }, // always first, even if no priority
      undername1: {
        priority: 1,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 1,
      },
      undername2: {
        priority: 2,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 2,
      },
      undername3: {
        priority: 3,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 3,
      },
      undername4: {
        priority: 3,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 4,
      },
      undername5: {
        priority: 100,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 5,
      },
      noPriority: { transactionId: 'test', ttlSeconds: 1, index: 6 },
    });
  });

  it('should always return @ as the first record, regardless of priority', () => {
    const records = {
      '@': { priority: 5, transactionId: 'test', ttlSeconds: 1 }, //  priorities set on '@' are ignored, they are always first
      undername1: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
    };
    const sorted = sortedANTRecords(records);
    assert.deepStrictEqual(sorted, {
      '@': { priority: 5, transactionId: 'test', ttlSeconds: 1, index: 0 },
      undername1: {
        priority: 2,
        transactionId: 'test',
        ttlSeconds: 1,
        index: 1,
      },
    });
  });
});
