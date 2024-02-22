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
