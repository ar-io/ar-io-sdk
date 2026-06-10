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
 * Account byte sizes below were measured against mainnet accounts created by
 * the current program deployments (see the `(measured)` notes per constant).
 * Sizes that embed the (Arweave-normalized, ≤51 char) name carry a
 * `+ nameLen` linear term. Rent itself is NOT hardcoded — it's quoted from
 * the cluster via `getMinimumBalanceForRentExemption` so validator rent
 * parameter changes are picked up automatically.
 */
import type { Intent } from '../types/io.js';
import type { SolanaRpc } from './types.js';

/**
 * Per-account byte sizes created by `spawnSolanaANT` (one transaction:
 * MPL Core `CreateV1` + `ario_ant::initialize` + ACL bootstrap).
 * Measured from a mainnet spawn of a 12-char name (asset
 * 2ZUspD5DUv4mPVvVg5XMt1sNTN9jnMUXTCPGUNDTmmyh):
 *   asset=302, antConfig=452, antControllers=176, rootRecord=316.
 */
const SPAWN_ASSET_BYTES_BASE = 290; // + nameLen
const SPAWN_ANT_CONFIG_BYTES_BASE = 440; // + nameLen
const SPAWN_ANT_CONTROLLERS_BYTES = 176;
const SPAWN_ROOT_RECORD_BYTES = 316;

/** ArNS record PDA created by `buy_record` (measured: 191 for 12 chars). */
const ARNS_RECORD_BYTES_BASE = 179; // + nameLen

/**
 * First-time ACL bootstrap: `register_acl_config` + `add_acl_page`
 * (measured: 60 + 8504). Only created when the buyer has never owned an
 * ANT before (or, rarely, when every existing page is at capacity — that
 * edge is ignored here; pages hold hundreds of entries).
 */
const ACL_CONFIG_BYTES = 60;
const ACL_PAGE_BYTES = 8504;

/**
 * PrimaryName PDA created on approve (measured: 119 for a 14-char name).
 * The request flow also creates a transient PrimaryNameRequest PDA that is
 * closed (rent refunded) on approve — approximated with the same size so
 * the wallet is gated on what it must hold UPFRONT, not the net cost.
 */
const PRIMARY_NAME_BYTES_BASE = 105; // + nameLen

/**
 * Undername `AntRecord` PDA created by `set_record`. Derived from the
 * measured root record (316 bytes for a 1-char `@` undername and a 43-char
 * Arweave target): base excludes both variable strings. IPFS CID targets
 * run longer (~46–59 chars) — pass the actual target length when known.
 */
const ANT_RECORD_BYTES_BASE = 272; // + undernameLen + targetLen
const DEFAULT_TARGET_LENGTH = 43; // Arweave transaction id

/** Byte size of an undername record account. */
export function antRecordBytes(
  undernameLength: number,
  targetLength: number = DEFAULT_TARGET_LENGTH,
): number {
  return ANT_RECORD_BYTES_BASE + Math.max(undernameLength, 1) + targetLength;
}

/**
 * Byte sizes of the accounts a bare `spawnSolanaANT` creates (asset,
 * AntConfig, AntControllers, root `@` record) — excluding the conditional
 * first-time ACL bootstrap, which spawn-adjacent flows quote separately.
 */
export function spawnAntAccountBytes(nameLength: number): number[] {
  const nameLen = Math.min(Math.max(nameLength, 1), 51);
  return [
    SPAWN_ASSET_BYTES_BASE + nameLen,
    SPAWN_ANT_CONFIG_BYTES_BASE + nameLen,
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

export type IntentGasProfile = {
  /** Number of transactions the intent sends. */
  transactionCount: number;
  /** Total signatures across those transactions. */
  signatureCount: number;
  /** Byte sizes of the accounts the flow creates (rent payable by buyer). */
  accountBytes: number[];
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
          ARNS_RECORD_BYTES_BASE + nameLen,
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
          PRIMARY_NAME_BYTES_BASE + nameLen,
          ...(needsPrimaryNameAccount
            ? [PRIMARY_NAME_BYTES_BASE + nameLen]
            : []),
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
 * in ONE RPC call. Solana rent is linear in account size with a flat
 * 128-byte per-account overhead, so the sum over N accounts equals the
 * exemption for a single account of `Σbytes + 128×(N−1)`.
 *
 * Never throws: if the RPC query fails, falls back to computing the same
 * linear formula locally with the long-standing cluster constants.
 */
export async function estimateRentLamports(
  rpc: SolanaRpc,
  accountBytes: number[],
): Promise<number> {
  if (accountBytes.length === 0) return 0;
  const totalBytes =
    accountBytes.reduce((sum, b) => sum + b, 0) +
    RENT_ACCOUNT_OVERHEAD_BYTES * (accountBytes.length - 1);
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
