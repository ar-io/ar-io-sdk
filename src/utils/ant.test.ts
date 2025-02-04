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
      undername5: { priority: 100, transactionId: 'test', ttlSeconds: 1 },
      noPriority: { transactionId: 'test', ttlSeconds: 1 },
      '@': { transactionId: 'test', ttlSeconds: 1 }, // always first, even if no priority
    };
    const sorted = sortedANTRecords(records);
    assert.deepStrictEqual(sorted, {
      '@': { transactionId: 'test', ttlSeconds: 1 }, // always first, even if no priority
      undername1: { priority: 1, transactionId: 'test', ttlSeconds: 1 },
      undername2: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
      undername3: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername4: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername5: { priority: 100, transactionId: 'test', ttlSeconds: 1 },
      noPriority: { transactionId: 'test', ttlSeconds: 1 },
    });
  });

  it('should always return @ as the first record, regardless of priority', () => {
    const records = {
      '@': { priority: 5, transactionId: 'test', ttlSeconds: 1 },
      undername1: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
    };
    const sorted = sortedANTRecords(records);
    assert.deepStrictEqual(sorted, {
      '@': { priority: 5, transactionId: 'test', ttlSeconds: 1 },
      undername1: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
    });
  });
});
