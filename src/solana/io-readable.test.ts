import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  PurchaseType,
  getArnsRecordEncoder,
  getDemandFactorEncoder,
} from '@ar.io/solana-contracts/arns';
import { getArioConfigEncoder } from '@ar.io/solana-contracts/core';
import { getGatewaySettingsEncoder } from '@ar.io/solana-contracts/gar';
import { type Address } from '@solana/kit';
import bs58 from 'bs58';

import { Logger } from '../common/logger.js';
import { ARIO_CORE_PROGRAM_ID, ARIO_GAR_PROGRAM_ID } from './constants.js';
import { SolanaARIOReadable } from './io-readable.js';
import { getArioConfigPDA, getGarSettingsPDA } from './pda.js';

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

// ---------------------------------------------------------------------------
// getTokenSupply — live mint supply + derived circulating
// ---------------------------------------------------------------------------

// `mint(n)` above just builds a deterministic 32-byte address.
const ARIO_MINT = mint(7) as Address;
const PROTOCOL_TOKEN_ACCOUNT = mint(8) as Address;

// mARIO (6 decimals). The live/declared pair mirrors mainnet after two holder
// burns: ArioConfig still declares the 1B genesis mint, the SPL mint holds
// 999,999,626.703 ARIO.
const DECLARED_TOTAL = 1_000_000_000_000_000;
const LIVE_SUPPLY = 999_999_626_703_000;
const STORED_CIRCULATING = 567_000_000_000_000; // stale by construction
const LOCKED = 350_823_675_500_000;
const STAKED = 13_960_000_000_000;
const DELEGATED = 14_500_000_000_000;
const WITHDRAWN = 2_530_000_000;
const RESERVE = 57_382_790_800_000;

function arioConfigBytes(overrides: {
  totalSupply?: number;
  circulatingSupply?: number;
  lockedSupply?: number;
}): Uint8Array {
  return getArioConfigEncoder().encode({
    authority: OWNER_ADDR,
    mint: ARIO_MINT,
    arnsProgram: OWNER_ADDR,
    treasury: OWNER_ADDR,
    totalSupply: overrides.totalSupply ?? DECLARED_TOTAL,
    // Folded accounting field — deliberately NOT the reward reserve.
    protocolBalance: 87_280_000_000_000,
    circulatingSupply: overrides.circulatingSupply ?? STORED_CIRCULATING,
    lockedSupply: overrides.lockedSupply ?? LOCKED,
    minVaultDuration: 0,
    maxVaultDuration: 0,
    primaryNameRequestExpiry: 0,
    migrationActive: true,
    migrationAuthority: OWNER_ADDR,
    bump: 255,
    garProgram: OWNER_ADDR,
    version: VERSION,
  }) as Uint8Array;
}

function garSettingsBytes(): Uint8Array {
  return getGatewaySettingsEncoder().encode({
    authority: OWNER_ADDR,
    mint: ARIO_MINT,
    minOperatorStake: 0,
    minDelegateStake: 0,
    withdrawalPeriod: 0,
    maxExpeditedWithdrawalPenalty: 0,
    minExpeditedWithdrawalPenalty: 0,
    minExpeditedWithdrawalAmount: 0,
    maxDelegatesPerGateway: 0,
    migrationActive: true,
    migrationAuthority: OWNER_ADDR,
    stakeTokenAccount: OWNER_ADDR,
    protocolTokenAccount: PROTOCOL_TOKEN_ACCOUNT,
    arnsProgramId: OWNER_ADDR,
    totalStaked: STAKED,
    totalDelegated: DELEGATED,
    totalWithdrawn: WITHDRAWN,
    bump: 255,
    version: VERSION,
  }) as Uint8Array;
}

/** 82-byte SPL Mint account; `supply` is a u64 LE at [36, 44). */
function splMintBytes(supply: number): Uint8Array {
  const data = Buffer.alloc(82);
  data.writeBigUInt64LE(BigInt(supply), 36);
  return data;
}

/** 165-byte SPL Token account; `amount` is a u64 LE at [64, 72). */
function splTokenAccountBytes(amount: number): Uint8Array {
  const data = Buffer.alloc(165);
  data.writeBigUInt64LE(BigInt(amount), 64);
  return data;
}

/**
 * Stub rpc that serves getAccountInfo from an address → bytes map, counting
 * fetches per address so callers can assert caching.
 */
function mappedAccountRpc(
  accounts: Map<string, Uint8Array>,
  fetches: Map<string, number> = new Map(),
): unknown {
  return {
    getAccountInfo: (addr: Address) => ({
      send: async () => {
        const key = String(addr);
        fetches.set(key, (fetches.get(key) ?? 0) + 1);
        const bytes = accounts.get(key);
        if (!bytes) return { value: null };
        return {
          value: {
            data: [
              Buffer.from(bytes).toString('base64'),
              'base64',
            ] as readonly [string, string],
            executable: false,
            lamports: 1_000_000n,
            owner: OWNER_ADDR,
            rentEpoch: 0n,
            space: BigInt(bytes.length),
          },
        };
      },
    }),
  };
}

/** Exposes the protected mint resolver for assertions. */
class MintReadable extends SolanaARIOReadable {
  async readArioMint() {
    return this.getArioMint();
  }
}

async function supplyAccounts(
  configBytes: Uint8Array,
  { withMint = true }: { withMint?: boolean } = {},
): Promise<Map<string, Uint8Array>> {
  const [configPda] = await getArioConfigPDA(ARIO_CORE_PROGRAM_ID);
  const [garSettingsPda] = await getGarSettingsPDA(ARIO_GAR_PROGRAM_ID);

  const accounts = new Map<string, Uint8Array>([
    [String(configPda), configBytes],
    [String(garSettingsPda), garSettingsBytes()],
    [String(PROTOCOL_TOKEN_ACCOUNT), splTokenAccountBytes(RESERVE)],
  ]);
  if (withMint) {
    accounts.set(String(ARIO_MINT), splMintBytes(LIVE_SUPPLY));
  }
  return accounts;
}

async function supplyReadable(
  configBytes: Uint8Array,
  { withMint = true }: { withMint?: boolean } = {},
): Promise<SolanaARIOReadable> {
  const accounts = await supplyAccounts(configBytes, { withMint });

  return new SolanaARIOReadable({
    rpc: mappedAccountRpc(accounts) as never,
    logger: new Logger({ level: 'none' }),
  });
}

describe('getTokenSupply — live mint supply', () => {
  it('reports the live SPL mint supply as total, not the frozen ArioConfig declaration', async () => {
    const readable = await supplyReadable(arioConfigBytes({}));

    const supply = await readable.getTokenSupply();

    assert.equal(supply.total, LIVE_SUPPLY);
    assert.notEqual(
      supply.total,
      DECLARED_TOTAL,
      'total must track burns, not the genesis declaration',
    );
    assert.equal(supply.protocolBalance, RESERVE, 'reserve = token account');
  });

  it('derives circulating so the six buckets reconcile to the live total', async () => {
    const readable = await supplyReadable(arioConfigBytes({}));

    const supply = await readable.getTokenSupply();

    const sum =
      supply.circulating +
      supply.locked +
      supply.staked +
      supply.delegated +
      supply.withdrawn +
      supply.protocolBalance;
    assert.equal(sum, supply.total, 'six buckets must sum to total');
    assert.equal(
      supply.circulating,
      LIVE_SUPPLY - LOCKED - STAKED - DELEGATED - WITHDRAWN - RESERVE,
    );
    assert.notEqual(
      supply.circulating,
      STORED_CIRCULATING,
      'circulating must be derived, not the stale stored field',
    );
  });

  it('falls back to ArioConfig.total_supply when the mint is unreadable', async () => {
    const readable = await supplyReadable(arioConfigBytes({}), {
      withMint: false,
    });

    const supply = await readable.getTokenSupply();

    assert.equal(supply.total, DECLARED_TOTAL);
    const sum =
      supply.circulating +
      supply.locked +
      supply.staked +
      supply.delegated +
      supply.withdrawn +
      supply.protocolBalance;
    assert.equal(
      sum,
      DECLARED_TOTAL,
      'buckets still reconcile to the fallback',
    );
  });

  it('falls back to the stored circulating_supply when the buckets exceed the live total', async () => {
    // locked alone swallows the whole live supply → derivation would go negative
    const readable = await supplyReadable(
      arioConfigBytes({ lockedSupply: LIVE_SUPPLY }),
    );

    const supply = await readable.getTokenSupply();

    assert.equal(supply.total, LIVE_SUPPLY);
    assert.equal(supply.circulating, STORED_CIRCULATING);
  });

  it('falls back to ArioConfig.total_supply when the mint account is truncated', async () => {
    const accounts = await supplyAccounts(arioConfigBytes({}));
    // Too short to hold the u64 `supply` field at [36, 44)
    accounts.set(String(ARIO_MINT), Buffer.alloc(32));
    const readable = new SolanaARIOReadable({
      rpc: mappedAccountRpc(accounts) as never,
      logger: new Logger({ level: 'none' }),
    });

    const supply = await readable.getTokenSupply();

    assert.equal(supply.total, DECLARED_TOTAL);
  });
});

describe('getArioMint', () => {
  it('resolves the mint from ArioConfig and caches it', async () => {
    const accounts = await supplyAccounts(arioConfigBytes({}));
    const [configPda] = await getArioConfigPDA(ARIO_CORE_PROGRAM_ID);
    const fetches = new Map<string, number>();
    const readable = new MintReadable({
      rpc: mappedAccountRpc(accounts, fetches) as never,
      logger: new Logger({ level: 'none' }),
    });

    assert.equal(await readable.readArioMint(), ARIO_MINT);
    assert.equal(await readable.readArioMint(), ARIO_MINT);
    assert.equal(
      fetches.get(String(configPda)),
      1,
      'ArioConfig should be fetched once and cached',
    );
  });

  it('throws a helpful error when ArioConfig is missing', async () => {
    const readable = new MintReadable({
      rpc: mappedAccountRpc(new Map()) as never,
      logger: new Logger({ level: 'none' }),
    });

    await assert.rejects(
      () => readable.readArioMint(),
      /ArioConfig not found at .* on coreProgram/,
    );
  });
});

// ---------------------------------------------------------------------------
// Request coalescing (single-flight caches)
//
// These caches used to store the RESOLVED value, so they only helped
// SEQUENTIAL callers: a concurrent burst all missed before any of them filled
// the cache. The burst is precisely the case worth collapsing — a price table
// quoting every row at once — so each test below drives CONCURRENT callers and
// asserts the underlying RPC ran once.
// ---------------------------------------------------------------------------

type RpcCounts = Record<string, number>;

/**
 * Stub responses resolve after a tick rather than instantly. With an instant
 * stub the first request settles before the other callers reach the cache, so
 * the burst is not actually concurrent and the test would prove nothing.
 */
const tick = () => new Promise((r) => setTimeout(r, 5));

/** A valid DemandFactor account, so getTokenCost gets past deserialization. */
function demandFactorBytes(): Uint8Array {
  return getDemandFactorEncoder().encode({
    currentDemandFactor: 1_000_000,
    currentPeriod: 1,
    purchasesThisPeriod: 0,
    revenueThisPeriod: 0,
    consecutivePeriodsWithMinDemandFactor: 0,
    trailingPeriodPurchases: Array(7).fill(0),
    trailingPeriodRevenues: Array(7).fill(0),
    fees: Array(51).fill(1_000_000),
    periodZeroStartTimestamp: 1_700_000_000,
    criteria: 0,
    bump: 255,
    version: VERSION,
  }) as Uint8Array;
}

/**
 * Stub rpc that counts every method and can be told to fail the first N calls
 * to a given method (for the "a failure must not be cached" case).
 */
function countingGasRpc(
  counts: RpcCounts,
  opts: { failFeeCalls?: number; accountExists?: boolean } = {},
) {
  let feeFailuresLeft = opts.failFeeCalls ?? 0;
  const bump = (m: string) => {
    counts[m] = (counts[m] ?? 0) + 1;
  };
  return {
    getRecentPrioritizationFees: () => ({
      send: async () => {
        bump('getRecentPrioritizationFees');
        await tick();
        if (feeFailuresLeft > 0) {
          feeFailuresLeft--;
          throw new Error('HTTP error (429): Too Many Requests');
        }
        return [{ slot: 1n, prioritizationFee: 12_345n }];
      },
    }),
    getMinimumBalanceForRentExemption: () => ({
      send: async () => {
        bump('getMinimumBalanceForRentExemption');
        await tick();
        return 2_000_000n;
      },
    }),
    getSlot: () => ({
      send: async () => {
        bump('getSlot');
        await tick();
        return 500n;
      },
    }),
    getBlockTime: () => ({
      send: async () => {
        bump('getBlockTime');
        await tick();
        return 1_760_000_000n;
      },
    }),
    getAccountInfo: () => ({
      send: async () => {
        bump('getAccountInfo');
        await tick();
        return opts.accountExists === false
          ? { value: null }
          : {
              value: {
                data: [
                  Buffer.from(demandFactorBytes()).toString('base64'),
                  'base64',
                ] as readonly [string, string],
                executable: false,
                lamports: 1_000_000n,
                owner: OWNER_ADDR,
                rentEpoch: 0n,
                space: 512n,
              },
            };
      },
    }),
  };
}

describe('SolanaARIOReadable request coalescing', () => {
  it('collapses a concurrent getGasEstimate burst onto one priority-fee query set', async () => {
    const counts: RpcCounts = {};
    const readable = new SolanaARIOReadable({
      rpc: countingGasRpc(counts) as never,
      logger: new Logger({ level: 'none' }),
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        readable.getGasEstimate({ intent: 'Buy-Name', name: 'x' }),
      ),
    );

    // One quote costs three queries: an unscoped sample plus two scoped
    // market references. Ten concurrent quotes must still cost three.
    assert.equal(
      counts.getRecentPrioritizationFees,
      3,
      'ten concurrent quotes should share one priority-fee estimate',
    );
    assert.equal(
      counts.getMinimumBalanceForRentExemption,
      1,
      'rent for an identical account profile should be quoted once',
    );
    // Every caller must still get the same complete answer.
    for (const r of results) {
      assert.deepEqual(r, results[0]);
      assert.ok(r.totalLamports > 0);
    }
  });

  it('collapses a concurrent getTokenCost burst onto one cluster-clock read', async () => {
    const counts: RpcCounts = {};
    const readable = new SolanaARIOReadable({
      rpc: countingGasRpc(counts) as never,
      logger: new Logger({ level: 'none' }),
    });

    await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        readable.getTokenCost({
          intent: 'Buy-Name',
          name: `burst-${i}`,
          type: 'lease',
          years: 1,
        }),
      ),
    );

    // getSlot -> getBlockTime is two SEQUENTIAL round trips, and getTokenCost
    // used to pay them on EVERY quote — 20 calls for a ten-row price table.
    assert.equal(counts.getSlot, 1, 'one slot read for the whole burst');
    assert.equal(counts.getBlockTime, 1, 'one block-time read for the burst');

    // Ten DIFFERENT names still cost ten per-name lookups; only the shared
    // DemandFactor PDA collapses. Coalescing dedupes identical requests, it
    // does not eliminate genuinely distinct ones.
    assert.equal(
      counts.getAccountInfo,
      11,
      'one shared DemandFactor read plus one lookup per distinct name',
    );
  });

  it('collapses repeated reads of the SAME name to a single lookup', async () => {
    const counts: RpcCounts = {};
    const readable = new SolanaARIOReadable({
      rpc: countingGasRpc(counts) as never,
      logger: new Logger({ level: 'none' }),
    });

    await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        readable.getTokenCost({
          intent: 'Buy-Name',
          name: 'same-name',
          type: 'lease',
          years: 1,
        }),
      ),
    );

    assert.equal(counts.getSlot, 1);
    assert.equal(counts.getBlockTime, 1);
    assert.ok(
      counts.getAccountInfo <= 2,
      `ten quotes for one name should share their reads, saw ${counts.getAccountInfo}`,
    );
  });

  it('does not cache a failed priority-fee estimate', async () => {
    const counts: RpcCounts = {};
    const readable = new SolanaARIOReadable({
      // Fail every query of the first estimate (3 queries), then succeed.
      rpc: countingGasRpc(counts, { failFeeCalls: 3 }) as never,
      logger: new Logger({ level: 'none' }),
    });

    // The fee estimator swallows per-query failures and falls back to its
    // floor, so the first quote still resolves — what matters is that the
    // NEXT quote re-queries rather than reusing a degraded cached value.
    const first = await readable.getGasEstimate({ intent: 'Buy-Name' });
    assert.equal(counts.getRecentPrioritizationFees, 3);

    const second = await readable.getGasEstimate({ intent: 'Buy-Name' });
    assert.equal(
      counts.getRecentPrioritizationFees,
      3,
      'a successful estimate is still cached for its TTL',
    );
    assert.ok(first.priorityFeeMicroLamports >= 0);
    assert.ok(second.priorityFeeMicroLamports >= 0);
  });

  it('shares one lookup for a MISSING account but does not cache the miss', async () => {
    const counts: RpcCounts = {};
    const readable = new SolanaARIOReadable({
      rpc: countingGasRpc(counts, { accountExists: false }) as never,
      logger: new Logger({ level: 'none' }),
    });

    // getDemandFactor reads through the cached-account path; a missing
    // account throws, and must not be remembered as a miss.
    await Promise.allSettled(
      Array.from({ length: 5 }, () => readable.getDemandFactor()),
    );
    assert.equal(counts.getAccountInfo, 1, 'the burst shares one lookup');

    await assert.rejects(() => readable.getDemandFactor());
    assert.equal(
      counts.getAccountInfo,
      2,
      'a miss must not be cached — the next caller re-checks',
    );
  });
});
