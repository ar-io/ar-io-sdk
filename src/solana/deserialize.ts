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
 * Thin adapter layer over Codama-generated account decoders from
 * `@ar.io/solana-contracts`. Each function accepts a raw `Buffer` (as
 * returned by `fetchEncodedAccount(...).data`) and returns the same
 * SDK-compatible plain-object shape the hand-rolled BorshReader
 * implementations used to return.
 *
 * The Codama decoders return `Address` (branded string) and `bigint`
 * for numeric fields. This module maps them to plain `string` and
 * `number` so the SDK's public API contract doesn't change.
 */
import {
  type Address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/kit';

import {
  getAclConfigDecoder,
  getAclPageDecoder,
  getAntConfigDecoder,
  getAntControllersDecoder,
  getAntRecordDecoder,
  getAntRecordMetadataDecoder,
} from '@ar.io/solana-contracts/ant';
import {
  PurchaseType,
  getArnsRecordDecoder,
  getDemandFactorDecoder,
  getReservedNameDecoder,
  getReturnedNameDecoder,
} from '@ar.io/solana-contracts/arns';
import {
  getArioConfigDecoder,
  getPrimaryNameDecoder,
  getPrimaryNameRequestDecoder,
  getVaultDecoder,
} from '@ar.io/solana-contracts/core';
import {
  GatewayStatus,
  getAllowlistEntryDecoder,
  getDelegationDecoder,
  getEpochDecoder,
  getEpochSettingsDecoder,
  getGatewaySettingsDecoder as getGarSettingsDecoder,
  getGatewayDecoder,
  getObservationDecoder,
  getRedelegationRecordDecoder,
  getWithdrawalDecoder,
} from '@ar.io/solana-contracts/gar';
import type {
  ArNSLeaseData,
  ArNSNameData,
  ArNSPermabuyData,
  Gateway,
  GatewayRegistrySettings,
  GatewaySettings,
  GatewayStats,
  GatewayWeights,
  VaultData,
} from '../types/io.js';
import { RATE_SCALE } from './constants.js';

const addressDecoder = getAddressDecoder();
const addressEncoder = getAddressEncoder();

function optionToValue<T>(opt: { __option: 'Some' | 'None'; value?: T }):
  | T
  | undefined {
  return opt.__option === 'Some' ? opt.value : undefined;
}

function scaleToFloat(value: number, scale: number = RATE_SCALE): number {
  return value / scale;
}

// =========================================
// Buffer reader/writer helpers (kept for test fixtures that synthesize account data)
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
    const str = this.data
      .toString('utf8', this.offset, this.offset + len)
      .replace(/\0/g, '');
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

  readOptionU16(): number | undefined {
    const tag = this.readU8();
    if (tag === 0) return undefined;
    return this.readU16();
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
// Gateway deserialization
// =========================================

export function deserializeGatewayWithAccumulator(
  data: Buffer,
): Gateway & { operator: string; cumulativeRewardPerToken: bigint } {
  const d = getGatewayDecoder().decode(new Uint8Array(data));

  const stats: GatewayStats = {
    passedEpochCount: d.stats.passedEpochs,
    failedEpochCount: d.stats.failedEpochs,
    totalEpochCount: d.stats.totalEpochs,
    prescribedEpochCount: d.stats.prescribedEpochs,
    observedEpochCount: d.stats.observedEpochs,
    passedConsecutiveEpochs: d.stats.passedConsecutive,
    failedConsecutiveEpochs: d.stats.failedConsecutive,
  };

  const weights: GatewayWeights = {
    stakeWeight: scaleToFloat(Number(d.weights.stakeWeight)),
    tenureWeight: scaleToFloat(Number(d.weights.tenureWeight)),
    gatewayPerformanceRatio: scaleToFloat(
      Number(d.weights.gatewayPerformanceRatio),
    ),
    observerPerformanceRatio: scaleToFloat(
      Number(d.weights.observerPerformanceRatio),
    ),
    gatewayRewardRatioWeight: scaleToFloat(
      Number(d.weights.gatewayPerformanceRatio),
    ),
    observerRewardRatioWeight: scaleToFloat(
      Number(d.weights.observerPerformanceRatio),
    ),
    compositeWeight: scaleToFloat(Number(d.weights.compositeWeight)),
    normalizedCompositeWeight: scaleToFloat(
      Number(d.weights.normalizedCompositeWeight),
    ),
  };

  const pendingRatioRaw = optionToValue(
    d.settings.pendingDelegateRewardShareRatio as any,
  ) as number | undefined;
  const pendingDelegateRewardShareRatio =
    pendingRatioRaw === undefined ? undefined : pendingRatioRaw / 100;
  const delegationDisabledAt = optionToValue(
    d.settings.delegationDisabledAt as any,
  ) as bigint | undefined;

  const settings: GatewaySettings = {
    allowDelegatedStaking: d.settings.allowlistEnabled
      ? 'allowlist'
      : d.settings.allowDelegatedStaking,
    delegateRewardShareRatio: d.settings.delegateRewardShareRatio / 100,
    allowedDelegates: [],
    minDelegatedStake: Number(d.settings.minDelegationAmount),
    autoStake: false,
    label: d.label,
    note: d.note,
    properties: d.properties,
    fqdn: d.fqdn,
    port: d.port,
    protocol: 'https',
    pendingDelegateRewardShareRatio,
    delegationDisabledAt:
      delegationDisabledAt !== undefined
        ? Number(delegationDisabledAt)
        : undefined,
  };

  const leaveTimestamp = optionToValue(d.leaveTimestamp as any) as
    | bigint
    | undefined;

  return {
    operator: d.operator as string,
    settings,
    stats,
    totalDelegatedStake: Number(d.totalDelegatedStake),
    startTimestamp: Number(d.startTimestamp),
    endTimestamp: leaveTimestamp !== undefined ? Number(leaveTimestamp) : 0,
    observerAddress: d.observerAddress as string,
    operatorStake: Number(d.operatorStake),
    status: d.status === GatewayStatus.Joined ? 'joined' : 'leaving',
    weights,
    cumulativeRewardPerToken: d.cumulativeRewardPerToken,
  };
}

export function deserializeGateway(
  data: Buffer,
): Gateway & { operator: string } {
  const { cumulativeRewardPerToken: _unused, ...publicShape } =
    deserializeGatewayWithAccumulator(data);
  return publicShape;
}

// =========================================
// ArNS Record deserialization
// =========================================

export function deserializeArnsRecord(
  data: Buffer,
): ArNSNameData & { name: string; owner: string } {
  const d = getArnsRecordDecoder().decode(new Uint8Array(data));
  const endTimestamp = optionToValue(d.endTimestamp as any) as
    | bigint
    | undefined;

  const baseData = {
    name: d.name,
    owner: d.owner as string,
    processId: d.ant as string,
    startTimestamp: Number(d.startTimestamp),
    undernameLimit: d.undernameLimit,
    purchasePrice: Number(d.purchasePrice),
  };

  if (d.purchaseType === PurchaseType.Lease && endTimestamp !== undefined) {
    return {
      ...baseData,
      type: 'lease' as const,
      endTimestamp: Number(endTimestamp),
    } as ArNSLeaseData & { name: string; owner: string };
  }

  return {
    ...baseData,
    type: 'permabuy' as const,
  } as ArNSPermabuyData & { name: string; owner: string };
}

// =========================================
// Vault deserialization
// =========================================

export function deserializeVault(data: Buffer): VaultData & { owner: string } {
  const d = getVaultDecoder().decode(new Uint8Array(data));
  const controller = optionToValue(d.controller as any) as Address | undefined;

  return {
    owner: d.owner as string,
    balance: Number(d.amount),
    startTimestamp: Number(d.startTimestamp),
    endTimestamp: Number(d.endTimestamp),
    controller: controller as string | undefined,
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
  rewardDebt: bigint;
};

export function deserializeDelegation(data: Buffer): DeserializedDelegation {
  const d = getDelegationDecoder().decode(new Uint8Array(data));

  return {
    gateway: d.gateway as string,
    delegator: d.delegator as string,
    delegatedStake: Number(d.amount),
    startTimestamp: Number(d.startTimestamp),
    rewardDebt: d.rewardDebt,
  };
}

// =========================================
// Balance deserialization
// =========================================

export function deserializeBalance(data: Buffer): {
  owner: string;
  balance: number;
} {
  const d = getBalanceDecoder().decode(new Uint8Array(data));
  return {
    owner: d.owner as string,
    balance: Number(d.amount),
  };
}

// Keep the import for deserializeBalance
import { getBalanceDecoder } from '@ar.io/solana-contracts/core';

// =========================================
// Epoch Settings deserialization
// =========================================

export function deserializeEpochSettings(data: Buffer): {
  epochZeroStartTimestamp: number;
  durationMs: number;
  prescribedNameCount: number;
  maxObservers: number;
} {
  const d = getEpochSettingsDecoder().decode(new Uint8Array(data));

  return {
    epochZeroStartTimestamp: Number(d.genesisTimestamp) * 1000,
    durationMs: Number(d.epochDuration) * 1000,
    prescribedNameCount: d.prescribedNameCount,
    maxObservers: d.prescribedObserverCount,
  };
}

// =========================================
// ArIO Config deserialization
// =========================================

export function deserializeArioConfig(data: Buffer): {
  totalSupply: number;
  protocolBalance: number;
  circulatingSupply: number;
  lockedSupply: number;
} {
  const d = getArioConfigDecoder().decode(new Uint8Array(data));

  return {
    totalSupply: Number(d.totalSupply),
    protocolBalance: Number(d.protocolBalance),
    circulatingSupply: Number(d.circulatingSupply),
    lockedSupply: Number(d.lockedSupply),
  };
}

// =========================================
// Demand Factor deserialization
// =========================================

export function deserializeDemandFactor(data: Buffer): {
  currentDemandFactor: number;
  currentPeriod: number;
  periodZeroStartTimestamp: number;
  consecutivePeriodsWithMinDemandFactor: number;
  trailingPeriodPurchases: number[];
  trailingPeriodRevenues: number[];
  fees: number[];
} {
  const d = getDemandFactorDecoder().decode(new Uint8Array(data));

  return {
    currentDemandFactor: Number(d.currentDemandFactor) / RATE_SCALE,
    currentPeriod: Number(d.currentPeriod),
    periodZeroStartTimestamp: Number(d.periodZeroStartTimestamp),
    consecutivePeriodsWithMinDemandFactor:
      d.consecutivePeriodsWithMinDemandFactor,
    trailingPeriodPurchases: d.trailingPeriodPurchases.map(Number),
    trailingPeriodRevenues: d.trailingPeriodRevenues.map(Number),
    fees: d.fees.map(Number),
  };
}

// =========================================
// Reserved Name deserialization
// =========================================

export function deserializeReservedName(data: Buffer): {
  name: string;
  target?: string;
  endTimestamp?: number;
} {
  const d = getReservedNameDecoder().decode(new Uint8Array(data));
  const reservedFor = optionToValue(d.reservedFor as any) as
    | Address
    | undefined;
  const expiresAt = optionToValue(d.expiresAt as any) as bigint | undefined;

  return {
    name: d.name,
    target: reservedFor as string | undefined,
    endTimestamp: expiresAt !== undefined ? Number(expiresAt) : undefined,
  };
}

// =========================================
// Returned Name deserialization
// =========================================

const RETURN_AUCTION_DURATION_SECONDS = 14 * 86_400;

export function deserializeReturnedName(data: Buffer): {
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  initiator: string;
  premiumMultiplier: number;
} {
  const d = getReturnedNameDecoder().decode(new Uint8Array(data));
  const returnedAt = Number(d.returnedAt);

  return {
    name: d.name,
    startTimestamp: returnedAt,
    endTimestamp: returnedAt + RETURN_AUCTION_DURATION_SECONDS,
    initiator: d.initiator as string,
    premiumMultiplier: 1,
  };
}

// =========================================
// Withdrawal deserialization
// =========================================

export function deserializeWithdrawal(data: Buffer): {
  owner: string;
  vaultId: string;
  gateway: string;
  balance: number;
  startTimestamp: number;
  endTimestamp: number;
  isDelegate: boolean;
} {
  const d = getWithdrawalDecoder().decode(new Uint8Array(data));

  return {
    owner: d.owner as string,
    vaultId: String(Number(d.withdrawalId)),
    gateway: d.gateway as string,
    balance: Number(d.amount),
    startTimestamp: Number(d.createdAt),
    endTimestamp: Number(d.availableAt),
    isDelegate: d.isDelegate,
  };
}

// =========================================
// Redelegation Record deserialization
// =========================================

export function deserializeRedelegationRecord(data: Buffer): {
  delegator: string;
  redelegationCount: number;
  lastRedelegationAt: number;
  feeResetAt: number;
} {
  const d = getRedelegationRecordDecoder().decode(new Uint8Array(data));

  return {
    delegator: d.delegator as string,
    redelegationCount: d.redelegationCount,
    lastRedelegationAt: Number(d.lastRedelegationAt),
    feeResetAt: Number(d.feeResetAt),
  };
}

// =========================================
// Primary Name Request deserialization
// =========================================

export function deserializePrimaryNameRequest(data: Buffer): {
  name: string;
  initiator: string;
  startTimestamp: number;
  endTimestamp: number;
} {
  const d = getPrimaryNameRequestDecoder().decode(new Uint8Array(data));

  return {
    name: d.name,
    initiator: d.initiator as string,
    startTimestamp: Number(d.createdAt),
    endTimestamp: Number(d.expiresAt),
  };
}

// =========================================
// GAR Settings deserialization
// =========================================

export function deserializeGarSettings(data: Buffer): GatewayRegistrySettings {
  const d = getGarSettingsDecoder().decode(new Uint8Array(data));
  const withdrawalPeriodMs = Number(d.withdrawalPeriod) * 1000;

  return {
    delegates: {
      minStake: Number(d.minDelegateStake),
      withdrawLengthMs: withdrawalPeriodMs,
    },
    observers: {
      tenureWeightDurationMs: 15_552_000_000,
      maxTenureWeight: 4,
    },
    operators: {
      minStake: Number(d.minOperatorStake),
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
      minExpeditedWithdrawalPenaltyRate: Number(
        d.minExpeditedWithdrawalPenalty,
      ),
      maxExpeditedWithdrawalPenaltyRate: Number(
        d.maxExpeditedWithdrawalPenalty,
      ),
      minExpeditedWithdrawalAmount: Number(d.minExpeditedWithdrawalAmount),
    },
  };
}

export function deserializeGarSupplyCounters(data: Buffer): {
  totalStaked: number;
  totalDelegated: number;
  totalWithdrawn: number;
} {
  const d = getGarSettingsDecoder().decode(new Uint8Array(data));

  return {
    totalStaked: Number(d.totalStaked),
    totalDelegated: Number(d.totalDelegated),
    totalWithdrawn: Number(d.totalWithdrawn),
  };
}

// =========================================
// Epoch Settings Full deserialization
// =========================================

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
  const d = getEpochSettingsDecoder().decode(new Uint8Array(data));

  return {
    currentEpochIndex: Number(d.currentEpochIndex),
    genesisTimestamp: Number(d.genesisTimestamp),
    epochDuration: Number(d.epochDuration),
    enabled: d.enabled,
    prescribedObserverCount: d.prescribedObserverCount,
    prescribedNameCount: d.prescribedNameCount,
    tenureWeightDuration: Number(d.tenureWeightDuration),
    maxTenureWeight: Number(d.maxTenureWeight),
    gatewayRewardRatio: Number(d.gatewayRewardRatio),
    observerRewardRatio: Number(d.observerRewardRatio),
    maxConsecutiveFailures: d.maxConsecutiveFailures,
  };
}

// =========================================
// Epoch deserialization
// =========================================

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
  const d = getEpochDecoder().decode(new Uint8Array(data));

  return {
    epochIndex: Number(d.epochIndex),
    startTimestamp: Number(d.startTimestamp),
    endTimestamp: Number(d.endTimestamp),
    totalEligibleRewards: Number(d.totalEligibleRewards),
    perGatewayReward: Number(d.perGatewayReward),
    perObserverReward: Number(d.perObserverReward),
    rewardRate: Number(d.rewardRate),
    activeGatewayCount: d.activeGatewayCount,
    distributionIndex: d.distributionIndex,
    tallyIndex: d.tallyIndex,
    observerCount: d.observerCount,
    nameCount: d.nameCount,
    observationsSubmitted: d.observationsSubmitted,
    rewardsDistributed: d.rewardsDistributed,
    weightsTallied: d.weightsTallied,
    prescriptionsDone: d.prescriptionsDone,
    failureCounts: Uint16Array.from(d.failureCounts),
    prescribedObservers: d.prescribedObservers as Address[],
    prescribedObserverGateways: d.prescribedObserverGateways as Address[],
    prescribedNameHashes: d.prescribedNames.map((b) => Buffer.from(b)),
    hasObserved: new Uint8Array(d.hasObserved),
  };
}

// =========================================
// Observation deserialization
// =========================================

export function deserializeObservation(data: Buffer): {
  epochIndex: number;
  observer: string;
  gatewayResults: Buffer;
  gatewayCount: number;
  reportTxId: string;
  submittedAt: number;
} {
  const d = getObservationDecoder().decode(new Uint8Array(data));

  return {
    epochIndex: Number(d.epochIndex),
    observer: d.observer as string,
    gatewayResults: Buffer.from(d.gatewayResults),
    gatewayCount: d.gatewayCount,
    reportTxId: Buffer.from(d.reportTxId).toString('base64url'),
    submittedAt: Number(d.submittedAt),
  };
}

// =========================================
// ANT Config deserialization
// =========================================

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
  const d = getAntConfigDecoder().decode(new Uint8Array(data));

  return {
    mint: d.mint as string,
    name: d.name,
    ticker: d.ticker,
    logo: d.logo,
    description: d.description,
    keywords: d.keywords,
    owner: d.lastKnownOwner as string,
    version: d.version.major,
  };
}

// =========================================
// ANT Controllers deserialization
// =========================================

export function deserializeAntControllers(data: Buffer): {
  mint: string;
  controllers: string[];
} {
  const d = getAntControllersDecoder().decode(new Uint8Array(data));

  return {
    mint: d.mint as string,
    controllers: d.controllers.map((c) => c as string),
  };
}

// =========================================
// ANT Record deserialization
// =========================================

export function deserializeAntRecord(data: Buffer): {
  mint: string;
  undername: string;
  transactionId: string;
  targetProtocol: number;
  ttlSeconds: number;
  priority?: number;
  owner?: string;
} {
  const d = getAntRecordDecoder().decode(new Uint8Array(data));

  return {
    mint: d.mint as string,
    undername: d.undername,
    transactionId: d.target,
    targetProtocol: d.targetProtocol,
    ttlSeconds: d.ttlSeconds,
    priority: optionToValue(d.priority as any) as number | undefined,
    owner: optionToValue(d.owner as any) as string | undefined,
  };
}

export function deserializeAntRecordMetadata(data: Buffer): {
  mint: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
} {
  const d = getAntRecordMetadataDecoder().decode(new Uint8Array(data));

  return {
    mint: d.mint as string,
    displayName: optionToValue(d.displayName as any) as string | undefined,
    logo: optionToValue(d.recordLogo as any) as string | undefined,
    description: optionToValue(d.recordDescription as any) as
      | string
      | undefined,
    keywords: optionToValue(d.recordKeywords as any) as string[] | undefined,
  };
}

// =========================================
// ANT ACL (paginated) deserialization
// =========================================

export type DeserializedAclEntry = {
  asset: string;
  role: number;
};

export function deserializeAclConfig(data: Buffer): {
  user: string;
  pageCount: bigint;
  totalEntries: bigint;
} {
  const d = getAclConfigDecoder().decode(new Uint8Array(data));

  return {
    user: d.user as string,
    pageCount: d.pageCount,
    totalEntries: d.totalEntries,
  };
}

export function deserializeAclPage(data: Buffer): {
  user: string;
  pageIdx: bigint;
  entries: DeserializedAclEntry[];
} {
  const d = getAclPageDecoder().decode(new Uint8Array(data));

  return {
    user: d.user as string,
    pageIdx: d.pageIdx,
    entries: d.entries.map((e) => ({
      asset: e.asset as string,
      role: e.role,
    })),
  };
}

// =========================================
// Primary Name deserialization
// =========================================

export function deserializePrimaryName(data: Buffer): {
  owner: string;
  name: string;
  startTimestamp: number;
} {
  const d = getPrimaryNameDecoder().decode(new Uint8Array(data));

  return {
    owner: d.owner as string,
    name: d.name,
    startTimestamp: Number(d.setAt),
  };
}

// =========================================
// Allowlist deserialization
// =========================================

export function deserializeAllowlist(data: Buffer): {
  gateway: string;
  delegate: string;
} {
  const d = getAllowlistEntryDecoder().decode(new Uint8Array(data));

  return {
    gateway: d.gateway as string,
    delegate: d.delegate as string,
  };
}

export { BorshReader, BorshWriter };
