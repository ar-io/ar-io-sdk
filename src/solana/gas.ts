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
 * Intent-aware gas (network cost) profiles for the ArNS purchase flows.
 *
 * On Solana the dominant cost of a purchase is NOT the transaction fee but
 * the rent-exempt deposits for the accounts the flow creates. Buy-Name in
 * particular runs TWO transactions — `ANT.spawn` (mints the MPL Core asset
 * and initializes the ANT state PDAs) followed by `buy_record` (creates the
 * ArNS record PDA) — and the spawn alone deposits ~0.012 SOL of rent, three
 * orders of magnitude more than the fees.
 *
 * Account byte sizes come from the codama clients where the account is
 * fixed-size; the ario programs additionally allocate their string-bearing
 * accounts at FIXED max-capacity space (verified size-identical across
 * mainnet names of widely different lengths), so those carry measured
 * constants. The only content-sized account is the MPL Core asset
 * (~2 bytes per name character). Rent itself is NOT hardcoded — it's
 * quoted from the cluster via `getMinimumBalanceForRentExemption` so
 * validator rent parameter changes are picked up automatically.
 */
import { getAclConfigSize } from '@ar.io/solana-contracts/ant';
import {
  getDelegationSize,
  getObserverLookupSize,
  getRedelegationRecordSize,
  getWithdrawalCounterSize,
  getWithdrawalSize,
} from '@ar.io/solana-contracts/gar';
import type { Intent } from '../types/io.js';
import type { SolanaRpc } from './types.js';

/**
 * Per-account byte sizes created by `spawnSolanaANT` (one transaction:
 * MPL Core `CreateV1` + `ario_ant::initialize` + ACL bootstrap).
 *
 * The ario-program accounts (AntConfig, AntControllers, AntRecord,
 * ArnsRecord, PrimaryName) are allocated at FIXED max-capacity space —
 * verified identical across mainnet names of length 4, 12, and 28 — so the
 * codama content encoders (which measure current content, not allocation)
 * can't supply these; the measured constants below ARE the allocation.
 * Only the MPL Core asset is content-sized at runtime: it grows ~2 bytes
 * per name character (the name appears in both `AssetV1.name` and the
 * `ARNS Name` attribute written at purchase), plus a few bytes of variance
 * from other attribute values.
 */
const SPAWN_ASSET_BYTES_BASE = 281; // + 2 × nameLen
const SPAWN_ANT_CONFIG_BYTES = 452;
const SPAWN_ANT_CONTROLLERS_BYTES = 176;
const SPAWN_ROOT_RECORD_BYTES = 316;

/**
 * ArNS record PDA created by `buy_record` — fixed allocation (stores the
 * 32-byte name hash, not the name; verified size-identical across names).
 */
const ARNS_RECORD_BYTES = 191;

/**
 * First-time ACL bootstrap: `register_acl_config` + `add_acl_page`. Only
 * created when the buyer has never owned an ANT before (or, rarely, when
 * every existing page is at capacity — that edge is ignored here; pages
 * hold hundreds of entries). The config is fixed-size (codama); the page
 * is pre-allocated at its measured 8504 bytes.
 */
const ACL_CONFIG_BYTES = getAclConfigSize();
const ACL_PAGE_BYTES = 8504;

/**
 * PrimaryName PDA created on approve — fixed allocation (verified
 * size-identical for 5- and 39-char names). The request flow also creates
 * a transient PrimaryNameRequest PDA that is closed (rent refunded) on
 * approve — approximated with the same size so the wallet is gated on
 * what it must hold UPFRONT, not the net cost.
 */
const PRIMARY_NAME_BYTES = 119;

/**
 * Undername `AntRecord` PDA created by `set_record` — fixed allocation
 * like every other ario-program account (the root `@` record measures 316
 * regardless of name; undername/target capacity is part of the fixed
 * space).
 */
export const ANT_RECORD_BYTES = 316;

/**
 * Byte sizes of the accounts a bare `spawnSolanaANT` creates (asset,
 * AntConfig, AntControllers, root `@` record) — excluding the conditional
 * first-time ACL bootstrap, which spawn-adjacent flows quote separately.
 */
export function spawnAntAccountBytes(nameLength: number): number[] {
  const nameLen = Math.min(Math.max(nameLength, 1), 51);
  return [
    SPAWN_ASSET_BYTES_BASE + 2 * nameLen,
    SPAWN_ANT_CONFIG_BYTES,
    SPAWN_ANT_CONTROLLERS_BYTES,
    SPAWN_ROOT_RECORD_BYTES,
  ];
}

/**
 * First-time ACL bootstrap account sizes (`register_acl_config` +
 * `add_acl_page`) — also needed by `transfer` when the RECIPIENT has never
 * owned an ANT.
 */
export const ACL_BOOTSTRAP_ACCOUNT_BYTES = [ACL_CONFIG_BYTES, ACL_PAGE_BYTES];

// =========================================
// GAR (gateway registry) workflows
// =========================================

/**
 * GAR account sizes. The fixed-size accounts come straight from the codama
 * clients (verified byte-identical against live mainnet accounts), so they
 * track program upgrades with the `@ar.io/solana-contracts` dependency.
 * Only two need measured values: the Gateway account is variable-size
 * (964 measured for a typical label/fqdn — varies a few tens of bytes),
 * and the gateway registry grows by one 32-byte pubkey per join (realloc
 * on a long-lived account, not a creation).
 */
const GAR_GATEWAY_BYTES = 964;
const GAR_OBSERVER_LOOKUP_BYTES = getObserverLookupSize();
const GAR_REGISTRY_ENTRY_REALLOC_BYTES = 32;
const GAR_DELEGATION_BYTES = getDelegationSize();
const GAR_WITHDRAWAL_BYTES = getWithdrawalSize();
const GAR_WITHDRAWAL_COUNTER_BYTES = getWithdrawalCounterSize();
const GAR_REDELEGATION_RECORD_BYTES = getRedelegationRecordSize();

/**
 * Every GAR write in the SDK pins a 1M compute-unit limit (vs the 400k
 * ArNS default) — fee quotes for GAR workflows must assume the same.
 */
export const GAR_COMPUTE_UNIT_LIMIT = 1_000_000;

export type GarGasWorkflow =
  | 'join-network'
  | 'leave-network'
  | 'update-gateway-settings'
  | 'increase-operator-stake'
  | 'decrease-operator-stake'
  | 'delegate-stake'
  | 'decrease-delegate-stake'
  | 'redelegate-stake'
  | 'instant-withdrawal'
  | 'cancel-withdrawal'
  | 'claim-withdrawal';

/**
 * Describe what a GAR workflow does on chain. Conditional flags mirror the
 * ANT/ArNS profiles: callers resolve them from live account checks (or
 * leave the conservative defaults when the actor is unknown).
 *
 * - `needsDelegation` — delegate/redelegate to a gateway the delegator has
 *   no Delegation PDA with yet.
 * - `needsWithdrawalCounter` — the actor's first-ever withdrawal also
 *   creates their WithdrawalCounter PDA.
 * - `needsRedelegationRecord` — first redelegation in the fee window.
 * - `instant` — decrease-delegate-stake with instant payout: a second
 *   transaction closes the just-created vault (its rent comes back).
 *
 * Withdrawal-closing workflows (claim/cancel/instant) report no created
 * accounts here — the reclaimed deposit is read live by the estimator.
 */
export function getGarWorkflowGasProfile({
  workflow,
  needsDelegation = false,
  needsWithdrawalCounter = false,
  needsRedelegationRecord = false,
  instant = false,
}: {
  workflow: GarGasWorkflow;
  needsDelegation?: boolean;
  needsWithdrawalCounter?: boolean;
  needsRedelegationRecord?: boolean;
  instant?: boolean;
}): IntentGasProfile {
  switch (workflow) {
    case 'join-network':
      return {
        transactionCount: 1,
        signatureCount: 1,
        accountBytes: [GAR_GATEWAY_BYTES, GAR_OBSERVER_LOOKUP_BYTES],
        reallocBytes: GAR_REGISTRY_ENTRY_REALLOC_BYTES,
      };
    case 'leave-network':
      // Protected exit vault + (conservatively) the excess vault — the
      // contract only consumes the second when post-stake excess exists.
      return {
        transactionCount: 1,
        signatureCount: 1,
        accountBytes: [
          GAR_WITHDRAWAL_BYTES,
          GAR_WITHDRAWAL_BYTES,
          ...(needsWithdrawalCounter ? [GAR_WITHDRAWAL_COUNTER_BYTES] : []),
        ],
      };
    case 'delegate-stake':
      return {
        transactionCount: 1,
        signatureCount: 1,
        accountBytes: needsDelegation ? [GAR_DELEGATION_BYTES] : [],
      };
    case 'decrease-operator-stake':
    case 'decrease-delegate-stake':
      return {
        // instant payout sends a follow-up instant_withdrawal transaction
        transactionCount: instant ? 2 : 1,
        signatureCount: instant ? 2 : 1,
        accountBytes: [
          GAR_WITHDRAWAL_BYTES,
          ...(needsWithdrawalCounter ? [GAR_WITHDRAWAL_COUNTER_BYTES] : []),
        ],
      };
    case 'redelegate-stake':
      return {
        transactionCount: 1,
        signatureCount: 1,
        accountBytes: [
          ...(needsDelegation ? [GAR_DELEGATION_BYTES] : []),
          ...(needsRedelegationRecord ? [GAR_REDELEGATION_RECORD_BYTES] : []),
        ],
      };
    // Mutate-in-place or close-only workflows: no accounts created.
    case 'update-gateway-settings':
    case 'increase-operator-stake':
    case 'instant-withdrawal':
    case 'cancel-withdrawal':
    case 'claim-withdrawal':
    default:
      return { transactionCount: 1, signatureCount: 1, accountBytes: [] };
  }
}

export type IntentGasProfile = {
  /** Number of transactions the intent sends. */
  transactionCount: number;
  /** Total signatures across those transactions. */
  signatureCount: number;
  /** Byte sizes of the accounts the flow creates (rent payable by buyer). */
  accountBytes: number[];
  /**
   * Extra bytes added to EXISTING accounts via realloc (e.g. the gateway
   * registry growing on join) — rent is owed per byte but without the
   * per-account overhead a fresh account carries.
   */
  reallocBytes?: number;
};

/**
 * Describe what an intent does on chain: how many transactions it sends,
 * how many signatures those carry, and which accounts it creates.
 *
 * Flags:
 * - `needsAclBootstrap` — Buy-Name only: the buyer has no ACL config yet
 *   (first ANT), so the spawn also creates the ACL head + first page.
 * - `needsPrimaryNameAccount` — Primary-Name-Request only: the wallet has
 *   no PrimaryName PDA yet (setting, not changing, a primary name).
 */
export function getIntentGasProfile({
  intent,
  name = '',
  needsAclBootstrap = false,
  needsPrimaryNameAccount = false,
}: {
  intent?: Intent;
  name?: string;
  needsAclBootstrap?: boolean;
  needsPrimaryNameAccount?: boolean;
}): IntentGasProfile {
  const nameLen = Math.min(Math.max(name.length, 1), 51);
  switch (intent) {
    case 'Buy-Name':
    case 'Buy-Record':
      return {
        // spawn (fee payer + fresh mint keypair) then buy (fee payer)
        transactionCount: 2,
        signatureCount: 3,
        accountBytes: [
          ...spawnAntAccountBytes(nameLen),
          ARNS_RECORD_BYTES,
          ...(needsAclBootstrap ? [ACL_CONFIG_BYTES, ACL_PAGE_BYTES] : []),
        ],
      };
    case 'Primary-Name-Request':
      return {
        // request_primary_name then approve_primary_name_request. The
        // transient request PDA is included so the estimate reflects the
        // upfront balance requirement; its rent comes back on approval.
        transactionCount: 2,
        signatureCount: 2,
        accountBytes: [
          PRIMARY_NAME_BYTES,
          ...(needsPrimaryNameAccount ? [PRIMARY_NAME_BYTES] : []),
        ],
      };
    // Mutate-in-place intents: a single transaction, no accounts created.
    case 'Extend-Lease':
    case 'Upgrade-Name':
    case 'Increase-Undername-Limit':
    default:
      return { transactionCount: 1, signatureCount: 1, accountBytes: [] };
  }
}

/**
 * Lamports per (128 + size) byte of rent-exempt deposit — the cluster
 * default since genesis (`lamports_per_byte_year` 3480 × 2-year exemption
 * threshold). Used only as the fallback when the RPC quote fails.
 */
const FALLBACK_RENT_LAMPORTS_PER_BYTE = 6960;
const RENT_ACCOUNT_OVERHEAD_BYTES = 128;

/**
 * Quote the total rent-exempt deposit for a set of to-be-created accounts
 * (plus any realloc growth of existing accounts) in ONE RPC call. Solana
 * rent is linear in account size with a flat 128-byte per-account overhead,
 * so the sum over N accounts equals the exemption for a single account of
 * `Σbytes + 128×(N−1)`; realloc bytes ride along without extra overhead.
 *
 * Never throws: if the RPC query fails, falls back to computing the same
 * linear formula locally with the long-standing cluster constants.
 */
export async function estimateRentLamports(
  rpc: SolanaRpc,
  accountBytes: number[],
  reallocBytes = 0,
): Promise<number> {
  if (accountBytes.length === 0 && reallocBytes === 0) return 0;
  const totalBytes =
    accountBytes.reduce((sum, b) => sum + b, 0) +
    RENT_ACCOUNT_OVERHEAD_BYTES * Math.max(accountBytes.length - 1, 0) +
    reallocBytes;
  try {
    const rent = await rpc
      .getMinimumBalanceForRentExemption(BigInt(totalBytes))
      .send();
    return Number(rent);
  } catch {
    return (
      (totalBytes + RENT_ACCOUNT_OVERHEAD_BYTES) *
      FALLBACK_RENT_LAMPORTS_PER_BYTE
    );
  }
}
