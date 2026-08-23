/**
 * Unit tests for the Lua-faithful, multi-gateway funding-plan builder.
 *
 * The planner is a pure function over `DiscoveredFundingSource[]` — these
 * tests exercise the decision matrix without standing up a Solana RPC.
 *
 * Cross-references gar.lua:
 *   - planBalanceDrawdown      (line 1456) — balance picked first
 *   - planVaultsDrawdown       (line 1510) — withdrawals oldest-first
 *   - planExcessStakesDrawdown (line 1559) — delegations drained excess across gateways
 *   - planMinimumStakesDrawdown(line 1585) — sub-min residue auto-vault per gateway
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address } from '@solana/kit';
import bs58 from 'bs58';

import {
  type DiscoveredFundingSource,
  MAX_DELEGATION_SOURCES,
  MAX_FUNDING_SOURCES,
  buildFundingPlan,
  computeResidueIndexes,
  discoverFundingSources,
} from './funding-plan.js';

const GATEWAY_A = 'GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
const GATEWAY_B = 'GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address;
const GATEWAY_C = 'GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as Address;
const GATEWAY_D = 'GatewayDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' as Address;

function balance(amount: bigint): DiscoveredFundingSource {
  return { kind: 'balance', available: amount };
}
function withdrawal(
  withdrawalId: bigint,
  amount: bigint,
  availableAt: bigint = 1_000n,
  gateway: Address = GATEWAY_A,
): DiscoveredFundingSource {
  return {
    kind: 'withdrawal',
    withdrawalId,
    gateway,
    available: amount,
    availableAt,
  };
}
function delegation(
  amount: bigint,
  gateway: Address = GATEWAY_A,
  minDelegationAmount: bigint = 10_000_000n,
): DiscoveredFundingSource {
  return {
    kind: 'delegation',
    gateway,
    available: amount,
    minDelegationAmount,
    performanceRatio: 1.0,
    totalDelegatedStake: amount,
    startTimestamp: 0n,
  };
}

describe('buildFundingPlan', () => {
  it("returns a balance-only plan when balance covers under fundFrom='balance'", () => {
    const plan = buildFundingPlan([balance(100n)], 50n, {
      fundFrom: 'balance',
    });
    if ('kind' in plan) throw new Error('expected a successful plan');
    assert.equal(plan.sources.length, 1);
    assert.deepEqual(plan.sources[0], { kind: 'balance', amount: 50n });
    assert.deepEqual(plan.gatewayPerSource, [undefined]);
    assert.deepEqual(plan.residueDelegationIndexes, []);
  });

  it("returns InsufficientFunding when balance falls short under 'balance' mode", () => {
    const result = buildFundingPlan([balance(40n)], 50n, {
      fundFrom: 'balance',
    });
    if (!('kind' in result)) throw new Error('expected error');
    assert.equal(result.kind, 'InsufficientFunding');
    assert.equal(result.shortfall, 10n);
  });

  it("composes balance + withdrawal under 'any' mode (Lua-faithful order)", () => {
    const plan = buildFundingPlan([balance(20n), withdrawal(0n, 100n)], 50n, {
      fundFrom: 'any',
    });
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.length, 2);
    assert.deepEqual(plan.sources[0], { kind: 'balance', amount: 20n });
    assert.deepEqual(plan.sources[1], {
      kind: 'withdrawal',
      amount: 30n,
      withdrawalId: 0n,
    });
    assert.equal(plan.hasBalanceSource, true);
  });

  it('drains withdrawals oldest-first (asc by availableAt) and carries withdrawalId per source', () => {
    const plan = buildFundingPlan(
      [
        withdrawal(2n, 100n, 5_000n), // newest
        withdrawal(0n, 100n, 1_000n), // oldest
        withdrawal(1n, 100n, 3_000n),
      ],
      150n,
      { fundFrom: 'any' },
    );
    if ('kind' in plan) throw new Error('expected plan');
    // Should drain oldest (id=0) entirely + middle (id=1) partially.
    assert.equal(plan.sources.length, 2);
    assert.deepEqual(plan.sources[0], {
      kind: 'withdrawal',
      amount: 100n,
      withdrawalId: 0n,
    });
    assert.deepEqual(plan.sources[1], {
      kind: 'withdrawal',
      amount: 50n,
      withdrawalId: 1n,
    });
  });

  it("composes balance + withdrawal + delegation when both stakes are needed under 'any'", () => {
    const plan = buildFundingPlan(
      [
        balance(10n),
        withdrawal(0n, 50n, 1_000n),
        delegation(100_000_000n), // 100 ARIO available; 10 ARIO min
      ],
      40_000_000n,
      { fundFrom: 'any', preferGateway: GATEWAY_A },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.length, 3);
    assert.equal(plan.sources[0].kind, 'balance');
    assert.equal(plan.sources[1].kind, 'withdrawal');
    assert.equal(plan.sources[2].kind, 'delegation');
    assert.equal(plan.gatewayPerSource[2], GATEWAY_A);
    assert.equal(plan.hasBalanceSource, true);
  });

  it('marks residueDelegationIndexes when delegation drains to sub-min', () => {
    // Stake 15 ARIO, draw 10 ARIO, residue 5 ARIO < min 10 ARIO → residue vault.
    const plan = buildFundingPlan(
      [delegation(15_000_000n, GATEWAY_A, 10_000_000n)],
      10_000_000n,
      { fundFrom: 'any', preferGateway: GATEWAY_A },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.deepEqual(plan.residueDelegationIndexes, [0]);
    assert.equal(plan.sources[0].kind, 'delegation');
    assert.equal(plan.sources[0].amount, 10_000_000n);
  });

  it('does NOT mark residueDelegationIndexes when delegation drains to ≥ min', () => {
    const plan = buildFundingPlan(
      [delegation(50_000_000n, GATEWAY_A, 10_000_000n)],
      30_000_000n,
      { fundFrom: 'any', preferGateway: GATEWAY_A },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.deepEqual(plan.residueDelegationIndexes, []);
  });

  it('preferGateway is consumed first; remaining stake comes from other gateways', () => {
    // Need 15M; GATEWAY_A has 20M (10M excess), GATEWAY_B has 20M (10M excess).
    // preferGateway=A → 10M excess from A, then 5M more excess from B.
    const plan = buildFundingPlan(
      [
        delegation(20_000_000n, GATEWAY_A, 10_000_000n),
        delegation(20_000_000n, GATEWAY_B, 10_000_000n),
      ],
      15_000_000n,
      { fundFrom: 'any', preferGateway: GATEWAY_A },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.filter((s) => s.kind === 'delegation').length, 2);
    // First delegation is GATEWAY_A (preferred), second is GATEWAY_B.
    const delegations = plan.sources
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.kind === 'delegation');
    assert.equal(plan.gatewayPerSource[delegations[0].i], GATEWAY_A);
    assert.equal(plan.gatewayPerSource[delegations[1].i], GATEWAY_B);
  });

  it('excludes operator-stake by default (Lua parity)', () => {
    const sources: DiscoveredFundingSource[] = [
      {
        kind: 'operatorStake',
        gateway: GATEWAY_A,
        available: 100_000_000_000n,
        minOperatorStake: 20_000_000_000n,
      },
    ];
    const result = buildFundingPlan(sources, 1_000_000n, {
      fundFrom: 'any',
      preferGateway: GATEWAY_A,
    });
    // Without fundAsOperator: operator stake isn't drawn → InsufficientFunding.
    if (!('kind' in result)) throw new Error('expected error');
    assert.equal(result.kind, 'InsufficientFunding');
  });

  it('includes operator-stake when fundAsOperator: true (Solana extension)', () => {
    const plan = buildFundingPlan(
      [
        {
          kind: 'operatorStake',
          gateway: GATEWAY_A,
          available: 100_000_000_000n,
          minOperatorStake: 20_000_000_000n,
        },
      ],
      1_000_000_000n,
      { fundFrom: 'any', preferGateway: GATEWAY_A, fundAsOperator: true },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.length, 1);
    assert.equal(plan.sources[0].kind, 'operatorStake');
    assert.equal(plan.gatewayPerSource[0], GATEWAY_A);
  });

  it('rejects plans that exceed MAX_FUNDING_SOURCES', () => {
    // Build many small withdrawals — planner caps source iteration at
    // MAX_FUNDING_SOURCES (5). With 5 × 1 = 5 covered, shortfall = 7.
    const sources: DiscoveredFundingSource[] = [];
    for (let i = 0; i < 12; i++)
      sources.push(withdrawal(BigInt(i), 1n, BigInt(i)));
    const result = buildFundingPlan(sources, 12n, { fundFrom: 'any' });
    if (!('kind' in result)) throw new Error('expected error');
    assert.equal(result.kind, 'InsufficientFunding');
    assert.equal(result.shortfall, 12n - BigInt(MAX_FUNDING_SOURCES));
  });

  it('InsufficientFunding error includes available-source summary', () => {
    const result = buildFundingPlan([balance(10n)], 100n, { fundFrom: 'any' });
    if (!('kind' in result)) throw new Error('expected error');
    assert.equal(result.kind, 'InsufficientFunding');
    assert.equal(result.amountNeeded, 100n);
    assert.equal(result.shortfall, 90n);
    assert.match(result.message, /balance=10/);
  });

  it("returns balance-only plan under 'plan' mode + explicit balance source", () => {
    const plan = buildFundingPlan([balance(100n)], 50n, { fundFrom: 'plan' });
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.length, 1);
    assert.deepEqual(plan.sources[0], { kind: 'balance', amount: 50n });
  });

  it("under 'withdrawal' mode draws vaults only (no balance, no delegation)", () => {
    // Solana extension: 'withdrawal' is a vault-only path. The picker
    // skips both the balance gate and the delegation passes. Confirms
    // the mode ignores a delegation that COULD cover the shortfall.
    const result = buildFundingPlan(
      [withdrawal(0n, 30n, 1_000n), delegation(100n)],
      50n,
      { fundFrom: 'withdrawal' },
    );
    if (!('kind' in result)) throw new Error('expected error');
    assert.equal(result.shortfall, 20n);
  });

  it("under 'stakes' mode draws vaults + delegations (Lua parity)", () => {
    // gar.lua:1437 invokes planVaultsDrawdown unconditionally after the
    // balance gate; only "balance" mode short-circuits. Pre-2026-05 the
    // SDK gated vaults behind `fundFrom !== 'stakes'`, so a delegator
    // with both matured vaults and active delegations would erode their
    // delegations instead of cleaning out matured vaults first.
    //
    // Need 30M. Has a 10M vault + a 100M delegation. Plan must drain the
    // vault first (cheaper, no residue risk) then take 20M from delegation.
    const plan = buildFundingPlan(
      [
        withdrawal(0n, 10_000_000n, 1_000n),
        delegation(100_000_000n, GATEWAY_A, 10_000_000n),
      ],
      30_000_000n,
      { fundFrom: 'stakes' },
    );
    if ('kind' in plan) throw new Error('expected plan');
    // First source must be the vault (Lua-faithful drawdown order).
    assert.equal(plan.sources[0].kind, 'withdrawal');
    assert.equal(plan.sources[0].amount, 10_000_000n);
    // Second source is the delegation covering the remaining 20M.
    assert.equal(plan.sources[1].kind, 'delegation');
    assert.equal(plan.sources[1].amount, 20_000_000n);
    assert.equal(plan.gatewayPerSource[1], GATEWAY_A);
    assert.equal(plan.hasBalanceSource, false);
  });

  it("under 'stakes' mode skips balance even when balance exists", () => {
    // 'stakes' must NOT touch the user's wallet balance — that's the
    // semantic the user opts into. The vault gets drawn after the
    // (skipped) balance gate, mirroring Lua's planBalanceDrawdown +
    // planVaultsDrawdown sequence.
    const plan = buildFundingPlan(
      [balance(100_000_000n), withdrawal(0n, 50_000_000n, 1_000n)],
      30_000_000n,
      { fundFrom: 'stakes' },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.length, 1);
    assert.equal(plan.sources[0].kind, 'withdrawal');
    assert.equal(plan.hasBalanceSource, false);
  });

  it('Stage 4 floor-pass: re-sorts by performanceRatio asc (Lua parity)', () => {
    // Lua gar.lua:1587-1600 re-sorts before draining floors:
    //   perf asc, totalDelegated desc, startTimestamp desc.
    // Stage 3 sorts by excess desc primarily, so without the re-sort,
    // floors get drained from gateways that already had high excess —
    // the opposite of "concentrate residue on bad gateways."
    //
    // Setup: two gateways, neither has excess (both at min). The min-pass
    // must drain the worst-performing gateway's floor first.
    const lowPerfGateway: DiscoveredFundingSource = {
      kind: 'delegation',
      gateway: GATEWAY_A,
      available: 10_000_000n, // = min, no excess
      minDelegationAmount: 10_000_000n,
      performanceRatio: 0.5, // worse perf
      totalDelegatedStake: 10_000_000n,
      startTimestamp: 0n,
    };
    const highPerfGateway: DiscoveredFundingSource = {
      kind: 'delegation',
      gateway: GATEWAY_B,
      available: 10_000_000n,
      minDelegationAmount: 10_000_000n,
      performanceRatio: 1.0, // perfect
      totalDelegatedStake: 10_000_000n,
      startTimestamp: 0n,
    };
    // Need 5M, satisfiable from a single gateway's floor — so the
    // *first* gateway drained reveals the iteration order.
    const plan = buildFundingPlan(
      [highPerfGateway, lowPerfGateway],
      5_000_000n,
      { fundFrom: 'any' },
    );
    if ('kind' in plan) throw new Error('expected plan');
    assert.equal(plan.sources.length, 1);
    assert.equal(plan.sources[0].kind, 'delegation');
    // Lua-faithful: bad-perf gateway drained first.
    assert.equal(
      plan.gatewayPerSource[0],
      GATEWAY_A,
      'floor pass must drain low-performance gateway before high-performance',
    );
  });

  // ----- multi-gateway specific tests -----

  it('multi-gateway: drains excess across two gateways', () => {
    // Need 16M. GATEWAY_A has 12M (2M excess), GATEWAY_B has 15M (5M excess).
    // Planner sorts by excess desc → B first (5M excess) then A (2M).
    // Total excess = 7M. Then min-pass drains 9M more (5M+5M = 10M from
    // GATEWAY_B floor consumed first since it's first in iteration order; A
    // floor takes the rest of the 9M? Actually the planner iterates ordered
    // delegations, so B's min is drawn first — let's verify the totals.
    const plan = buildFundingPlan(
      [
        delegation(15_000_000n, GATEWAY_B, 10_000_000n),
        delegation(12_000_000n, GATEWAY_A, 10_000_000n),
      ],
      16_000_000n,
      { fundFrom: 'any' },
    );
    if ('kind' in plan) throw new Error('expected plan');
    // Expect 2 delegation sources covering exactly 16M total.
    const totalDraw = plan.sources
      .filter((s) => s.kind === 'delegation')
      .reduce((acc, s) => acc + s.amount, 0n);
    assert.equal(totalDraw, 16_000_000n);
    // Both gateways must show up in gatewayPerSource for their delegation slots.
    const gateways = new Set<Address | undefined>();
    plan.sources.forEach((s, i) => {
      if (s.kind === 'delegation') gateways.add(plan.gatewayPerSource[i]);
    });
    assert.ok(gateways.has(GATEWAY_A));
    assert.ok(gateways.has(GATEWAY_B));
  });

  it('multi-gateway: produces N residue PDAs (one per touched gateway draining sub-min)', () => {
    // GATEWAY_A: 12M, min 10M → 2M excess + 2M floor draw → residue 8M < 10M = residue
    // GATEWAY_B: 12M, min 10M → 2M excess + 2M floor draw → residue 8M < 10M = residue
    // Need 8M. Excess pass: 2M from each = 4M. Min pass: 4M more from one
    // (or split). Either way at least one gateway goes sub-min.
    const plan = buildFundingPlan(
      [
        delegation(12_000_000n, GATEWAY_A, 10_000_000n),
        delegation(12_000_000n, GATEWAY_B, 10_000_000n),
      ],
      8_000_000n,
      { fundFrom: 'any', preferGateway: GATEWAY_A },
    );
    if ('kind' in plan) throw new Error('expected plan');
    // At least one residue vault expected since the plan must dip below
    // min on at least one gateway.
    assert.ok(plan.residueDelegationIndexes.length >= 1);
  });

  it('multi-gateway: caps Delegation sources at MAX_DELEGATION_SOURCES', () => {
    // Build 4 small delegations on 4 distinct gateways, all with excess.
    // The planner can use at most MAX_DELEGATION_SOURCES (3) gateways.
    const sources: DiscoveredFundingSource[] = [
      delegation(15_000_000n, GATEWAY_A, 10_000_000n),
      delegation(15_000_000n, GATEWAY_B, 10_000_000n),
      delegation(15_000_000n, GATEWAY_C, 10_000_000n),
      delegation(15_000_000n, GATEWAY_D, 10_000_000n),
    ];
    // Need 30M — comfortably fits in 3 gateways' total available (45M).
    const plan = buildFundingPlan(sources, 30_000_000n, { fundFrom: 'any' });
    if ('kind' in plan) throw new Error('expected plan');
    const gateways = new Set<Address>();
    plan.sources.forEach((s, i) => {
      if (s.kind === 'delegation') {
        const g = plan.gatewayPerSource[i];
        if (g) gateways.add(g);
      }
    });
    assert.ok(gateways.size <= MAX_DELEGATION_SOURCES);
  });

  it('multi-gateway: rejects plan that needs > MAX_DELEGATION_SOURCES gateways', () => {
    // Each gateway has only 5M excess. Need 16M → would need 4 gateways.
    const sources: DiscoveredFundingSource[] = [
      delegation(15_000_000n, GATEWAY_A, 10_000_000n),
      delegation(15_000_000n, GATEWAY_B, 10_000_000n),
      delegation(15_000_000n, GATEWAY_C, 10_000_000n),
      delegation(15_000_000n, GATEWAY_D, 10_000_000n),
    ];
    // Need 31M — requires excess from all 4 (5M × 4 = 20M) + floor from
    // multiple. With cap=3 we can only touch 3 gateways → max draw 45M
    // is fine but with planner stopping at 3 gateways, the test expects
    // shortfall iff 3-gateway total < 31M. 3 gateways × 15M = 45M, so it
    // fits. Shrink the per-gateway available so 3 gateways ≠ enough.
    const tightSources: DiscoveredFundingSource[] = sources.map((s) =>
      s.kind === 'delegation'
        ? { ...s, available: 5_000_000n, minDelegationAmount: 10_000_000n }
        : s,
    );
    // Each: 5M available, 10M min → 0 excess. Floor pass: 5M total per
    // gateway. 3 gateways × 5M = 15M. Need 16M → InsufficientFunding.
    const result = buildFundingPlan(tightSources, 16_000_000n, {
      fundFrom: 'any',
    });
    if (!('kind' in result)) throw new Error('expected error');
    assert.equal(result.kind, 'InsufficientFunding');
  });
});

void MAX_FUNDING_SOURCES;
void MAX_DELEGATION_SOURCES;

describe('computeResidueIndexes', () => {
  it('flags a delegation that drains into (0, min)', () => {
    const sources = [{ kind: 'delegation', amount: 12_000_000n }];
    const states = [
      { delegationAmount: 15_000_000n, minDelegationAmount: 10_000_000n },
    ];
    // post = 3M, in (0, 10M) → residue
    assert.deepEqual(computeResidueIndexes(sources, states), [0]);
  });

  it('does NOT flag full-drain (post = 0)', () => {
    const sources = [{ kind: 'delegation', amount: 15_000_000n }];
    const states = [
      { delegationAmount: 15_000_000n, minDelegationAmount: 10_000_000n },
    ];
    assert.deepEqual(computeResidueIndexes(sources, states), []);
  });

  it('does NOT flag drain leaving ≥ min', () => {
    const sources = [{ kind: 'delegation', amount: 5_000_000n }];
    const states = [
      { delegationAmount: 30_000_000n, minDelegationAmount: 10_000_000n },
    ];
    // post = 25M, ≥ 10M → no residue
    assert.deepEqual(computeResidueIndexes(sources, states), []);
  });

  it('skips Delegations whose live amount is insufficient (lets on-chain reject)', () => {
    const sources = [{ kind: 'delegation', amount: 100_000_000n }];
    const states = [
      { delegationAmount: 50_000_000n, minDelegationAmount: 10_000_000n },
    ];
    assert.deepEqual(computeResidueIndexes(sources, states), []);
  });

  it('handles multi-gateway: independent residue flags per gateway', () => {
    const sources = [
      { kind: 'delegation', amount: 12_000_000n }, // residue (post=3M)
      { kind: 'delegation', amount: 5_000_000n }, // no residue (post=25M)
      { kind: 'delegation', amount: 14_000_000n }, // residue (post=1M)
    ];
    const states = [
      { delegationAmount: 15_000_000n, minDelegationAmount: 10_000_000n },
      { delegationAmount: 30_000_000n, minDelegationAmount: 10_000_000n },
      { delegationAmount: 15_000_000n, minDelegationAmount: 10_000_000n },
    ];
    assert.deepEqual(computeResidueIndexes(sources, states), [0, 2]);
  });

  it('ignores non-Delegation sources', () => {
    const sources = [
      { kind: 'balance', amount: 100n },
      { kind: 'withdrawal', amount: 200n },
      { kind: 'delegation', amount: 12_000_000n },
    ];
    const states: (
      | { delegationAmount: bigint; minDelegationAmount: bigint }
      | undefined
    )[] = [
      undefined,
      undefined,
      { delegationAmount: 15_000_000n, minDelegationAmount: 10_000_000n },
    ];
    assert.deepEqual(computeResidueIndexes(sources, states), [2]);
  });

  it('skips Delegation when state is missing (undefined slot)', () => {
    const sources = [{ kind: 'delegation', amount: 12_000_000n }];
    assert.deepEqual(computeResidueIndexes(sources, [undefined]), []);
  });
});

// ---------------------------------------------------------------------------
// discoverFundingSources — RPC shape
//
// This path had no coverage, so these tests were written against the ORIGINAL
// implementation first and must keep passing unchanged: they pin the observable
// output while the request pattern underneath it changes.
// ---------------------------------------------------------------------------

/** Real base58 pubkeys — kit rejects placeholder strings outright. */
const addr32 = (fill: number) => bs58.encode(Buffer.alloc(32, fill)) as Address;
const OWNER = addr32(1);
const MINT = addr32(2);
const GAR_PROGRAM = addr32(3);

const DELEGATION_SIZE = 8 + 32 + 32 + 8 + 8 + 16 + 1 + 3;
const WITHDRAWAL_SIZE = 8 + 32 + 8 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 3;

/** Raw Delegation account bytes; the discovery path hand-parses these offsets. */
function delegationBytes(opts: {
  gateway: Uint8Array;
  amount: bigint;
  startTimestamp: bigint;
}): string {
  const b = Buffer.alloc(DELEGATION_SIZE);
  Buffer.from(opts.gateway).copy(b, 8); // gateway pubkey
  b.writeBigUInt64LE(opts.amount, 72); // amount
  b.writeBigInt64LE(opts.startTimestamp, 80); // start_timestamp
  return b.toString('base64');
}

/** SPL token account: amount lives at offset 64. */
function ataBytes(amount: bigint): string {
  const b = Buffer.alloc(165);
  b.writeBigUInt64LE(amount, 64);
  return b.toString('base64');
}

type DiscoveryCounts = {
  getAccountInfo: number;
  getMultipleAccounts: number;
  getProgramAccounts: number;
  accountsRequested: number;
};

/**
 * Stub rpc for discovery. `existingGateways` decides which gateway PDAs come
 * back as existing — the discovery path only ever used that existence bit.
 */
function discoveryRpc(
  counts: DiscoveryCounts,
  opts: { delegations: string[]; ataAmount?: bigint },
) {
  const accountValue = (data: string) => ({
    data: [data, 'base64'] as readonly [string, string],
    executable: false,
    lamports: 1_000_000n,
    owner: OWNER,
    rentEpoch: 0n,
    space: BigInt(Buffer.from(data, 'base64').length),
  });
  return {
    getAccountInfo: (_addr: unknown) => ({
      send: async () => {
        counts.getAccountInfo++;
        // First getAccountInfo is the owner's ATA; the rest are gateway PDAs
        // in the original implementation.
        return counts.getAccountInfo === 1 && opts.ataAmount !== undefined
          ? { value: accountValue(ataBytes(opts.ataAmount)) }
          : { value: accountValue(Buffer.alloc(400).toString('base64')) };
      },
    }),
    getMultipleAccounts: (addrs: unknown[]) => ({
      send: async () => {
        counts.getMultipleAccounts++;
        counts.accountsRequested += (addrs as unknown[]).length;
        return {
          value: (addrs as unknown[]).map(() =>
            accountValue(Buffer.alloc(400).toString('base64')),
          ),
        };
      },
    }),
    getProgramAccounts: (_program: unknown, cfg: any) => ({
      send: async () => {
        counts.getProgramAccounts++;
        const size = cfg?.filters?.find((f: any) => f.dataSize)?.dataSize;
        if (size === BigInt(WITHDRAWAL_SIZE)) return [];
        if (size === BigInt(DELEGATION_SIZE))
          return opts.delegations.map((d) => ({
            pubkey: OWNER,
            account: { data: [d, 'base64'] },
          }));
        return [];
      },
    }),
  };
}

describe('discoverFundingSources', () => {
  const gwABytes = Buffer.alloc(32, 7);
  const gwBBytes = Buffer.alloc(32, 9);

  it('returns balance + delegation sources with the documented shape', async () => {
    const counts: DiscoveryCounts = {
      getAccountInfo: 0,
      getMultipleAccounts: 0,
      getProgramAccounts: 0,
      accountsRequested: 0,
    };
    const rpc = discoveryRpc(counts, {
      ataAmount: 5_000_000n,
      delegations: [
        delegationBytes({
          gateway: gwABytes,
          amount: 1_000_000n,
          startTimestamp: 100n,
        }),
        delegationBytes({
          gateway: gwBBytes,
          amount: 3_000_000n,
          startTimestamp: 200n,
        }),
      ],
    });

    const sources = await discoverFundingSources(rpc as never, OWNER, {
      arioMint: MINT,
      garProgram: GAR_PROGRAM,
    });

    const balance = sources.filter((s) => s.kind === 'balance');
    const delegations = sources.filter((s) => s.kind === 'delegation');
    assert.equal(balance.length, 1);
    assert.equal(balance[0].available, 5_000_000n);
    assert.equal(delegations.length, 2);
    // minDelegationAmount comes from the gateway existence check; both exist.
    for (const d of delegations) {
      assert.equal(d.minDelegationAmount, 10_000_000n);
      assert.equal(d.performanceRatio, 1.0);
      assert.equal(d.totalDelegatedStake, 0n);
    }
    // Lua sort: descending excess stake. Both are below the floor here, so
    // excess is 0 for both and the tie breaks on later start timestamp.
    assert.equal(delegations[0].available, 3_000_000n);
    assert.equal(delegations[1].available, 1_000_000n);

    // No operatorStake source is ever discovered: fundAsOperator requires
    // explicit `sources`. Pinned so removing the dead fetch stays a no-op.
    assert.equal(sources.filter((s) => s.kind === 'operatorStake').length, 0);
  });

  it('reads gateway metadata without one round trip per delegation', async () => {
    const counts: DiscoveryCounts = {
      getAccountInfo: 0,
      getMultipleAccounts: 0,
      getProgramAccounts: 0,
      accountsRequested: 0,
    };
    const delegations = Array.from({ length: 120 }, (_, i) =>
      delegationBytes({
        gateway: Buffer.alloc(32, (i % 200) + 1),
        amount: BigInt((i + 1) * 1_000),
        startTimestamp: BigInt(i),
      }),
    );
    const rpc = discoveryRpc(counts, { ataAmount: 1n, delegations });

    const sources = await discoverFundingSources(rpc as never, OWNER, {
      arioMint: MINT,
      garProgram: GAR_PROGRAM,
    });

    assert.equal(
      sources.filter((s) => s.kind === 'delegation').length,
      120,
      'every delegation is still discovered',
    );
    // The ATA read is the only legitimate single-account fetch here.
    assert.equal(
      counts.getAccountInfo,
      1,
      `gateway metadata must not cost one getAccountInfo per delegation ` +
        `(saw ${counts.getAccountInfo})`,
    );
    assert.equal(
      counts.getMultipleAccounts,
      2,
      '120 gateways should batch into 2 getMultipleAccounts calls of <=100',
    );
    assert.equal(counts.accountsRequested, 120);
  });

  it('surfaces a transient RPC failure instead of reporting zero sources', async () => {
    // The whole point: a 429 must not be indistinguishable from "this wallet
    // has no delegations". Observed live against public devnet — a wallet
    // holding seven delegations reported none, silently, and the planner would
    // have under-funded from it.
    const counts: DiscoveryCounts = {
      getAccountInfo: 0,
      getMultipleAccounts: 0,
      getProgramAccounts: 0,
      accountsRequested: 0,
    };
    const rpc = discoveryRpc(counts, { ataAmount: 1n, delegations: [] });
    // Every getProgramAccounts 429s, through the retries.
    rpc.getProgramAccounts = () => ({
      send: async () => {
        counts.getProgramAccounts++;
        throw new Error('HTTP error (429): Too Many Requests');
      },
    });

    await assert.rejects(
      () =>
        discoverFundingSources(rpc as never, OWNER, {
          arioMint: MINT,
          garProgram: GAR_PROGRAM,
        }),
      /Refusing to report zero sources for a transient failure/,
    );
    assert.ok(
      counts.getProgramAccounts > 1,
      `a transient failure should be retried before giving up, saw ${counts.getProgramAccounts} attempt(s)`,
    );
  });

  it('still degrades to an empty list when getProgramAccounts is unsupported', async () => {
    // Many public RPCs disable gPA outright. That is permanent, not transient,
    // so the graceful fallback is still correct there — it just says so now.
    const counts: DiscoveryCounts = {
      getAccountInfo: 0,
      getMultipleAccounts: 0,
      getProgramAccounts: 0,
      accountsRequested: 0,
    };
    const rpc = discoveryRpc(counts, { ataAmount: 7n, delegations: [] });
    rpc.getProgramAccounts = () => ({
      send: async () => {
        counts.getProgramAccounts++;
        throw new Error('Method not supported: getProgramAccounts');
      },
    });

    const sources = await discoverFundingSources(rpc as never, OWNER, {
      arioMint: MINT,
      garProgram: GAR_PROGRAM,
    });
    // Balance still discovered; the gPA-backed sources are simply absent.
    assert.deepEqual(
      sources.map((s) => s.kind),
      ['balance'],
    );
    assert.equal(
      counts.getProgramAccounts,
      2,
      'a permanent error should not be retried (one attempt per scan)',
    );
  });
});
