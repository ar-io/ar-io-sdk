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
import { Gateway } from './contract-state.js';

export interface ContractCache {
  /**
   * The ContractCache interface is used to define a contract state provider.
   */
  setContractTxId(contractTxId: string): ArIOContract;
}
// TODO: extend with additional methods
export interface ArIOContract {
  getGateway({ address }: { address: WalletAddress }): Promise<Gateway>;
  getGateways(): Promise<Record<WalletAddress, Gateway>>;
  getBalance({ address }: { address: WalletAddress }): Promise<number>;
  getBalances(): Promise<Record<WalletAddress, number>>;
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

export type WalletAddress = string;

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
  // TODO: add post method
  // post<T>({
  //   endpoint,
  //   signal,
  //   headers,
  //   allowedStatuses,
  //   data,
  // }: {
  //   endpoint: string;
  //   signal: AbortSignal;
  //   headers?: Record<string, string>;
  //   allowedStatuses?: number[];
  //   data: Readable | ReadableStream | Buffer;
  // }): Promise<T>;
}
