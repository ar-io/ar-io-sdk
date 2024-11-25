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
import { AOProcess } from '../common/index.js';
import { validateArweaveId } from '../utils/arweave.js';
import {
  AoMessageResult,
  AoPrimaryName,
  AoPrimaryNameRequest,
  AoRedelegationFeeInfo,
  AtLeastOne,
  BlockHeight,
  ProcessId,
  Timestamp,
  TransactionId,
  WalletAddress,
  WriteOptions,
} from './index.js';
import { mIOToken } from './token.js';

// Pagination

export type PaginationParams<T = Record<string, never>> = {
  cursor?: string;
  limit?: number;
  sortBy?: keyof T extends never ? string : keyof T; // default to string if T is empty
  sortOrder?: 'asc' | 'desc';
};

export type PaginationResult<T> = {
  items: T[];
  nextCursor: string | undefined;
  totalItems: number;
  sortBy?: keyof T;
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
export type AoRegistrationFees = Record<
  number,
  {
    lease: Record<number, number>;
    permabuy: number;
  }
>;
export type AoEpochIndex = number;

export type AoEpochObservationData = {
  failureSummaries: Record<WalletAddress, WalletAddress[]>;
  reports: Record<WalletAddress, TransactionId>;
};

export type AoVaultData = {
  balance: number;
  startTimestamp: Timestamp;
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
  totalEligibleGateways: number;
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
export type AoArNSReservedNameDataWithName = AoArNSReservedNameData & {
  name: string;
};
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
  observations: AoEpochObservationData;
  prescribedObservers: AoWeightedObserver[];
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  distributionTimestamp: Timestamp;
  distributions: AoEpochDistributionData;
};

export type AoTokenSupplyData = {
  total: number;
  circulating: number;
  locked: number;
  withdrawn: number;
  delegated: number;
  staked: number;
  protocolBalance: number;
};

export type AoGatewayService = {
  fqdn: string;
  path: string;
  protocol: 'https';
  port: number;
};

export type AoGatewayServices =
  | {
      bundlers: AoGatewayService[];
    }
  | undefined; // not required, for now

export type AoGatewayDelegates = Record<WalletAddress, AoGatewayDelegate>;
export type AoGatewayDelegateAllowList = WalletAddress[];

export type AoWalletVault = AoVaultData & {
  address: WalletAddress;
  vaultId: string;
};

export type AoGateway = {
  settings: AoGatewaySettings;
  stats: AoGatewayStats;
  totalDelegatedStake: number;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  observerAddress: WalletAddress;
  operatorStake: number;
  status: 'joined' | 'leaving';
  weights: AoGatewayWeights;
  services: AoGatewayServices;
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

export type AoGatewayDelegateWithAddress = AoGatewayDelegate & {
  address: WalletAddress;
};

export type AoGatewaySettings = {
  allowDelegatedStaking: boolean | 'allowlist';
  delegateRewardShareRatio: number;
  allowedDelegates: WalletAddress[];
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

// Auctions
export type AoAuctionSettings = {
  durationMs: number;
  decayRate: number;
  scalingExponent: number;
  startPriceMultiplier: number;
};

export type AoAuction = {
  name: string;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  initiator: string;
  baseFee: number;
  demandFactor: number;
  settings: AoAuctionSettings;
};

export type AoAuctionPriceData = {
  type: 'lease' | 'permabuy';
  years?: number;
  prices: Record<string, number>;
  currentPrice: number;
};

export type AoDelegationBase = {
  type: 'stake' | 'vault';
  gatewayAddress: WalletAddress;
  delegationId: string;
};

export type AoVaultDelegation = AoDelegationBase &
  AoVaultData & {
    type: 'vault';
    vaultId: TransactionId;
  };

export type AoStakeDelegation = AoDelegationBase & {
  type: 'stake';
  startTimestamp: Timestamp;
  balance: number;
};

export type AoDelegation = AoStakeDelegation | AoVaultDelegation;

export type AoGatewayVault = {
  cursorId: string;
  vaultId: TransactionId;
  balance: number;
  endTimestamp: Timestamp;
  startTimestamp: Timestamp;
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

export interface AoIORead {
  // read interactions
  getInfo(): Promise<{
    Ticker: string;
    Name: string;
    Logo: string;
    Denomination: number;
    Handlers: string[];
    LastTickedEpochIndex: number;
  }>;
  getTokenSupply(): Promise<AoTokenSupplyData>;
  getEpochSettings(params?: EpochInput): Promise<AoEpochSettings>;
  getGateway({
    address,
  }: {
    address: WalletAddress;
  }): Promise<AoGateway | undefined>;
  // TODO: these could be moved to a separate Gateways class that implements gateway specific interactions
  getGatewayDelegates({
    address,
    ...pageParams
  }: {
    address: WalletAddress;
  } & PaginationParams<AoGatewayDelegateWithAddress>): Promise<
    PaginationResult<AoGatewayDelegateWithAddress>
  >;
  getGatewayDelegateAllowList(
    params?: PaginationParams<WalletAddress>,
  ): Promise<PaginationResult<WalletAddress>>;
  // END OF GATEWAY SPECIFIC INTERACTIONS
  getGateways(
    params?: PaginationParams<AoGatewayWithAddress>,
  ): Promise<PaginationResult<AoGatewayWithAddress>>;
  getDelegations(
    params: PaginationParams<AoDelegation> & { address: WalletAddress },
  ): Promise<PaginationResult<AoDelegation>>;
  getAllowedDelegates(
    params: PaginationParams & { address: WalletAddress },
  ): Promise<PaginationResult<WalletAddress>>;
  getGatewayVaults(
    params: PaginationParams<AoGatewayVault> & { address: WalletAddress },
  ): Promise<PaginationResult<AoGatewayVault>>;
  getBalance(params: { address: WalletAddress }): Promise<number>;
  getBalances(
    params?: PaginationParams<AoBalanceWithAddress>,
  ): Promise<PaginationResult<AoBalanceWithAddress>>;
  getArNSRecord({
    name,
  }: {
    name: string;
  }): Promise<AoArNSNameData | undefined>;
  getArNSRecords(
    params?: PaginationParams<AoArNSNameDataWithName>,
  ): Promise<PaginationResult<AoArNSNameDataWithName>>;
  getArNSReservedNames(
    params?: PaginationParams<AoArNSReservedNameDataWithName>,
  ): Promise<PaginationResult<AoArNSReservedNameDataWithName>>;
  getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<AoArNSReservedNameData | undefined>;
  getArNSAuctions(
    params?: PaginationParams<AoAuction>,
  ): Promise<PaginationResult<AoAuction>>;
  getArNSAuction({ name }: { name: string }): Promise<AoAuction | undefined>;
  getArNSAuctionPrices({
    name,
    type,
    years,
    timestamp,
    intervalMs,
  }: {
    name: string;
    type: 'lease' | 'permabuy';
    years?: number;
    timestamp?: number;
    intervalMs?: number;
  }): Promise<AoAuctionPriceData>;
  getEpoch(epoch?: EpochInput): Promise<AoEpochData>;
  getCurrentEpoch(): Promise<AoEpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<AoWeightedObserver[]>;
  getPrescribedNames(epoch?: EpochInput): Promise<string[]>;
  getObservations(epoch?: EpochInput): Promise<AoEpochObservationData>;
  getDistributions(epoch?: EpochInput): Promise<AoEpochDistributionData>;
  getTokenCost({
    intent,
    type,
    years,
    name,
    quantity,
  }: {
    intent: 'Buy-Record' | 'Extend-Lease' | 'Increase-Undername-Limit';
    type?: 'permabuy' | 'lease';
    years?: number;
    name?: string;
    quantity?: number;
  }): Promise<number>;
  getRegistrationFees(): Promise<AoRegistrationFees>;
  getDemandFactor(): Promise<number>;
  getVaults(
    params?: PaginationParams<AoWalletVault>,
  ): Promise<PaginationResult<AoWalletVault>>;
  getVault({
    address,
    vaultId,
  }: {
    address: WalletAddress;
    vaultId: string;
  }): Promise<AoVaultData>;
  getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest>;
  getPrimaryNameRequests(
    params: PaginationParams<AoPrimaryNameRequest>,
  ): Promise<PaginationResult<AoPrimaryNameRequest>>;
  getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<AoPrimaryName>;
  getPrimaryNames(
    params?: PaginationParams<AoPrimaryName>,
  ): Promise<PaginationResult<AoPrimaryName>>;
  getRedelegationFee(params: {
    address: WalletAddress;
  }): Promise<AoRedelegationFeeInfo>;
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
  // TODO: these could be moved to a separate Gateways class that implements gateway specific interactions
  joinNetwork(
    params: AoJoinNetworkParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  leaveNetwork(options?: WriteOptions): Promise<AoMessageResult>;
  updateGatewaySettings(
    params: AoUpdateGatewaySettingsParams,
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
      instant?: boolean;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  instantWithdrawal(
    params: {
      gatewayAddress?: WalletAddress;
      vaultId: string;
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
  // END OF GATEWAY SPECIFIC INTERACTIONS
  buyRecord(
    params: {
      name: string;
      years?: number;
      type: 'lease' | 'permabuy';
      processId: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  upgradeRecord(
    params: {
      name: string;
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
  cancelWithdrawal(
    params: {
      gatewayAddress?: WalletAddress;
      vaultId: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  submitAuctionBid(
    params: {
      name: string;
      processId: string;
      quantity?: number;
      type?: 'lease' | 'permabuy';
      years?: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  requestPrimaryName(params: { name: string }): Promise<AoMessageResult>;
  redelegateStake(
    params: {
      target: string;
      source: string;
      stakeQty: number | mIOToken;
      vaultId?: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
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
