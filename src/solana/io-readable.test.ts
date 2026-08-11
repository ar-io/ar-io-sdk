import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  PurchaseType,
  getArnsRecordEncoder,
} from '@ar.io/solana-contracts/arns';
import { type Address } from '@solana/kit';
import bs58 from 'bs58';

import { Logger } from '../common/logger.js';
import { SolanaARIOReadable } from './io-readable.js';

type Counts = { gma: number; gmaAccts: number };

function countingRpc(counts: Counts) {
  return {
    getMultipleAccounts: (addrs: unknown[]) => ({
      send: async () => {
        counts.gma++;
        counts.gmaAccts += addrs.length;
        return { value: addrs.map(() => null) };
      },
    }),
  };
}

function mint(n: number): string {
  return bs58.encode(Buffer.alloc(32, n));
}

class TestReadable extends SolanaARIOReadable {
  async readAccumulators(operatorAddresses: string[]) {
    return this.getGatewayAccumulators(operatorAddresses);
  }
}

function makeReadable(counts: Counts) {
  return new TestReadable({
    // biome-ignore lint/suspicious/noExplicitAny: minimal stub rpc for counting
    rpc: countingRpc(counts) as any,
    logger: new Logger({ level: 'none' }),
  });
}

describe('SolanaARIOReadable accumulator batching', () => {
  it('chunks getGatewayAccumulators into 100-account getMultipleAccounts calls', async () => {
    const counts: Counts = { gma: 0, gmaAccts: 0 };
    const readable = makeReadable(counts);

    const operators = Array.from({ length: 250 }, (_, i) => mint(i + 1));
    const accumulators = await readable.readAccumulators(operators);

    assert.equal(counts.gma, 3, '250 gateways should be split into 3 calls');
    assert.equal(counts.gmaAccts, 250, 'all 250 accounts should be requested');
    assert.deepEqual(accumulators, new Map());
  });
});

// ---------------------------------------------------------------------------
// getArNSRecord — timestamp conversion (seconds → milliseconds)
// ---------------------------------------------------------------------------

const OWNER_ADDR = '11111111111111111111111111111111' as Address;
const VERSION = { major: 1, minor: 0, patch: 0 };

function arnsRecordBytes(
  name: string,
  startSec: number,
  endSec: number | null,
): Uint8Array {
  return getArnsRecordEncoder().encode({
    nameHash: new Uint8Array(32),
    owner: OWNER_ADDR,
    ant: OWNER_ADDR,
    purchaseType: endSec === null ? PurchaseType.Permabuy : PurchaseType.Lease,
    startTimestamp: startSec,
    endTimestamp: endSec,
    undernameLimit: 10,
    purchasePrice: 0,
    bump: 255,
    name,
    version: VERSION,
  }) as Uint8Array;
}

/** Stub rpc that returns `bytes` for any getAccountInfo call. */
function singleAccountRpc(bytes: Uint8Array): unknown {
  const b64 = Buffer.from(bytes).toString('base64');
  return {
    getAccountInfo: () => ({
      send: async () => ({
        value: {
          data: [b64, 'base64'] as readonly [string, string],
          executable: false,
          lamports: 1_000_000n,
          owner: OWNER_ADDR,
          rentEpoch: 0n,
          space: BigInt(bytes.length),
        },
      }),
    }),
  };
}

describe('getArNSRecord — timestamp conversion', () => {
  it('converts lease startTimestamp and endTimestamp from seconds to milliseconds', async () => {
    const startSec = 1_720_000_000; // ~2024-07-03
    const endSec = 1_756_000_000; // ~2025-08-23
    const bytes = arnsRecordBytes('testname', startSec, endSec);
    const readable = new SolanaARIOReadable({
      rpc: singleAccountRpc(bytes) as never,
    });

    const record = await readable.getArNSRecord({ name: 'testname' });

    assert.equal(record.type, 'lease');
    assert.equal(
      record.startTimestamp,
      startSec * 1000,
      'startTimestamp should be in milliseconds',
    );
    assert.equal(
      'endTimestamp' in record ? record.endTimestamp : undefined,
      endSec * 1000,
      'endTimestamp should be in milliseconds',
    );
  });

  it('converts permabuy startTimestamp and omits endTimestamp', async () => {
    const startSec = 1_720_000_000;
    const bytes = arnsRecordBytes('permatest', startSec, null);
    const readable = new SolanaARIOReadable({
      rpc: singleAccountRpc(bytes) as never,
    });

    const record = await readable.getArNSRecord({ name: 'permatest' });

    assert.equal(record.type, 'permabuy');
    assert.equal(
      record.startTimestamp,
      startSec * 1000,
      'startTimestamp should be in milliseconds',
    );
    assert.equal(
      'endTimestamp' in record,
      false,
      'permabuy should not have endTimestamp',
    );
  });
});
