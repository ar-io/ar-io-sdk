import { createHash } from 'crypto';

/**
 * PDA derivation helpers for AR.IO Solana programs.
 *
 * Each function derives the on-chain address for a given account type,
 * mirroring the seeds defined in the Anchor programs.
 *
 * All helpers are async — kit's `getProgramDerivedAddress` is async because
 * it may perform bump-seed search off the main thread in some environments.
 */
import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';

import {
  ACL_CONFIG_SEED,
  ACL_PAGE_SEED,
  ALLOWLIST_SEED,
  ANT_CONFIG_SEED,
  ANT_CONTROLLERS_SEED,
  ANT_RECORD_META_SEED,
  ANT_RECORD_SEED,
  ARIO_ANT_ESCROW_PROGRAM_ID,
  ARIO_ANT_PROGRAM_ID,
  ARIO_ARNS_PROGRAM_ID,
  ARIO_CONFIG_SEED,
  ARIO_CORE_PROGRAM_ID,
  ARIO_GAR_PROGRAM_ID,
  ARNS_RECORD_SEED,
  ARNS_REGISTRY_SEED,
  ARNS_SETTINGS_SEED,
  BALANCE_SEED,
  DELEGATION_SEED,
  DEMAND_FACTOR_SEED,
  EPOCH_SEED,
  EPOCH_SETTINGS_SEED,
  ESCROW_ANT_SEED,
  ESCROW_TOKEN_SEED,
  ESCROW_VAULT_SEED,
  GAR_SETTINGS_SEED,
  GATEWAY_REGISTRY_SEED,
  GATEWAY_SEED,
  OBSERVATION_SEED,
  OBSERVER_LOOKUP_SEED,
  PRIMARY_NAME_REQUEST_SEED,
  PRIMARY_NAME_REVERSE_SEED,
  PRIMARY_NAME_SEED,
  REDELEGATION_SEED,
  RESERVED_NAME_SEED,
  RETURNED_NAME_SEED,
  VAULT_COUNTER_SEED,
  VAULT_SEED,
  WITHDRAWAL_COUNTER_SEED,
  WITHDRAWAL_SEED,
} from './constants.js';

const addressEncoder = getAddressEncoder();

/** Return shape for every PDA helper: `[pdaAddress, bumpSeed]`. */
export type Pda = readonly [Address, number];

/**
 * Hash a variable-length name for use as PDA seed.
 * Matches Rust: hash(name.to_lowercase().as_bytes())
 */
export function hashName(name: string): Buffer {
  return createHash('sha256')
    .update(name.toLowerCase())
    .digest()
    .subarray(0, 32);
}

// =========================================
// ario-core PDAs
// =========================================

export async function getArioConfigPDA(
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ARIO_CONFIG_SEED],
  });
}

export async function getBalancePDA(
  owner: Address,
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [BALANCE_SEED, addressEncoder.encode(owner)],
  });
}

export async function getVaultPDA(
  owner: Address,
  vaultId: bigint | number,
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(vaultId));
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [VAULT_SEED, addressEncoder.encode(owner), idBuf],
  });
}

export async function getVaultCounterPDA(
  owner: Address,
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [VAULT_COUNTER_SEED, addressEncoder.encode(owner)],
  });
}

export async function getPrimaryNamePDA(
  owner: Address,
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [PRIMARY_NAME_SEED, addressEncoder.encode(owner)],
  });
}

export async function getPrimaryNameRequestPDA(
  initiator: Address,
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [PRIMARY_NAME_REQUEST_SEED, addressEncoder.encode(initiator)],
  });
}

export async function getPrimaryNameReversePDA(
  name: string,
  programId: Address = ARIO_CORE_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [PRIMARY_NAME_REVERSE_SEED, hashName(name)],
  });
}

// =========================================
// ario-gar PDAs
// =========================================

export async function getGatewayRegistryPDA(
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [GATEWAY_REGISTRY_SEED],
  });
}

export async function getGarSettingsPDA(
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [GAR_SETTINGS_SEED],
  });
}

export async function getGatewayPDA(
  operator: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [GATEWAY_SEED, addressEncoder.encode(operator)],
  });
}

export async function getDelegationPDA(
  gateway: Address,
  delegator: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      DELEGATION_SEED,
      addressEncoder.encode(gateway),
      addressEncoder.encode(delegator),
    ],
  });
}

export async function getWithdrawalPDA(
  owner: Address,
  withdrawalId: bigint | number,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(withdrawalId));
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [WITHDRAWAL_SEED, addressEncoder.encode(owner), idBuf],
  });
}

export async function getWithdrawalCounterPDA(
  owner: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [WITHDRAWAL_COUNTER_SEED, addressEncoder.encode(owner)],
  });
}

export async function getAllowlistPDA(
  gateway: Address,
  delegate: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      ALLOWLIST_SEED,
      addressEncoder.encode(gateway),
      addressEncoder.encode(delegate),
    ],
  });
}

export async function getEpochPDA(
  epochIndex: number,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  const indexBuf = Buffer.alloc(8);
  indexBuf.writeBigUInt64LE(BigInt(epochIndex));
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [EPOCH_SEED, indexBuf],
  });
}

export async function getEpochSettingsPDA(
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [EPOCH_SETTINGS_SEED],
  });
}

export async function getRedelegationRecordPDA(
  delegator: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [REDELEGATION_SEED, addressEncoder.encode(delegator)],
  });
}

export async function getObservationPDA(
  epochIndex: number,
  observer: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  const indexBuf = Buffer.alloc(8);
  indexBuf.writeBigUInt64LE(BigInt(epochIndex));
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [OBSERVATION_SEED, indexBuf, addressEncoder.encode(observer)],
  });
}

export async function getObserverLookupPDA(
  observerAddress: Address,
  programId: Address = ARIO_GAR_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [OBSERVER_LOOKUP_SEED, addressEncoder.encode(observerAddress)],
  });
}

// =========================================
// ario-arns PDAs
// =========================================

export async function getArnsRegistryPDA(
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ARNS_REGISTRY_SEED],
  });
}

export async function getArnsSettingsPDA(
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ARNS_SETTINGS_SEED],
  });
}

export async function getArnsRecordPDA(
  name: string,
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ARNS_RECORD_SEED, hashName(name)],
  });
}

/**
 * Derive ArNS record PDA from a raw 32-byte name hash.
 * Used when resolving prescribed name hashes from Epoch data.
 */
export async function getArnsRecordPDAFromHash(
  nameHash: Buffer,
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ARNS_RECORD_SEED, nameHash],
  });
}

export async function getReservedNamePDA(
  name: string,
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [RESERVED_NAME_SEED, hashName(name)],
  });
}

export async function getReturnedNamePDA(
  name: string,
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [RETURNED_NAME_SEED, hashName(name)],
  });
}

export async function getDemandFactorPDA(
  programId: Address = ARIO_ARNS_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [DEMAND_FACTOR_SEED],
  });
}

// =========================================
// ario-ant PDAs
// =========================================

export async function getAntConfigPDA(
  mint: Address,
  programId: Address = ARIO_ANT_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ANT_CONFIG_SEED, addressEncoder.encode(mint)],
  });
}

export async function getAntControllersPDA(
  mint: Address,
  programId: Address = ARIO_ANT_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ANT_CONTROLLERS_SEED, addressEncoder.encode(mint)],
  });
}

export async function getAntRecordPDA(
  mint: Address,
  undername: string,
  programId: Address = ARIO_ANT_PROGRAM_ID,
): Promise<Pda> {
  const nameHash = createHash('sha256')
    .update(undername.toLowerCase())
    .digest()
    .subarray(0, 32);
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ANT_RECORD_SEED, addressEncoder.encode(mint), nameHash],
  });
}

export async function getAntRecordMetadataPDA(
  mint: Address,
  undername: string,
  programId: Address = ARIO_ANT_PROGRAM_ID,
): Promise<Pda> {
  const nameHash = createHash('sha256')
    .update(undername.toLowerCase())
    .digest()
    .subarray(0, 32);
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ANT_RECORD_META_SEED, addressEncoder.encode(mint), nameHash],
  });
}

/**
 * Derive the `AclConfig` head PDA for a given wallet address.
 *
 * Seeds: `["acl_config", user]` under the ario-ant program.
 *
 * See ADR-012 (docs/DECISIONS.md): `AclConfig` is the head record for a
 * user's paginated ACL. It tracks `page_count` (how many `AclPage` PDAs
 * exist) and `total_entries` (sum across pages). Frontends point-read
 * this once, then fan out to each `AclPage` via `getMultipleAccountsInfo`.
 */
export async function getAclConfigPDA(
  user: Address,
  programId: Address = ARIO_ANT_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ACL_CONFIG_SEED, addressEncoder.encode(user)],
  });
}

/**
 * Derive an `AclPage` PDA for a given user + page index.
 *
 * Seeds: `["acl_page", user, page_idx_le]` where `page_idx_le` is the
 * 8-byte little-endian encoding of `u64` (matches the contract).
 *
 * Each page address is content-derivable from `(user, page_idx)`, so any
 * single page can be loaded in O(1) without scanning sibling pages.
 */
export async function getAclPagePDA(
  user: Address,
  pageIdx: bigint | number,
  programId: Address = ARIO_ANT_PROGRAM_ID,
): Promise<Pda> {
  const idxBuf = Buffer.alloc(8);
  idxBuf.writeBigUInt64LE(BigInt(pageIdx));
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ACL_PAGE_SEED, addressEncoder.encode(user), idxBuf],
  });
}

// =========================================
// ario-ant-escrow PDAs
// =========================================

/**
 * Derive the EscrowAnt PDA for a given ANT mint. Exactly one escrow per
 * ANT — re-deriving the address tells you whether an escrow already
 * exists (look up the account and check `data.length`).
 *
 * Seeds: ["escrow_ant", ant_mint]
 * Source: contracts/programs/ario-ant-escrow/src/state.rs::ESCROW_ANT_SEED
 */
export async function getEscrowAntPDA(
  antMint: Address,
  programId: Address = ARIO_ANT_ESCROW_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ESCROW_ANT_SEED, addressEncoder.encode(antMint)],
  });
}

/**
 * Derive the EscrowToken PDA for a given depositor and asset ID.
 *
 * Seeds: ["escrow_token", depositor, asset_id]
 * Source: contracts/programs/ario-ant-escrow/src/state.rs::ESCROW_TOKEN_SEED
 */
export async function getEscrowTokenPDA(
  depositor: Address,
  assetId: Uint8Array,
  programId: Address = ARIO_ANT_ESCROW_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ESCROW_TOKEN_SEED, addressEncoder.encode(depositor), assetId],
  });
}

/**
 * Derive the EscrowVault PDA for a given depositor and asset ID.
 *
 * Seeds: ["escrow_vault", depositor, asset_id]
 * Source: contracts/programs/ario-ant-escrow/src/state.rs::ESCROW_VAULT_SEED
 */
export async function getEscrowVaultPDA(
  depositor: Address,
  assetId: Uint8Array,
  programId: Address = ARIO_ANT_ESCROW_PROGRAM_ID,
): Promise<Pda> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [ESCROW_VAULT_SEED, addressEncoder.encode(depositor), assetId],
  });
}
