import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

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
