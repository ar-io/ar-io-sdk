import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import bs58 from 'bs58';

import { Logger } from '../common/logger.js';
import { SolanaANTReadable } from './ant-readable.js';
import {
  antRecordBytes,
  estimateRentLamports,
  getIntentGasProfile,
} from './gas.js';
import { SolanaARIOReadable } from './io-readable.js';
import {
  BASE_FEE_LAMPORTS_PER_SIGNATURE,
  DEFAULT_COMPUTE_UNIT_LIMIT,
  estimateGasFee,
} from './send.js';

const RENT_PER_BYTE = 6960n;

function stubRpc(
  opts: {
    fees?: number[] | 'throws';
    /** fees returned for the address-scoped (wallet market) query */
    scopedFees?: number[];
    rentThrows?: boolean;
    /** lamports per account returned by getMultipleAccounts (null = missing) */
    accountLamports?: (number | null)[];
  } = {},
  counts = { feeCalls: 0, rentCalls: 0, accountCalls: 0 },
): { rpc: unknown; counts: typeof counts } {
  return {
    counts,
    rpc: {
      getRecentPrioritizationFees: (addresses?: unknown[]) => ({
        send: async () => {
          counts.feeCalls++;
          if (opts.fees === 'throws') throw new Error('rpc down');
          const fees = addresses
            ? (opts.scopedFees ?? opts.fees ?? [])
            : (opts.fees ?? []);
          return fees.map((prioritizationFee) => ({
            prioritizationFee,
            slot: 1n,
          }));
        },
      }),
      getMinimumBalanceForRentExemption: (bytes: bigint) => ({
        send: async () => {
          counts.rentCalls++;
          if (opts.rentThrows) throw new Error('rpc down');
          return (128n + bytes) * RENT_PER_BYTE;
        },
      }),
      getAccountInfo: () => ({
        send: async () => {
          counts.accountCalls++;
          return { value: null }; // no ACL config / primary name
        },
      }),
      getMultipleAccounts: (addrs: unknown[]) => ({
        send: async () => ({
          value: addrs.map((_, i) => {
            const lamports = opts.accountLamports?.[i] ?? null;
            return lamports === null
              ? null
              : {
                  lamports: BigInt(lamports),
                  data: ['', 'base64'],
                  owner: '11111111111111111111111111111111',
                  executable: false,
                  rentEpoch: 0n,
                  space: 0n,
                };
          }),
        }),
      }),
    },
  };
}

describe('estimateGasFee', () => {
  it('quotes fees + rent with a pinned compute-unit price', async () => {
    const { rpc, counts } = stubRpc({ fees: 'throws' });
    const quote = await estimateGasFee(rpc as never, {
      priorityFeeMicroLamports: 250_000,
      signatureCount: 3,
      transactionCount: 2,
      rentLamports: 12_000_000,
    });
    // per-tx priority: 400k CU × 250_000 µ◎/CU / 1e6 = 100_000 lamports
    assert.equal(quote.priorityFeeLamports, 200_000);
    assert.equal(quote.baseFeeLamports, 3 * BASE_FEE_LAMPORTS_PER_SIGNATURE);
    assert.equal(quote.feeLamports, 215_000);
    assert.equal(quote.rentLamports, 12_000_000);
    assert.equal(quote.totalLamports, 12_215_000);
    assert.equal(quote.computeUnitLimit, DEFAULT_COMPUTE_UNIT_LIMIT);
    assert.equal(quote.priorityFeeMicroLamports, 250_000);
    assert.equal(quote.transactionCount, 2);
    assert.equal(counts.feeCalls, 0, 'pinned price must not query the rpc');
  });

  it('rounds the per-transaction priority fee up to whole lamports', async () => {
    const { rpc } = stubRpc({ fees: 'throws' });
    const quote = await estimateGasFee(rpc as never, {
      computeUnitLimit: 1,
      priorityFeeMicroLamports: 1n,
      transactionCount: 2,
    });
    // 1 CU × 1 µ◎/CU is a fraction of a lamport — the runtime charges 1 per tx.
    assert.equal(quote.priorityFeeLamports, 2);
  });

  it('estimates the compute-unit price from recent on-chain fees', async () => {
    const { rpc } = stubRpc({
      fees: [20_000, 50_000, 30_000, 40_000],
      scopedFees: [],
    });
    const quote = await estimateGasFee(rpc as never);
    // p75 of the sorted non-zero fees is 50_000 µ◎/CU.
    assert.equal(quote.priorityFeeMicroLamports, 50_000);
    assert.equal(quote.priorityFeeLamports, 20_000); // 400k × 50_000 / 1e6
    assert.equal(quote.rentLamports, 0);
    assert.equal(quote.totalLamports, BASE_FEE_LAMPORTS_PER_SIGNATURE + 20_000);
  });

  it('falls back to the floor price when the fee query fails', async () => {
    const { rpc } = stubRpc({ fees: 'throws' });
    const quote = await estimateGasFee(rpc as never);
    assert.equal(quote.priorityFeeMicroLamports, 10_000);
    assert.equal(quote.priorityFeeLamports, 4_000); // 400k × 10_000 / 1e6
  });

  it('quotes the wallet market rate when it exceeds the base estimate', async () => {
    // Global per-slot minimums are quiet, but the busy-reference (wallet)
    // queries report what fee-paying transactions actually attach — the
    // quote must cover the wallet rate, since that's what Phantom charges.
    const { rpc } = stubRpc({
      fees: [20_000],
      scopedFees: [400_000, 500_000, 600_000],
    });
    const quote = await estimateGasFee(rpc as never);
    // pooled p85 (600_000) shrunk toward the 500_000 prior → 550_000,
    // which wins over the global p75 (20_000)
    assert.equal(quote.priorityFeeMicroLamports, 550_000);
    assert.equal(quote.priorityFeeLamports, 220_000); // 400k × 550_000 / 1e6
  });

  it('keeps the floor on clusters with no fee market (devnet)', async () => {
    const { rpc } = stubRpc({ fees: [], scopedFees: [] });
    const quote = await estimateGasFee(rpc as never);
    // no fee-paying slots anywhere → floor, NOT the wallet prior
    assert.equal(quote.priorityFeeMicroLamports, 10_000);
  });
});

describe('getIntentGasProfile', () => {
  it('models Buy-Name as spawn + buy with the spawned account set', () => {
    const profile = getIntentGasProfile({
      intent: 'Buy-Name',
      name: 'brandybuck35', // 12 chars — matches the mainnet measurement
    });
    assert.equal(profile.transactionCount, 2);
    assert.equal(profile.signatureCount, 3);
    // asset, antConfig, antControllers, rootRecord, arnsRecord
    assert.deepEqual(profile.accountBytes, [302, 452, 176, 316, 191]);
  });

  it('adds ACL bootstrap accounts for first-time buyers', () => {
    const profile = getIntentGasProfile({
      intent: 'Buy-Name',
      name: 'brandybuck35',
      needsAclBootstrap: true,
    });
    assert.deepEqual(profile.accountBytes, [302, 452, 176, 316, 191, 60, 8504]);
  });

  it('models mutate-in-place intents as a single free-rent transaction', () => {
    for (const intent of [
      'Extend-Lease',
      'Upgrade-Name',
      'Increase-Undername-Limit',
    ] as const) {
      const profile = getIntentGasProfile({ intent, name: 'x' });
      assert.deepEqual(profile, {
        transactionCount: 1,
        signatureCount: 1,
        accountBytes: [],
      });
    }
  });

  it('models Primary-Name-Request as request + approve', () => {
    const profile = getIntentGasProfile({
      intent: 'Primary-Name-Request',
      name: 'amsterdam-trip', // 14 chars — matches the mainnet measurement
      needsPrimaryNameAccount: true,
    });
    assert.equal(profile.transactionCount, 2);
    // transient request PDA + the PrimaryName account itself
    assert.deepEqual(profile.accountBytes, [119, 119]);
  });
});

describe('estimateRentLamports', () => {
  it('collapses N accounts into one rent-exemption query', async () => {
    const { rpc, counts } = stubRpc();
    const rent = await estimateRentLamports(rpc as never, [302, 452, 176]);
    // Σbytes + 128×(N−1) = 930 + 256; quote adds the final 128 overhead.
    assert.equal(rent, Number((128n + 1186n) * RENT_PER_BYTE));
    assert.equal(counts.rentCalls, 1);
  });

  it('returns 0 for intents that create no accounts', async () => {
    const { rpc, counts } = stubRpc();
    assert.equal(await estimateRentLamports(rpc as never, []), 0);
    assert.equal(counts.rentCalls, 0);
  });

  it('falls back to the protocol-constant formula when the rpc fails', async () => {
    const { rpc } = stubRpc({ rentThrows: true });
    const rent = await estimateRentLamports(rpc as never, [100]);
    assert.equal(rent, Number((128n + 100n) * RENT_PER_BYTE));
  });
});

describe('SolanaARIOReadable.getGasEstimate', () => {
  it('includes ANT spawn + record rent for Buy-Name and memoizes queries', async () => {
    const { rpc, counts } = stubRpc({ fees: [100_000], scopedFees: [] });
    const readable = new SolanaARIOReadable({
      rpc: rpc as never,
      logger: new Logger({ level: 'none' }),
    });

    const quote = await readable.getGasEstimate({
      intent: 'Buy-Name',
      name: 'brandybuck35',
    });
    // No fromAddress → conservatively assumes first-time buyer (ACL incl.)
    const bytes = 302 + 452 + 176 + 316 + 191 + 60 + 8504 + 128 * 6;
    assert.equal(quote.rentLamports, Number((128n + BigInt(bytes)) * 6960n));
    assert.equal(quote.transactionCount, 2);
    assert.equal(quote.signatureCount, 3);
    assert.equal(quote.totalLamports, quote.feeLamports + quote.rentLamports);

    const second = await readable.getGasEstimate({
      intent: 'Buy-Name',
      name: 'brandybuck35',
    });
    // one refresh = three queries (global + two wallet-market references)
    assert.equal(counts.feeCalls, 3, 'priority fee memoized within TTL');
    assert.equal(counts.rentCalls, 1, 'rent memoized per byte size');
    assert.equal(second.totalLamports, quote.totalLamports);
  });

  it('quotes a single cheap transaction for Extend-Lease', async () => {
    const { rpc } = stubRpc({ fees: [100_000], scopedFees: [] });
    const readable = new SolanaARIOReadable({
      rpc: rpc as never,
      logger: new Logger({ level: 'none' }),
    });
    const quote = await readable.getGasEstimate({
      intent: 'Extend-Lease',
      name: 'brandybuck35',
    });
    assert.equal(quote.rentLamports, 0);
    assert.equal(quote.transactionCount, 1);
    assert.equal(quote.signatureCount, 1);
    assert.equal(
      quote.totalLamports,
      BASE_FEE_LAMPORTS_PER_SIGNATURE + 40_000, // 400k × 100_000 µ◎ / 1e6
    );
  });
});

describe('SolanaANTReadable.getGasEstimate', () => {
  function makeAnt(rpc: unknown) {
    return new SolanaANTReadable({
      rpc: rpc as never,
      processId: bs58.encode(Buffer.alloc(32, 7)),
      logger: new Logger({ level: 'none' }),
    });
  }

  it('reports the live record deposit as reclaimed rent on remove-record', async () => {
    const { rpc } = stubRpc({
      fees: [100_000],
      scopedFees: [],
      // record account holds 3_090_240 lamports; no metadata PDA
      accountLamports: [3_090_240, null],
    });
    const quote = await makeAnt(rpc).getGasEstimate({
      workflow: 'remove-record',
      undername: 'docs',
    });
    assert.equal(quote.rentReclaimedLamports, 3_090_240);
    assert.equal(quote.rentLamports, 0);
    // upfront need is fees only; the refund is reported, not netted
    assert.equal(quote.totalLamports, BASE_FEE_LAMPORTS_PER_SIGNATURE + 40_000);
  });

  it('quotes record rent for set-record', async () => {
    const { rpc } = stubRpc({ fees: [100_000], scopedFees: [] });
    const quote = await makeAnt(rpc).getGasEstimate({
      workflow: 'set-record',
      undername: 'docs',
    });
    const expectedRent = Number(
      (128n + BigInt(antRecordBytes('docs'.length))) * RENT_PER_BYTE,
    );
    assert.equal(quote.rentLamports, expectedRent);
    assert.equal(quote.rentReclaimedLamports, 0);
    assert.equal(quote.totalLamports, quote.feeLamports + expectedRent);
  });

  it('quotes the recipient ACL bootstrap for transfers to fresh wallets', async () => {
    const { rpc } = stubRpc({ fees: [100_000], scopedFees: [] }); // getAccountInfo → null
    const quote = await makeAnt(rpc).getGasEstimate({
      workflow: 'transfer',
      recipient: bs58.encode(Buffer.alloc(32, 9)),
    });
    // aclConfig(60) + aclPage(8504) + inter-account overhead(128)
    const expectedRent = Number((128n + 8692n) * RENT_PER_BYTE);
    assert.equal(quote.rentLamports, expectedRent);
  });

  it('quotes fees only for reassign-name', async () => {
    const { rpc } = stubRpc({ fees: [100_000], scopedFees: [] });
    const quote = await makeAnt(rpc).getGasEstimate({
      workflow: 'reassign-name',
    });
    assert.equal(quote.rentLamports, 0);
    assert.equal(quote.rentReclaimedLamports, 0);
    assert.equal(quote.transactionCount, 1);
  });
});
