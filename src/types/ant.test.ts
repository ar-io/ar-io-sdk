import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { z } from 'zod';

import {
  AntHandlerNames,
  AntInfoSchema,
  AntStateSchema,
  isAoANTState,
} from './ant.js';

const stub_arweave_address = 'valid-address'.padEnd(43, '1');
const stub_eth_address = '0x8B5f221c8837d862b818799e6b19cc23CE23B0E5';

describe('ANT Schemas', () => {
  it('should validate AntStateSchema', () => {
    const validState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Description: 'Test description',
      Keywords: ['keyword1', 'keyword2', 'keyword3'],
      Denomination: 0,
      Owner: stub_arweave_address,
      Controllers: [stub_arweave_address],
      Records: {
        record1: {
          transactionId: stub_arweave_address,
          ttlSeconds: 3600,
        },
      },
      Balances: {
        [stub_arweave_address]: 1,
      },
      Logo: stub_arweave_address,
      TotalSupply: 1,
      Initialized: true,
    };
    const invalidState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Description: 'Test description',
      Keywords: ['keyword1', 'keyword2', 'keyword3'],
      Denomination: 0,
      Owner: stub_arweave_address,
      Controllers: [stub_arweave_address],
      Records: {
        record1: {
          transactionId: 'invalid-id',
          ttlSeconds: '3600',
        },
      },
      Balances: {
        [stub_arweave_address]: 1,
      },
      Logo: stub_arweave_address,
      TotalSupply: -1,
      Initialized: true,
    };

    assert.doesNotThrow(() => AntStateSchema.parse(validState));
    assert.throws(() => AntStateSchema.parse(invalidState), z.ZodError);
  });

  it('should validate AntStateSchema with ETH address', () => {
    const validState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Description: 'Test description',
      Keywords: ['keyword1', 'keyword2', 'keyword3'],
      Denomination: 0,
      Owner: stub_eth_address,
      Controllers: [stub_eth_address],
      Records: {
        record1: {
          transactionId: stub_arweave_address,
          ttlSeconds: 3600,
        },
      },
      Balances: {
        [stub_eth_address]: 1,
      },
      Logo: stub_arweave_address,
      TotalSupply: 1,
      Initialized: true,
    };

    assert.doesNotThrow(() => AntStateSchema.parse(validState));
  });

  it('should validate AntInfoSchema', () => {
    const validInfo = {
      Name: 'TestToken',
      Owner: stub_arweave_address,

      Ticker: 'TST',
      Description: 'Test description',
      Keywords: ['keyword1', 'keyword2', 'keyword3'],
      ['Total-Supply']: '1',
      Logo: stub_arweave_address,
      Denomination: '0',
      Handlers: AntHandlerNames,
    };
    const invalidInfo = {
      Name: 'TestToken',
      Owner: stub_arweave_address,

      Ticker: 'TST',
      ['Total-Supply']: 1000,
      Logo: stub_arweave_address,
      Denomination: '1',
      Handlers: AntHandlerNames,
    };

    assert.doesNotThrow(() => AntInfoSchema.parse(validInfo));
    assert.throws(() => AntInfoSchema.parse(invalidInfo), z.ZodError);
  });

  it('should validate isAoANTState', () => {
    const validState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Description: 'Test description',
      Keywords: ['keyword1', 'keyword2', 'keyword3'],
      Denomination: 0,
      Owner: stub_arweave_address,
      Controllers: [stub_arweave_address],
      Records: {
        record1: {
          transactionId: stub_arweave_address,
          ttlSeconds: 3600,
        },
      },
      Balances: {
        [stub_arweave_address]: 1,
      },
      Logo: stub_arweave_address,
      TotalSupply: 0,
      Initialized: true,
    };
    const invalidState = {
      Name: 'TestToken',
      Ticker: 'TST',
      Description: 'Test description',
      Keywords: ['keyword1', 'keyword2', 'keyword3'],
      Denomination: 0,
      Owner: stub_arweave_address,
      Controllers: [stub_arweave_address],
      Records: {
        record1: {
          transactionId: 'invalid-id',
          ttlSeconds: '3600',
        },
      },
      Balances: {
        [stub_arweave_address]: 1,
      },
      Logo: stub_arweave_address,
      TotalSupply: -1,
      Initialized: true,
    };

    assert.strictEqual(isAoANTState(validState), true);
    assert.strictEqual(isAoANTState(invalidState), false);
  });
});
