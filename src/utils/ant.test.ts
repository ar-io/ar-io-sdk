import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { convertHyperBeamStateToAoANTState, sortANTRecords } from './ant.js';

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
      noPriority1: { transactionId: 'test', ttlSeconds: 1 },
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
      noPriority1: { transactionId: 'test', ttlSeconds: 1, index: 10 },
      noPriority11: { transactionId: 'test', ttlSeconds: 1, index: 11 },
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

describe('convertHyperBeamStateToAoANTState', () => {
  it('should convert HyperBeam ANT state to Ao ANT state format', () => {
    const hyperBeamState = {
      name: 'TestANT',
      ticker: 'TANT',
      description: 'A test ANT',
      keywords: ['test', 'ant'],
      denomination: '0',
      owner: 'owner-address',
      controllers: ['controller1', 'controller2'],
      records: {
        '@': {
          transactionid: 'tx-id-1',
          ttlseconds: 3600,
        },
        subdomain: {
          transactionid: 'tx-id-2',
          ttlseconds: 7200,
          priority: 1,
        },
      },
      balances: {
        address1: 100,
        address2: 200,
      },
      logo: 'logo-tx-id',
      totalsupply: 1000,
      initialized: true,
    };

    const expectedAoState = {
      Name: 'TestANT',
      Ticker: 'TANT',
      Description: 'A test ANT',
      Keywords: ['test', 'ant'],
      Denomination: 0,
      Owner: 'owner-address',
      Controllers: ['controller1', 'controller2'],
      Records: {
        '@': {
          transactionId: 'tx-id-1',
          ttlSeconds: 3600,
        },
        subdomain: {
          transactionId: 'tx-id-2',
          ttlSeconds: 7200,
          priority: 1,
        },
      },
      Balances: {
        address1: 100,
        address2: 200,
      },
      Logo: 'logo-tx-id',
      TotalSupply: 1000,
      Initialized: true,
    };

    const result = convertHyperBeamStateToAoANTState(hyperBeamState);
    assert.deepStrictEqual(result, expectedAoState);
  });

  it('should handle mixed case keys in HyperBeam state', () => {
    const hyperBeamState = {
      name: 'TestANT',
      ticker: 'TANT',
      description: 'A test ANT',
      keywords: ['test', 'ant'],
      denomination: '0',
      owner: 'owner-address',
      controllers: ['controller1', 'controller2'],
      records: {
        '@': {
          transactionid: 'tx-id-1',
          ttlseconds: 3600,
        },
        subdomain: {
          transactionid: 'tx-id-2',
          ttlseconds: 7200,
          priority: 1,
        },
      },
      balances: {
        address1: 100,
        address2: 200,
      },
      logo: 'logo-tx-id',
      totalsupply: 1000,
      initialized: true,
    };

    const expectedAoState = {
      Name: 'TestANT',
      Ticker: 'TANT',
      Description: 'A test ANT',
      Keywords: ['test', 'ant'],
      Denomination: 0,
      Owner: 'owner-address',
      Controllers: ['controller1', 'controller2'],
      Records: {
        '@': {
          transactionId: 'tx-id-1',
          ttlSeconds: 3600,
        },
        subdomain: {
          transactionId: 'tx-id-2',
          ttlSeconds: 7200,
          priority: 1,
        },
      },
      Balances: {
        address1: 100,
        address2: 200,
      },
      Logo: 'logo-tx-id',
      TotalSupply: 1000,
      Initialized: true,
    };

    const result = convertHyperBeamStateToAoANTState(hyperBeamState);
    assert.deepStrictEqual(result, expectedAoState);
  });

  it('should handle records without priority', () => {
    const hyperBeamState = {
      name: 'TestANT',
      ticker: 'TANT',
      description: 'A test ANT',
      keywords: ['test', 'ant'],
      denomination: '0',
      owner: 'owner-address',
      controllers: [],
      records: {
        '@': {
          transactionid: 'tx-id-1',
          ttlseconds: 3600,
        },
      },
      balances: {},
      logo: 'logo-tx-id',
      totalsupply: 1000,
      initialized: true,
    };

    const result = convertHyperBeamStateToAoANTState(hyperBeamState);
    assert.deepStrictEqual(result.Records['@'], {
      transactionId: 'tx-id-1',
      ttlSeconds: 3600,
    });
    assert.strictEqual('priority' in result.Records['@'], false);
  });

  it('should convert mixed case keys to lowercase', () => {
    // This test uses a type assertion to bypass TypeScript's type checking
    // since we want to test the case conversion functionality
    const hyperBeamState = {
      Name: 'TestANT',
      TICKER: 'TANT',
      Description: 'A test ANT',
      Keywords: ['test', 'ant'],
      Denomination: '0',
      Owner: 'owner-address',
      Controllers: ['controller1', 'controller2'],
      Records: {
        '@': {
          TransactionId: 'tx-id-1',
          TTLSeconds: 3600,
        },
        subdomain: {
          transactionid: 'tx-id-2',
          ttlseconds: 7200,
          Priority: 1,
        },
      },
      Balances: {
        address1: 100,
        address2: 200,
      },
      Logo: 'logo-tx-id',
      TotalSupply: 1000,
      Initialized: true,
    } as any; // Type assertion to test case conversion

    const expectedAoState = {
      Name: 'TestANT',
      Ticker: 'TANT',
      Description: 'A test ANT',
      Keywords: ['test', 'ant'],
      Denomination: 0,
      Owner: 'owner-address',
      Controllers: ['controller1', 'controller2'],
      Records: {
        '@': {
          transactionId: 'tx-id-1',
          ttlSeconds: 3600,
        },
        subdomain: {
          transactionId: 'tx-id-2',
          ttlSeconds: 7200,
          priority: 1,
        },
      },
      Balances: {
        address1: 100,
        address2: 200,
      },
      Logo: 'logo-tx-id',
      TotalSupply: 1000,
      Initialized: true,
    };

    const result = convertHyperBeamStateToAoANTState(hyperBeamState);
    assert.deepStrictEqual(result, expectedAoState);
  });
});
