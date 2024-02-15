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
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';
import { EvalStateResult, EvaluationOptions } from 'warp-contracts';

export interface ContractCache {
  /**
   * The ContractStateProvider interface is used to define a contract state provider.
   */
  getContractState<ContractState>({
    contractTxId,
  }: {
    contractTxId: string;
  }): Promise<ContractState>;
}

export type EvaluatedContractState<ContractState> =
  EvalStateResult<ContractState> & {
    sortKey: string;
    evaluationOptions: EvaluationOptions;
    contractTxId: string;
  };

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
  }: {
    endpoint: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
  }): Promise<T>;
  post<T>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
    data,
  }: {
    endpoint: string;
    signal: AbortSignal;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
    data: Readable | ReadableStream | Buffer;
  }): Promise<T>;
}
