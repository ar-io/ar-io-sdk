import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { z } from 'zod';

import {
  AntInfoSchema,
  AntStateSchema,
  isAoANTState,
} from '../../src/types/ant.js';

const stub_address = 'valid-address'.padEnd(43, '1');

describe('ANT Schemas', () => {
  it('should validate AntStateSchema', () => {
    const validState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Denomination: 0,
      Owner: stub_address,
      Controllers: [stub_address],
      Records: {
        record1: {
          transactionId: stub_address,
          ttlSeconds: 3600,
        },
      },
      Balances: {
        [stub_address]: 1,
      },
      Logo: stub_address,
      TotalSupply: 1,
      Initialized: true,
      ['Source-Code-TX-ID']: stub_address,
    };
    const invalidState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Denomination: 0,
      Owner: stub_address,
      Controllers: [stub_address],
      Records: {
        record1: {
          transactionId: 'invalid-id',
          ttlSeconds: '3600',
        },
      },
      Balances: {
        [stub_address]: 1,
      },
      Logo: stub_address,
      TotalSupply: -1,
      Initialized: true,
      ['Source-Code-TX-ID']: stub_address,
    };

    assert.doesNotThrow(() => AntStateSchema.parse(validState));
    assert.throws(() => AntStateSchema.parse(invalidState), z.ZodError);
  });

  it('should validate AntInfoSchema', () => {
    const validInfo = {
      Name: 'TestToken',
      Owner: stub_address,
      ['Source-Code-TX-ID']: stub_address,
      Ticker: 'TST',
      ['Total-Supply']: '1',
      Logo: stub_address,
      Denomination: '0',
    };
    const invalidInfo = {
      Name: 'TestToken',
      Owner: stub_address,
      ['Source-Code-TX-ID']: stub_address,
      Ticker: 'TST',
      ['Total-Supply']: 1000,
      Logo: stub_address,
      Denomination: '1',
    };

    assert.doesNotThrow(() => AntInfoSchema.parse(validInfo));
    assert.throws(() => AntInfoSchema.parse(invalidInfo), z.ZodError);
  });

  it('should validate isAoANTState', () => {
    const validState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Denomination: 0,
      Owner: stub_address,
      Controllers: [stub_address],
      Records: {
        record1: {
          transactionId: stub_address,
          ttlSeconds: 3600,
        },
      },
      Balances: {
        [stub_address]: 1,
      },
      Logo: stub_address,
      TotalSupply: 0,
      Initialized: true,
      ['Source-Code-TX-ID']: stub_address,
    };
    const invalidState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Denomination: 0,
      Owner: stub_address,
      Controllers: [stub_address],
      Records: {
        record1: {
          transactionId: 'invalid-id',
          ttlSeconds: '3600',
        },
      },
      Balances: {
        [stub_address]: 1,
      },
      Logo: stub_address,
      TotalSupply: -1,
      Initialized: true,
      ['Source-Code-TX-ID']: stub_address,
    };

    assert.strictEqual(isAoANTState(validState), true);
    assert.strictEqual(isAoANTState(invalidState), false);
  });
});
