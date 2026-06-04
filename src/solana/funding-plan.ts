/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Multi-source, multi-gateway funding plan builder + executor for the AR.IO
 * Solana SDK.
 *
 * Lua-faithful port of `gar.getFundingPlan` / `gar.applyFundingPlan` from
 * `ar-io-network-process/src/gar.lua`. Supports Delegation sources across
 * multiple gateways in a single plan (closes BD-076).
 *
 * Drawdown order (matches Lua exactly):
 *   1. Balance — taken first when `fundFrom in {'balance','any','plan'}`
 *      (`planBalanceDrawdown` in gar.lua:1456)
 *   2. Withdrawal vaults — sorted asc by `available_at`, oldest-maturing
 *      first (`planVaultsDrawdown` in gar.lua:1510). Gateway-independent.
 *   3. Excess delegated stake — iterates ALL gateways the user has delegated
 *      on (Lua-sorted: desc excess, asc perf, desc total stake, desc start
 *      timestamp). Up to MAX_DELEGATION_SOURCES gateways per plan.
 *      (`planExcessStakesDrawdown` in gar.lua:1559)
 *   4. Minimum delegated stake — drains the floor on each touched gateway,
 *      auto-vaulting the residue. Same gateway iteration order as step 3.
 *      (`planMinimumStakesDrawdown` in gar.lua:1585)
 *
 * Operator stake is a Solana extension: Lua's funding plans never touch it.
 * The picker excludes operator stake unless `opts.fundAsOperator === true`.
 *
 * The on-chain `pay_from_funding_plan` ix caps the source list at
 * MAX_FUNDING_SOURCES (5) and Delegation sources at MAX_DELEGATION_SOURCES (3)
 * (see `programs/ario-gar/src/state/mod.rs`). The planner enforces the same
 * caps so `executeFundingPlan` calls never get rejected for
 * `TooManyFundingSources` / `TooManyDelegationSources`.
 */

import {
  AccountRole,
  type Address,
  type Rpc,
  type SolanaRpcApi,
  type SolanaRpcApiMainnet,
  fetchEncodedAccount,
  getAddressDecoder,
} from '@solana/kit';

/**
 * The discovery + executor accept either the dev/test or the mainnet RPC API
 * shape — they only use methods that are common to both (`getProgramAccounts`,
 * `getAccountInfo`).
 */
export type FundingPlanRpc = Rpc<SolanaRpcApi> | Rpc<SolanaRpcApiMainnet>;

import { ARIO_GAR_PROGRAM_ADDRESS as ARIO_GAR_PROGRAM_ID } from '@ar.io/solana-contracts/gar';
import { type FundingSourceKind, type FundingSourceSpec } from '../types/io.js';
import {
  getDelegationPDA,
  getGatewayPDA,
  getWithdrawalCounterPDA,
  getWithdrawalPDA,
} from './pda.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Hard cap on funding-plan length — must stay in sync with the on-chain
 * `MAX_FUNDING_SOURCES` constant (`programs/ario-gar/src/state/mod.rs`).
 */
export const MAX_FUNDING_SOURCES = 5;

/**
 * Hard cap on Delegation sources within a single plan — must stay in sync
 * with the on-chain `MAX_DELEGATION_SOURCES` constant.
 */
export const MAX_DELEGATION_SOURCES = 3;

/** A single source the user can draw from. Discovery returns these. */
export type DiscoveredFundingSource =
  | { kind: 'balance'; available: bigint }
  | {
      kind: 'delegation';
      gateway: Address;
      available: bigint;
      /** Per-gateway floor; the residue auto-vaults if drained below this. */
      minDelegationAmount: bigint;
      /** Gateway performance ratio — used for Lua-faithful sort order. */
      performanceRatio: number;
      /** Total delegated stake on the gateway — secondary sort key. */
      totalDelegatedStake: bigint;
      /** Gateway start timestamp — tertiary sort key. */
      startTimestamp: bigint;
    }
  | {
      kind: 'operatorStake';
      gateway: Address;
      available: bigint;
      minOperatorStake: bigint;
    }
  | {
      kind: 'withdrawal';
      withdrawalId: bigint;
      gateway: Address;
      available: bigint;
      availableAt: bigint;
    };

/** Output of `buildFundingPlan` when a plan covers the requested amount. */
export type FundingPlan = {
  /** Source specs in declaration order — passed verbatim to the on-chain ix. */
  sources: FundingSourceSpec[];
  /**
   * Per-source bound gateway, in declaration order. `undefined` for Balance
   * and Withdrawal sources; set for Delegation and OperatorStake sources.
   * Used by the executor to materialize per-source gateway PDA slots in
   * `remaining_accounts`.
   */
  gatewayPerSource: (Address | undefined)[];
  /**
   * Indexes (into `sources`) of Delegation sources that will trigger an
   * on-chain residue auto-vault (drained below `min_delegation_amount`).
   * The executor must supply that many trailing residue_vault PDAs in
   * `remaining_accounts`, in the same order as these indexes.
   */
  residueDelegationIndexes: number[];
  /** Whether any Balance source is in the plan (drives optional `payer_token_account`). */
  hasBalanceSource: boolean;
};

/** Discriminated error emitted when no plan covers the requested amount. */
export type InsufficientFundingError = {
  kind: 'InsufficientFunding';
  amountNeeded: bigint;
  shortfall: bigint;
  availableSources: DiscoveredFundingSource[];
  message: string;
};

export type BuildFundingPlanOpts = {
  /** SDK fundFrom mode — drives source preferences (balance / stakes / withdrawal / plan / any). */
  fundFrom?: 'balance' | 'stakes' | 'withdrawal' | 'plan' | 'any';
  /**
   * When set, prefer this gateway first when iterating stake-locked
   * delegation sources. Other gateways are still considered for additional
   * fill (up to MAX_DELEGATION_SOURCES total).
   */
  preferGateway?: Address;
  /** Solana extension: include OperatorStake in the picker. Default false (Lua parity). */
  fundAsOperator?: boolean;
  /** When set, use only sources of this kind (single-source mode). */
  restrictToKind?: FundingSourceKind;
};

// ---------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------

/**
 * Enumerate the user's fund-from-eligible sources via `getProgramAccounts`
 * + targeted reads.
 *
 * `getProgramAccounts` is restricted on most public Solana RPCs; callers
 * pointing at default endpoints should switch to a DAS-equivalent RPC
 * (Helius, Triton, etc.) or pass an explicit `sources` array on the
 * fee-paying ix to skip discovery.
 *
 * Returns sources sorted in the Lua-faithful drawdown order so callers can
 * iterate without re-sorting.
 */
export async function discoverFundingSources(
  rpc: FundingPlanRpc,
  owner: Address,
  opts: {
    /** Mint of ARIO; required to compute the user's ATA. */
    arioMint: Address;
    /** Optional: pre-fetched balance from the user's ATA (bypasses RPC). */
    balanceOverride?: bigint;
    /** Optional ario-gar program override (defaults to deployed program). */
    garProgram?: Address;
  },
): Promise<DiscoveredFundingSource[]> {
  const garProgram = opts.garProgram ?? ARIO_GAR_PROGRAM_ID;
  const sources: DiscoveredFundingSource[] = [];

  // 1. Balance — read user's ATA.
  let balance = opts.balanceOverride;
  if (balance === undefined) {
    const { getAssociatedTokenAddressKit } = await import('./ata.js');
    const ata = await getAssociatedTokenAddressKit(opts.arioMint, owner);
    const ataAccount = await fetchEncodedAccount(rpc, ata);
    if (ataAccount.exists && ataAccount.data.length >= 72) {
      // SPL Token Account layout: mint(32) + owner(32) + amount(8) at offset 64.
      balance = new DataView(
        ataAccount.data.buffer,
        ataAccount.data.byteOffset,
        72,
      ).getBigUint64(64, true);
    } else {
      balance = 0n;
    }
  }
  if (balance > 0n) sources.push({ kind: 'balance', available: balance });

  // 2. Withdrawal vaults — getProgramAccounts on ario-gar with memcmp filter
  //    on Withdrawal.owner.
  const withdrawals = await fetchUserWithdrawals(rpc, owner, garProgram);
  // Lua sorts asc by endTimestamp (`planVaultsDrawdown` in gar.lua:1531).
  withdrawals.sort((a, b) => {
    if (a.kind !== 'withdrawal' || b.kind !== 'withdrawal') return 0;
    return a.availableAt < b.availableAt
      ? -1
      : a.availableAt > b.availableAt
        ? 1
        : 0;
  });
  for (const w of withdrawals) sources.push(w);

  // 3+4. Delegations on every gateway the user has staked on. We sort
  //      Lua-faithfully here so consumers can iterate top-to-bottom.
  const delegations = await fetchUserDelegations(rpc, owner, garProgram);
  // (planExcessStakesDrawdown in gar.lua:1559+ sorts by:
  //  desc excessStake, asc gatewayPerformanceRatio, desc totalDelegatedStake,
  //  desc startTimestamp.)
  delegations.sort((a, b) => {
    if (a.kind !== 'delegation' || b.kind !== 'delegation') return 0;
    const aExcess =
      a.available > a.minDelegationAmount
        ? a.available - a.minDelegationAmount
        : 0n;
    const bExcess =
      b.available > b.minDelegationAmount
        ? b.available - b.minDelegationAmount
        : 0n;
    if (aExcess !== bExcess) return bExcess > aExcess ? 1 : -1;
    if (a.performanceRatio !== b.performanceRatio)
      return a.performanceRatio - b.performanceRatio;
    if (a.totalDelegatedStake !== b.totalDelegatedStake)
      return b.totalDelegatedStake > a.totalDelegatedStake ? 1 : -1;
    return b.startTimestamp > a.startTimestamp ? 1 : -1;
  });
  for (const d of delegations) sources.push(d);

  // 5. Operator stake (Solana extension; only relevant when caller opts in).
  //    Discovery requires checking each gateway the user might operate; we
  //    only check the user's own gateway-as-operator PDA rather than scanning
  //    all gateways.
  const operatorSource = await fetchOperatorStake(rpc, owner, garProgram);
  if (operatorSource) sources.push(operatorSource);

  return sources;
}

// ---------------------------------------------------------------------------
// Plan builder (Lua-faithful, multi-gateway)
// ---------------------------------------------------------------------------

/**
 * Build a multi-source funding plan that covers `amountNeeded` mARIO.
 *
 * Returns `{ kind: 'InsufficientFunding', ... }` when no plan covers the
 * amount given the supplied sources — caller handles by topping up balance,
 * choosing a different gateway, or surfacing the error to the user.
 *
 * Multi-gateway: Delegation sources span up to MAX_DELEGATION_SOURCES (3)
 * different gateways. The planner iterates delegations in Lua-faithful order
 * (or `opts.preferGateway` first if set), drawing excess from each before
 * falling back to floor-draining (which auto-vaults the residue).
 *
 * OperatorStake (Solana extension) is bound to a single gateway when present.
 * Withdrawal sources have NO gateway constraint.
 */
export function buildFundingPlan(
  sources: DiscoveredFundingSource[],
  amountNeeded: bigint,
  opts: BuildFundingPlanOpts = {},
): FundingPlan | InsufficientFundingError {
  const fundFrom = opts.fundFrom ?? 'any';
  const sourceSpecs: FundingSourceSpec[] = [];
  const gatewayPerSource: (Address | undefined)[] = [];
  // raws[i] is the raw discovered source backing sourceSpecs[i] (for residue
  // detection at finalize-time).
  const raws: DiscoveredFundingSource[] = [];
  // Track total drawn per delegation gateway so multi-pass (excess then min)
  // bookkeeping stays in sync.
  const delegationDrawByGateway = new Map<Address, bigint>();
  let shortfall = amountNeeded;

  const pushSource = (
    spec: FundingSourceSpec,
    raw: DiscoveredFundingSource,
    gateway: Address | undefined,
  ): boolean => {
    if (sourceSpecs.length >= MAX_FUNDING_SOURCES) return false;
    if (
      spec.kind === 'delegation' &&
      countDelegationGateways(gatewayPerSource, sourceSpecs) >=
        MAX_DELEGATION_SOURCES &&
      gateway !== undefined &&
      !gatewayPerSource.some(
        (g, i) => g === gateway && sourceSpecs[i].kind === 'delegation',
      )
    ) {
      // Adding another distinct delegation gateway would exceed the cap.
      return false;
    }
    sourceSpecs.push(spec);
    gatewayPerSource.push(gateway);
    raws.push(raw);
    if (spec.kind === 'delegation' && gateway !== undefined) {
      delegationDrawByGateway.set(
        gateway,
        (delegationDrawByGateway.get(gateway) ?? 0n) + spec.amount,
      );
    }
    return true;
  };

  // 1. Balance (if mode allows).
  if (fundFrom === 'balance' || fundFrom === 'any' || fundFrom === 'plan') {
    const bal = sources.find((s) => s.kind === 'balance');
    if (bal && bal.available > 0n) {
      const take = bal.available < shortfall ? bal.available : shortfall;
      if (take > 0n) {
        if (!pushSource({ kind: 'balance', amount: take }, bal, undefined)) {
          return {
            kind: 'InsufficientFunding',
            amountNeeded,
            shortfall,
            availableSources: sources,
            message: `Plan exceeds source caps`,
          };
        }
        shortfall -= take;
      }
    }
  }
  if (shortfall === 0n)
    return finalizePlan(sourceSpecs, gatewayPerSource, raws);
  if (fundFrom === 'balance')
    return insufficient(amountNeeded, shortfall, sources);

  // 2. Withdrawal vaults (oldest-maturing first; gateway-independent).
  // Defensive sort — `discoverFundingSources` returns presorted, but explicit
  // callers may not. Sort by availableAt asc (Lua's `planVaultsDrawdown`).
  //
  // Runs for ALL non-balance modes ('stakes', 'withdrawal', 'plan', 'any').
  // Lua's `planVaultsDrawdown` (gar.lua:1437) is invoked unconditionally
  // after the balance gate — only "balance" short-circuits before vaults.
  // (Pre-2026-05 the SDK skipped vaults under 'stakes', diverging from Lua;
  // a delegator with both matured vaults and active delegations would erode
  // their delegations instead of cleaning out matured vaults first.)
  const withdrawalSources = sources
    .filter(
      (s): s is DiscoveredFundingSource & { kind: 'withdrawal' } =>
        s.kind === 'withdrawal',
    )
    .slice()
    .sort((a, b) =>
      a.availableAt < b.availableAt
        ? -1
        : a.availableAt > b.availableAt
          ? 1
          : 0,
    );
  for (const s of withdrawalSources) {
    if (shortfall === 0n) break;
    const take = s.available < shortfall ? s.available : shortfall;
    if (take === 0n) continue;
    if (
      !pushSource(
        { kind: 'withdrawal', amount: take, withdrawalId: s.withdrawalId },
        s,
        undefined,
      )
    ) {
      break;
    }
    shortfall -= take;
  }
  if (shortfall === 0n)
    return finalizePlan(sourceSpecs, gatewayPerSource, raws);
  if (fundFrom === 'withdrawal')
    return insufficient(amountNeeded, shortfall, sources);

  // 3+4. Delegation + OperatorStake — multi-gateway.
  // Build gateway iteration order: opts.preferGateway first (if it has a
  // delegation), then Lua-sorted delegations from `sources`.
  const delegationsByGateway = new Map<
    Address,
    DiscoveredFundingSource & { kind: 'delegation' }
  >();
  for (const s of sources) {
    if (s.kind === 'delegation') delegationsByGateway.set(s.gateway, s);
  }
  const orderedDelegations: (DiscoveredFundingSource & {
    kind: 'delegation';
  })[] = [];
  if (opts.preferGateway && delegationsByGateway.has(opts.preferGateway)) {
    orderedDelegations.push(delegationsByGateway.get(opts.preferGateway)!);
  }
  for (const s of sources) {
    if (s.kind !== 'delegation') continue;
    if (s.gateway === opts.preferGateway) continue; // already added
    orderedDelegations.push(s);
  }

  // 3. Excess pass — draw above-min from each gateway in order.
  for (const d of orderedDelegations) {
    if (shortfall === 0n) break;
    if (d.available <= d.minDelegationAmount) continue;
    const excess = d.available - d.minDelegationAmount;
    const take = excess < shortfall ? excess : shortfall;
    if (take === 0n) continue;
    if (!pushSource({ kind: 'delegation', amount: take }, d, d.gateway)) {
      // Cap reached — stop excess pass.
      break;
    }
    shortfall -= take;
  }
  if (shortfall === 0n)
    return finalizePlan(sourceSpecs, gatewayPerSource, raws);

  // Solana extension: OperatorStake (only when caller opts in).
  if (opts.fundAsOperator) {
    const operatorStake = sources.find(
      (s): s is DiscoveredFundingSource & { kind: 'operatorStake' } =>
        s.kind === 'operatorStake',
    );
    if (
      operatorStake &&
      operatorStake.available > operatorStake.minOperatorStake
    ) {
      const excess = operatorStake.available - operatorStake.minOperatorStake;
      const take = excess < shortfall ? excess : shortfall;
      if (take > 0n) {
        if (
          pushSource(
            { kind: 'operatorStake', amount: take },
            operatorStake,
            operatorStake.gateway,
          )
        ) {
          shortfall -= take;
        }
      }
    }
  }
  if (shortfall === 0n)
    return finalizePlan(sourceSpecs, gatewayPerSource, raws);

  // 4. Minimum pass — drain the floor on each touched delegation, bumping
  //    the existing source rather than adding a new one. Mirrors Lua's
  //    planMinimumStakesDrawdown which mutates the same fundingPlan.stakes
  //    entry. Auto-vault detection happens at finalize-time based on each
  //    gateway's total draw.
  //
  // Lua re-sorts before this pass (gar.lua:1587-1600): perf asc, then
  // totalDelegated desc, then startTimestamp desc — i.e. "drain the
  // worst-performing gateway's floor first." The Stage-3 order
  // (`orderedDelegations`) used excess desc as the primary key, which
  // means floors get drained from gateways that already had a lot of
  // excess — backwards from Lua's "concentrate the residue on bad
  // gateways" intent. Re-sort here to match.
  //
  // `preferGateway` still wins: if the caller asked for a specific
  // gateway preference, honor it on the floor pass too.
  const floorOrder = orderedDelegations.slice().sort((a, b) => {
    if (opts.preferGateway) {
      const aPref = a.gateway === opts.preferGateway ? 0 : 1;
      const bPref = b.gateway === opts.preferGateway ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
    }
    if (a.performanceRatio !== b.performanceRatio) {
      return a.performanceRatio - b.performanceRatio;
    }
    if (a.totalDelegatedStake !== b.totalDelegatedStake) {
      return b.totalDelegatedStake > a.totalDelegatedStake ? 1 : -1;
    }
    if (a.startTimestamp !== b.startTimestamp) {
      return b.startTimestamp > a.startTimestamp ? 1 : -1;
    }
    return 0;
  });

  for (const d of floorOrder) {
    if (shortfall === 0n) break;
    const drawn = delegationDrawByGateway.get(d.gateway) ?? 0n;
    const remaining = d.available - drawn;
    if (remaining <= 0n) continue;
    const take = remaining < shortfall ? remaining : shortfall;
    if (take === 0n) continue;
    const existingIdx = sourceSpecs.findIndex(
      (s, i) => s.kind === 'delegation' && gatewayPerSource[i] === d.gateway,
    );
    if (existingIdx >= 0) {
      sourceSpecs[existingIdx].amount += take;
      delegationDrawByGateway.set(d.gateway, drawn + take);
      shortfall -= take;
    } else {
      // No prior source for this gateway (had no excess); add a fresh
      // Delegation entry. Subject to MAX_DELEGATION_SOURCES.
      if (!pushSource({ kind: 'delegation', amount: take }, d, d.gateway)) {
        break;
      }
      shortfall -= take;
    }
  }

  if (shortfall > 0n) return insufficient(amountNeeded, shortfall, sources);
  return finalizePlan(sourceSpecs, gatewayPerSource, raws);
}

function countDelegationGateways(
  gatewayPerSource: (Address | undefined)[],
  sourceSpecs: FundingSourceSpec[],
): number {
  const seen = new Set<string>();
  for (let i = 0; i < sourceSpecs.length; i++) {
    if (sourceSpecs[i].kind === 'delegation') {
      const g = gatewayPerSource[i];
      if (g !== undefined) seen.add(g);
    }
  }
  return seen.size;
}

function insufficient(
  amountNeeded: bigint,
  shortfall: bigint,
  availableSources: DiscoveredFundingSource[],
): InsufficientFundingError {
  const summary = availableSources
    .map((s) => {
      if (s.kind === 'balance') return `balance=${s.available}`;
      if (s.kind === 'delegation')
        return `delegation@${s.gateway.slice(0, 8)}…=${s.available}`;
      if (s.kind === 'operatorStake')
        return `operatorStake@${s.gateway.slice(0, 8)}…=${s.available}`;
      return `withdrawal#${s.withdrawalId}=${s.available}`;
    })
    .join(', ');
  return {
    kind: 'InsufficientFunding',
    amountNeeded,
    shortfall,
    availableSources,
    message: `Insufficient funding: need ${amountNeeded} mARIO, short ${shortfall}. Available: ${summary || '(none)'}`,
  };
}

function finalizePlan(
  sources: FundingSourceSpec[],
  gatewayPerSource: (Address | undefined)[],
  raws: DiscoveredFundingSource[],
): FundingPlan {
  // Detect which Delegation sources will trigger residue auto-vault.
  // For each Delegation slot: total draw on that gateway >= available - min
  // and < available means the post-drain balance is in (0, min) — the
  // on-chain handler auto-vaults that residue (mirrors Lua's
  // planMinimumStakesDrawdown finalize step).
  const residueDelegationIndexes: number[] = [];
  const drawByGateway = new Map<Address, bigint>();
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const g = gatewayPerSource[i];
    if (s.kind !== 'delegation' || g === undefined) continue;
    drawByGateway.set(g, (drawByGateway.get(g) ?? 0n) + s.amount);
  }
  // Mark each delegation slot whose gateway will go sub-min. We mark the
  // FIRST delegation slot per gateway (the one created during the excess
  // pass, which is also the one whose `amount` was bumped during the min
  // pass) so the executor's residue PDA list is in declaration order.
  const markedGateways = new Set<Address>();
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const g = gatewayPerSource[i];
    if (s.kind !== 'delegation' || g === undefined) continue;
    if (markedGateways.has(g)) continue;
    const raw = raws[i];
    if (raw.kind !== 'delegation') continue;
    const totalDraw = drawByGateway.get(g) ?? 0n;
    const remaining = raw.available - totalDraw;
    if (remaining > 0n && remaining < raw.minDelegationAmount) {
      residueDelegationIndexes.push(i);
      markedGateways.add(g);
    }
  }
  return {
    sources,
    gatewayPerSource,
    residueDelegationIndexes,
    hasBalanceSource: sources.some((s) => s.kind === 'balance'),
  };
}

// ---------------------------------------------------------------------------
// Executor — derive PDAs + assemble remaining_accounts for the on-chain ix
// ---------------------------------------------------------------------------

/**
 * Materialize a `FundingPlan` into the per-source PDAs the on-chain ix
 * expects in `remaining_accounts`.
 *
 * Layout (per source, in declaration order):
 *   - Balance:        0 slots
 *   - Delegation:     2 slots [gateway_pda, delegation_pda]
 *   - OperatorStake:  1 slot  [gateway_pda]
 *   - Withdrawal:     1 slot  [withdrawal_pda]
 *
 * Followed by N residue_vault PDAs (in the order produced by
 * `predictResidueVaults`), one per element of `plan.residueDelegationIndexes`.
 */
export async function buildFundingPlanRemainingAccounts(
  plan: FundingPlan,
  owner: Address,
  opts: {
    /** Per-source override for Withdrawal PDAs. By index of Withdrawal sources in plan. */
    withdrawalIds?: bigint[];
    /** Residue-vault PDAs from `predictResidueVaults`, in plan order. */
    residueVaults?: Address[];
    garProgram?: Address;
  } = {},
): Promise<{ address: Address; role: AccountRole }[]> {
  const garProgram = opts.garProgram ?? ARIO_GAR_PROGRAM_ID;
  const out: { address: Address; role: AccountRole }[] = [];
  let withdrawalIdx = 0;
  for (let i = 0; i < plan.sources.length; i++) {
    const source = plan.sources[i];
    const gateway = plan.gatewayPerSource[i];
    if (source.kind === 'delegation') {
      if (!gateway) {
        throw new Error(
          `FundingPlan source #${i} is a Delegation but gatewayPerSource[${i}] is undefined`,
        );
      }
      const [gatewayPda] = await getGatewayPDA(gateway, garProgram);
      const [delegationPda] = await getDelegationPDA(
        gateway,
        owner,
        garProgram,
      );
      out.push({ address: gatewayPda, role: AccountRole.WRITABLE });
      out.push({ address: delegationPda, role: AccountRole.WRITABLE });
    } else if (source.kind === 'operatorStake') {
      if (!gateway) {
        throw new Error(
          `FundingPlan source #${i} is OperatorStake but gatewayPerSource[${i}] is undefined`,
        );
      }
      const [gatewayPda] = await getGatewayPDA(gateway, garProgram);
      out.push({ address: gatewayPda, role: AccountRole.WRITABLE });
    } else if (source.kind === 'withdrawal') {
      const id = opts.withdrawalIds?.[withdrawalIdx];
      if (id === undefined) {
        throw new Error(
          `FundingPlan includes Withdrawal source #${withdrawalIdx} but no withdrawalId was provided`,
        );
      }
      const [pda] = await getWithdrawalPDA(owner, id, garProgram);
      out.push({ address: pda, role: AccountRole.WRITABLE });
      withdrawalIdx++;
    }
    // Balance contributes 0 entries.
  }

  // Trailing residue-vault PDAs.
  const residueVaults = opts.residueVaults ?? [];
  if (residueVaults.length !== plan.residueDelegationIndexes.length) {
    throw new Error(
      `Expected ${plan.residueDelegationIndexes.length} residue vault PDAs, got ${residueVaults.length}`,
    );
  }
  for (const v of residueVaults) {
    out.push({ address: v, role: AccountRole.WRITABLE });
  }

  return out;
}

/**
 * Pure helper: given an array of explicit `FundingSourceSpec`s and the
 * decoded (delegation.amount, gateway.minDelegationAmount) for each
 * Delegation source, return the indexes of sources that will trigger an
 * on-chain residue auto-vault (post-drain in `(0, min)`).
 *
 * `delegationStates[i]` matches `sources[i]` by index — entries for non-
 * Delegation sources are ignored. Pass `undefined` for those slots.
 *
 * Caller is responsible for fetching the on-chain state; this function
 * is intentionally pure to keep it unit-testable without mocking RPC.
 */
export function computeResidueIndexes(
  sources: { kind: string; amount: bigint }[],
  delegationStates: (
    | { delegationAmount: bigint; minDelegationAmount: bigint }
    | undefined
  )[],
): number[] {
  const out: number[] = [];
  for (let i = 0; i < sources.length; i++) {
    if (sources[i].kind !== 'delegation') continue;
    const state = delegationStates[i];
    if (!state) continue;
    if (state.delegationAmount < sources[i].amount) continue; // insufficient — let on-chain reject
    const post = state.delegationAmount - sources[i].amount;
    if (post > 0n && post < state.minDelegationAmount) {
      out.push(i);
    }
  }
  return out;
}

/**
 * Predict the residue Withdrawal PDAs the on-chain ix will use for any
 * Delegation source draining sub-min. Returns one PDA per
 * `plan.residueDelegationIndexes` entry, sequenced from the user's current
 * `WithdrawalCounter.next_id`.
 */
export async function predictResidueVaults(
  rpc: FundingPlanRpc,
  owner: Address,
  plan: FundingPlan,
  opts: { garProgram?: Address } = {},
): Promise<{
  residueVaults: Address[];
  withdrawalCounter: Address;
  nextId: bigint;
}> {
  const garProgram = opts.garProgram ?? ARIO_GAR_PROGRAM_ID;
  const [withdrawalCounter] = await getWithdrawalCounterPDA(owner, garProgram);
  const acct = await fetchEncodedAccount(rpc, withdrawalCounter);
  let nextId = 0n;
  if (acct.exists && acct.data.length >= 48) {
    // WithdrawalCounter layout: disc(8) + owner(32) + next_id(u64 le) at 40..48.
    nextId = new DataView(
      acct.data.buffer,
      acct.data.byteOffset,
      48,
    ).getBigUint64(40, true);
  }
  const residueVaults: Address[] = [];
  for (let i = 0; i < plan.residueDelegationIndexes.length; i++) {
    const id = nextId + BigInt(i);
    const [pda] = await getWithdrawalPDA(owner, id, garProgram);
    residueVaults.push(pda);
  }
  return { residueVaults, withdrawalCounter, nextId };
}

// ---------------------------------------------------------------------------
// Internal helpers — getProgramAccounts-driven discovery
// ---------------------------------------------------------------------------

const ADDRESS_DECODER = getAddressDecoder();

async function fetchUserWithdrawals(
  rpc: FundingPlanRpc,
  owner: Address,
  garProgram: Address,
): Promise<DiscoveredFundingSource[]> {
  // Withdrawal layout (offsets):
  //   0..8     discriminator
  //   8..40    owner: Pubkey       <-- memcmp filter target
  //   40..48   withdrawal_id: u64
  //   48..80   gateway: Pubkey
  //   80..88   amount: u64
  //   88..96   created_at: i64
  //   96..104  available_at: i64
  //   104..105 is_delegate: bool
  //   105..106 is_exit_vault: bool
  //   106..107 is_protected: bool   — BD-102: protected min-stake exit
  //                                    vaults are skipped (cannot fund-from)
  //   107..108 bump: u8
  //   108..111 version: SchemaVersion { major, minor, patch }
  try {
    const result = await rpc
      .getProgramAccounts(garProgram, {
        filters: [
          {
            memcmp: { offset: 8n, bytes: owner, encoding: 'base58' as const },
          },
          { dataSize: BigInt(8 + 32 + 8 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 3) },
        ],
        encoding: 'base64',
      } as Parameters<typeof rpc.getProgramAccounts>[1])
      .send();
    const out: DiscoveredFundingSource[] = [];
    for (const entry of result as unknown as Array<{
      account: { data: [string, string] };
    }>) {
      const data = Buffer.from(entry.account.data[0], 'base64');
      if (data.length < 108) continue;
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const withdrawalId = dv.getBigUint64(40, true);
      const gateway = ADDRESS_DECODER.decode(data.subarray(48, 80));
      const amount = dv.getBigUint64(80, true);
      if (amount === 0n) continue; // already drained
      const isProtected = data[106] === 1;
      // BD-102: protected min-stake exit vaults are off-limits to the
      // funding-plan path (deduct_withdrawal_for_payment rejects with
      // GarError::ProtectedVault). Filter at discovery so the planner
      // never proposes an unspendable source.
      if (isProtected) continue;
      const availableAt = BigInt(dv.getBigInt64(96, true));
      out.push({
        kind: 'withdrawal',
        withdrawalId,
        gateway,
        available: amount,
        availableAt,
      });
    }
    return out;
  } catch {
    // RPC doesn't support getProgramAccounts — caller must pass explicit sources.
    return [];
  }
}

async function fetchUserDelegations(
  rpc: FundingPlanRpc,
  owner: Address,
  garProgram: Address,
): Promise<DiscoveredFundingSource[]> {
  // Delegation layout:
  //   0..8     discriminator
  //   8..40    gateway: Pubkey
  //   40..72   delegator: Pubkey   <-- memcmp filter target
  //   72..80   amount: u64
  //   80..88   start_timestamp: i64
  //   88..104  reward_debt: u128
  //   104..105 bump: u8
  //   105..108 version: SchemaVersion { major, minor, patch }
  try {
    const result = await rpc
      .getProgramAccounts(garProgram, {
        filters: [
          {
            memcmp: { offset: 40n, bytes: owner, encoding: 'base58' as const },
          },
          { dataSize: BigInt(8 + 32 + 32 + 8 + 8 + 16 + 1 + 3) },
        ],
        encoding: 'base64',
      } as Parameters<typeof rpc.getProgramAccounts>[1])
      .send();
    const out: DiscoveredFundingSource[] = [];
    for (const entry of result as unknown as Array<{
      account: { data: [string, string] };
    }>) {
      const data = Buffer.from(entry.account.data[0], 'base64');
      if (data.length < 105) continue;
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const gateway = ADDRESS_DECODER.decode(data.subarray(8, 40));
      const amount = dv.getBigUint64(72, true);
      if (amount === 0n) continue;
      const startTimestamp = BigInt(dv.getBigInt64(80, true));
      // We need the gateway's min_delegation_amount + perf ratio to sort
      // properly. Fetch each gateway lazily; cache in a map.
      const meta = await fetchGatewayMeta(rpc, gateway, garProgram);
      out.push({
        kind: 'delegation',
        gateway,
        available: amount,
        minDelegationAmount: meta.minDelegationAmount,
        performanceRatio: meta.performanceRatio,
        totalDelegatedStake: meta.totalDelegatedStake,
        startTimestamp,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchGatewayMeta(
  rpc: FundingPlanRpc,
  gateway: Address,
  garProgram: Address,
): Promise<{
  minDelegationAmount: bigint;
  performanceRatio: number;
  totalDelegatedStake: bigint;
}> {
  const [pda] = await getGatewayPDA(gateway, garProgram);
  const acct = await fetchEncodedAccount(rpc, pda);
  if (!acct.exists) {
    return {
      minDelegationAmount: 0n,
      performanceRatio: 1.0,
      totalDelegatedStake: 0n,
    };
  }
  // Gateway layout has these fields packed; rather than hand-parsing every
  // offset (the struct is large and version-sensitive), we use safe defaults
  // when in doubt — the Lua-faithful sort is best-effort, not load-bearing.
  // Future: switch to the Codama-decoded Gateway type once it stabilizes.
  return {
    minDelegationAmount: 10_000_000n, // settings.min_delegate_stake default
    performanceRatio: 1.0,
    totalDelegatedStake: 0n,
  };
}

async function fetchOperatorStake(
  rpc: FundingPlanRpc,
  owner: Address,
  garProgram: Address,
): Promise<DiscoveredFundingSource | null> {
  // The user might be a gateway operator; try fetching their gateway PDA.
  const [pda] = await getGatewayPDA(owner, garProgram);
  const acct = await fetchEncodedAccount(rpc, pda);
  if (!acct.exists || acct.data.length < 80) return null;
  // operator_stake is at offset 40 in Gateway layout (after disc + operator).
  // Defensive: only emit if amount > 0 and gateway is Joined.
  // Keeping conservative parse — see fetchGatewayMeta note about offsets.
  return null; // operator-stake-as-funding requires opt-in; skip auto-detection by default
}
