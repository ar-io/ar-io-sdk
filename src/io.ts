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
import {
  ArNSNameData,
  ArNSReservedNameData,
  EpochDistributionData,
  EpochObservations,
  GatewayDelegate,
  GatewaySettings,
  VaultData,
  WeightedObserver,
} from './contract-state.js';
import { mIOToken } from './token.js';
import {
  AoMessageResult,
  BlockHeight,
  ContractSigner,
  JoinNetworkParams,
  Timestamp,
  TransactionId,
  UpdateGatewaySettingsParams,
  WalletAddress,
  WriteOptions,
} from './types.js';
import { validateArweaveId } from './utils/arweave.js';

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

export type ProcessConfiguration =
  | {
      process?: AOProcess;
    }
  | {
      processId?: string;
    };

export type EpochInput =
  | {
      blockHeight: BlockHeight;
    }
  | {
      epochIndex: AoEpochIndex;
    }
  | {
      timestamp: Timestamp;
    }
  | undefined;

export interface AOContract {
  read<K>({
    tags,
    retries,
  }: {
    tags?: { name: string; value: string }[];
    retries?: number;
  }): Promise<K>;
  send<I, K>({
    tags,
    data,
    signer,
  }: {
    tags: { name: string; value: string }[];
    data: I;
    signer: ContractSigner;
  }): Promise<{ id: string; result?: K }>;
}

export interface AoIORead {
  // read interactions
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
  getArNSRecord({
    name,
  }: {
    name: string;
  }): Promise<AoArNSNameData | undefined>;
  getArNSRecords(): Promise<
    Record<string, AoArNSNameData> | Record<string, never>
  >;
  getArNSReservedNames(): Promise<
    Record<string, AoArNSReservedNameData> | Record<string, never>
  >;
  getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<ArNSReservedNameData | undefined>;
  getEpoch(epoch?: EpochInput): Promise<AoEpochData>;
  getCurrentEpoch(): Promise<AoEpochData>;
  getPrescribedObservers(epoch?: EpochInput): Promise<WeightedObserver[]>;
  getPrescribedNames(epoch?: EpochInput): Promise<string[]>;
  getObservations(epoch?: EpochInput): Promise<EpochObservations>;
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

// AO Contract types
export interface AoIOState {
  GatewayRegistry: Record<WalletAddress, AoGateway>;
  Epochs: Record<AoEpochIndex, AoEpochData>;
  NameRegistry: {
    records: Record<string, AoArNSNameData>;
    reserved: Record<string, AoArNSReservedNameData>;
  };
  Balances: Record<WalletAddress, number>;
  Vaults: Record<WalletAddress, VaultData>;
  Ticker: string;
  Name: string;
  Logo: string;
}

export type AoEpochIndex = number;
export type AoArNSReservedNameData = ArNSReservedNameData;
export type AoArNSNameData = Omit<ArNSNameData, 'contractTxId'> & {
  processId: string;
};

export type AoEpochData = {
  epochIndex: AoEpochIndex;
  startHeight: BlockHeight;
  observations: EpochObservations;
  prescribedObservers: WeightedObserver[];
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  distributionTimestamp: Timestamp;
  distributions: {
    rewards: Record<WalletAddress, number>;
    distributedTimestamp: Timestamp;
    totalDistributedRewards: number;
    totalEligibleRewards: number;
  };
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
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  observerAddress: WalletAddress;
  operatorStake: number;
  status: 'joined' | 'leaving';
  // TODO: add weights
};
