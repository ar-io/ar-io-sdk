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
  AoWriteAction,
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

export type SortBy<T> = T extends string
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

export type ProcessIdConfig = {
  processId?: string;
};

export type ProcessConfig = {
  process?: AOProcess;
};

export type ProcessConfiguration = ProcessConfig | ProcessIdConfig;

export type EpochTimestampInput = {
  timestamp: Timestamp;
};

export type EpochIndexInput = {
  epochIndex: AoEpochIndex;
};

export type EpochInput = EpochTimestampInput | EpochIndexInput | undefined;

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
  controller?: WalletAddress;
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
  maxObservers: number;
};

export type AoEpochDistributionTotalsData = {
  totalEligibleGateways: number;
  totalEligibleRewards: number;
  totalEligibleObserverReward: number;
  totalEligibleGatewayReward: number;
};

/** @deprecated Use getEligibleEpochRewards getEpochDistributions, will be removed in a future release  */
export type AoEpochDistributionRewards = {
  eligible: Record<
    WalletAddress,
    {
      delegateRewards: Record<WalletAddress, number>;
      operatorReward: number;
    }
  >;
  distributed: Record<WalletAddress, number>;
};

export type AoEpochDistributed = AoEpochDistributionTotalsData & {
  /** @deprecated Use getEligibleEpochRewards getEpochDistributions, will be removed in a future release  */
  rewards: AoEpochDistributionRewards;
  distributedTimestamp: Timestamp; // only set if rewards have been distributed
  totalDistributedRewards: number; // only set if rewards have been distributed
};

export type AoEpochDistributionData =
  | AoEpochDistributionTotalsData
  | AoEpochDistributed;

export type AoEpochData<D = AoEpochDistributionData> = {
  epochIndex: AoEpochIndex;
  startHeight: BlockHeight;
  observations: AoEpochObservationData;
  prescribedObservers: AoWeightedObserver[];
  prescribedNames: string[];
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  distributionTimestamp: Timestamp;
  distributions: D;
  arnsStats: {
    totalReturnedNames: number;
    totalActiveNames: number;
    totalGracePeriodNames: number;
    totalReservedNames: number;
  };
};

export const isDistributedEpochData = (
  data: AoEpochDistributed | AoEpochDistributionTotalsData,
): data is AoEpochDistributed => {
  return (data as AoEpochDistributed).distributedTimestamp !== undefined;
};

export const isDistributedEpoch = (
  data: AoEpochData,
): data is AoEpochData<AoEpochDistributed> & {
  distributions: { rewards: object };
} => {
  return (
    data.distributions !== undefined &&
    isDistributedEpochData(data.distributions)
  );
};

export type AoEligibleDistribution = {
  type: 'operatorReward' | 'delegateReward';
  recipient: WalletAddress;
  eligibleReward: number;
  gatewayAddress: WalletAddress;
  cursorId: string;
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
  // @deprecated - use `gatewayPerformanceRatio` instead
  gatewayRewardRatioWeight: number;
  // @deprecated - use `observerPerformanceRatio` instead
  observerRewardRatioWeight: number;
  gatewayPerformanceRatio: number;
  observerPerformanceRatio: number;
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

export type AoAllDelegates = AoGatewayDelegateWithAddress & {
  gatewayAddress: WalletAddress;
  vaultedStake: number;
  cursorId: string;
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

/** Operator stake being withdrawn from a given gateway */
export type AoGatewayVault = {
  cursorId: string;
  vaultId: TransactionId;
  balance: number;
  endTimestamp: Timestamp;
  startTimestamp: Timestamp;
};

/** Operator stake being withdrawn from all gateway gateways */
export type AoAllGatewayVaults = AoGatewayVault & {
  gatewayAddress: WalletAddress;
};

// Input types
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

export type AoPaginatedAddressParams = PaginationParams<string> &
  AoAddressParams;

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

export const fundFromOptions = ['balance', 'stakes', 'any', 'turbo'] as const;
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
  wincQty?: string;
};

export type AoGetVaultParams = {
  address: WalletAddress;
  vaultId: string;
};

export type AoArNSPurchaseParams = AoArNSNameParams & {
  fundFrom?: FundFrom;
  paidBy?: WalletAddress | WalletAddress[];
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

export type AoVaultedTransferParams = {
  recipient: WalletAddress;
  quantity: mARIOToken | number;
  lockLengthMs: number;
  revokable?: boolean;
};

export type AoRevokeVaultParams = {
  vaultId: TransactionId;
  recipient: WalletAddress;
};

export type AoCreateVaultParams = {
  quantity: mARIOToken | number;
  lockLengthMs: number;
};

export type AoExtendVaultParams = {
  vaultId: string;
  extendLengthMs: number;
};

export type AoIncreaseVaultParams = {
  vaultId: string;
  quantity: mARIOToken | number;
};

export type AoGatewayRegistrySettings = {
  delegates: {
    minStake: number;
    withdrawLengthMs: number;
  };
  observers: {
    tenureWeightDurationMs: number;
    maxTenureWeight: number;
  };
  operators: {
    minStake: number;
    withdrawLengthMs: number;
    leaveLengthMs: number;
    maxDelegateRewardSharePct: number;
    failedEpochCountMax: number;
    failedGatewaySlashRate: number;
  };
  redelegations: {
    minRedelegationPenaltyRate: number;
    maxRedelegationPenaltyRate: number;
    minRedelegationAmount: number;
    redelegationFeeResetIntervalMs: number;
  };
  expeditedWithdrawals: {
    minExpeditedWithdrawalPenaltyRate: number;
    maxExpeditedWithdrawalPenaltyRate: number;
    minExpeditedWithdrawalAmount: number;
  };
};

export type DemandFactorSettings = {
  periodZeroStartTimestamp: number;
  movingAvgPeriodCount: number;
  periodLengthMs: number;
  demandFactorBaseValue: number;
  demandFactorMin: number;
  demandFactorUpAdjustmentRate: number;
  demandFactorDownAdjustmentRate: number;
  maxPeriodsAtMinDemandFactor: number;
  criteria: string;
};

// Interfaces

// simple interface to allow multiple implementations of ArNSNameResolver
export type ArNSNameResolutionData = {
  name: string;
  owner?: string; // could be unowned
  txId: string;
  type: 'lease' | 'permabuy';
  processId: string;
  ttlSeconds: number;
  priority?: number; // TODO: the SDK should always provide a priority index, even if the ANT does not have a priority set
  undernameLimit: number;
};

export interface ArNSNameResolver {
  resolveArNSName({ name }: { name: string }): Promise<ArNSNameResolutionData>;
}

export interface AoARIORead extends ArNSNameResolver {
  process: AOProcess;
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
  getGateway({ address }: AoAddressParams): Promise<AoGateway>;
  getGatewayDelegates({
    address,
    ...pageParams
  }: AoAddressParams & PaginationParams<AoGatewayDelegateWithAddress>): Promise<
    PaginationResult<AoGatewayDelegateWithAddress>
  >;
  getGatewayDelegateAllowList(
    params: AoPaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>>;
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
  getArNSRecord({ name }: { name: string }): Promise<AoArNSNameData>;
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
  }): Promise<AoArNSReservedNameData>;
  getArNSReturnedNames(
    params?: PaginationParams<AoReturnedName>,
  ): Promise<PaginationResult<AoReturnedName>>;
  getArNSReturnedName({ name }: { name: string }): Promise<AoReturnedName>;
  getEpoch(epoch?: EpochInput): Promise<AoEpochData>;
  getCurrentEpoch(): Promise<AoEpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<AoWeightedObserver[]>;
  getPrescribedNames(epoch?: EpochInput): Promise<string[]>;
  getObservations(epoch?: EpochInput): Promise<AoEpochObservationData>;
  getDistributions(epoch?: EpochInput): Promise<AoEpochDistributionData>;
  getEligibleEpochRewards(
    epoch?: EpochInput,
    params?: PaginationParams<AoEligibleDistribution>,
  ): Promise<PaginationResult<AoEligibleDistribution>>;
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
  getVault({ address, vaultId }: AoGetVaultParams): Promise<AoVaultData>;
  getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest>;
  getPrimaryNameRequests(
    params?: PaginationParams<AoPrimaryNameRequest>,
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
  getGatewayRegistrySettings(): Promise<AoGatewayRegistrySettings>;
  getAllDelegates(
    params?: PaginationParams<AoAllDelegates>,
  ): Promise<PaginationResult<AoAllDelegates>>;
  getAllGatewayVaults(
    params?: PaginationParams<AoAllGatewayVaults>,
  ): Promise<PaginationResult<AoAllGatewayVaults>>;
}

export interface AoARIOWrite extends AoARIORead {
  // write interactions
  transfer: AoWriteAction<{ target: WalletAddress; qty: number | mARIOToken }>;
  vaultedTransfer: AoWriteAction<AoVaultedTransferParams>;
  revokeVault: AoWriteAction<AoRevokeVaultParams>;
  createVault: AoWriteAction<AoCreateVaultParams>;
  extendVault: AoWriteAction<AoExtendVaultParams>;
  increaseVault: AoWriteAction<AoIncreaseVaultParams>;

  // TODO: these could be moved to a separate Gateways class that implements gateway specific interactions
  joinNetwork: AoWriteAction<AoJoinNetworkParams>;
  leaveNetwork: (options?: WriteOptions) => Promise<AoMessageResult>;
  updateGatewaySettings: AoWriteAction<AoUpdateGatewaySettingsParams>;
  increaseOperatorStake: AoWriteAction<{ increaseQty: number | mARIOToken }>;
  decreaseOperatorStake: AoWriteAction<{
    decreaseQty: number | mARIOToken;
    instant?: boolean;
  }>;
  delegateStake: AoWriteAction<AoDelegateStakeParams>;
  decreaseDelegateStake: AoWriteAction<{
    target: WalletAddress;
    decreaseQty: number | mARIOToken;
    instant?: boolean;
  }>;
  instantWithdrawal: AoWriteAction<{
    gatewayAddress?: WalletAddress;
    vaultId: string;
  }>;
  saveObservations: AoWriteAction<{
    reportTxId: TransactionId;
    failedGateways: WalletAddress[];
  }>;
  // END OF GATEWAY SPECIFIC INTERACTIONS
  buyRecord: AoWriteAction<AoBuyRecordParams, AoMessageResult>;
  upgradeRecord: AoWriteAction<AoArNSPurchaseParams, AoMessageResult>;
  extendLease: AoWriteAction<AoExtendLeaseParams, AoMessageResult>;
  increaseUndernameLimit: AoWriteAction<
    AoIncreaseUndernameLimitParams,
    AoMessageResult
  >;
  cancelWithdrawal: AoWriteAction<{
    gatewayAddress?: WalletAddress;
    vaultId: string;
  }>;
  requestPrimaryName: AoWriteAction<AoArNSPurchaseParams>;
  redelegateStake: AoWriteAction<AoRedelegateStakeParams>;
}

// Type-guard functions
export function isProcessConfiguration(
  config: object | undefined,
): config is Required<ProcessConfiguration> & Record<string, never> {
  return config !== undefined && 'process' in config;
}

export function isProcessIdConfiguration(
  config: object | undefined,
): config is Required<ProcessIdConfig> & Record<string, never> {
  return (
    config !== undefined &&
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
