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
import { mARIOToken } from './token.js';

// Pagination
type NestedKeys<T> = T extends object
  ? T extends readonly unknown[] // Detect arrays precisely
    ? never // Exclude arrays
    : {
        [K in keyof T & string]: T[K] extends object
          ? `${K}.${NestedKeys<T[K]>}`
          : K;
      }[keyof T & string]
  : never;

type SortBy<T> = T extends string
  ? string
  : keyof T extends never
    ? string
    : NestedKeys<T>;

export type PaginationParams<T = Record<string, never>> = {
  cursor?: string;
  limit?: number;
  sortBy?: SortBy<T>; // default to string if T is empty
  sortOrder?: 'asc' | 'desc';
};

export type PaginationResult<T> = {
  items: T[];
  nextCursor?: string;
  limit: number;
  totalItems: number;
  sortBy?: SortBy<T>;
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

// AO/ARIO Contract
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
export type AoEpochPrescribedObservers = Record<WalletAddress, WalletAddress[]>;

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
  epochZeroTimestamp: Timestamp;
  pruneEpochsCount: number;
};

export type AoEpochData = {
  epochIndex: AoEpochIndex;
  startHeight: BlockHeight;
  observations: AoEpochObservationData;
  prescribedObservers: AoWeightedObserver[];
  prescribedNames: string[];
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  distributionTimestamp: Timestamp;
  // @deprecated - use `getDistributions` to get distribution data for a given epoch
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

export type AoGatewayServices = {
  bundlers: AoGatewayService[];
};

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
  services?: AoGatewayServices;
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

export type AoReturnedName = {
  name: string;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  initiator: string;
  premiumMultiplier: number;
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
export type AoJoinNetworkParams = Pick<AoGateway, 'operatorStake'> &
  Partial<AoGatewaySettings> & {
    observerAddress?: WalletAddress;
  };

export type AoUpdateGatewaySettingsParams = AtLeastOne<
  Omit<AoJoinNetworkParams, 'operatorStake'>
>;

export type AoArNSNameParams = {
  name: string;
};

export type AoAddressParams = {
  address: WalletAddress;
};

export type AoBalanceParams = AoAddressParams;

export type AoPaginatedAddressParams = PaginationParams & AoAddressParams;

export type AoDelegateStakeParams = {
  target: WalletAddress;
  stakeQty: number | mARIOToken;
};

export type AoGetArNSRecordsParams = PaginationParams<AoArNSNameDataWithName>;

export type AoRedelegateStakeParams = {
  target: string;
  source: string;
  stakeQty: number | mARIOToken;
  vaultId?: string;
};

export const validIntents = [
  'Buy-Name',
  'Buy-Record', // for backwards compatibility
  'Extend-Lease',
  'Increase-Undername-Limit',
  'Upgrade-Name',
  'Primary-Name-Request',
] as const;
export const intentsUsingYears = [
  'Buy-Record', // for backwards compatibility
  'Buy-Name',
  'Extend-Lease',
] as const;
export type Intent = (typeof validIntents)[number];
export const isValidIntent = (intent: string): intent is Intent => {
  return validIntents.indexOf(intent as Intent) !== -1;
};

export type AoTokenCostParams = {
  intent: Intent;
  type?: 'permabuy' | 'lease';
  years?: number;
  name: string;
  quantity?: number;
  fromAddress?: WalletAddress;
};

export const fundFromOptions = ['balance', 'stakes', 'any'] as const;
export type FundFrom = (typeof fundFromOptions)[number];
export const isValidFundFrom = (fundFrom: string): fundFrom is FundFrom => {
  return fundFromOptions.indexOf(fundFrom as FundFrom) !== -1;
};

export type AoGetCostDetailsParams = AoTokenCostParams & {
  fundFrom?: FundFrom;
};

export type AoFundingPlan = {
  address: WalletAddress;
  balance: number;
  stakes: Record<
    WalletAddress,
    {
      vaults: Record<string, number>[];
      delegatedStake: number;
    }
  >;
  /** Any remaining shortfall will indicate an insufficient balance for the action */
  shortfall: number;
};

export type CostDiscount = {
  name: string;
  discountTotal: number;
  multiplier: number;
};

export type CostDetailsResult = {
  tokenCost: number;
  discounts: CostDiscount[];
  returnedNameDetails?: AoReturnedName & {
    basePrice: number;
  };
  fundingPlan?: AoFundingPlan;
};

export type AoGetVaultParams = {
  address: WalletAddress;
  vaultId: string;
};

export type AoArNSPurchaseParams = AoArNSNameParams & {
  fundFrom?: FundFrom;
};

export type AoBuyRecordParams = AoArNSPurchaseParams & {
  years?: number;
  type: 'lease' | 'permabuy';
  processId: string;
};

export type AoExtendLeaseParams = AoArNSPurchaseParams & {
  years: number;
};

export type AoIncreaseUndernameLimitParams = AoArNSPurchaseParams & {
  increaseCount: number;
};

export type AoGatewayRegistrySettings = {
  delegates: {
    minStake: number;
    withdrawLengthMs: number;
  };
  observers: {
    tenureWeightDays: number;
    tenureWeightPeriod: number;
    maxTenureWeight: number;
    maxPerEpoch: number;
  };
  operators: {
    minStake: number;
    withdrawLengthMs: number;
    leaveLengthMs: number;
    failedEpochCountMax: number;
    failedEpochSlashRate: number;
  };
};

export type DemandFactorSettings = {
  periodZeroStartTimestamp: number;
  movingAvgPeriodCount: number;
  periodLengthMs: number;
  demandFactorBaseValue: number;
  demandFactorMin: number;
  demandFactorUpAdjustment: number;
  demandFactorDownAdjustment: number;
  stepDownThreshold: number;
  criteria: string;
};

// Interfaces

export interface AoARIORead {
  // read interactions
  getInfo(): Promise<{
    Ticker: string;
    Name: string;
    Logo: string;
    Denomination: number;
    Handlers: string[];
    LastCreatedEpochIndex: number;
    LastDistributedEpochIndex: number;
  }>;
  getTokenSupply(): Promise<AoTokenSupplyData>;
  getEpochSettings(): Promise<AoEpochSettings>;
  getGateway({ address }: AoAddressParams): Promise<AoGateway | undefined>;
  // TODO: these could be moved to a separate Gateways class that implements gateway specific interactions
  getGatewayDelegates({
    address,
    ...pageParams
  }: AoAddressParams & PaginationParams<AoGatewayDelegateWithAddress>): Promise<
    PaginationResult<AoGatewayDelegateWithAddress>
  >;
  getGatewayDelegateAllowList(
    params: AoPaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>>;
  // END OF GATEWAY SPECIFIC INTERACTIONS
  getGateways(
    params?: PaginationParams<AoGatewayWithAddress>,
  ): Promise<PaginationResult<AoGatewayWithAddress>>;
  getDelegations(
    params: PaginationParams<AoDelegation> & { address: WalletAddress },
  ): Promise<PaginationResult<AoDelegation>>;
  getAllowedDelegates(
    params: AoPaginatedAddressParams,
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
    params?: AoGetArNSRecordsParams,
  ): Promise<PaginationResult<AoArNSNameDataWithName>>;
  getArNSReservedNames(
    params?: PaginationParams<AoArNSReservedNameDataWithName>,
  ): Promise<PaginationResult<AoArNSReservedNameDataWithName>>;
  getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<AoArNSReservedNameData | undefined>;
  getArNSReturnedNames(
    params?: PaginationParams<AoReturnedName>,
  ): Promise<PaginationResult<AoReturnedName>>;
  getArNSReturnedName({
    name,
  }: {
    name: string;
  }): Promise<AoReturnedName | undefined>;
  getEpoch(epoch?: EpochInput): Promise<AoEpochData | undefined>;
  getCurrentEpoch(): Promise<AoEpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<AoWeightedObserver[]>;
  getPrescribedNames(epoch?: EpochInput): Promise<string[]>;
  getObservations(
    epoch?: EpochInput,
  ): Promise<AoEpochObservationData | undefined>;
  getDistributions(
    epoch?: EpochInput,
  ): Promise<AoEpochDistributionData | undefined>;
  getTokenCost({
    intent,
    type,
    years,
    name,
    quantity,
  }: AoTokenCostParams): Promise<number>;
  getCostDetails({
    intent,
    type,
    years,
    name,
    quantity,
    fundFrom,
  }: AoGetCostDetailsParams): Promise<CostDetailsResult>;
  getRegistrationFees(): Promise<AoRegistrationFees>;
  getDemandFactor(): Promise<number>;
  getDemandFactorSettings(): Promise<DemandFactorSettings>;
  getVaults(
    params?: PaginationParams<AoWalletVault>,
  ): Promise<PaginationResult<AoWalletVault>>;
  getVault({
    address,
    vaultId,
  }: AoGetVaultParams): Promise<AoVaultData | undefined>;
  getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest>;
  getPrimaryNameRequests(
    params?: PaginationParams<AoPrimaryNameRequest>,
  ): Promise<PaginationResult<AoPrimaryNameRequest>>;
  getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<AoPrimaryName | undefined>;
  getPrimaryNames(
    params?: PaginationParams<AoPrimaryName>,
  ): Promise<PaginationResult<AoPrimaryName>>;
  getRedelegationFee(params: {
    address: WalletAddress;
  }): Promise<AoRedelegationFeeInfo>;
  getGatewayRegistrySettings(): Promise<AoGatewayRegistrySettings>;
  getAllDelegates(
    params?: PaginationParams<AoAllDelegates>,
  ): Promise<PaginationResult<AoAllDelegates>>;
}

export type AoAllDelegates = {
  address: WalletAddress;
  gatewayAddress: WalletAddress;
  delegatedStake: number;
  startTimestamp: Timestamp;
  vaultedStake: number;
  cursorId: string;
};

export interface AoARIOWrite extends AoARIORead {
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
      increaseQty: number | mARIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  decreaseOperatorStake(
    params: {
      decreaseQty: number | mARIOToken;
      instant?: boolean;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  delegateStake(
    params: {
      target: WalletAddress;
      stakeQty: number | mARIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  decreaseDelegateStake(
    params: {
      target: WalletAddress;
      decreaseQty: number | mARIOToken;
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
    params: AoBuyRecordParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  upgradeRecord(
    params: AoArNSPurchaseParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  extendLease(
    params: AoExtendLeaseParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  increaseUndernameLimit(
    params: AoIncreaseUndernameLimitParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  cancelWithdrawal(
    params: {
      gatewayAddress?: WalletAddress;
      vaultId: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  requestPrimaryName(
    params: AoArNSPurchaseParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  redelegateStake(
    params: AoRedelegateStakeParams,
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
