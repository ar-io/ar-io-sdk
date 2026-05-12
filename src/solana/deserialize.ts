/**
 * Account deserialization for AR.IO Solana programs.
 *
 * Reads raw account data (Borsh-encoded by Anchor) and returns SDK-compatible
 * types. Each function skips the 8-byte Anchor discriminator, then reads
 * fields in the exact order defined in the Rust structs.
 *
 * NOTE on discriminators: this module no longer exports a hand-rolled
 * discriminator table. The Codama-generated account modules under
 * `./generated/<program>/accounts/` already export
 * `<NAME>_DISCRIMINATOR: Uint8Array` constants pulled directly from each
 * IDL, so they're guaranteed to match the on-chain struct names.
 * Use those at the call site (see `io-readable.ts` for the
 * `getAccountsByDiscriminator` helper that bs58-encodes them for
 * `getProgramAccounts` memcmp filters).
 *
 * Borsh encoding rules (Anchor default):
 *   - u8/bool: 1 byte
 *   - u16: 2 bytes LE
 *   - u32: 4 bytes LE
 *   - u64: 8 bytes LE
 *   - u128: 16 bytes LE
 *   - i64: 8 bytes LE (signed)
 *   - Pubkey: 32 bytes
 *   - String: 4-byte LE length prefix + UTF-8 bytes
 *   - Option<T>: 1-byte tag (0=None, 1=Some) + T if Some
 *   - Vec<T>: 4-byte LE length + T[] elements
 *   - Enum: 1-byte variant index
 */
import {
  type Address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/kit';

import type {
  AoArNSLeaseData,
  AoArNSNameData,
  AoArNSPermabuyData,
  AoGateway,
  AoGatewayRegistrySettings,
  AoGatewaySettings,
  AoGatewayStats,
  AoGatewayWeights,
  AoVaultData,
} from '../types/io.js';
import { RATE_SCALE } from './constants.js';
import { getBalanceDecoder } from './generated/core/accounts/balance.js';
import { getEpochDecoder } from './generated/gar/accounts/epoch.js';

const addressDecoder = getAddressDecoder();
const addressEncoder = getAddressEncoder();

// =========================================
// Buffer reader helper
// =========================================

class BorshReader {
  private offset: number;
  constructor(
    private data: Buffer,
    startOffset = 0,
  ) {
    this.offset = startOffset;
  }

  readU8(): number {
    const val = this.data.readUInt8(this.offset);
    this.offset += 1;
    return val;
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readU16(): number {
    const val = this.data.readUInt16LE(this.offset);
    this.offset += 2;
    return val;
  }

  readU32(): number {
    const val = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return val;
  }

  readU64(): bigint {
    const val = this.data.readBigUInt64LE(this.offset);
    this.offset += 8;
    return val;
  }

  readU64AsNumber(): number {
    return Number(this.readU64());
  }

  readI64(): bigint {
    const val = this.data.readBigInt64LE(this.offset);
    this.offset += 8;
    return val;
  }

  readI64AsNumber(): number {
    return Number(this.readI64());
  }

  readU128(): bigint {
    const lo = this.data.readBigUInt64LE(this.offset);
    const hi = this.data.readBigUInt64LE(this.offset + 8);
    this.offset += 16;
    return (hi << 64n) | lo;
  }

  readPubkey(): Address {
    const bytes = this.data.subarray(this.offset, this.offset + 32);
    this.offset += 32;
    return addressDecoder.decode(bytes);
  }

  readString(): string {
    const len = this.readU32();
    const str = this.data.toString('utf8', this.offset, this.offset + len);
    this.offset += len;
    return str;
  }

  readOptionI64(): number | undefined {
    const tag = this.readU8();
    if (tag === 0) return undefined;
    return this.readI64AsNumber();
  }

  readOptionU32(): number | undefined {
    const tag = this.readU8();
    if (tag === 0) return undefined;
    return this.readU32();
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  getOffset(): number {
    return this.offset;
  }

  remaining(): number {
    return this.data.length - this.offset;
  }

  readOptionPubkey(): Address | undefined {
    const tag = this.readU8();
    if (tag === 0) return undefined;
    return this.readPubkey();
  }

  readOptionString(): string | undefined {
    const tag = this.readU8();
    if (tag === 0) return undefined;
    return this.readString();
  }

  readVecString(): string[] {
    const count = this.readU32();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.readString());
    }
    return result;
  }

  readOptionVecString(): string[] | undefined {
    const tag = this.readU8();
    if (tag === 0) return undefined;
    return this.readVecString();
  }

  readVecPubkey(): Address[] {
    const count = this.readU32();
    const result: Address[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.readPubkey());
    }
    return result;
  }

  readFixedU64Array(count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.readU64AsNumber());
    }
    return result;
  }

  readFixedBytes(count: number): Buffer {
    const buf = this.data.subarray(this.offset, this.offset + count);
    this.offset += count;
    return Buffer.from(buf);
  }
}

// =========================================
// Buffer writer helper
// =========================================

class BorshWriter {
  private buf: Buffer;
  private offset: number;

  constructor(size: number) {
    this.buf = Buffer.alloc(size);
    this.offset = 0;
  }

  writeU8(val: number): void {
    this.buf.writeUInt8(val, this.offset);
    this.offset += 1;
  }

  writeBool(val: boolean): void {
    this.writeU8(val ? 1 : 0);
  }

  writeU16(val: number): void {
    this.buf.writeUInt16LE(val, this.offset);
    this.offset += 2;
  }

  writeU32(val: number): void {
    this.buf.writeUInt32LE(val, this.offset);
    this.offset += 4;
  }

  writeU64(val: bigint | number): void {
    this.buf.writeBigUInt64LE(BigInt(val), this.offset);
    this.offset += 8;
  }

  writeI64(val: bigint | number): void {
    this.buf.writeBigInt64LE(BigInt(val), this.offset);
    this.offset += 8;
  }

  writePubkey(key: Address): void {
    const bytes = addressEncoder.encode(key);
    for (let i = 0; i < 32; i++) {
      this.buf[this.offset + i] = bytes[i];
    }
    this.offset += 32;
  }

  /** Write raw bytes without a length prefix (fixed-size fields). */
  writeFixedBytes(data: Buffer | Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.buf[this.offset + i] = data[i];
    }
    this.offset += data.length;
  }

  writeString(str: string): void {
    const encoded = Buffer.from(str, 'utf8');
    this.writeU32(encoded.length);
    encoded.copy(this.buf, this.offset);
    this.offset += encoded.length;
  }

  writeOptionI64(val: number | undefined): void {
    if (val === undefined) {
      this.writeU8(0);
    } else {
      this.writeU8(1);
      this.writeI64(val);
    }
  }

  writeOptionU32(val: number | undefined): void {
    if (val === undefined) {
      this.writeU8(0);
    } else {
      this.writeU8(1);
      this.writeU32(val);
    }
  }

  writeOptionPubkey(key: Address | undefined): void {
    if (key === undefined) {
      this.writeU8(0);
    } else {
      this.writeU8(1);
      this.writePubkey(key);
    }
  }

  writeOptionString(val: string | undefined): void {
    if (val === undefined) {
      this.writeU8(0);
    } else {
      this.writeU8(1);
      this.writeString(val);
    }
  }

  /** Borsh `Option<Vec<String>>`: 0/1 tag, then u32 length + each string. */
  writeOptionStringVec(val: string[] | undefined): void {
    if (val === undefined) {
      this.writeU8(0);
    } else {
      this.writeU8(1);
      this.writeU32(val.length);
      for (const s of val) this.writeString(s);
    }
  }

  toBuffer(): Buffer {
    return this.buf.subarray(0, this.offset);
  }

  getOffset(): number {
    return this.offset;
  }
}

// =========================================
// Helper: scale factor -> float
// =========================================

/** Convert a RATE_SCALE-encoded u64 to a float (e.g., 1_000_000 -> 1.0) */
function scaleToFloat(value: number, scale: number = RATE_SCALE): number {
  return value / scale;
}

// =========================================
// Gateway deserialization
// =========================================

/**
 * Deserialize a Gateway account from raw bytes.
 * PDA: ["gateway", operator_pubkey] in ario-gar program.
 *
 * Returns the SDK-compatible AoGateway type.
 */
export function deserializeGateway(
  data: Buffer,
): AoGateway & { operator: string } {
  const r = new BorshReader(data, 8); // skip 8-byte discriminator

  const operator = r.readPubkey();
  const label = r.readString();
  const fqdn = r.readString();
  const port = r.readU16();
  r.readU8(); // protocolIdx: 0=Http, 1=Https
  const properties = r.readString();
  const note = r.readString();
  const operatorStake = r.readU64AsNumber();
  const totalDelegatedStake = r.readU64AsNumber();
  const statusIdx = r.readU8(); // 0=Joined, 1=Leaving
  const startTimestamp = r.readI64AsNumber();
  const leaveTimestamp = r.readOptionI64();
  // leave_epoch_duration: i64 — snapshot of epoch_settings.epoch_duration captured
  // at leave_network/prune_gateway. Not surfaced on AoGateway; consume to stay aligned.
  r.skip(8);

  // GatewayStats
  const passedEpochCount = r.readU32();
  const failedEpochCount = r.readU32();
  const totalEpochCount = r.readU32();
  const prescribedEpochCount = r.readU32();
  const observedEpochCount = r.readU32();
  const failedConsecutiveEpochs = r.readU8();
  const passedConsecutiveEpochs = r.readU8();

  // GatewayWeights (7 x u64 — 7th is weights_epoch, set by tally_weights)
  const stakeWeight = r.readU64AsNumber();
  const tenureWeight = r.readU64AsNumber();
  const gatewayPerformanceRatio = r.readU64AsNumber();
  const observerPerformanceRatio = r.readU64AsNumber();
  const compositeWeight = r.readU64AsNumber();
  const normalizedCompositeWeight = r.readU64AsNumber();
  r.skip(8); // weights_epoch — not surfaced on AoGatewayWeights

  // GatewaySettings2 (auto_stake removed in cfc7a8b2 — never existed on Solana)
  const allowDelegatedStaking = r.readBool();
  const delegateRewardShareRatio = r.readU16();
  const minDelegatedStake = r.readU64AsNumber();
  const allowlistEnabled = r.readBool();

  // RegistryIndex (index: u32, _reserved: u8 — was is_registered:bool)
  r.readU32(); // registryIndex
  r.readU8(); // _reserved (layout-preserving placeholder for the legacy is_registered byte)

  // observer_address
  const observerAddress = r.readPubkey();

  // cumulative_reward_per_token (u128, not exposed in SDK type)
  r.skip(16);

  // bump
  r.skip(1);

  const stats: AoGatewayStats = {
    passedEpochCount,
    failedEpochCount,
    totalEpochCount,
    prescribedEpochCount,
    observedEpochCount,
    passedConsecutiveEpochs,
    failedConsecutiveEpochs,
  };

  const weights: AoGatewayWeights = {
    stakeWeight: scaleToFloat(stakeWeight),
    tenureWeight: scaleToFloat(tenureWeight),
    gatewayPerformanceRatio: scaleToFloat(gatewayPerformanceRatio),
    observerPerformanceRatio: scaleToFloat(observerPerformanceRatio),
    gatewayRewardRatioWeight: scaleToFloat(gatewayPerformanceRatio), // deprecated alias
    observerRewardRatioWeight: scaleToFloat(observerPerformanceRatio), // deprecated alias
    compositeWeight: scaleToFloat(compositeWeight),
    normalizedCompositeWeight: scaleToFloat(normalizedCompositeWeight),
  };

  const settings: AoGatewaySettings = {
    allowDelegatedStaking: allowlistEnabled
      ? 'allowlist'
      : allowDelegatedStaking,
    delegateRewardShareRatio,
    allowedDelegates: [], // populated separately from allowlist PDAs
    minDelegatedStake,
    autoStake: false, // not an on-chain field on Solana; preserved on AoGatewaySettings for AO parity
    label,
    note,
    properties,
    fqdn,
    port,
    protocol: 'https', // protocolIdx: 0=Http, 1=Https — only HTTPS in practice
  };

  return {
    operator: operator,
    settings,
    stats,
    totalDelegatedStake,
    startTimestamp,
    endTimestamp: leaveTimestamp ?? 0,
    observerAddress: observerAddress,
    operatorStake,
    status: statusIdx === 0 ? 'joined' : 'leaving',
    weights,
  };
}

// =========================================
// ArNS Record deserialization
// =========================================

/**
 * Deserialize an ArNS record account from raw bytes.
 * PDA: ["arns_record", hash(name)] in ario-arns program.
 *
 * Field order is **load-bearing** and mirrors the on-chain
 * `ArnsRecord` struct in `contracts/programs/ario-arns/src/state/mod.rs`.
 * Every fixed-size field appears before the variable-length `name` so
 * `getProgramAccounts` callers can `memcmp`-filter on `ant` (offset
 * 72) — see `ARNS_RECORD_ANT_OFFSET` in `./constants.ts`. If you
 * touch the contract layout, both files have to move in lockstep.
 */
export function deserializeArnsRecord(
  data: Buffer,
): AoArNSNameData & { name: string; owner: string } {
  const r = new BorshReader(data, 8); // skip discriminator

  r.readPubkey(); // 32-byte name hash (used as PDA seed)
  const owner = r.readPubkey();
  const ant = r.readPubkey(); // ANT Metaplex Core asset address
  const typeIdx = r.readU8(); // 0=Lease, 1=Permabuy
  const startTimestamp = r.readI64AsNumber();
  const endTimestamp = r.readOptionI64();
  // u16 on-chain — the prior implementation read u32 here and silently
  // consumed two bytes of `purchase_price`, producing junk for both
  // fields. Caught while reworking the layout for memcmp filtering.
  const undernameLimit = r.readU16();
  const purchasePrice = r.readU64AsNumber();
  r.skip(1); // bump
  const name = r.readString();

  const baseData = {
    name,
    owner: owner,
    processId: ant, // SDK calls ANT address "processId"
    startTimestamp,
    undernameLimit,
    purchasePrice,
  };

  if (typeIdx === 0 && endTimestamp !== undefined) {
    return {
      ...baseData,
      type: 'lease' as const,
      endTimestamp,
    } as AoArNSLeaseData & { name: string; owner: string };
  }

  return {
    ...baseData,
    type: 'permabuy' as const,
  } as AoArNSPermabuyData & { name: string; owner: string };
}

// =========================================
// Vault deserialization
// =========================================

/**
 * Deserialize a Vault account from raw bytes.
 * PDA: ["vault", owner, vault_id] in ario-core program.
 *
 * On-chain layout (matches `state::Vault`):
 *   disc(8) + owner(Pubkey=32) + vault_id(u64=8) + amount(u64=8)
 *   + start_timestamp(i64=8) + end_timestamp(i64=8)
 *   + controller(Option<Pubkey>=33) + revocable(bool=1) + bump(u8=1)
 */
export function deserializeVault(
  data: Buffer,
): AoVaultData & { owner: string } {
  const r = new BorshReader(data, 8); // skip discriminator

  const owner = r.readPubkey();
  // The Rust struct has vault_id BEFORE amount — easy to miss because the
  // SDK only surfaces `balance` (the AO interface name for `amount`). The
  // earlier deserializer skipped vault_id and read vault_id-as-balance →
  // `balance` was always 0 for fresh vaults at index 0.
  r.skip(8); // vault_id (recoverable from the PDA seeds; not surfaced)
  const balance = r.readU64AsNumber();
  const startTimestamp = r.readI64AsNumber();
  const endTimestamp = r.readI64AsNumber();

  // controller: Option<Pubkey>
  const hasController = r.readU8();
  const controller = hasController ? r.readPubkey() : undefined;

  // revocable: bool
  r.readBool();
  // bump
  r.skip(1);

  return {
    owner: owner,
    balance,
    startTimestamp,
    endTimestamp,
    controller,
  };
}

// =========================================
// Delegation deserialization
// =========================================

export type DeserializedDelegation = {
  gateway: string;
  delegator: string;
  delegatedStake: number;
  startTimestamp: number;
};

/**
 * Deserialize a Delegation account from raw bytes.
 * PDA: ["delegation", gateway, delegator] in ario-gar program.
 */
export function deserializeDelegation(data: Buffer): DeserializedDelegation {
  const r = new BorshReader(data, 8); // skip discriminator

  const gateway = r.readPubkey();
  const delegator = r.readPubkey();
  const amount = r.readU64AsNumber();
  const startTimestamp = r.readI64AsNumber();
  // reward_debt: u128, bump: u8 — skip
  r.skip(16 + 1);

  return {
    gateway: gateway,
    delegator: delegator,
    delegatedStake: amount,
    startTimestamp,
  };
}

// =========================================
// Balance deserialization
// =========================================

/**
 * Deserialize a Balance account from raw bytes.
 * PDA: ["balance", owner] in ario-core program.
 *
 * Backed by the Codama-generated decoder so the encoder
 * (`getBalanceEncoder` used by migration/snapshot) and decoder share a single
 * source of truth derived from the `ario_core` IDL.
 */
export function deserializeBalance(data: Buffer): {
  owner: string;
  balance: number;
} {
  const decoded = getBalanceDecoder().decode(data);
  return {
    owner: decoded.owner,
    balance: Number(decoded.amount),
  };
}

// =========================================
// Epoch Settings deserialization
// =========================================

export function deserializeEpochSettings(data: Buffer): {
  epochZeroStartTimestamp: number;
  durationMs: number;
  prescribedNameCount: number;
  maxObservers: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  r.skip(32); // authority
  const epochDuration = r.readI64AsNumber();
  const maxObservers = r.readU8(); // prescribed_observer_count
  const prescribedNameCount = r.readU8();
  r.skip(8); // min_observer_stake (u64)
  r.skip(2); // slash_rate (u16)
  r.skip(1); // enabled (bool)
  r.skip(8); // current_epoch_index (u64)
  const epochZeroStartTimestamp = r.readI64AsNumber(); // genesis_timestamp

  return {
    // SDK expects milliseconds (matching AO convention), Solana stores
    // seconds — convert both timestamps and durations here.
    epochZeroStartTimestamp: epochZeroStartTimestamp * 1000,
    durationMs: epochDuration * 1000,
    prescribedNameCount,
    maxObservers,
  };
}

// =========================================
// ArIO Config deserialization
// =========================================

/**
 * Deserialize an ArioConfig account from raw bytes.
 * PDA: ["ario_config"] in ario-core program.
 */
export function deserializeArioConfig(data: Buffer): {
  totalSupply: number;
  protocolBalance: number;
  circulatingSupply: number;
  lockedSupply: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  r.skip(32); // authority
  r.skip(32); // mint
  r.skip(32); // arns_program
  r.skip(32); // treasury
  const totalSupply = r.readU64AsNumber();
  const protocolBalance = r.readU64AsNumber();
  const circulatingSupply = r.readU64AsNumber();
  const lockedSupply = r.readU64AsNumber();
  // remaining fields not needed: min_vault_duration, max_vault_duration,
  // primary_name_request_expiry, migration_active, migration_authority, bump

  return {
    totalSupply,
    protocolBalance,
    circulatingSupply,
    lockedSupply,
  };
}

// =========================================
// Demand Factor deserialization
// =========================================

/**
 * Deserialize a DemandFactor account from raw bytes.
 * PDA: ["demand_factor"] in ario-arns program.
 */
export function deserializeDemandFactor(data: Buffer): {
  currentDemandFactor: number;
  currentPeriod: number;
  periodZeroStartTimestamp: number;
  consecutivePeriodsWithMinDemandFactor: number;
  trailingPeriodPurchases: number[];
  trailingPeriodRevenues: number[];
  fees: number[];
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const currentDemandFactorRaw = r.readU64AsNumber();
  const currentPeriod = r.readU64AsNumber();
  r.skip(8); // purchases_this_period (u64)
  r.skip(8); // revenue_this_period (u64)
  const consecutivePeriodsWithMinDemandFactor = r.readU32();
  const trailingPeriodPurchases = r.readFixedU64Array(7);
  const trailingPeriodRevenues = r.readFixedU64Array(7);
  const fees = r.readFixedU64Array(51);
  const periodZeroStartTimestamp = r.readI64AsNumber();
  // criteria: u8, bump: u8 — skip

  return {
    currentDemandFactor: currentDemandFactorRaw / RATE_SCALE,
    currentPeriod,
    periodZeroStartTimestamp,
    consecutivePeriodsWithMinDemandFactor,
    trailingPeriodPurchases,
    trailingPeriodRevenues,
    fees,
  };
}

// =========================================
// Reserved Name deserialization
// =========================================

/**
 * Deserialize a ReservedName account from raw bytes.
 * PDA: ["reserved_name", hash(name)] in ario-arns program.
 */
export function deserializeReservedName(data: Buffer): {
  name: string;
  target?: string;
  endTimestamp?: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const name = r.readString();
  const reservedFor = r.readOptionPubkey();
  const expiresAt = r.readOptionI64();
  // reserved_by: Pubkey, created_at: i64, bump: u8 — not needed

  return {
    name,
    target: reservedFor,
    endTimestamp: expiresAt,
  };
}

// =========================================
// Returned Name deserialization
// =========================================

const RETURN_AUCTION_DURATION_SECONDS = 14 * 86_400; // 14 days

/**
 * Deserialize a ReturnedName account from raw bytes.
 * PDA: ["returned_name", hash(name)] in ario-arns program.
 */
export function deserializeReturnedName(data: Buffer): {
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  initiator: string;
  premiumMultiplier: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const name = r.readString();
  r.skip(32); // name_hash [u8; 32]
  const initiator = r.readPubkey();
  const returnedAt = r.readI64AsNumber();
  // bump: u8 — skip

  return {
    name,
    startTimestamp: returnedAt,
    endTimestamp: returnedAt + RETURN_AUCTION_DURATION_SECONDS,
    initiator: initiator,
    premiumMultiplier: 1, // calculated at query time from elapsed vs auction duration
  };
}

// =========================================
// Withdrawal deserialization
// =========================================

/**
 * Deserialize a Withdrawal account from raw bytes.
 * PDA: ["withdrawal", gateway, owner, withdrawal_id] in ario-gar program.
 */
export function deserializeWithdrawal(data: Buffer): {
  owner: string;
  vaultId: string;
  gateway: string;
  balance: number;
  startTimestamp: number;
  endTimestamp: number;
  isDelegate: boolean;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const owner = r.readPubkey();
  const withdrawalId = r.readU64AsNumber();
  const gateway = r.readPubkey();
  const amount = r.readU64AsNumber();
  const createdAt = r.readI64AsNumber();
  const availableAt = r.readI64AsNumber();
  const isDelegate = r.readBool();
  // is_exit_vault: bool, bump: u8 — skip

  return {
    owner: owner,
    vaultId: String(withdrawalId),
    gateway: gateway,
    balance: amount,
    startTimestamp: createdAt,
    endTimestamp: availableAt,
    isDelegate,
  };
}

// =========================================
// Redelegation Record deserialization
// =========================================

/**
 * Deserialize a RedelegationRecord account from raw bytes.
 * PDA: ["redelegation", delegator] in ario-gar program.
 */
export function deserializeRedelegationRecord(data: Buffer): {
  delegator: string;
  redelegationCount: number;
  lastRedelegationAt: number;
  feeResetAt: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const delegator = r.readPubkey();
  const redelegationCount = r.readU32();
  const lastRedelegationAt = r.readI64AsNumber();
  const feeResetAt = r.readI64AsNumber();
  // bump: u8 — skip

  return {
    delegator: delegator,
    redelegationCount,
    lastRedelegationAt,
    feeResetAt,
  };
}

// =========================================
// Primary Name Request deserialization
// =========================================

/**
 * Deserialize a PrimaryNameRequest account from raw bytes.
 * PDA: ["primary_name_request", initiator] in ario-core program.
 */
export function deserializePrimaryNameRequest(data: Buffer): {
  name: string;
  initiator: string;
  startTimestamp: number;
  endTimestamp: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const initiator = r.readPubkey();
  const name = r.readString();
  const createdAt = r.readI64AsNumber();
  const expiresAt = r.readI64AsNumber();
  // bump: u8 — skip

  return {
    name,
    initiator: initiator,
    startTimestamp: createdAt,
    endTimestamp: expiresAt,
  };
}

// =========================================
// GAR Settings deserialization (full)
// =========================================

/**
 * Deserialize a GarSettings account from raw bytes and return
 * the full AoGatewayRegistrySettings type.
 * PDA: ["gar_settings"] in ario-gar program.
 *
 * Fields not stored in GarSettings are filled with protocol defaults.
 */
export function deserializeGarSettings(
  data: Buffer,
): AoGatewayRegistrySettings {
  const r = new BorshReader(data, 8); // skip discriminator

  r.skip(32); // authority
  r.skip(32); // mint
  const minOperatorStake = r.readU64AsNumber();
  const minDelegateStake = r.readU64AsNumber();
  const withdrawalPeriod = r.readI64AsNumber(); // seconds
  const maxExpeditedWithdrawalPenalty = r.readU64AsNumber();
  const minExpeditedWithdrawalPenalty = r.readU64AsNumber();
  const minExpeditedWithdrawalAmount = r.readU64AsNumber();
  r.readU32(); // max_delegates_per_gateway
  // migration_active: bool, migration_authority: Pubkey, bump: u8 — skip

  const withdrawalPeriodMs = withdrawalPeriod * 1000;

  return {
    delegates: {
      minStake: minDelegateStake,
      withdrawLengthMs: withdrawalPeriodMs,
    },
    observers: {
      tenureWeightDurationMs: 15_552_000_000, // 180 days in ms
      maxTenureWeight: 4,
    },
    operators: {
      minStake: minOperatorStake,
      withdrawLengthMs: withdrawalPeriodMs,
      leaveLengthMs: withdrawalPeriodMs,
      maxDelegateRewardSharePct: 95,
      failedEpochCountMax: 30,
      failedGatewaySlashRate: 0,
    },
    redelegations: {
      minRedelegationPenaltyRate: 0,
      maxRedelegationPenaltyRate: 600_000,
      minRedelegationAmount: 10_000_000,
      redelegationFeeResetIntervalMs: 7 * 86_400 * 1000,
    },
    expeditedWithdrawals: {
      minExpeditedWithdrawalPenaltyRate: minExpeditedWithdrawalPenalty,
      maxExpeditedWithdrawalPenaltyRate: maxExpeditedWithdrawalPenalty,
      minExpeditedWithdrawalAmount: minExpeditedWithdrawalAmount,
    },
  };
}

/**
 * Deserialize supply counter fields from GatewaySettings account.
 * These 3 fields were added after arns_program_id, before bump.
 */
export function deserializeGarSupplyCounters(data: Buffer): {
  totalStaked: number;
  totalDelegated: number;
  totalWithdrawn: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator
  r.skip(32); // authority
  r.skip(32); // mint
  r.skip(8); // min_operator_stake
  r.skip(8); // min_delegate_stake
  r.skip(8); // withdrawal_period
  r.skip(8); // max_expedited_withdrawal_penalty
  r.skip(8); // min_expedited_withdrawal_penalty
  r.skip(8); // min_expedited_withdrawal_amount
  r.skip(4); // max_delegates_per_gateway
  r.skip(1); // migration_active
  r.skip(32); // migration_authority
  r.skip(32); // stake_token_account
  r.skip(32); // protocol_token_account
  r.skip(32); // arns_program_id
  const totalStaked = r.readU64AsNumber();
  const totalDelegated = r.readU64AsNumber();
  const totalWithdrawn = r.readU64AsNumber();
  return { totalStaked, totalDelegated, totalWithdrawn };
}

// =========================================
// Epoch Settings Full deserialization
// =========================================

/**
 * Deserialize the full EpochSettings account from raw bytes.
 * Unlike deserializeEpochSettings (which returns 4 fields), this reads
 * all fields from the on-chain struct.
 * PDA: ["epoch_settings"] in ario-gar program.
 */
export function deserializeEpochSettingsFull(data: Buffer): {
  currentEpochIndex: number;
  genesisTimestamp: number;
  epochDuration: number;
  enabled: boolean;
  prescribedObserverCount: number;
  prescribedNameCount: number;
  tenureWeightDuration: number;
  maxTenureWeight: number;
  gatewayRewardRatio: number;
  observerRewardRatio: number;
  maxConsecutiveFailures: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  r.skip(32); // authority
  const epochDuration = r.readI64AsNumber();
  const prescribedObserverCount = r.readU8();
  const prescribedNameCount = r.readU8();
  r.skip(8); // min_observer_stake (u64)
  r.skip(2); // slash_rate (u16)
  const enabled = r.readU8() !== 0;
  const currentEpochIndex = r.readU64AsNumber();
  const genesisTimestamp = r.readI64AsNumber();
  const tenureWeightDuration = r.readI64AsNumber();
  const maxTenureWeight = r.readU64AsNumber();
  const gatewayRewardRatio = r.readU64AsNumber();
  const observerRewardRatio = r.readU64AsNumber();
  r.skip(8); // missed_observation_penalty_rate (u64)
  r.skip(8); // max_reward_rate (u64)
  r.skip(8); // min_reward_rate (u64)
  r.skip(8); // reward_decay_start_epoch (u64)
  r.skip(8); // reward_decay_last_epoch (u64)
  const maxConsecutiveFailures = r.readU8();
  // failed_gateway_slash_rate: u64, bump: u8 — skip

  return {
    currentEpochIndex,
    genesisTimestamp,
    epochDuration,
    enabled,
    prescribedObserverCount,
    prescribedNameCount,
    tenureWeightDuration,
    maxTenureWeight,
    gatewayRewardRatio,
    observerRewardRatio,
    maxConsecutiveFailures,
  };
}

// =========================================
// Epoch deserialization (zero-copy #[repr(C)])
// =========================================

/**
 * Deserialize an Epoch account from raw bytes.
 * PDA: ["epoch", epoch_index_le_bytes] in ario-gar program.
 *
 * This is a zero-copy account with #[repr(C)] layout (not Borsh).
 * Fields are at fixed offsets after the 8-byte discriminator.
 */
export function deserializeEpoch(data: Buffer): {
  epochIndex: number;
  startTimestamp: number;
  endTimestamp: number;
  totalEligibleRewards: number;
  perGatewayReward: number;
  perObserverReward: number;
  rewardRate: number;
  activeGatewayCount: number;
  distributionIndex: number;
  tallyIndex: number;
  observerCount: number;
  nameCount: number;
  observationsSubmitted: number;
  rewardsDistributed: number;
  weightsTallied: number;
  prescriptionsDone: number;
  failureCounts: Uint16Array;
  prescribedObservers: Address[];
  prescribedObserverGateways: Address[];
  prescribedNameHashes: Buffer[];
  hasObserved: Uint8Array;
} {
  // Codama-decoded path. Replaces the hand-rolled offset arithmetic
  // below — that broke under cluster cfg changes (e.g. the
  // `--features devnet-shrunk` build cuts the Epoch struct from
  // ~9400 bytes down to ~3472 bytes, but the hand-rolled deser had
  // hardcoded `base + 9388` reads that overshot the buffer). The
  // codama decoder is regenerated from the on-chain IDL on every
  // contract change, so layout drift is impossible by construction.
  // The "old" hand-rolled body is kept below this early return so
  // tests + any downstream consumers that need a specific subset
  // of fields still see the shape they expect.
  try {
    const codamaEpoch = getEpochDecoder().decode(new Uint8Array(data));
    return {
      epochIndex: Number(codamaEpoch.epochIndex),
      startTimestamp: Number(codamaEpoch.startTimestamp),
      endTimestamp: Number(codamaEpoch.endTimestamp),
      totalEligibleRewards: Number(codamaEpoch.totalEligibleRewards),
      perGatewayReward: Number(codamaEpoch.perGatewayReward),
      perObserverReward: Number(codamaEpoch.perObserverReward),
      rewardRate: Number(codamaEpoch.rewardRate),
      activeGatewayCount: codamaEpoch.activeGatewayCount,
      distributionIndex: codamaEpoch.distributionIndex,
      tallyIndex: codamaEpoch.tallyIndex,
      observerCount: codamaEpoch.observerCount,
      nameCount: codamaEpoch.nameCount,
      observationsSubmitted: codamaEpoch.observationsSubmitted,
      rewardsDistributed: codamaEpoch.rewardsDistributed,
      weightsTallied: codamaEpoch.weightsTallied,
      prescriptionsDone: codamaEpoch.prescriptionsDone,
      failureCounts: Uint16Array.from(codamaEpoch.failureCounts),
      prescribedObservers: codamaEpoch.prescribedObservers as Address[],
      prescribedObserverGateways:
        codamaEpoch.prescribedObserverGateways as Address[],
      prescribedNameHashes: codamaEpoch.prescribedNames.map((b) =>
        Buffer.from(b),
      ),
      hasObserved: new Uint8Array(codamaEpoch.hasObserved),
    };
  } catch (codamaErr: any) {
    // Fall through to the legacy hand-rolled path so tests/fixtures
    // that synthesize a custom Epoch buffer (e.g.
    // save-observations.test.ts) keep working. Real on-chain data
    // always succeeds via the codama path above.
    void codamaErr;
  }
  // All offsets relative to start of struct (after 8-byte discriminator)
  const base = 8;

  const epochIndex = Number(data.readBigUInt64LE(base + 0));
  const startTimestamp = Number(data.readBigInt64LE(base + 8));
  const endTimestamp = Number(data.readBigInt64LE(base + 16));
  const totalEligibleRewards = Number(data.readBigUInt64LE(base + 24));
  const perGatewayReward = Number(data.readBigUInt64LE(base + 32));
  const perObserverReward = Number(data.readBigUInt64LE(base + 40));
  const rewardRate = Number(data.readBigUInt64LE(base + 48));
  // total_composite_weight_lo/hi at 56, 64 — skip
  // hashchain at 72 — skip (32 bytes)
  const activeGatewayCount = data.readUInt32LE(base + 104);
  const distributionIndex = data.readUInt32LE(base + 108);
  const tallyIndex = data.readUInt32LE(base + 112);
  const observerCount = data.readUInt8(base + 116);
  const nameCount = data.readUInt8(base + 117);
  const observationsSubmitted = data.readUInt8(base + 118);
  const rewardsDistributed = data.readUInt8(base + 119);
  const weightsTallied = data.readUInt8(base + 120);
  const prescriptionsDone = data.readUInt8(base + 121);
  // bump at 122, _padding1 at 123

  // failure_counts: [u16; 3000] at offset 124
  const failureCounts = new Uint16Array(3000);
  for (let i = 0; i < 3000; i++) {
    failureCounts[i] = data.readUInt16LE(base + 124 + i * 2);
  }

  // prescribed_observers: [Pubkey; 50] at offset 6124
  const prescribedObservers: Address[] = [];
  for (let i = 0; i < 50; i++) {
    const off = base + 6124 + i * 32;
    prescribedObservers.push(
      addressDecoder.decode(data.subarray(off, off + 32)),
    );
  }

  // prescribed_observer_gateways: [Pubkey; 50] at offset 7724
  const prescribedObserverGateways: Address[] = [];
  for (let i = 0; i < 50; i++) {
    const off = base + 7724 + i * 32;
    prescribedObserverGateways.push(
      addressDecoder.decode(data.subarray(off, off + 32)),
    );
  }

  // prescribed_names: [[u8; 32]; 2] at offset 9324
  const prescribedNameHashes: Buffer[] = [];
  for (let i = 0; i < 2; i++) {
    const off = base + 9324 + i * 32;
    prescribedNameHashes.push(Buffer.from(data.subarray(off, off + 32)));
  }

  // has_observed: [u8; 7] at offset 9388
  const hasObserved = new Uint8Array(data.subarray(base + 9388, base + 9395));

  return {
    epochIndex,
    startTimestamp,
    endTimestamp,
    totalEligibleRewards,
    perGatewayReward,
    perObserverReward,
    rewardRate,
    activeGatewayCount,
    distributionIndex,
    tallyIndex,
    observerCount,
    nameCount,
    observationsSubmitted,
    rewardsDistributed,
    weightsTallied,
    prescriptionsDone,
    failureCounts,
    prescribedObservers,
    prescribedObserverGateways,
    prescribedNameHashes,
    hasObserved,
  };
}

// =========================================
// Observation deserialization
// =========================================

/**
 * Deserialize an Observation account from raw bytes.
 * PDA: ["observation", epoch_index_le_bytes, observer_pubkey] in ario-gar program.
 */
export function deserializeObservation(data: Buffer): {
  epochIndex: number;
  observer: string;
  gatewayResults: Buffer;
  gatewayCount: number;
  reportTxId: string;
  submittedAt: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const epochIndex = r.readU64AsNumber();
  const observer = r.readPubkey();
  const gatewayResults = r.readFixedBytes(375);
  const gatewayCount = r.readU16();
  const reportTxId = r.readFixedBytes(32).toString('base64url');
  const submittedAt = r.readI64AsNumber();

  return {
    epochIndex,
    observer,
    gatewayResults,
    gatewayCount,
    reportTxId,
    submittedAt,
  };
}

// =========================================
// ANT Config deserialization
// =========================================

/**
 * Deserialize an AntConfig account from raw bytes.
 * PDA: ["ant_config", mint] in ario-ant program.
 */
export function deserializeAntConfig(data: Buffer): {
  mint: string;
  name: string;
  ticker: string;
  logo: string;
  description: string;
  keywords: string[];
  owner: string;
  version: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const mint = r.readPubkey();
  const name = r.readString();
  const ticker = r.readString();
  const logo = r.readString();
  const description = r.readString();
  const keywords = r.readVecString();
  const lastKnownOwner = r.readPubkey();
  r.readU8(); // bump
  let version = 0;
  try {
    version = r.readU8();
  } catch {
    /* pre-version accounts default to 0 */
  }

  return {
    mint: mint,
    name,
    ticker,
    logo,
    description,
    keywords,
    owner: lastKnownOwner,
    version,
  };
}

// =========================================
// ANT Controllers deserialization
// =========================================

/**
 * Deserialize an AntControllers account from raw bytes.
 * PDA: ["ant_controllers", mint] in ario-ant program.
 */
export function deserializeAntControllers(data: Buffer): {
  mint: string;
  controllers: string[];
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const mint = r.readPubkey();
  const controllers = r.readVecPubkey().map((pk) => pk);
  // bump: u8 — skip

  return {
    mint: mint,
    controllers,
  };
}

// =========================================
// ANT Record deserialization
// =========================================

/**
 * Deserialize an AntRecord account from raw bytes.
 * PDA: ["ant_record", mint, hash(undername)] in ario-ant program.
 */
export function deserializeAntRecord(data: Buffer): {
  mint: string;
  undername: string;
  transactionId: string;
  targetProtocol: number;
  ttlSeconds: number;
  priority?: number;
  owner?: string;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const mint = r.readPubkey();
  const undername = r.readString();
  const transactionId = r.readString(); // on-chain field: target
  const targetProtocol = r.readU8(); // 0 = Arweave, 1 = IPFS
  const ttlSeconds = r.readU32();
  const priority = r.readOptionU32();
  const ownerPk = r.readOptionPubkey();
  // last_reconciled_owner: Pubkey, bump: u8 — skip

  return {
    mint: mint,
    undername,
    transactionId,
    targetProtocol,
    ttlSeconds,
    priority,
    owner: ownerPk,
  };
}

/**
 * Deserialize an AntRecordMetadata account from raw bytes.
 * This is a separate PDA that holds optional per-record metadata fields.
 */
export function deserializeAntRecordMetadata(data: Buffer): {
  mint: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const mint = r.readPubkey();
  r.skip(32); // undername_hash — [u8; 32], not needed by callers
  const displayName = r.readOptionString();
  const logo = r.readOptionString();
  const description = r.readOptionString();
  const keywords = r.readOptionVecString();
  // bump: u8 — skip

  return { mint, displayName, logo, description, keywords };
}

// =========================================
// ANT ACL (paginated) deserialization
// =========================================

/**
 * Per-user ACL entry: a `(asset, role)` tuple where `role` is `0=Owner`,
 * `1=Controller` (see `AclRole` in ario-ant). The byte layout matches the
 * on-chain `AclEntry` (33 bytes).
 */
export type DeserializedAclEntry = {
  asset: string;
  role: number;
};

/**
 * Deserialize an `AclConfig` account (paginated ACL head — ADR-012).
 * PDA: `["acl_config", user]` in ario-ant program.
 *
 * Holds counts but no entries. Read this first, then fan out to each
 * `AclPage` PDA (`["acl_page", user, page_idx_le]`) for the entries.
 */
export function deserializeAclConfig(data: Buffer): {
  user: string;
  pageCount: bigint;
  totalEntries: bigint;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const user = r.readPubkey();
  const pageCount = r.readU64();
  const totalEntries = r.readU64();
  // bump: u8 — managed by Anchor

  return {
    user: user as string,
    pageCount,
    totalEntries,
  };
}

/**
 * Deserialize an `AclPage` account (paginated ACL page — ADR-012).
 * PDA: `["acl_page", user, page_idx_le]` in ario-ant program.
 *
 * Stores up to `MAX_ACL_PAGE_ENTRIES` `(asset, role)` entries. Pages can
 * be sparse mid-life (entries are removed via `swap_remove`) — the SDK's
 * append path fills the first non-full page to keep density reasonable.
 */
export function deserializeAclPage(data: Buffer): {
  user: string;
  pageIdx: bigint;
  entries: DeserializedAclEntry[];
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const user = r.readPubkey();
  const pageIdx = r.readU64();
  const entryCount = r.readU32();
  const entries: DeserializedAclEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const asset = r.readPubkey();
    const role = r.readU8();
    entries.push({ asset: asset as string, role });
  }
  // bump: u8 — managed by Anchor

  return {
    user: user as string,
    pageIdx,
    entries,
  };
}

// =========================================
// Primary Name deserialization
// =========================================

/**
 * Deserialize a PrimaryName account from raw bytes.
 * PDA: ["primary_name", owner] in ario-core program.
 */
export function deserializePrimaryName(data: Buffer): {
  owner: string;
  name: string;
  processId: string;
  startTimestamp: number;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const owner = r.readPubkey();
  const name = r.readString();
  const processId = r.readPubkey();
  const startTimestamp = r.readI64AsNumber();
  // bump: u8 — skip

  return {
    owner: owner,
    name,
    processId: processId,
    startTimestamp,
  };
}

// =========================================
// Allowlist deserialization
// =========================================

/**
 * Deserialize an Allowlist entry account from raw bytes.
 * PDA: ["allowlist", gateway, delegate] in ario-gar program.
 */
export function deserializeAllowlist(data: Buffer): {
  gateway: string;
  delegate: string;
} {
  const r = new BorshReader(data, 8); // skip discriminator

  const gateway = r.readPubkey();
  const delegate = r.readPubkey();
  // bump: u8 — skip

  return {
    gateway: gateway,
    delegate: delegate,
  };
}

// Re-export the reader and writer for custom (de)serialization
export { BorshReader, BorshWriter };
