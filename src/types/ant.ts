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

export const IntegerStringSchema = z
  .string({
    description: 'Integer String',
  })
  .refine(
    (val) => {
      const num = parseInt(val);
      return Number.isInteger(num) && num >= 0;
    },
    { message: 'Must be a non negative integer string' },
  );

export const AntDescriptionSchema = z.string(); // TODO: add specific limits for description ie max length
export const AntKeywordsSchema = z.array(z.string()); // TODO: add specific limits for keywords ie max amount and max length
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
  Description: z.string().describe('The description for the ANT.'),
  Keywords: AntKeywordsSchema.describe('The keywords for the ANT.'),
  Denomination: z
    .number()
    .describe(
      'The number of decimal places to use for the ANT. Defaults to 0 if not set representing whole numbers.',
    )
    .min(0, { message: 'Denomination must be a non-negative number' }),
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
});

export type AoANTState = z.infer<typeof AntStateSchema>;

export const AntReadHandlers = [
  'balance',
  'balances',
  'totalSupply',
  'info',
  'controllers',
  'record',
  'records',
  'state',
] as const;

export type AoANTReadHandler = (typeof AntReadHandlers)[number];

export const AntWriteHandlers = [
  '_eval',
  '_default',
  'transfer',
  'addController',
  'removeController',
  'setRecord',
  'removeRecord',
  'setName',
  'setTicker',
  'setDescription',
  'setKeywords',
  'setLogo',
  'initializeState',
  'releaseName',
  'reassignName',
  'approvePrimaryName',
  'removePrimaryNames',
] as const;

export type AoANTWriteHandler = (typeof AntWriteHandlers)[number];

export const AntHandlerNames = [...AntReadHandlers, ...AntWriteHandlers];
export type AoANTHandler = AoANTWriteHandler | AoANTReadHandler;
export const AntHandlersSchema = z
  .array(z.string({ description: 'Handler Name' }))
  .refine(
    (antHandlers: string[]) => {
      return AntHandlerNames.every((handler) => antHandlers.includes(handler));
    },
    {
      message: 'ANT is missing required handlers',
    },
  );

export const AntInfoSchema = z.object({
  Name: z.string().describe('The name of the ANT.'),
  Owner: ArweaveTxIdSchema.describe('The Owners address.'),

  Ticker: z.string().describe('The ticker symbol for the ANT.'),
  ['Total-Supply']: IntegerStringSchema.describe(
    'Total supply of the ANT in circulation.',
  ),
  Description: AntDescriptionSchema.describe('The description for the ANT.'),
  Keywords: AntKeywordsSchema.describe('The keywords for the ANT.'),

  Logo: ArweaveTxIdSchema.describe('Transaction ID of the ANT logo.'),
  Denomination: IntegerStringSchema.describe(
    'The number of decimal places to use for the ANT. Defaults to 0 if not set representing whole numbers.',
  ),
  Handlers: AntHandlersSchema.optional().describe(
    'List of handlers for the ANT.',
  ),
  HandlerNames: AntHandlersSchema.optional().describe(
    'Deprecated: List of handlers for the ANT. Use "Handlers" instead.',
  ),
});

export type AoANTInfo = z.infer<typeof AntInfoSchema>;

/**
 * @param state {object}
 * @returns {boolean}
 */
export function isAoANTState(state: object): state is AoANTState {
  return AntStateSchema.safeParse(state).success;
}

export type AntReadOptions = { strict?: boolean };

export interface AoANTRead {
  processId: string;
  getState(opts?: AntReadOptions): Promise<AoANTState>;
  getInfo(opts?: AntReadOptions): Promise<AoANTInfo>;
  getRecord(
    { undername }: { undername: string },
    opts?: AntReadOptions,
  ): Promise<AoANTRecord | undefined>;
  getRecords(opts?: AntReadOptions): Promise<Record<string, AoANTRecord>>;
  getOwner(opts?: AntReadOptions): Promise<WalletAddress>;
  getControllers(): Promise<WalletAddress[]>;
  getTicker(opts?: AntReadOptions): Promise<string>;
  getLogo(opts?: AntReadOptions): Promise<string>;
  getName(opts?: AntReadOptions): Promise<string>;
  getBalance(
    { address }: { address: WalletAddress },
    opts?: AntReadOptions,
  ): Promise<number>;
  getBalances(opts?: AntReadOptions): Promise<Record<WalletAddress, number>>;
  getHandlers(): Promise<AoANTHandler[]>;
}

export interface AoANTWrite extends AoANTRead {
  transfer: WriteAction<{ target: WalletAddress }>;
  addController: WriteAction<{ controller: WalletAddress }>;
  removeController: WriteAction<{ controller: WalletAddress }>;
  /** @deprecated Use setUndernameRecord instead for undernames, and setBaseNameRecord instead for the top level name (e.g. "@") */
  setRecord: WriteAction<AoANTSetUndernameRecordParams>;
  removeRecord: WriteAction<{ undername: string }>;
  setBaseNameRecord: WriteAction<AoANTSetBaseNameRecordParams>;
  setUndernameRecord: WriteAction<AoANTSetUndernameRecordParams>;
  removeUndernameRecord: WriteAction<{ undername: string }>;
  setTicker: WriteAction<{ ticker: string }>;
  setDescription: WriteAction<{ description: string }>;
  setKeywords: WriteAction<{ keywords: string[] }>;
  setName: WriteAction<{ name: string }>;
  setLogo: WriteAction<{ txId: string }>;
  releaseName: WriteAction<{ name: string; arioProcessId: string }>;
  reassignName: WriteAction<{
    name: string;
    arioProcessId: string;
    antProcessId: string;
  }>;
  approvePrimaryNameRequest: WriteAction<{
    name: string;
    address: string;
    arioProcessId: string;
  }>;
  removePrimaryNames: WriteAction<{
    names: string[];
    arioProcessId: string;
    notifyOwners?: boolean;
  }>;
}

/** utility type to ensure WriteOptions are appended to each parameter set */
type WriteAction<P, R = AoMessageResult> = (
  params: P,
  options?: WriteOptions,
) => Promise<R>;

export type AoANTSetBaseNameRecordParams = {
  transactionId: string;
  ttlSeconds: number;
};

export type AoANTSetUndernameRecordParams = AoANTSetBaseNameRecordParams & {
  undername: string;
};
