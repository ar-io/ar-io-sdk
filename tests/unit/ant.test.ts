import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { isAoANTState } from '../../src/utils/ao.js';

const testAoANTState = {
  Name: 'TestToken',
  Ticker: 'TST',
  Denomination: 1,
  Owner: ''.padEnd(43, '1'),
  Controllers: [''.padEnd(43, '2')],
  Records: {
    record1: {
      transactionId: ''.padEnd(43, '1'),
      ttlSeconds: 3600,
    },
  },
  Balances: {
    [''.padEnd(43, '1')]: 1,
  },
  Logo: ''.padEnd(43, '1'),
  TotalSupply: 0,
  Initialized: true,
};
describe('ANT', () => {
  it('should validate accurate ANT state', () => {
    const res = isAoANTState(testAoANTState);
    assert.strictEqual(res, true);
  });

  it('should invalidate inaccurate ANT state', () => {
    const res = isAoANTState({ ...testAoANTState, Name: 1 });
    assert.strictEqual(res, false);
  });
});
