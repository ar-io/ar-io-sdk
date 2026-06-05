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
import {
  MessageResult,
  UpgradeAntProgressEvent,
  WalletAddress,
  WriteAction,
} from './common.js';

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

export const WalletAddressSchema = z.string({
  description: 'Wallet address (Solana base58 pubkey)',
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

export const AntDescriptionSchema = z.string().max(256, {
  message: 'ANT description must be at most 256 characters',
});
export const AntKeywordsSchema = z
  .array(
    z.string().max(32, {
      message: 'Each keyword must be at most 32 characters',
    }),
  )
  .max(8, { message: 'ANT can have at most 8 keywords' });
export const AntRecordSchema = z.object({
  transactionId: z
    .string()
    .describe('Content target (Arweave TX ID, IPFS CID, etc.)'),
  ttlSeconds: z.number(),
  targetProtocol: z
    .number()
    .describe('Storage protocol: 0 = Arweave, 1 = IPFS')
    .default(0),
  priority: z.number().optional(),
  owner: WalletAddressSchema.describe(
    'The owner address of the record',
  ).optional(),
  displayName: z
    .string()
    .max(61)
    .describe('Display name of the record (max 61 chars)')
    .optional(),
  logo: ArweaveTxIdSchema.describe(
    'Logo transaction ID for the record',
  ).optional(),
  description: z
    .string()
    .max(256)
    .describe('Description of the record (max 256 chars)')
    .optional(),
  keywords: z
    .array(z.string().max(32))
    .max(8)
    .describe('Keywords array (max 8, each max 32 chars)')
    .optional(),
});
export type ANTRecord = z.infer<typeof AntRecordSchema>;
export type ANTRecords = Record<string, ANTRecord>;
export type SortedANTRecord = ANTRecord & { index: number };
export type SortedANTRecords = Record<string, SortedANTRecord>;

export const AntRecordsSchema = z.record(z.string(), AntRecordSchema);
export const AntControllersSchema = z.array(
  WalletAddressSchema.describe('Controller address'),
);
export const AntBalancesSchema = z.record(
  WalletAddressSchema.describe('Holder address'),
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
  Owner: WalletAddressSchema.describe('The Owners address.'),
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

export type ANTState = z.infer<typeof AntStateSchema>;

/**
 * Lightweight ANT view for portfolio/list rendering. Carries the config fields
 * plus controllers and the apex (`@`) record — everything a names table needs —
 * WITHOUT the full undername record set. Produced in bulk by
 * `getANTSummaries(mints)` in a handful of `getMultipleAccounts` calls; fetch
 * full undernames lazily via `getRecords`/`getState` when a name is opened.
 */
export type ANTSummary = {
  processId: string;
  name: string;
  ticker: string;
  logo: string;
  description: string;
  keywords: string[];
  owner: WalletAddress;
  controllers: WalletAddress[];
  /** The apex (`@`) record — the name's primary target — if set. */
  apexRecord?: ANTRecord;
};

export const SpawnANTStateSchema = z.object({
  name: z.string().describe('The name of the ANT.'),
  ticker: z.string().describe('The ticker symbol for the ANT.'),
  description: z.string().describe('The description for the ANT.'),
  keywords: AntKeywordsSchema.describe('The keywords for the ANT.'),
  owner: WalletAddressSchema.describe('The Owners address.'),
  controllers: AntControllersSchema.describe(
    'Controllers of the ANT who have administrative privileges.',
  ),
  records: AntRecordsSchema.describe('Records associated with the ANT.'),
  balances: AntBalancesSchema.describe(
    'Balance details for each address holding the ANT.',
  ),
  logo: ArweaveTxIdSchema.describe('Transaction ID of the ANT logo.'),
});

export type SpawnANTState = z.infer<typeof SpawnANTStateSchema>;

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

export type ANTReadHandler = (typeof AntReadHandlers)[number];

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
  'transferRecordOwnership',
] as const;

export type ANTWriteHandler = (typeof AntWriteHandlers)[number];

export const AntHandlerNames = [...AntReadHandlers, ...AntWriteHandlers];
export type ANTHandler = ANTWriteHandler | ANTReadHandler;
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

export type ANTInfo = z.infer<typeof AntInfoSchema>;

/**
 * @param state {object}
 * @returns {boolean}
 */
export function isANTState(state: object): state is ANTState {
  return AntStateSchema.safeParse(state).success;
}

export type AntReadOptions = {
  strict?: boolean;
  /**
   * Include per-record metadata (`displayName`/`logo`/`description`/`keywords`)
   * when reading undername records. Defaults to `false` — metadata requires a
   * second `getProgramAccounts` scan per ANT and is only needed in detail/edit
   * views, so list reads (`getState`/`getRecords`) skip it by default. Fetch a
   * single record's metadata on demand via `getRecord`.
   */
  includeMetadata?: boolean;
};

export interface ANTRead {
  processId: string;
  getState(opts?: AntReadOptions): Promise<ANTState>;
  getInfo(opts?: AntReadOptions): Promise<ANTInfo>;
  getRecord(
    { undername }: { undername: string },
    opts?: AntReadOptions,
  ): Promise<ANTRecord | undefined>;
  getRecords(opts?: AntReadOptions): Promise<SortedANTRecords>;
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
  getHandlers(): Promise<ANTHandler[]>;
  getModuleId(opts?: {
    graphqlUrl?: string;
    retries?: number;
  }): Promise<string>;
  getVersion(opts?: {
    antRegistryId?: string;
    graphqlUrl?: string;
    retries?: number;
  }): Promise<string>;
  isLatestVersion(opts?: {
    antRegistryId?: string;
    graphqlUrl?: string;
    retries?: number;
  }): Promise<boolean>;
}

export interface ANTWrite extends ANTRead {
  /**
   * Transfer ANT ownership to `target`.
   *
   * Note: ex-controllers are always cleared as part of the transfer. The
   * Solana `ario-ant` contract clears `AntControllers` via inline reconcile,
   * and the wrapped CPI also clears each ex-controller's paginated ACL
   * entry in the same tx. Skipping cleanup would leave stale "I control
   * this ANT" entries visible to frontends. This was an opt-in flag in
   * the AO era; on Solana it is intrinsic to the transfer flow.
   */
  transfer: WriteAction<{
    target: WalletAddress;
  }>;
  addController: WriteAction<{ controller: WalletAddress }>;
  removeController: WriteAction<{ controller: WalletAddress }>;
  /**
   * @deprecated Use `setUndernameRecord` for undernames and
   * `setBaseNameRecord` for the top-level name (`"@"`). This bridge
   * accepts either shape so existing callers continue to type-check.
   */
  setRecord: WriteAction<
    ANTSetBaseNameRecordParams | ANTSetUndernameRecordParams
  >;
  /** @deprecated Use removeUndernameRecord instead for undernames */
  removeRecord: WriteAction<{ undername: string }>;
  setBaseNameRecord: WriteAction<ANTSetBaseNameRecordParams>;
  setUndernameRecord: WriteAction<ANTSetUndernameRecordParams>;
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
  upgrade(
    params?: {
      arioProcessId?: string;
      antRegistryId?: string;
      skipVersionCheck?: boolean;
      onSigningProgress?: (
        name: keyof UpgradeAntProgressEvent,
        payload: UpgradeAntProgressEvent[keyof UpgradeAntProgressEvent],
      ) => void;
    } & (
      | { names: string[]; reassignAffiliatedNames?: false }
      | { names?: never; reassignAffiliatedNames?: true }
    ),
  ): Promise<{
    forkedProcessId: string;
    reassignedNames: Record<string, MessageResult>;
    failedReassignedNames: Record<string, { id?: string; error: Error }>;
  }>;
  transferRecord: WriteAction<{
    undername: string;
    recipient: string;
  }>;
}

export type ANTSetBaseNameRecordParams = {
  transactionId: string;
  ttlSeconds: number;
  /** Storage protocol: 0 = Arweave, 1 = IPFS. Defaults to 0 (Arweave). */
  targetProtocol?: number;
  priority?: number; // TODO: the SDK should always provide a priority, even if the ANT does not have a priority set
  owner?: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
};

export type ANTSetUndernameRecordParams = ANTSetBaseNameRecordParams & {
  undername: string;
};
