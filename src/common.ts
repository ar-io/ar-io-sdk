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
import { InteractionResult, Transaction } from 'warp-contracts';

import {
  ANTRecord,
  ANTState,
  ArIOState,
  ArNSAuctionData,
  ArNSNameData,
  EpochDistributionData,
  Gateway,
  Observations,
  RegistrationType,
  WeightedObserver,
} from './contract-state.js';

export type BlockHeight = number;
export type SortKey = string;
export type WalletAddress = string;

// TODO: append this with other configuration options (e.g. local vs. remote evaluation)
export type ContractSigner = ArweaveSigner | ArconnectSigner;
export type ContractConfiguration = {
  signer?: ContractSigner; // TODO: optionally allow JWK in place of signer
} & (
  | {
      contract?: BaseContract<unknown> & ReadContract;
    }
  | {
      contractTxId: string;
    }
);

export function isContractConfiguration<T>(
  config: ContractConfiguration,
): config is { contract: BaseContract<T> & ReadContract } {
  return 'contract' in config;
}

export function isContractTxIdConfiguration(
  config: ContractConfiguration,
): config is { contractTxId: string } {
  return 'contractTxId' in config;
}

export type EvaluationOptions = {
  evalTo?: { sortKey: SortKey } | { blockHeight: BlockHeight };
  // TODO: any other evaluation constraints
};

// combine evaluation parameters with read interaction inputs
export type EvaluationParameters<T = NonNullable<unknown>> = {
  evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
} & T;

export type WriteParameters<Input> = {
  functionName: string;
  inputs: Input;
  dryWrite?: boolean;
  // TODO: add syncState and abortSignal options
};

export interface BaseContract<T> {
  getState(params: EvaluationParameters): Promise<T>;
  connect(signer: ContractSigner): this;
}

export interface ReadContract {
  readInteraction<Input, State>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<{
    functionName: string;
    inputs?: Input;
  }>): Promise<State>;
}

export interface WriteContract {
  writeInteraction<Input>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<WriteParameters<Input>>): Promise<
    Transaction | DataItem | InteractionResult<unknown, unknown>
  >;
}

export interface SmartWeaveContract<T> {
  getContractState(params: EvaluationParameters): Promise<T>;
  readInteraction<I, K>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<{ functionName: string; inputs?: I }>): Promise<K>;
}

// TODO: extend with additional methods
export interface ArIOContract extends BaseContract<ArIOState> {
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
  }: {
    blockHeight: number;
  } & EvaluationParameters): Promise<EpochDistributionData>;
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

export interface ANTContract extends BaseContract<ANTState> {
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
