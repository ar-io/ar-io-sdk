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
import { WalletAddress } from './common.js';

// Gateways

export type Gateway = {
  delegates: Record<string, unknown>;
  end: number;
  observerWallet: WalletAddress;
  operatorStake: number;
  settings: GatewaySettings;
  start: number;
  stats: GatewayStats;
  status: string;
  totalDelegatedStake: number;
  vaults: Record<WalletAddress, VaultData>;
  weights: ObserverWeights;
};

export type GatewaySettings = {
  allowDelegatedStaking: boolean;
  delegateRewardShareRatio: number;
  fqdn: string;
  label: string;
  minDelegatedStake: number;
  note?: string;
  port: number;
  properties?: string;
  protocol: AllowedProtocols;
};

export type AllowedProtocols = 'http' | 'https';

export type GatewayStats = {
  failedConsecutiveEpochs: number;
  passedEpochCount: number;
  submittedEpochCount: number;
  totalEpochParticipationCount: number;
  totalEpochsPrescribedCount: number;
};

// Observations

export type WeightedObserver = {
  gatewayAddress: WalletAddress;
  observerAddress: WalletAddress;
  stake: number;
  start: number;
} & ObserverWeights;

export type ObserverWeights = {
  stakeWeight: number;
  tenureWeight: number;
  gatewayRewardRatioWeight: number;
  observerRewardRatioWeight: number;
  compositeWeight: number;
  normalizedCompositeWeight: number;
};

// Records
export type RegistrationType = 'lease' | 'permabuy';
export type ArNSBaseNameData = {
  contractTxId: string; // The ANT Contract used to manage this name
  startTimestamp: number; // At what unix time (seconds since epoch) the lease starts
  type: RegistrationType;
  undernames: number;
  purchasePrice: number;
};

export type ArNSPermabuyData = ArNSBaseNameData & {
  type: 'permabuy';
};

export type ArNSLeaseData = ArNSBaseNameData & {
  type: 'lease';
  endTimestamp: number; // At what unix time (seconds since epoch) the lease ends
};

export type ArNSNameData = ArNSPermabuyData | ArNSLeaseData;

// Vaults

export type VaultData = {
  balance: number;
  start: number;
  end: number;
};

// Balances

export type Balances = Record<WalletAddress, number>;

export type Fees = Record<string, number>;

export type ReservedNameData = {
  target?: string; // The target wallet address this name is reserved for
  endTimestamp?: number; // At what unix time (seconds since epoch) this reserved name becomes available
};

export type ArNSBaseAuctionData = {
  startPrice: number;
  floorPrice: number;
  startHeight: number;
  endHeight: number;
  type: RegistrationType;
  initiator: string;
  contractTxId: string;
};

export type ArNSLeaseAuctionData = ArNSBaseAuctionData & {
  type: 'lease';
  years: 1;
};

export type ArNSPermabuyAuctionData = ArNSBaseAuctionData & {
  type: 'permabuy';
};

export type ArNSAuctionData = ArNSLeaseAuctionData | ArNSPermabuyAuctionData;

export type DemandFactoringData = {
  periodZeroBlockHeight: number; // TODO: The block height at which the contract was initialized
  currentPeriod: number;
  trailingPeriodPurchases: number[]; // Acts as a ring buffer of trailing period purchase counts
  trailingPeriodRevenues: number[]; // Acts as a ring buffer of trailing period revenues
  purchasesThisPeriod: number;
  revenueThisPeriod: number;
  demandFactor: number;
  consecutivePeriodsWithMinDemandFactor: number;
};

export type EpochObservations = {
  failureSummaries: Record<string, string[]>; // an observers summary of all failed gateways in the epoch
  reports: Record<string, string>; // a reference point for the report submitted by this observer
};

export type Observations = Record<number, EpochObservations>;

export type EpochDistributionData = {
  epochZeroStartHeight: number;
  epochStartHeight: number; // the current epoch start height
  epochEndHeight: number; // the current epoch end height
  epochPeriod: number;
  nextDistributionHeight: number;
};

export type Vaults = Record<string, VaultData>;

export type RegistryVaults = Record<string, Vaults>;

export type PrescribedObservers = Record<number, WeightedObserver[]>;

export interface ArIOState {
  balances: Balances;
  name: string; // The friendly name of the token, shown in block explorers and marketplaces
  records: Record<string, ArNSNameData>; // The list of all ArNS names and their associated data
  gateways: Record<string, Gateway>; // each gateway uses its public arweave wallet address to identify it in the gateway registry
  fees: Fees; // starting list of all fees for purchasing ArNS names
  reserved: Record<string, ReservedNameData>; // list of all reserved names that are not allowed to be purchased at this time
  auctions: Record<string, ArNSAuctionData>;
  lastTickedHeight: number; // periodicity management
  demandFactoring: DemandFactoringData;
  observations: Observations;
  distributions: EpochDistributionData;
  vaults: RegistryVaults;
  prescribedObservers: PrescribedObservers;
}

export type AntRecord = {
  ttlSeconds: number;
  transactionId: string;
};

export interface AntState {
  balances: Balances;
  name: string;
  ticket: string;
  records: Record<string, AntRecord>;
  owner: string;
  controllers: string[];
}
