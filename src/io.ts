/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { AOProcess } from './common/index.js';
import { mIOToken } from './token.js';
import {
  AoMessageResult,
  AoSigner,
  AtLeastOne,
  BlockHeight,
  ProcessId,
  Timestamp,
  TransactionId,
  WalletAddress,
  WriteOptions,
} from './types.js';
import { validateArweaveId } from './utils/arweave.js';

// Pagination

export type PaginationParams = {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginationResult<T> = {
  items: T[];
  nextCursor: string | undefined;
  totalItems: number;
  sortBy: keyof T;
  sortOrder: 'asc' | 'desc';
  hasMore: boolean;
};

// Configuration
export type ProcessConfiguration =
  | {
      process?: AOProcess;
    }
  | {
      processId?: string;
    };

export type EpochInput =
  | {
      epochIndex: AoEpochIndex;
    }
  | {
      timestamp: Timestamp;
    }
  | undefined;

// AO/IO Contract
export type AoBalances = Record<WalletAddress, number>;
export type AoFees = Record<string, number>;
export type AoObservations = Record<number, AoEpochObservationData>;
export type AoEpochIndex = number;

export interface AoIOState {
  GatewayRegistry: Record<WalletAddress, AoGateway>;
  Epochs: Record<AoEpochIndex, AoEpochData>;
  NameRegistry: {
    records: Record<string, AoArNSNameData>;
    reserved: Record<string, AoArNSReservedNameData>;
  };
  Balances: Record<WalletAddress, number>;
  Vaults: Record<WalletAddress, AoVaultData>;
  Ticker: string;
  Name: string;
  Logo: string;
}

export type AoEpochObservationData = {
  failureSummaries: Record<WalletAddress, WalletAddress[]>;
  reports: Record<WalletAddress, TransactionId>;
};

export type AoVaultData = {
  balance: number;
  locked: number;
  endTimestamp: Timestamp;
};

export type AoEpochDistributionRewards = {
  eligible: Record<
    WalletAddress,
    {
      delegateRewards: Record<WalletAddress, number>;
      operatorReward: number;
    }
  >;
  // TODO: we could create a new type for this
  distributed?: Record<WalletAddress, number>;
};

export type AoEpochDistributionData = {
  rewards: AoEpochDistributionRewards;
  totalEligibleRewards: number;
  totalEligibleObserverReward: number;
  totalEligibleGatewayReward: number;
  // TODO: we could create a new type for this
  distributedTimestamp?: Timestamp; // only set if rewards have been distributed
  totalDistributedRewards?: number; // only set if rewards have been distributed
};

export type AoArNSReservedNameData = {
  target?: string;
  endTimestamp?: number;
};
export type AoArNSNameData = AoArNSPermabuyData | AoArNSLeaseData;
export type AoArNSNameDataWithName = AoArNSNameData & { name: string };
export type AoArNSBaseNameData = {
  processId: ProcessId;
  startTimestamp: number;
  type: 'lease' | 'permabuy';
  undernameLimit: number;
  purchasePrice: number;
};

export type AoArNSPermabuyData = AoArNSBaseNameData & {
  type: 'permabuy';
};

export type AoArNSLeaseData = AoArNSBaseNameData & {
  type: 'lease';
  endTimestamp: Timestamp;
};

export type AoEpochSettings = {
  epochZeroStartTimestamp: Timestamp;
  durationMs: number;
  prescribedNameCount: number;
  rewardPercentage: number;
  maxObservers: number;
  distributionDelayMs: number;
};

export type AoEpochData = {
  epochIndex: AoEpochIndex;
  startHeight: BlockHeight;
  observations: AoObservations;
  prescribedObservers: AoWeightedObserver[];
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  distributionTimestamp: Timestamp;
  distributions: AoEpochDistributionData;
};

export type AoGateway = {
  settings: AoGatewaySettings;
  stats: AoGatewayStats;
  delegates: Record<WalletAddress, AoGatewayDelegate>;
  totalDelegatedStake: number;
  vaults: Record<WalletAddress, AoVaultData>;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  observerAddress: WalletAddress;
  operatorStake: number;
  status: 'joined' | 'leaving';
  weights: AoGatewayWeights;
};

export type AoGatewayStats = {
  passedConsecutiveEpochs: number;
  failedConsecutiveEpochs: number;
  totalEpochCount: number;
  passedEpochCount: number;
  failedEpochCount: number;
  observedEpochCount: number;
  prescribedEpochCount: number;
};

export type AoWeightedObserver = {
  gatewayAddress: WalletAddress;
  observerAddress: WalletAddress;
  stake: number;
  startTimestamp: number;
} & AoGatewayWeights;

export type AoGatewayWeights = {
  stakeWeight: number;
  tenureWeight: number;
  gatewayRewardRatioWeight: number;
  observerRewardRatioWeight: number;
  compositeWeight: number;
  normalizedCompositeWeight: number;
};

export type AoGatewayWithAddress = AoGateway & {
  gatewayAddress: WalletAddress;
};

export type AoGatewayDelegate = {
  delegatedStake: number;
  startTimestamp: Timestamp;
  vaults: Record<WalletAddress, AoVaultData>;
};

export type AoGatewaySettings = {
  allowDelegatedStaking: boolean;
  delegateRewardShareRatio: number;
  minDelegatedStake: number;
  autoStake: boolean;
  label: string;
  note: string;
  properties: string;
  fqdn: string;
  port: number;
  protocol: 'https';
};

export type AoBalanceWithAddress = {
  address: WalletAddress;
  balance: number;
};

// ANT Contract

export type AoANTState = {
  Name: string;
  Ticker: string;
  Denomination: number;
  Owner: WalletAddress;
  Controllers: WalletAddress[];
  Records: Record<string, AoANTRecord>;
  Balances: Record<WalletAddress, number>;
  Logo: string;
  TotalSupply: number;
  Initialized: boolean;
};

export type AoANTRecord = {
  transactionId: string;
  ttlSeconds: number;
};

// Input types

// TODO: confirm what is required or if all can be optional and defaults will be provided
export type AoJoinNetworkParams = Pick<
  AoGateway,
  'operatorStake' | 'observerAddress'
> &
  Partial<AoGatewaySettings>;

export type AoUpdateGatewaySettingsParams = AtLeastOne<AoJoinNetworkParams>;

// Interfaces

export interface AOContract {
  read<K>({
    tags,
    retries,
  }: {
    tags?: { name: string; value: string }[];
    retries?: number;
  }): Promise<K>;
  send<K>({
    tags,
    data,
    signer,
  }: {
    tags: { name: string; value: string }[];
    data: string | undefined;
    signer: AoSigner;
  }): Promise<{ id: string; result?: K }>;
}

export interface AoIORead {
  // read interactions
  getInfo(): Promise<{
    Ticker: string;
    Name: string;
    Logo: string;
    Denomination: number;
  }>;
  getTokenSupply(): Promise<number>;
  getEpochSettings(params?: EpochInput): Promise<AoEpochSettings>;
  getGateway({
    address,
  }: {
    address: WalletAddress;
  }): Promise<AoGateway | undefined>;
  getGateways(
    params?: PaginationParams,
  ): Promise<PaginationResult<AoGatewayWithAddress>>;
  getBalance(params: { address: WalletAddress }): Promise<number>;
  getBalances(
    params?: PaginationParams,
  ): Promise<PaginationResult<AoBalanceWithAddress>>;
  getArNSRecord({
    name,
  }: {
    name: string;
  }): Promise<AoArNSNameData | undefined>;
  getArNSRecords(
    params?: PaginationParams,
  ): Promise<PaginationResult<AoArNSNameDataWithName>>;
  getArNSReservedNames(): Promise<
    Record<string, AoArNSReservedNameData> | Record<string, never>
  >;
  getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<AoArNSReservedNameData | undefined>;
  getEpoch(epoch?: EpochInput): Promise<AoEpochData>;
  getCurrentEpoch(): Promise<AoEpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<AoWeightedObserver[]>;
  getPrescribedNames(epoch?: EpochInput): Promise<string[]>;
  getObservations(epoch?: EpochInput): Promise<AoEpochObservationData>;
  getDistributions(epoch?: EpochInput): Promise<AoEpochDistributionData>;
  getTokenCost({
    intent,
    purchaseType,
    years,
    name,
    quantity,
  }: {
    intent: 'Buy-Record' | 'Extend-Lease' | 'Increase-Undername-Limit';
    purchaseType?: 'permabuy' | 'lease';
    years?: number;
    name?: string;
    quantity?: number;
  }): Promise<number>;
}

export interface AoIOWrite extends AoIORead {
  // write interactions
  transfer(
    {
      target,
      qty,
    }: {
      target: WalletAddress;
      qty: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  joinNetwork(
    {
      operatorStake,
      allowDelegatedStaking,
      delegateRewardShareRatio,
      fqdn,
      label,
      minDelegatedStake,
      note,
      port,
      properties,
      protocol,
      autoStake,
      observerAddress,
    }: AoJoinNetworkParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  leaveNetwork(options?: WriteOptions): Promise<AoMessageResult>;
  updateGatewaySettings(
    {
      allowDelegatedStaking,
      delegateRewardShareRatio,
      fqdn,
      label,
      minDelegatedStake,
      note,
      port,
      properties,
      protocol,
      autoStake,
      observerAddress,
    }: AoUpdateGatewaySettingsParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  increaseOperatorStake(
    params: {
      increaseQty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  decreaseOperatorStake(
    params: {
      decreaseQty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  delegateStake(
    params: {
      target: WalletAddress;
      stakeQty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  decreaseDelegateStake(
    params: {
      target: WalletAddress;
      decreaseQty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  saveObservations(
    params: {
      reportTxId: TransactionId;
      failedGateways: WalletAddress[];
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  buyRecord(
    params: {
      name: string;
      years?: number;
      type: 'lease' | 'permabuy';
      processId: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  extendLease(
    params: {
      name: string;
      years: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  increaseUndernameLimit(
    params: {
      name: string;
      increaseCount: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
}

export interface AoANTRead {
  getState(): Promise<AoANTState>;
  getInfo(): Promise<{
    Name: string;
    Ticker: string;
    Denomination: number;
    Owner: string;
    ['Source-Code-TX-ID']?: string;
  }>;
  getRecord({ undername }): Promise<AoANTRecord | undefined>;
  getRecords(): Promise<Record<string, AoANTRecord>>;
  getOwner(): Promise<WalletAddress>;
  getControllers(): Promise<WalletAddress[]>;
  getTicker(): Promise<string>;
  getName(): Promise<string>;
  getBalance({ address }: { address: WalletAddress }): Promise<number>;
  getBalances(): Promise<Record<WalletAddress, number>>;
}

export interface AoANTWrite extends AoANTRead {
  transfer({ target }: { target: WalletAddress }): Promise<AoMessageResult>;
  addController({
    controller,
  }: {
    controller: WalletAddress;
  }): Promise<AoMessageResult>;
  removeController({
    controller,
  }: {
    controller: WalletAddress;
  }): Promise<AoMessageResult>;
  setRecord({
    undername,
    transactionId,
    ttlSeconds,
  }: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<AoMessageResult>;
  removeRecord({ undername }: { undername: string }): Promise<AoMessageResult>;
  setTicker({ ticker }): Promise<AoMessageResult>;
  setName({ name }): Promise<AoMessageResult>;
}

export interface AoANTRegistryRead {
  accessControlList(params: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }>;
}

export interface AoANTRegistryWrite extends AoANTRegistryRead {
  register(params: { processId: string }): Promise<AoMessageResult>;
}

// Typeguard functions
export function isProcessConfiguration(
  config: object,
): config is { process: AOProcess } {
  return 'process' in config;
}

export function isProcessIdConfiguration(
  config: object,
): config is { processId: string } {
  return (
    'processId' in config &&
    typeof config.processId === 'string' &&
    validateArweaveId(config.processId) === true
  );
}

export function isLeasedArNSRecord(
  record: AoArNSNameData,
): record is AoArNSLeaseData {
  return record.type === 'lease';
}
