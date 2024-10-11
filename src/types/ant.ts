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
import { ARWEAVE_TX_REGEX } from '../constants.js';
import { AoMessageResult, WalletAddress, WriteOptions } from './common.js';

/**
 * example error:
 *  {
        "code": "custom",
        "message": "Must be an Arweave Transaction ID",
        "path": [
          "Records",
          "record1",
          "transactionId"
        ]
      },
 */
export const ArweaveTxIdSchema = z
  .string({
    description: 'Arweave Transaction ID',
  })
  .refine((val) => ARWEAVE_TX_REGEX.test(val), {
    message: 'Must be an Arweave Transaction ID',
  });
export const AntRecordSchema = z.object({
  transactionId: ArweaveTxIdSchema.describe('The Target ID of the undername'),
  ttlSeconds: z.number(),
});
export type AoANTRecord = z.infer<typeof AntRecordSchema>;

export const AntRecordsSchema = z.record(z.string(), AntRecordSchema);
export const AntControllersSchema = z.array(
  ArweaveTxIdSchema.describe('Controller address'),
);
export const AntBalancesSchema = z.record(
  ArweaveTxIdSchema.describe('Holder address'),
  z.number(),
);

export const AntStateSchema = z.object({
  Name: z.string().describe('The name of the ANT.'),
  Ticker: z.string().describe('The ticker symbol for the ANT.'),
  Denomination: z.number(),
  Owner: ArweaveTxIdSchema.describe('The Owners address.'),
  Controllers: AntControllersSchema.describe(
    'Controllers of the ANT who have administrative privileges.',
  ),
  Records: AntRecordsSchema.describe('Records associated with the ANT.'),
  Balances: AntBalancesSchema.describe(
    'Balance details for each address holding the ANT.',
  ),
  Logo: ArweaveTxIdSchema.describe('Transaction ID of the ANT logo.'),
  TotalSupply: z
    .number()
    .describe('Total supply of the ANT in circulation.')
    .min(0, { message: 'Total supply must be a non-negative number' }),
  Initialized: z
    .boolean()
    .describe('Flag indicating whether the ANT has been initialized.'),
  ['Source-Code-TX-ID']: ArweaveTxIdSchema.describe(
    'Transaction ID of the Source Code for the ANT.',
  ),
});

export type AoANTState = z.infer<typeof AntStateSchema>;

export const AntInfoSchema = z.object({
  Name: z.string().describe('The name of the ANT.'),
  Owner: ArweaveTxIdSchema.describe('The Owners address.'),
  ['Source-Code-TX-ID']: ArweaveTxIdSchema.describe(
    'Transaction ID of the Source Code for the ANT.',
  ),
  Ticker: z.string().describe('The ticker symbol for the ANT.'),
  ['Total-Supply']: z
    .number()
    .describe('Total supply of the ANT in circulation.')
    .min(0, { message: 'Total supply must be a non-negative number' }),
  Logo: ArweaveTxIdSchema.describe('Transaction ID of the ANT logo.'),
  Denomination: z.number(),
});

export type AoANTInfo = z.infer<typeof AntInfoSchema>;

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
