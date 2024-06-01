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
import { GQLNodeInterface, Transaction } from 'warp-contracts';

import { RemoteContract, WarpContract } from './common/index.js';
import { IOContractInteractionsWithIOFees } from './contract-state.js';
import {
  ANTRecord,
  ANTState,
  AllowedProtocols,
  ArIOState,
  ArNSAuctionData,
  ArNSNameData,
  ArNSReservedNameData,
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
import { mIOToken } from './token.js';

export type BlockHeight = number;
export type SortKey = string;
export type WalletAddress = string;
export type TransactionId = string;

export type DataProtocolTransaction = Pick<
  GQLNodeInterface,
  'id' | 'tags' | 'data'
>;

// TODO: append this with other configuration options (e.g. local vs. remote evaluation)
export type ContractSigner = ArweaveSigner | ArconnectSigner;
export type WithSigner<T = NonNullable<unknown>> = {
  signer: ContractSigner;
} & T; // TODO: optionally allow JWK in place of signer
export type OptionalSigner<T = NonNullable<unknown>> = {
  signer?: ContractSigner;
} & T;
export type ContractConfiguration<T = NonNullable<unknown>> =
  | {
      contract?: WarpContract<T> | RemoteContract<T>;
    }
  | {
      contractTxId?: string;
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

export type WriteOptions = {
  tags?: { name: string; value: string }[];
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
  writeInteraction<Input>(
    { functionName, inputs }: WriteParameters<Input>,
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
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
  getArNSReservedNames({
    evaluationOptions,
  }: EvaluationParameters): Promise<
    Record<string, ArNSReservedNameData> | Record<string, never>
  >;
  getArNSReservedName({
    domain,
    evaluationOptions,
  }: EvaluationParameters<{ domain: string }>): Promise<
    ArNSReservedNameData | undefined
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
  }: EvaluationParameters): Promise<Observations>;
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
  getPriceForInteraction({
    interactionName,
    payload,
    evaluationOptions,
  }: EvaluationParameters<{
    interactionName: IOContractInteractionsWithIOFees;
    payload: object;
  }>): Promise<number>;
}

export interface ArIOWriteContract {
  // write interactions
  transfer(
    {
      target,
      qty,
      denomination,
    }: {
      target: WalletAddress;
      qty: number;
      denomination: DENOMINATIONS;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  joinNetwork(
    {
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
      observerWallet,
    }: JoinNetworkParams,
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
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
      observerWallet,
    }: UpdateGatewaySettingsParams,
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  increaseOperatorStake(
    params: {
      qty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  decreaseOperatorStake(
    params: {
      qty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  increaseDelegateStake(
    params: {
      target: WalletAddress;
      qty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  decreaseDelegateStake(
    params: {
      target: WalletAddress;
      qty: number | mIOToken;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  saveObservations(
    params: {
      reportTxId: TransactionId;
      failedGateways: WalletAddress[];
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  extendLease(
    params: {
      domain: string;
      years: number;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  increaseUndernameLimit(
    params: {
      domain: string;
      qty: number;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
}

// we only support L1 smartweave interactions
export type WriteInteractionResult = Transaction;

// Helper type to overwrite properties of A with B
type Overwrite<T, U> = {
  [K in keyof T]: K extends keyof U ? U[K] : T[K];
};

export type JoinNetworkParams = Overwrite<
  GatewayConnectionSettings & GatewayStakingSettings & GatewayMetadata,
  {
    minDelegatedStake: number | mIOToken; // TODO: this is for backwards compatibility
  }
> & {
  qty: number | mIOToken; // TODO: this is for backwards compatibility
  observerWallet?: WalletAddress;
};

// Original type definition refined with proper field-specific types
export type UpdateGatewaySettingsParamsBase = {
  allowDelegatedStaking?: boolean;
  delegateRewardShareRatio?: number;
  fqdn?: string;
  label?: string;
  minDelegatedStake?: number | mIOToken; // TODO: this is for backwards compatibility - eventually we'll drop number
  note?: string;
  port?: number;
  properties?: string;
  protocol?: AllowedProtocols;
  autoStake?: boolean;
  observerWallet?: WalletAddress;
};

// Utility type to require at least one of the fields
export type AtLeastOne<
  T,
  U = { [K in keyof T]-?: Record<K, T[K]> },
> = Partial<T> & U[keyof U];

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
  transfer(
    {
      target,
    }: {
      target: WalletAddress;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  setController(
    {
      controller,
    }: {
      controller: WalletAddress;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  removeController(
    {
      controller,
    }: {
      controller: WalletAddress;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  setRecord(
    {
      subDomain,
      transactionId,
      ttlSeconds,
    }: {
      subDomain: string;
      transactionId: string;
      ttlSeconds: number;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  removeRecord(
    {
      subDomain,
    }: {
      subDomain: string;
    },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  setTicker(
    { ticker }: { ticker: string },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
  setName(
    { name }: { name: string },
    options?: WriteOptions,
  ): Promise<WriteInteractionResult>;
}

export interface Logger {
  setLogLevel: (level: string) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

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
