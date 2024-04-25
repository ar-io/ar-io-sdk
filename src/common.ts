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
import { ArconnectSigner, ArweaveSigner } from 'arbundles';
import { DataItem } from 'warp-arbundles';
import { Transaction } from 'warp-contracts';

import { RemoteContract, WarpContract } from './common/index.js';
import {
  ANTRecord,
  ANTState,
  AllowedProtocols,
  ArIOState,
  ArNSAuctionData,
  ArNSNameData,
  DENOMINATIONS,
  EpochDistributionData,
  Gateway,
  GatewayConnectionSettings,
  GatewayMetadata,
  GatewayStakingSettings,
  Observations,
  RegistrationType,
  WeightedObserver,
} from './contract-state.js';

export type BlockHeight = number;
export type SortKey = string;
export type WalletAddress = string;
export type TransactionId = string;

// TODO: append this with other configuration options (e.g. local vs. remote evaluation)
export type ContractSigner = ArweaveSigner | ArconnectSigner;
export type WithSigner<T = NonNullable<unknown>> = {
  signer: ContractSigner;
} & T; // TODO: optionally allow JWK in place of signer
export type OptionalSigner<T = NonNullable<unknown>> = {
  signer?: ContractSigner;
} & T;
export type ContractConfiguration =
  | {
      contract: WarpContract<unknown> | RemoteContract<unknown>;
    }
  | {
      contractTxId: string;
    };

export type EvaluationOptions = {
  evalTo?: { sortKey: SortKey } | { blockHeight: BlockHeight };
  // TODO: any other evaluation constraints
};

// combine evaluation parameters with read interaction inputs
export type EvaluationParameters<T = NonNullable<unknown>> = {
  evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
} & T;

export type ReadParameters<Input> = {
  functionName: string;
  inputs?: Input;
};

export type WriteParameters<Input> = WithSigner<
  Required<ReadParameters<Input>>
>;

export interface BaseContract<T> {
  getState(params: EvaluationParameters): Promise<T>;
}

export interface ReadContract {
  readInteraction<Input, State>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<ReadParameters<Input>>): Promise<State>;
}

export interface WriteContract {
  writeInteraction<Input>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<
    WriteParameters<Input>
  >): Promise<WriteInteractionResult>;
}

// TODO: extend with additional methods
export interface ArIOReadContract extends BaseContract<ArIOState> {
  getGateway({
    address,
    evaluationOptions,
  }: EvaluationParameters<{ address: WalletAddress }>): Promise<
    Gateway | undefined
  >;
  getGateways({
    evaluationOptions,
  }: EvaluationParameters): Promise<
    Record<WalletAddress, Gateway> | Record<string, never>
  >;
  getBalance(
    params: { address: WalletAddress } & EvaluationOptions,
  ): Promise<number>;
  getBalances({
    evaluationOptions,
  }: EvaluationParameters): Promise<
    Record<WalletAddress, number> | Record<string, never>
  >;
  getArNSRecord({
    domain,
    evaluationOptions,
  }: EvaluationParameters<{ domain: string }>): Promise<
    ArNSNameData | undefined
  >;
  getArNSRecords({
    evaluationOptions,
  }: EvaluationParameters): Promise<
    Record<string, ArNSNameData> | Record<string, never>
  >;
  getEpoch({
    blockHeight,
    evaluationOptions,
  }: EvaluationParameters<{
    blockHeight: number;
  }>): Promise<EpochDistributionData>;
  getCurrentEpoch({
    evaluationOptions,
  }: EvaluationParameters): Promise<EpochDistributionData>;
  getPrescribedObservers({
    evaluationOptions,
  }: EvaluationParameters): Promise<WeightedObserver[]>;
  getObservations({
    evaluationOptions,
  }: EvaluationParameters<{
    epochStartHeight?: number;
  }>): Promise<Observations>;
  getDistributions({
    evaluationOptions,
  }: EvaluationParameters): Promise<EpochDistributionData>;
  getAuctions({
    evaluationOptions,
  }: EvaluationParameters): Promise<Record<string, ArNSAuctionData>>;
  getAuction({
    domain,
    type,
    evaluationOptions,
  }: EvaluationParameters<{
    domain: string;
    type?: RegistrationType;
  }>): Promise<ArNSAuctionData>;
}

export interface ArIOWriteContract {
  // write interactions
  transfer({
    target,
    qty,
    denomination,
  }: {
    target: WalletAddress;
    qty: number;
    denomination: DENOMINATIONS;
  }): Promise<WriteInteractionResult>;
  joinNetwork({
    qty,
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
  }: JoinNetworkParams): Promise<WriteInteractionResult>;
  updateGatewaySettings({
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
  }: UpdateGatewaySettingsParams): Promise<WriteInteractionResult>;
  increaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult>;
  decreaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult>;
  increaseDelegateStake(params: {
    target: WalletAddress;
    qty: number;
  }): Promise<WriteInteractionResult>;
  decreaseDelegateStake(params: {
    target: WalletAddress;
    qty: number;
  }): Promise<WriteInteractionResult>;
  saveObservations(params: {
    reportTxId: TransactionId;
    failedGateways: WalletAddress[];
  }): Promise<WriteInteractionResult>;
}

export type WriteInteractionResult = Transaction | DataItem;

export type JoinNetworkParams = GatewayConnectionSettings &
  GatewayStakingSettings &
  GatewayMetadata & { qty: number };

// Original type definition refined with proper field-specific types
export type UpdateGatewaySettingsParamsBase = {
  allowDelegatedStaking?: boolean;
  delegateRewardShareRatio?: number;
  fqdn?: string;
  label?: string;
  minDelegatedStake?: number;
  note?: string;
  port?: number;
  properties?: string;
  protocol?: AllowedProtocols;
  autoStake?: boolean;
};

// Utility type to require at least one of the fields
export type AtLeastOne<T, U = { [K in keyof T]-?: T[K] }> = Partial<U> &
  { [K in keyof U]: Required<Pick<U, K>> }[keyof U];

// Define the type used for function parameters
export type UpdateGatewaySettingsParams =
  AtLeastOne<UpdateGatewaySettingsParamsBase>;

export interface ANTReadContract extends BaseContract<ANTState> {
  getRecord({
    domain,
    evaluationOptions,
  }: EvaluationParameters<{ domain: string }>): Promise<ANTRecord>;
  getRecords({
    evaluationOptions,
  }: EvaluationParameters): Promise<Record<string, ANTRecord>>;
  getOwner({ evaluationOptions }: EvaluationParameters): Promise<string>;
  getControllers({
    evaluationOptions,
  }: EvaluationParameters): Promise<string[]>;
  getTicker({ evaluationOptions }: EvaluationParameters): Promise<string>;
  getName({ evaluationOptions }: EvaluationParameters): Promise<string>;
  getBalance({
    address,
    evaluationOptions,
  }: EvaluationParameters<{ address: string }>): Promise<number>;
  getBalances({
    evaluationOptions,
  }: EvaluationParameters): Promise<Record<string, number>>;
}

export interface ANTWriteContract {
  transfer({
    target,
  }: {
    target: WalletAddress;
  }): Promise<WriteInteractionResult>;
  setController({
    controller,
  }: {
    controller: WalletAddress;
  }): Promise<WriteInteractionResult>;
  removeController({
    controller,
  }: {
    controller: WalletAddress;
  }): Promise<WriteInteractionResult>;
  setRecord({
    subDomain,
    transactionId,
    ttlSeconds,
  }: {
    subDomain: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<WriteInteractionResult>;
  removeRecord({
    subDomain,
  }: {
    subDomain: string;
  }): Promise<WriteInteractionResult>;
  setTicker({ ticker }: { ticker: string }): Promise<WriteInteractionResult>;
  setName({ name }: { name: string }): Promise<WriteInteractionResult>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Logger {
  setLogLevel: (level: string) => void;
  setLogFormat: (logFormat: string) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
export interface HTTPClient {
  get<I, K>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
    params,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
    params?: object | I;
  }): Promise<K>;
}
