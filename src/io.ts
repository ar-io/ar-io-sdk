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
import {
  ArNSNameData,
  ArNSReservedNameData,
  EpochDistributionData,
  EpochObservations,
  GatewayDelegate,
  GatewaySettings,
  Observations,
  VaultData,
  WeightedObserver,
} from './contract-state.js';
import { mIOToken } from './token.js';
import {
  AoMessageResult,
  JoinNetworkParams,
  TransactionId,
  UpdateGatewaySettingsParams,
  WalletAddress,
  WriteOptions,
} from './types.js';

export type EpochInput =
  | {
      blockHeight: number;
    }
  | {
      epochIndex: number;
    }
  | {
      timestamp: number;
    }
  | undefined;

export interface AoIORead {
  getGateway({
    address,
  }: {
    address: WalletAddress;
  }): Promise<AoGateway | undefined>;
  getGateways(): Promise<
    Record<WalletAddress, AoGateway> | Record<string, never>
  >;
  getBalance(params: { address: WalletAddress }): Promise<number>;
  getBalances(): Promise<Record<WalletAddress, number> | Record<string, never>>;
  getArNSRecord({ name }: { name: string }): Promise<ArNSNameData | undefined>;
  getArNSRecords(): Promise<
    Record<string, ArNSNameData> | Record<string, never>
  >;
  getArNSReservedNames(): Promise<
    Record<string, ArNSReservedNameData> | Record<string, never>
  >;
  getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<ArNSReservedNameData | undefined>;
  getEpoch(epoch?: EpochInput): Promise<AoEpochData>;
  getCurrentEpoch(): Promise<AoEpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<WeightedObserver[]>;
  getObservations(epoch?: EpochInput): Promise<Observations>;
  getDistributions(epoch?: EpochInput): Promise<EpochDistributionData>;
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
    }: Omit<JoinNetworkParams, 'observerWallet' | 'qty'> & {
      observerAddress: string;
      operatorStake: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
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
    }: Omit<UpdateGatewaySettingsParams, 'observerWallet'> & {
      observerAddress?: WalletAddress;
    },
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

// AO Contract types
export interface AoIOState {
  GatewayRegistry: Record<string, AoGateway>;
  Epochs: Record<number, AoEpochData>;
  NameRegistry: Record<string, ArNSNameData>;
  Balances: Record<WalletAddress, number>;
  Vaults: Record<WalletAddress, VaultData>;
  Ticker: string;
  Name: string;
}

export type AoEpochData = {
  epochIndex: number;
  observations: EpochObservations;
  prescribedObservers: WeightedObserver[];
  startTimestamp: number;
  endTimestamp: number;
  distributionTimestamp: number;
  distributions: Record<WalletAddress, number>;
};

export type AoGatewayStats = {
  passedConsecutiveEpochs: number;
  failedConsecutiveEpochs: number;
  totalEpochParticipationCount: number;
  passedEpochCount: number;
  failedEpochCount: number;
  observedEpochCount: number;
  prescribedEpochCount: number;
};

export type AoGateway = {
  settings: GatewaySettings;
  stats: AoGatewayStats;
  delegates: Record<WalletAddress, GatewayDelegate>;
  totalDelegatedStake: number;
  vaults: Record<WalletAddress, VaultData>;
  startTimestamp: number;
  endTimestamp: number;
  observerAddress: WalletAddress;
  operatorStake: number;
  status: 'joined' | 'leaving';
  // TODO: add weights
};
