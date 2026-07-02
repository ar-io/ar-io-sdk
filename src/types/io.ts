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
import {
  AtLeastOne,
  BlockHeight,
  BuyArNSNameProgressEvents,
  CreatePrimaryNameRequest,
  MessageResult,
  PrimaryName,
  PrimaryNameRequest,
  ProcessId,
  RedelegationFeeInfo,
  SetPrimaryNameProgressEvents,
  Timestamp,
  TransactionId,
  WalletAddress,
  WriteAction,
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
  filters?: Partial<
    Record<keyof T, string | string[] | number | number[] | boolean | boolean[]>
  >;
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

export type EpochTimestampInput = {
  timestamp: Timestamp;
};

export type EpochIndexInput = {
  epochIndex: EpochIndex;
};

export type EpochInput = EpochTimestampInput | EpochIndexInput | undefined;

// AO/ARIO Contract
export type Balances = Record<WalletAddress, number>;
export type RegistrationFees = Record<
  number,
  {
    lease: Record<number, number>;
    permabuy: number;
  }
>;
export type EpochIndex = number;

export type EpochObservationData = {
  failureSummaries: Record<WalletAddress, WalletAddress[]>;
  reports: Record<WalletAddress, TransactionId>;
};
export type EpochPrescribedObservers = Record<WalletAddress, WalletAddress[]>;

export type VaultData = {
  balance: number;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  controller?: WalletAddress;
};

export type ArNSReservedNameData = {
  target?: string;
  endTimestamp?: number;
};
export type ArNSNameData = ArNSPermabuyData | ArNSLeaseData;
export type ArNSNameDataWithName = ArNSNameData & { name: string };
export type ArNSReservedNameDataWithName = ArNSReservedNameData & {
  name: string;
};
export type ArNSBaseNameData = {
  processId: ProcessId;
  startTimestamp: number;
  type: 'lease' | 'permabuy';
  undernameLimit: number;
  purchasePrice: number;
};

export type ArNSPermabuyData = ArNSBaseNameData & {
  type: 'permabuy';
};

export type ArNSLeaseData = ArNSBaseNameData & {
  type: 'lease';
  endTimestamp: Timestamp;
};

export type EpochSettings = {
  epochZeroStartTimestamp: Timestamp;
  durationMs: number;
  prescribedNameCount: number;
  maxObservers: number;
};

export type EpochDistributionTotalsData = {
  totalEligibleGateways: number;
  totalEligibleRewards: number;
  totalEligibleObserverReward: number;
  totalEligibleGatewayReward: number;
};

/** @deprecated Use getEligibleEpochRewards getEpochDistributions, will be removed in a future release  */
export type EpochDistributionRewards = {
  eligible: Record<
    WalletAddress,
    {
      delegateRewards: Record<WalletAddress, number>;
      operatorReward: number;
    }
  >;
  distributed: Record<WalletAddress, number>;
};

export type EpochDistributed = EpochDistributionTotalsData & {
  /** @deprecated Use getEligibleEpochRewards getEpochDistributions, will be removed in a future release  */
  rewards: EpochDistributionRewards;
  distributedTimestamp: Timestamp; // only set if rewards have been distributed
  totalDistributedRewards: number; // only set if rewards have been distributed
};

export type EpochDistributionData =
  | EpochDistributionTotalsData
  | EpochDistributed;

export type EpochData<D = EpochDistributionData> = {
  epochIndex: EpochIndex;
  startHeight: BlockHeight;
  observations: EpochObservationData;
  prescribedObservers: WeightedObserver[];
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
  data: EpochDistributed | EpochDistributionTotalsData,
): data is EpochDistributed => {
  return (data as EpochDistributed).distributedTimestamp !== undefined;
};

export const isDistributedEpoch = (
  data: EpochData,
): data is EpochData<EpochDistributed> & {
  distributions: { rewards: object };
} => {
  return (
    data.distributions !== undefined &&
    isDistributedEpochData(data.distributions)
  );
};

export type EligibleDistribution = {
  type: 'operatorReward' | 'delegateReward';
  recipient: WalletAddress;
  eligibleReward: number;
  gatewayAddress: WalletAddress;
  cursorId: string;
};

/**
 * The six ARIO supply buckets. They are mutually exclusive and sum to `total`:
 *   circulating + locked + staked + delegated + withdrawn + protocolBalance === total
 *
 * `protocolBalance` is the protocol **reward reserve** (the pool epoch rewards
 * are paid from) — on Solana this is the live balance of the protocol token
 * account, matching AO's `protocolBalance` (the qNvAoz0 reserve). It is NOT the
 * on-chain `ArioConfig.protocol_balance` accounting field, which folds the
 * staking buckets in and would double-count.
 */
export type TokenSupplyData = {
  total: number;
  circulating: number;
  locked: number;
  withdrawn: number;
  delegated: number;
  staked: number;
  protocolBalance: number;
};

export type GatewayService = {
  fqdn: string;
  path: string;
  protocol: 'https';
  port: number;
};

export type GatewayServices = {
  bundlers: GatewayService[];
};

export type GatewayDelegates = Record<WalletAddress, GatewayDelegate>;
export type GatewayDelegateAllowList = WalletAddress[];

export type WalletVault = VaultData & {
  address: WalletAddress;
  /**
   * Vault PDA address — globally-unique, stable handle for React keys /
   * explorer links. Mirrors `GatewayVault.cursorId`. This is NOT a valid
   * argument to `releaseVault`/`revokeVault`; use `vaultId` for those.
   */
  cursorId: string;
  /**
   * Numeric per-owner vault id (u64 as string). Pass this to
   * `releaseVault({ vaultId })` / `revokeVault({ vaultId })`.
   */
  vaultId: string;
};

export type Gateway = {
  settings: GatewaySettings;
  stats: GatewayStats;
  totalDelegatedStake: number;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  observerAddress: WalletAddress;
  operatorStake: number;
  status: 'joined' | 'leaving';
  weights: GatewayWeights;
  services?: GatewayServices;
};

export type GatewayStats = {
  passedConsecutiveEpochs: number;
  failedConsecutiveEpochs: number;
  totalEpochCount: number;
  passedEpochCount: number;
  failedEpochCount: number;
  observedEpochCount: number;
  prescribedEpochCount: number;
};

export type WeightedObserver = {
  gatewayAddress: WalletAddress;
  observerAddress: WalletAddress;
  stake: number;
  startTimestamp: number;
} & GatewayWeights;

export type GatewayWeights = {
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

export type GatewayWithAddress = Gateway & {
  gatewayAddress: WalletAddress;
};

export type GatewayDelegate = {
  delegatedStake: number;
  startTimestamp: Timestamp;
};

export type GatewayDelegateWithAddress = GatewayDelegate & {
  address: WalletAddress;
};

export type AllDelegates = GatewayDelegateWithAddress & {
  gatewayAddress: WalletAddress;
  vaultedStake: number;
  cursorId: string;
};

export type GatewaySettings = {
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
  /**
   * Solana only (GATEWAY_VERSION 1.1.0+). A `delegateRewardShareRatio` change
   * requested mid-epoch is staged here and applied at the next epoch's
   * `tally_weights` (WP §6.3 / Fix #7), so the active value stays epoch-stable.
   * When set, render the active `delegateRewardShareRatio` as the current rate
   * and this as "pending until next epoch". Percent (0-95), same scale as
   * `delegateRewardShareRatio`. Undefined when no change is queued.
   */
  pendingDelegateRewardShareRatio?: number;
  /**
   * Solana only (GATEWAY_VERSION 1.1.0+). Unix seconds when the operator
   * disabled delegation (WP §6.3 / Fix #6). Re-enabling is blocked until every
   * delegate has been withdrawn AND the withdrawal-period cooldown has elapsed
   * since this time. Undefined when delegation is enabled.
   */
  delegationDisabledAt?: number;
};

export type BalanceWithAddress = {
  address: WalletAddress;
  balance: number;
};

export type ReturnedName = {
  name: string;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  initiator: string;
  premiumMultiplier: number;
};

export type DelegationBase = {
  type: 'stake' | 'vault';
  gatewayAddress: WalletAddress;
  delegationId: string;
};

export type VaultDelegation = DelegationBase &
  VaultData & {
    type: 'vault';
    vaultId: TransactionId;
  };

export type StakeDelegation = DelegationBase & {
  type: 'stake';
  startTimestamp: Timestamp;
  balance: number;
};

export type Delegation = StakeDelegation | VaultDelegation;

/** Operator stake being withdrawn from a given gateway */
export type GatewayVault = {
  cursorId: string;
  vaultId: TransactionId;
  balance: number;
  endTimestamp: Timestamp;
  startTimestamp: Timestamp;
};

/** Operator stake being withdrawn from all gateway gateways */
export type AllGatewayVaults = GatewayVault & {
  gatewayAddress: WalletAddress;
};

/**
 * A pending or matured stake withdrawal owned by a wallet. Covers both
 * operator-stake decreases and delegate-stake decreases — discriminate with
 * `isDelegate`. A withdrawal is claimable when `Date.now() >= endTimestamp`.
 *
 * Solana-only: AO releases withdrawals automatically at maturity and has no
 * equivalent per-owner read.
 */
export type UserWithdrawal = AllGatewayVaults & {
  isDelegate: boolean;
};

// Input types
//
// NOTE: `services` is intentionally NOT exposed here even though it lives
// on the read-side `GatewaySettings`. `SolanaARIOWriteable.joinNetwork`
// (and `updateGatewaySettings`) do not forward gateway services to the
// `ario-gar` contract yet — advertising it here would be a silent no-op.
// Wire it through end-to-end before adding it back.
export type JoinNetworkParams = Pick<Gateway, 'operatorStake'> &
  Partial<GatewaySettings> & {
    observerAddress?: WalletAddress;
  };

export type UpdateGatewaySettingsParams = AtLeastOne<
  Omit<JoinNetworkParams, 'operatorStake'>
>;

export type ArNSNameParams = {
  name: string;
};

export type AddressParams = {
  address: WalletAddress;
};

export type BalanceParams = AddressParams;

export type PaginatedAddressParams = PaginationParams<string> & AddressParams;

export type DelegateStakeParams = {
  target: WalletAddress;
  stakeQty: number | mARIOToken;
};

export type GetArNSRecordsParams = PaginationParams<ArNSNameDataWithName>;

export type RedelegateStakeParams = {
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

export type TokenCostParams = {
  intent: Intent;
  type?: 'permabuy' | 'lease';
  years?: number;
  name: string;
  quantity?: number;
  fromAddress?: WalletAddress;
};

export const fundFromOptions = [
  'balance',
  'stakes',
  'withdrawal',
  'plan',
  'any',
  'turbo',
] as const;
export type FundFrom = (typeof fundFromOptions)[number];
export const isValidFundFrom = (fundFrom: string): fundFrom is FundFrom => {
  return fundFromOptions.indexOf(fundFrom as FundFrom) !== -1;
};

/**
 * One entry in a multi-source funding plan. Mirrors the on-chain
 * `ario_gar::FundingSourceSpec` shape (kind + amount); `gateway` is an
 * SDK-side hint for explicit (non-discovered) plans so the executor knows
 * which gateway PDA to slot in for `Delegation` / `OperatorStake` sources.
 *
 * Multi-gateway: `Delegation` sources may span up to MAX_DELEGATION_SOURCES
 * (3) distinct gateways per plan. `Balance` and `Withdrawal` sources are
 * gateway-independent. Hard cap of MAX_FUNDING_SOURCES (5) total sources
 * per `pay_from_funding_plan` call.
 */
export type FundingSourceKind =
  | 'balance'
  | 'delegation'
  | 'operatorStake'
  | 'withdrawal';

export type FundingSourceSpec = {
  kind: FundingSourceKind;
  /** mARIO amount drawn from this source. Must be > 0. */
  amount: bigint;
  /**
   * Bound gateway (base58). Required for `delegation` / `operatorStake` in
   * multi-gateway explicit plans; ignored for `balance` / `withdrawal`. When
   * omitted on stake-locked sources, the executor falls back to
   * `params.gatewayAddress`.
   */
  gateway?: WalletAddress;
  /**
   * Withdrawal vault id — required for `kind: 'withdrawal'` in multi-
   * withdrawal plans. Single-withdrawal plans may omit it and rely on
   * `params.withdrawalId`. Ignored for non-withdrawal kinds. Client-side
   * metadata only — does NOT change the on-chain wire format.
   */
  withdrawalId?: bigint;
};

export type GetCostDetailsParams = TokenCostParams & {
  fundFrom?: FundFrom;
};

export type FundingPlan = {
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

/**
 * Estimated network ("gas") cost for executing an intent on the underlying
 * chain — separate from `tokenCost`, which is the protocol price in mARIO.
 * Currently populated only by the Solana implementations, where amounts are
 * denominated in lamports (1 SOL = 1e9 lamports).
 *
 * `totalLamports` is what the wallet must hold in SOL:
 * `feeLamports` (transaction fees across every transaction the intent
 * sends) plus `rentLamports` (rent-exempt deposits for accounts the flow
 * creates — for Buy-Name that includes the ANT spawn's MPL Core asset,
 * config/controllers/root-record PDAs, first-time ACL bootstrap accounts,
 * and the ArNS record itself; rent dwarfs the fees by ~3 orders of
 * magnitude).
 *
 * The fee side is conservative: the priority fee is charged on the
 * compute-unit LIMIT each transaction pins, and the write path auto-tightens
 * that limit from a pre-send simulation, so the fee actually paid is usually
 * lower.
 */
export type GasEstimate = {
  /** Grand total in lamports the wallet needs: `feeLamports + rentLamports`. */
  totalLamports: number;
  /** Transaction fees across all transactions (base + priority). */
  feeLamports: number;
  /** Flat per-signature fee: 5000 lamports × `signatureCount`. */
  baseFeeLamports: number;
  /**
   * Prioritization fee: `transactionCount` × ceil(`computeUnitLimit` × price
   * ÷ 1e6) lamports.
   */
  priorityFeeLamports: number;
  /**
   * Rent-exempt deposits (lamports) for accounts the intent creates. Zero
   * for intents that only mutate existing accounts (Extend-Lease,
   * Upgrade-Name, Increase-Undername-Limit).
   */
  rentLamports: number;
  /**
   * Rent (lamports) returned to the caller by accounts the action CLOSES —
   * e.g. removing an undername record refunds that record's deposit. Not
   * subtracted from `totalLamports`, which stays the upfront requirement;
   * the net cost of the action is `totalLamports − rentReclaimedLamports`.
   */
  rentReclaimedLamports: number;
  /** Compute-unit price used for the quote, in micro-lamports per CU. */
  priorityFeeMicroLamports: number;
  /** Compute-unit limit the quote assumes EACH transaction will pin. */
  computeUnitLimit: number;
  /** Total signatures across all transactions. */
  signatureCount: number;
  /** Number of transactions the intent sends (Buy-Name: spawn ANT + buy). */
  transactionCount: number;
};

export type CostDetailsResult = {
  tokenCost: number;
  discounts: CostDiscount[];
  returnedNameDetails?: ReturnedName & {
    basePrice: number;
  };
  fundingPlan?: FundingPlan;
  wincQty?: string;
  /**
   * Network-fee quote for executing the action on chain. Solana-only;
   * `undefined` on backends without per-transaction gas (e.g. AO).
   */
  gasEstimate?: GasEstimate;
};

export type GetVaultParams = {
  address: WalletAddress;
  vaultId: string;
};

export type ArNSPurchaseParams = ArNSNameParams & {
  fundFrom?: FundFrom;
  /** Gateway operator address — required when fundFrom is 'stakes' */
  gatewayAddress?: WalletAddress;
  /** If true, fund from operator stake instead of delegation (default: delegation) */
  fundAsOperator?: boolean;
  /** Withdrawal vault id — required when fundFrom is 'withdrawal' (Solana only) */
  withdrawalId?: bigint;
  /**
   * Explicit funding plan — when provided AND fundFrom is 'plan' or 'any',
   * the SDK skips source discovery and uses these sources verbatim. Caller
   * is responsible for matching `sum(amounts) == cost` and respecting the
   * single-gateway invariant. Solana only.
   */
  sources?: FundingSourceSpec[];
  paidBy?: WalletAddress | WalletAddress[];
  referrer?: string;
};

export type BuyRecordParams = ArNSPurchaseParams & {
  years?: number;
  type: 'lease' | 'permabuy';
  processId?: string;
};

export type ExtendLeaseParams = ArNSPurchaseParams & {
  years: number;
};

export type IncreaseUndernameLimitParams = ArNSPurchaseParams & {
  increaseCount: number;
};

export type VaultedTransferParams = {
  recipient: WalletAddress;
  quantity: mARIOToken | number;
  lockLengthMs: number;
  revokable?: boolean;
};

export type RevokeVaultParams = {
  vaultId: TransactionId;
  recipient: WalletAddress;
};

export type CreateVaultParams = {
  quantity: mARIOToken | number;
  lockLengthMs: number;
};

export type ExtendVaultParams = {
  vaultId: string;
  extendLengthMs: number;
};

export type IncreaseVaultParams = {
  vaultId: string;
  quantity: mARIOToken | number;
};

export type GatewayRegistrySettings = {
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

export interface ARIORead extends ArNSNameResolver {
  getInfo(): Promise<{
    Ticker: string;
    Name: string;
    Logo: string;
    Denomination: number;
    Handlers: string[];
    LastCreatedEpochIndex: number;
    LastDistributedEpochIndex: number;
  }>;
  getTokenSupply(): Promise<TokenSupplyData>;
  getEpochSettings(): Promise<EpochSettings>;
  getGateway({ address }: AddressParams): Promise<Gateway>;
  getGatewayDelegates({
    address,
    ...pageParams
  }: AddressParams & PaginationParams<GatewayDelegateWithAddress>): Promise<
    PaginationResult<GatewayDelegateWithAddress>
  >;
  getGatewayDelegateAllowList(
    params: PaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>>;
  getGateways(
    params?: PaginationParams<GatewayWithAddress>,
  ): Promise<PaginationResult<GatewayWithAddress>>;
  getDelegations(
    params: PaginationParams<Delegation> & { address: WalletAddress },
  ): Promise<PaginationResult<Delegation>>;
  getAllowedDelegates(
    params: PaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>>;
  getGatewayVaults(
    params: PaginationParams<GatewayVault> & { address: WalletAddress },
  ): Promise<PaginationResult<GatewayVault>>;
  getBalance(params: { address: WalletAddress }): Promise<number>;
  getBalances(
    params?: PaginationParams<BalanceWithAddress>,
  ): Promise<PaginationResult<BalanceWithAddress>>;
  getArNSRecord({ name }: { name: string }): Promise<ArNSNameData>;
  getArNSRecords(
    params?: GetArNSRecordsParams,
  ): Promise<PaginationResult<ArNSNameDataWithName>>;
  getArNSRecordsForAddress(
    params: PaginationParams<ArNSNameDataWithName> & {
      address: WalletAddress;
      antRegistryProcessId?: string;
    },
  ): Promise<PaginationResult<ArNSNameDataWithName>>;
  getArNSReservedNames(
    params?: PaginationParams<ArNSReservedNameDataWithName>,
  ): Promise<PaginationResult<ArNSReservedNameDataWithName>>;
  getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<ArNSReservedNameData>;
  getArNSReturnedNames(
    params?: PaginationParams<ReturnedName>,
  ): Promise<PaginationResult<ReturnedName>>;
  getArNSReturnedName({ name }: { name: string }): Promise<ReturnedName>;
  getEpoch(epoch?: EpochInput): Promise<EpochData>;
  getCurrentEpoch(): Promise<EpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<WeightedObserver[]>;
  getPrescribedNames(epoch?: EpochInput): Promise<string[]>;
  getObservations(epoch?: EpochInput): Promise<EpochObservationData>;
  getDistributions(epoch?: EpochInput): Promise<EpochDistributionData>;
  getEligibleEpochRewards(
    epoch?: EpochInput,
    params?: PaginationParams<EligibleDistribution>,
  ): Promise<PaginationResult<EligibleDistribution>>;
  getTokenCost({
    intent,
    type,
    years,
    name,
    quantity,
  }: TokenCostParams): Promise<number>;
  getCostDetails({
    intent,
    type,
    years,
    name,
    quantity,
    fundFrom,
  }: GetCostDetailsParams): Promise<CostDetailsResult>;
  getRegistrationFees(): Promise<RegistrationFees>;
  getDemandFactor(): Promise<number>;
  getDemandFactorSettings(): Promise<DemandFactorSettings>;
  getVaults(
    params?: PaginationParams<WalletVault>,
  ): Promise<PaginationResult<WalletVault>>;
  getVault({ address, vaultId }: GetVaultParams): Promise<VaultData>;
  getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<PrimaryNameRequest>;
  getPrimaryNameRequests(
    params?: PaginationParams<PrimaryNameRequest>,
  ): Promise<PaginationResult<PrimaryNameRequest>>;
  getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<PrimaryName>;
  getPrimaryNames(
    params?: PaginationParams<PrimaryName>,
  ): Promise<PaginationResult<PrimaryName>>;
  getRedelegationFee(params: {
    address: WalletAddress;
  }): Promise<RedelegationFeeInfo>;
  getGatewayRegistrySettings(): Promise<GatewayRegistrySettings>;
  getAllDelegates(
    params?: PaginationParams<AllDelegates>,
  ): Promise<PaginationResult<AllDelegates>>;
  getAllGatewayVaults(
    params?: PaginationParams<AllGatewayVaults>,
  ): Promise<PaginationResult<AllGatewayVaults>>;
  getWithdrawals(
    params: PaginationParams<UserWithdrawal> & { address: WalletAddress },
  ): Promise<PaginationResult<UserWithdrawal>>;
}

export interface ARIOWrite extends ARIORead {
  // write interactions
  transfer: WriteAction<{ target: WalletAddress; qty: number | mARIOToken }>;
  vaultedTransfer: WriteAction<VaultedTransferParams>;
  revokeVault: WriteAction<RevokeVaultParams>;
  createVault: WriteAction<CreateVaultParams>;
  extendVault: WriteAction<ExtendVaultParams>;
  increaseVault: WriteAction<IncreaseVaultParams>;

  // TODO: these could be moved to a separate Gateways class that implements gateway specific interactions
  joinNetwork: WriteAction<JoinNetworkParams>;
  leaveNetwork: (options?: WriteOptions) => Promise<MessageResult>;
  updateGatewaySettings: WriteAction<UpdateGatewaySettingsParams>;
  increaseOperatorStake: WriteAction<{ increaseQty: number | mARIOToken }>;
  decreaseOperatorStake: WriteAction<{
    decreaseQty: number | mARIOToken;
    instant?: boolean;
  }>;
  delegateStake: WriteAction<DelegateStakeParams>;
  decreaseDelegateStake: WriteAction<{
    target: WalletAddress;
    decreaseQty: number | mARIOToken;
    instant?: boolean;
  }>;
  instantWithdrawal: WriteAction<{
    gatewayAddress?: WalletAddress;
    vaultId: string;
  }>;
  saveObservations: WriteAction<{
    reportTxId: TransactionId;
    failedGateways: WalletAddress[];
  }>;
  // END OF GATEWAY SPECIFIC INTERACTIONS
  buyRecord: WriteAction<
    BuyRecordParams,
    MessageResult,
    keyof BuyArNSNameProgressEvents,
    BuyArNSNameProgressEvents[keyof BuyArNSNameProgressEvents]
  >;
  upgradeRecord: WriteAction<ArNSPurchaseParams, MessageResult>;
  extendLease: WriteAction<ExtendLeaseParams, MessageResult>;
  increaseUndernameLimit: WriteAction<
    IncreaseUndernameLimitParams,
    MessageResult
  >;
  cancelWithdrawal: WriteAction<{
    gatewayAddress?: WalletAddress;
    vaultId: string;
  }>;
  requestPrimaryName(
    params: ArNSPurchaseParams,
    options?: WriteOptions,
  ): Promise<MessageResult<CreatePrimaryNameRequest>>;
  setPrimaryName: WriteAction<
    ArNSPurchaseParams,
    MessageResult,
    keyof SetPrimaryNameProgressEvents,
    SetPrimaryNameProgressEvents[keyof SetPrimaryNameProgressEvents]
  >;
  redelegateStake: WriteAction<RedelegateStakeParams>;
  /**
   * Reconcile an ANT NFT's on-chain Attributes plugin (`ArNS Name`, `Type`,
   * `Undername Limit`) with its current `ArnsRecord` state. Permissionless
   * cache-sync — useful when a `buyRecord`/`reassignName` was performed on
   * behalf of a different ANT holder, leaving traits unpopulated.
   *
   * Solana-only: throws on the AO backend (AO ANTs have no NFT trait surface).
   */
  syncAttributes: WriteAction<{ name: string }, MessageResult>;

  // NOTE: prune / cleanup methods (`pruneExpiredNames`, `pruneNameToReturned`,
  // `pruneReturnedNames`, `pruneExpiredReservation`, `pruneGateway`,
  // `finalizeGone`, `closeObservation`, `closeEmptyDelegation`,
  // `closeDrainedWithdrawal`, `releaseVault`, `closeExpiredRequest`) are
  // Solana-only and intentionally NOT on this interface — they have no AO
  // analogue (Lua's `tick()` did this lazily). Consumers needing them
  // should type the client as `SolanaARIOWriteable` directly. Keeps the
  // cross-backend interface minimal and avoids stubs that throw on AO.
  // See docs/CRANKER_PRUNING_PLAN.md.
}

// Type-guard functions
export function isLeasedArNSRecord(
  record: ArNSNameData,
): record is ArNSLeaseData {
  return record.type === 'lease';
}
