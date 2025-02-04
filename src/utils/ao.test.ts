import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { antRecordsSortedByPriority } from './ao.js';

describe('sortANTRecordsByPriority', () => {
  it('should sort records by priority and then lexicographically', () => {
    const records = {
      undername1: { priority: 1, transactionId: 'test', ttlSeconds: 1 },
      undername2: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
      undername3: { priority: 3, transactionId: 'test', ttlSeconds: 1 }, // colliding priorities default to lexicographic sorting
      undername4: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername5: { priority: 100, transactionId: 'test', ttlSeconds: 1 },
      noPriority: { transactionId: 'test', ttlSeconds: 1 },
      '@': { priority: 0, transactionId: 'test', ttlSeconds: 1 }, // always firs
    };
    const sorted = antRecordsSortedByPriority(records);
    assert.deepStrictEqual(sorted, {
      '@': { priority: 0, transactionId: 'test', ttlSeconds: 1 },
      undername1: { priority: 1, transactionId: 'test', ttlSeconds: 1 },
      undername2: { priority: 2, transactionId: 'test', ttlSeconds: 1 },
      undername3: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername4: { priority: 3, transactionId: 'test', ttlSeconds: 1 },
      undername5: { priority: 100, transactionId: 'test', ttlSeconds: 1 },
      noPriority: { transactionId: 'test', ttlSeconds: 1 },
    });
  });
});
