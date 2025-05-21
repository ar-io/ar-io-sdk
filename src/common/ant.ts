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

import {
  ANTRecords,
  AntBalancesSchema,
  AntControllersSchema,
  AntInfoSchema,
  AntReadOptions,
  AntRecordSchema,
  AntRecordsSchema,
  AntStateSchema,
  AoANTHandler,
  AoANTInfo,
  AoANTRead,
  AoANTRecord,
  AoANTSetBaseNameRecordParams,
  AoANTSetUndernameRecordParams,
  AoANTState,
  AoANTVersionsRead,
  AoANTWrite,
  SortedANTRecords,
} from '../types/ant.js';
import {
  AoMessageResult,
  AoSigner,
  ProcessConfiguration,
  WalletAddress,
  WithSigner,
  WriteOptions,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types/index.js';
import { sortANTRecords } from '../utils/ant.js';
import { createAoSigner } from '../utils/ao.js';
import { parseSchemaResult } from '../utils/schema.js';
import { ANTVersions } from './ant-versions.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';

type ANTConfigOptionalStrict = Required<ProcessConfiguration> & {
  strict?: boolean;
};
type ANTConfigNoSigner = ANTConfigOptionalStrict;
type ANTConfigWithSigner = WithSigner<ANTConfigOptionalStrict>;
type ANTConfig = ANTConfigNoSigner | ANTConfigWithSigner;

export class ANT {
  static versions: AoANTVersionsRead = ANTVersions.init();
  // no signer give read
  static init(config: ANTConfigNoSigner): AoANTRead;

  // with signer give write
  static init(config: ANTConfigWithSigner): AoANTWrite;

  // implementation
  static init(config: ANTConfig): AoANTRead | AoANTWrite {
    if (config !== undefined && 'signer' in config) {
      return new AoANTWriteable(config);
    }
    return new AoANTReadable(config);
  }
}

export class AoANTReadable implements AoANTRead {
  protected process: AOProcess;
  public readonly processId: string;
  private strict: boolean;
  private checkHyperBeamPromise: Promise<boolean> | undefined;

  constructor(config: ANTConfigOptionalStrict) {
    this.strict = config.strict || false;
    if (isProcessConfiguration(config)) {
      this.process = config.process;
    } else if (isProcessIdConfiguration(config)) {
      this.process = new AOProcess({
        processId: config.processId,
      });
    } else {
      throw new InvalidContractConfigurationError();
    }

    this.processId = this.process.processId;
    this.checkHyperBeamPromise = this.checkHyperBeamCompatibility();
  }

  private async checkHyperBeamCompatibility(): Promise<boolean> {
    const res = await fetch(
      `https://permanode.xyz/${this.processId}~process@1.0/now/cache`,
      {
        method: 'HEAD',
      },
    );

    if (res.ok && res.headers.get('initialized') === '"true"') {
      return true;
    }

    return false;
  }

  async getState(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<AoANTState> {
    // TODO: detect if process is hyperbeam compatible, if so fetch state via hyperbeam node
    if (await this.checkHyperBeamPromise) {
      const res = await fetch(
        `https://permanode.xyz/${this.processId}~process@1.0/now/cache/serialize~json@1.0`,
        {
          method: 'GET',
          redirect: 'follow',
        },
      );

      if (!res.ok) {
        throw new Error('Failed to fetch ant state');
      }

      const body = (await res.json()) as {
        name: string;
        ticker: string;
        description: string;
        keywords: string[];
        denomination: string;
        owner: string;
        controllers: string[];
        records: Record<string, { transactionid: string; ttlseconds: number }>;
        balances: Record<string, number>;
        logo: string;
        totalsupply: number;
        initialized: boolean;
      };

      return {
        Name: body.name,
        Ticker: body.ticker,
        Description: body.description,
        Keywords: body.keywords,
        Denomination: parseInt(body.denomination),
        Owner: body.owner,
        Controllers: body.controllers,
        Records: Object.entries(body.records).reduce(
          (acc, [key, record]) => {
            acc[key] = {
              transactionId: record.transactionid,
              ttlSeconds: record.ttlseconds,
            };
            return acc;
          },
          {} as Record<string, AoANTRecord>,
        ),
        Balances: body.balances,
        Logo: body.logo,
        TotalSupply: body.totalsupply || 1,
        Initialized: body.initialized,
      };
    }

    const tags = [{ name: 'Action', value: 'State' }];
    const res = await this.process.read<AoANTState>({
      tags,
    });
    if (strict) {
      parseSchemaResult(
        AntStateSchema.passthrough().and(
          z.object({
            Records: z.record(z.string(), AntRecordSchema.passthrough()),
          }),
        ),
        res,
      );
    }

    return res;
  }

  async getInfo(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<AoANTInfo> {
    if (await this.checkHyperBeamPromise) {
      const state = await this.getState();
      return {
        Name: state.Name,
        Ticker: state.Ticker,
        Description: state.Description,
        Keywords: state.Keywords,
        Denomination: state.Denomination.toString(),
        Owner: state.Owner,
        Logo: state.Logo,
        'Total-Supply': state.TotalSupply.toString(),
        Handlers: [], // TODO: support for handler in patched state
      };
    }

    const tags = [{ name: 'Action', value: 'Info' }];
    const info = await this.process.read<AoANTInfo>({
      tags,
    });
    if (strict) {
      parseSchemaResult(AntInfoSchema.passthrough(), info);
    }
    return info;
  }

  /**
   * Returns the TX ID of the logo set for the ANT.
   */
  async getLogo(): Promise<string> {
    const info = await this.getInfo();
    return info.Logo;
  }

  /**
   * @param undername @type {string} The domain name.
   * @returns {Promise<ANTRecord>} The record of the undername domain.
   * @example
   * Get the current record
   * ```ts
   * ant.getRecord({ undername: "john" });
   * ```
   */
  async getRecord(
    { undername }: { undername: string },
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<AoANTRecord> {
    if (await this.checkHyperBeamPromise) {
      const records = await this.getRecords();
      const cachedRecord = records[undername];

      // if the record is not found, throw an error
      if (cachedRecord === undefined) {
        throw new Error('Record not found');
      }

      return cachedRecord;
    }

    // TODO: use sortedANTRecords to get priority on all records, even if ANT does not have a priority set
    const record = await this.process.read<AoANTRecord>({
      tags: [
        { name: 'Action', value: 'Record' },
        { name: 'Sub-Domain', value: undername },
      ],
    });
    if (strict) parseSchemaResult(AntRecordSchema.passthrough(), record);

    return record;
  }

  /**
   * @returns {Promise<SortedANTRecords>} All the undernames managed by the ANT.
   * @example
   * Get the current records
   * ```ts
   * ant.getRecords();
   * ````
   */
  async getRecords(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<SortedANTRecords> {
    if (await this.checkHyperBeamPromise) {
      const state = await this.getState();
      return sortANTRecords(state.Records);
    }

    const tags = [{ name: 'Action', value: 'Records' }];
    const records = await this.process.read<ANTRecords>({
      tags,
    });

    if (strict) parseSchemaResult(AntRecordsSchema, records);

    // sort the records using the deterministic sort used by ar-io nodes
    return sortANTRecords(records);
  }

  /**
   * @returns {Promise<string>} The owner of the ANT.
   * @example
   * Get the current owner
   * ```ts
   *  ant.getOwner();
   * ```
   */
  async getOwner(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<string> {
    if (await this.checkHyperBeamPromise) {
      const state = await this.getState();
      return state.Owner;
    }

    const info = await this.getInfo({ strict });
    return info.Owner;
  }

  /**
   * @returns {Promise<string[]>} The controllers of the ANT.
   * @example
   * Get the controllers of the ANT.
   * ```ts
   * ant.getControllers();
   * ```
   */
  async getControllers(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<WalletAddress[]> {
    if (await this.checkHyperBeamPromise) {
      const state = await this.getState();
      return state.Controllers;
    }

    const tags = [{ name: 'Action', value: 'Controllers' }];
    const controllers = await this.process.read<WalletAddress[]>({
      tags,
    });
    if (strict) parseSchemaResult(AntControllersSchema, controllers);
    return controllers;
  }

  /**
   * @returns {Promise<string>} The name of the ANT (not the same as ArNS name).
   * @example
   * Get the current name
   * ```ts
   * ant.getName();
   * ```
   */
  async getName(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<string> {
    if (await this.checkHyperBeamPromise) {
      const state = await this.getState();
      return state.Name;
    }
    const info = await this.getInfo({ strict });
    return info.Name;
  }

  /**
   * @returns {Promise<string>} The name of the ANT (not the same as ArNS name).
   * @example
   * The current ticker of the ANT.
   * ```ts
   * ant.getTicker();
   * ```
   */
  async getTicker(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<string> {
    if (await this.checkHyperBeamPromise) {
      const state = await this.getState();
      return state.Ticker;
    }
    const info = await this.getInfo({ strict });
    return info.Ticker;
  }

  /**
   * @returns {Promise<Record<WalletAddress, number>>} The balances of the ANT
   * @example
   * The current balances of the ANT.
   * ```ts
   * ant.getBalances();
   * ```
   */
  async getBalances(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<Record<string, number>> {
    if (await this.checkHyperBeamPromise) {
      const res = await fetch(
        `https://permanode.xyz/${this.processId}~process@1.0/now/cache/balances/serialize~json@1.0`,
        {
          method: 'GET',
          redirect: 'follow',
        },
      );
      if (!res.ok) {
        throw new Error('Failed to fetch ant balances');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { device, ...balances } = (await res.json()) as {
        device: string;
        [key: string]: any;
      };
      return balances as Record<string, number>;
    }

    const tags = [{ name: 'Action', value: 'Balances' }];
    const balances = await this.process.read<Record<string, number>>({
      tags,
    });
    if (strict) parseSchemaResult(AntBalancesSchema, balances);
    return balances;
  }

  /**
   * @param address @type {string} The address of the account you want the balance of.
   * @returns {Promise<number>} The balance of the provided address
   * @example
   * The current balance of the address.
   * ```ts
   * ant.getBalance({ address });
   * ```
   */
  async getBalance(
    { address }: { address: string },
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<number> {
    if (await this.checkHyperBeamPromise) {
      const balances = await this.getBalances();
      return balances[address] ?? 0;
    }
    const tags = [
      { name: 'Action', value: 'Balance' },
      { name: 'Recipient', value: address },
    ];
    const balance = await this.process.read<number>({
      tags,
    });
    if (strict) parseSchemaResult(z.number(), balance);
    return balance;
  }

  /**
   * @returns {Promise<AoANTHandler[]>} The handlers of the ANT.
   * @example
   * Get the handlers of the ANT.
   * ```ts
   * const handlers = await ant.getHandlers();
   * ```
   */
  async getHandlers(): Promise<AoANTHandler[]> {
    if (await this.checkHyperBeamPromise) {
      throw new Error('Handlers are not supported on HyperBeam');
    }
    const info = await this.getInfo();
    return (info.Handlers ?? info.HandlerNames) as AoANTHandler[];
  }
}

export class AoANTWriteable extends AoANTReadable implements AoANTWrite {
  private signer: AoSigner;

  constructor({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>> & { strict?: boolean }) {
    super(config);
    this.signer = createAoSigner(signer);
  }

  /**
   * @param target @type {string} The address of the account you want to transfer the ANT to.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.transfer({ target: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async transfer(
    { target }: { target: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const tags = [
      ...(options?.tags ?? []),
      { name: 'Action', value: 'Transfer' },
      { name: 'Recipient', value: target },
    ];

    return this.process.send({
      tags,
      signer: this.signer,
    });
  }

  /**
   * @param controller @type {string} The address of the account you want to set as a controller.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async addController(
    {
      controller,
    }: {
      controller: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const tags = [
      ...(options?.tags ?? []),
      { name: 'Action', value: 'Add-Controller' },
      { name: 'Controller', value: controller },
    ];

    return this.process.send({
      tags,
      signer: this.signer,
    });
  }

  /**
   * @param controller @type {string} The address of the account you want to remove from the controllers list
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removeController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async removeController(
    {
      controller,
    }: {
      controller: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const tags = [
      ...(options?.tags ?? []),
      { name: 'Action', value: 'Remove-Controller' },
      { name: 'Controller', value: controller },
    ];

    return this.process.send({
      tags,
      signer: this.signer,
    });
  }

  /**
   * Sets the transactionId and ttlSeconds of a record (for updating the top level name, use undername "@".)
   *
   * @deprecated Use setUndernameRecord instead for undernames, and setBaseNameRecord instead for the top level name (e.g. "@")
   * @param undername @type {string} The record you want to set the transactionId and ttlSeconds of.
   * @param transactionId @type {string} The transactionId of the record.
   * @param ttlSeconds @type {number} The time to live of the record.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   */
  async setRecord(
    { undername, transactionId, ttlSeconds }: AoANTSetUndernameRecordParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: undername },
        { name: 'Transaction-Id', value: transactionId },
        { name: 'TTL-Seconds', value: ttlSeconds.toString() },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sets the top level name of the ANT. This is the name that will be used to resolve the ANT (e.g. ardrive.ar.io)
   *
   * @param transactionId @type {string} The transactionId of the record.
   * @param ttlSeconds @type {number} The time to live of the record.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setBaseNameRecord({ transactionId: "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM", ttlSeconds: 100 }); // ardrive.ar.io will resolve to the provided transaction id and be cached for 100 seconds by clients
   * ```
   */
  async setBaseNameRecord(
    { transactionId, ttlSeconds }: AoANTSetBaseNameRecordParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.setRecord(
      {
        transactionId,
        ttlSeconds,
        undername: '@',
      },
      options,
    );
  }

  /**
   * Adds or updates an undername of the ANT. An undername is appended to the base name of the ANT (e.g. ardrive.ar.io) to form a fully qualified name (e.g. dapp_ardrive.ar.io)
   *
   * @param undername @type {string} The undername of the ANT.
   * @param transactionId @type {string} The transactionId of the record.
   * @param ttlSeconds @type {number} The time to live of the record.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setUndernameRecord({ undername: "dapp", transactionId: "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM", ttlSeconds: 100 }); // dapp_ardrive.ar.io will resolve to the provided transaction id and be cached for 100 seconds by clients
   * ```
   */
  async setUndernameRecord(
    { undername, transactionId, ttlSeconds }: AoANTSetUndernameRecordParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.setRecord(
      {
        undername,
        transactionId,
        ttlSeconds,
      },
      options,
    );
  }

  /**
   * Removes an undername from the ANT. This will remove the undername from the ANT.
   *
   * @param undername @type {string} The undername you want to remove.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removeUndernameRecord({ undername: "dapp" }); // removes dapp_ardrive.ar.io
   * ```
   */
  async removeUndernameRecord({
    undername,
  }: {
    undername: string;
  }): Promise<AoMessageResult> {
    return this.removeRecord({ undername });
  }

  /**
   * Removes a record from the ANT. This will remove the record from the ANT. If '@' is provided, the top level name will be removed.
   *
   * @deprecated Use removeUndernameRecord instead.
   * @param undername @type {string} The record you want to remove.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removeRecord({ undername: "dapp" }); // removes dapp_ardrive.ar.io
   * ```
   */
  async removeRecord(
    {
      undername,
    }: {
      undername: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Remove-Record' },
        { name: 'Sub-Domain', value: undername },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sets the ticker of the ANT. This is the abbreviation displayed in ecosystem apps.
   *
   * @param ticker @type {string} Sets the ANT Ticker.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setTicker({ ticker: "KAPOW" });
   * ```
   */
  async setTicker(
    { ticker }: { ticker: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Set-Ticker' },
        { name: 'Ticker', value: ticker },
      ],
      signer: this.signer,
    });
  }
  /**
   * Sets the name of the ANT. This is the display name of the ANT. This is NOT the base name record.
   *
   * @param name @type {string} Sets the Name of the ANT.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setName({ name: "test" }); // results in the resolution of `test_<apexName>.ar.io`
   * ```
   */
  async setName(
    { name }: { name: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Set-Name' },
        { name: 'Name', value: name },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sets the description of the ANT. This is the description of the ANT displayed in ecosystem apps.
   *
   * @param description @type {string} Sets the ANT Description.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setDescription({ description: "This name is used for the ArDrive" });
   * ```
   */
  async setDescription(
    { description }: { description: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Set-Description' },
        { name: 'Description', value: description },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sets the keywords of the ANT. This is the keywords of the ANT displayed in ecosystem apps.
   *
   * @param keywords @type {string[]} Sets the ANT Keywords.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setKeywords({ keywords: ['keyword1', 'keyword2', 'keyword3']});
   * ```
   */
  async setKeywords(
    { keywords }: { keywords: string[] },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Set-Keywords' },
        { name: 'Keywords', value: JSON.stringify(keywords) },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sets the logo of the ANT. This is the logo of the ANT displayed in ecosystem apps. Additionally, this logo is displayed for any primary names affiliated with the ANT.
   *
   * @param txId @type {string} - Arweave transaction id of the logo we want to set
   * @param options @type {WriteOptions} - additional options to add to the write interaction (optional)
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setLogo({ logo: "U7RXcpaVShG4u9nIcPVmm2FJSM5Gru9gQCIiRaIPV7f" });
   * ```
   */
  async setLogo(
    { txId }: { txId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Set-Logo' },
        { name: 'Logo', value: txId },
      ],
      signer: this.signer,
    });
  }

  /**
   * Releases an ArNS name associated with the ANT. This will release the name to the public and allow anyone to register it. All primary names must be removed before the name can be released.
   *
   * @param name @type {string} The name you want to release. The name will be put up for as a recently returned name on the ARIO contract. 50% of the winning bid will be distributed to the ANT owner at the time of purchase. If no purchase in the recently returned name period (14 epochs), the name will be released and can be reregistered by anyone.
   * @param arioProcessId @type {string} The processId of the ARIO contract. This is where the ANT will send the message to release the name.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.releaseName({ name: "ardrive", arioProcessId: ARIO_MAINNET_PROCESS_ID });
   * ```
   */
  async releaseName(
    { name, arioProcessId }: { name: string; arioProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Release-Name' },
        { name: 'Name', value: name },
        { name: 'IO-Process-Id', value: arioProcessId },
        { name: 'ARIO-Process-Id', value: arioProcessId },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sends a message to the ARIO contract to reassign the the base ArNS name to a new ANT. This can only be done by the current owner of the ANT.
   *
   * @param name @type {string} The name you want to reassign.
   * @param arioProcessId @type {string} The processId of the ARIO contract.
   * @param antProcessId @type {string} The processId of the ANT contract.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.reassignName({ name: "ardrive", arioProcessId: ARIO_MAINNET_PROCESS_ID, antProcessId: NEW_ANT_PROCESS_ID });
   * ```
   */
  async reassignName(
    {
      name,
      arioProcessId,
      antProcessId,
    }: { name: string; arioProcessId: string; antProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Reassign-Name' },
        { name: 'Name', value: name },
        { name: 'IO-Process-Id', value: arioProcessId },
        { name: 'ARIO-Process-Id', value: arioProcessId },
        { name: 'Process-Id', value: antProcessId },
      ],
      signer: this.signer,
    });
  }

  /**
   * Approves a primary name request for a given name or address.
   *
   * @param name @type {string} The name you want to approve.
   * @param address @type {WalletAddress} The address you want to approve.
   * @param arioProcessId @type {string} The processId of the ARIO contract.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.approvePrimaryNameRequest({ name: "ardrive", address: "U7RXcpaVShG4u9nIcPVmm2FJSM5Gru9gQCIiRaIPV7f", arioProcessId: ARIO_MAINNET_PROCESS_ID }); // approves the request for ardrive.ar.io to be registered by the address
   * ```
   */
  async approvePrimaryNameRequest(
    {
      name,
      address,
      arioProcessId,
    }: { name: string; address: WalletAddress; arioProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Approve-Primary-Name' },
        { name: 'Name', value: name },
        { name: 'Recipient', value: address },
        { name: 'IO-Process-Id', value: arioProcessId },
        { name: 'ARIO-Process-Id', value: arioProcessId },
      ],
      signer: this.signer,
    });
  }

  /**
   * Removes primary names from the ANT. This will remove the primary names associated with the base ArNS name controlled by this ANT. All primary names must be removed before the name can be released.
   *
   * @param names @type {string[]} The names you want to remove.
   * @param arioProcessId @type {string} The processId of the ARIO contract.
   * @param notifyOwners @type {boolean} Whether to notify the owners of the primary names.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removePrimaryNames({ names: ["ardrive", "dapp_ardrive"], arioProcessId: ARIO_MAINNET_PROCESS_ID, notifyOwners: true }); // removes the primary names and associated wallet addresses assigned to "ardrive" and "dapp_ardrive"
   * ```
   */
  async removePrimaryNames(
    {
      names,
      arioProcessId,
      notifyOwners = false,
    }: { names: string[]; arioProcessId: string; notifyOwners?: boolean },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Remove-Primary-Names' },
        { name: 'Names', value: names.join(',') },
        { name: 'IO-Process-Id', value: arioProcessId },
        { name: 'ARIO-Process-Id', value: arioProcessId },
        { name: 'Notify-Owners', value: notifyOwners.toString() },
      ],
      signer: this.signer,
    });
  }
}
