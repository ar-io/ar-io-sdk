/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { z } from 'zod';

import { Logger } from '../common/logger.js';
import { AoMessageResult, WalletAddress, WriteOptions } from './common.js';

export type AoANTState = {
  Name: string;
  Ticker: string;
  Denomination: number;
  Owner: WalletAddress;
  Controllers: WalletAddress[];
  Records: Record<string, AoANTRecord>;
  Balances: Record<WalletAddress, number>;
  Logo: string;
  TotalSupply: number;
  Initialized: boolean;
  ['Source-Code-TX-ID']: string;
};

export type AoANTInfo = {
  Name: string;
  Owner: string;
  Handlers: string[];
  ['Source-Code-TX-ID']: string;
  // token related
  Ticker: string;
  ['Total-Supply']: string;
  Logo: string;
  Denomination: string;
};

export type AoANTRecord = {
  transactionId: string;
  ttlSeconds: number;
};

export interface AoANTRead {
  getState(): Promise<AoANTState>;
  getInfo(): Promise<AoANTInfo>;
  getRecord({ undername }): Promise<AoANTRecord | undefined>;
  getRecords(): Promise<Record<string, AoANTRecord>>;
  getOwner(): Promise<WalletAddress>;
  getControllers(): Promise<WalletAddress[]>;
  getTicker(): Promise<string>;
  getName(): Promise<string>;
  getBalance({ address }: { address: WalletAddress }): Promise<number>;
  getBalances(): Promise<Record<WalletAddress, number>>;
}

export interface AoANTWrite extends AoANTRead {
  transfer(
    { target }: { target: WalletAddress },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  addController(
    {
      controller,
    }: {
      controller: WalletAddress;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  removeController(
    {
      controller,
    }: {
      controller: WalletAddress;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  setRecord(
    {
      undername,
      transactionId,
      ttlSeconds,
    }: {
      undername: string;
      transactionId: string;
      ttlSeconds: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  removeRecord(
    { undername }: { undername: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  setTicker(
    { ticker }: { ticker: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
  setName(
    { name }: { name: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult>;
}

export const AntRecordSchema = z
  .object({
    transactionId: z.string(),
    ttlSeconds: z.number(),
  })
  .passthrough();
export const AntRecordsSchema = z.record(z.string(), AntRecordSchema);

export const AntControllersSchema = z.array(z.string());
export const AntBalancesSchema = z.record(z.string(), z.number());

// using passThrough to require the minimum fields and allow others (eg TotalSupply, Logo, etc)
export const AntStateSchema = z
  .object({
    Name: z.string(),
    Ticker: z.string(),
    Owner: z.string(),
    Controllers: AntControllersSchema,
    Records: AntRecordsSchema,
    Balances: AntBalancesSchema,
    ['Source-Code-TX-ID']: z.string(),
  })
  .passthrough();

export const AntInfoSchema = z
  .object({
    Name: z.string(),
    Owner: z.string(),
    ['Source-Code-TX-ID']: z.string(),
    Ticker: z.string(),
    ['Total-Supply']: z.string(),
    Logo: z.string(),
    Denomination: z.string(),
  })
  .passthrough();

/**
 * @param state
 * @returns {boolean}
 * @throws {z.ZodError} if the state object does not match the expected schema
 */
export function isAoANTState(
  state: object,
  logger: Logger = Logger.default,
): state is AoANTState {
  try {
    AntStateSchema.parse(state);
    return true;
  } catch (error) {
    // this allows us to see the path of the error in the object as well as the expected schema on invalid fields
    logger.error(error.issues);
    return false;
  }
}
