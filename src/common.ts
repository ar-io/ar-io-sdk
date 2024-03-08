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
import { ArIOState, ArNSNameData, Gateway } from './contract-state.js';

export type BlockHeight = number;
export type SortKey = string;
export type WalletAddress = string;

export type EvaluationOptions = {
  evalTo?: { sortKey: SortKey } | { blockHeight: BlockHeight };
  // TODO: any other evaluation constraints
};

// combine evaluation parameters with read interaction inputs
export type EvaluationParameters<T = NonNullable<unknown>> = {
  evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
} & T;

export interface SmartWeaveContract<T> {
  getContractState(params: EvaluationParameters): Promise<T>;
  readInteraction<I, K>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<{ functionName: string; inputs?: I }>): Promise<K>;
  // TODO: write interaction
}

// TODO: extend with additional methods
export interface ArIOContract {
  getState({ evaluationOptions }: EvaluationParameters): Promise<ArIOState>;
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