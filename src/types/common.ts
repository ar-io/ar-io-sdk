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
  AntRecord,
  AntState,
  ArIOState,
  ArNSNameData,
  Gateway,
} from './contract-state.js';

export type BlockHeight = number;
export type SortKey = string;
export type WalletAddress = string;

export type EvalToParams =
  | { sortKey: SortKey }
  | { blockHeight: BlockHeight }
  | undefined;

export type EvaluationParameters = {
  evalTo?: EvalToParams;
};

// TODO: extend type with other read filters (e.g max eval time)
export type EvaluationOptions = {
  evaluationParameters?: EvaluationParameters;
};

export interface SmartWeaveContract {
  getContractState(params: EvaluationOptions): Promise<any>;
  readInteraction<T>(
    params: { functionName: string; inputs?: unknown } & EvaluationOptions,
  ): Promise<T>;
  // TODO: write interaction
}

// TODO: extend with additional methods
export interface ArIOContract {
  getState(params: EvaluationOptions): Promise<ArIOState>;
  getGateway(
    params: { address: WalletAddress } & EvaluationOptions,
  ): Promise<Gateway>;
  getGateways(
    params?: EvaluationOptions,
  ): Promise<Record<WalletAddress, Gateway>>;
  getBalance(
    params: { address: WalletAddress } & EvaluationOptions,
  ): Promise<number>;
  getBalances(
    params?: EvaluationOptions,
  ): Promise<Record<WalletAddress, number>>;
  getArNSRecord(
    params: { domain: string } & EvaluationOptions,
  ): Promise<ArNSNameData>;
  getArNSRecords(
    params?: EvaluationOptions,
  ): Promise<Record<string, ArNSNameData>>;
}

export interface AntContract {
  getState(params: EvaluationOptions): Promise<AntState>;
  getRecords(params: EvaluationOptions): Promise<Record<string, AntRecord>>;
  getRecord(
    params: { undername: string } & EvaluationOptions,
  ): Promise<AntRecord>;
  getOwner(params: EvaluationOptions): Promise<WalletAddress>;
  getControllers(params: EvaluationOptions): Promise<WalletAddress[]>;
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
  get<T>({
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
    params?: Record<string, unknown>;
  }): Promise<T>;
}
