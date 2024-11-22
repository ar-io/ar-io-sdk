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
  AoANTState,
  AoANTWrite,
} from '../types/ant.js';
import {
  AoMessageResult,
  AoSigner,
  OptionalSigner,
  ProcessConfiguration,
  WalletAddress,
  WithSigner,
  WriteOptions,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types/index.js';
import { createAoSigner } from '../utils/ao.js';
import { parseSchemaResult } from '../utils/schema.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';

export class ANT {
  static init(
    config: Required<ProcessConfiguration> & {
      signer?: undefined;
      strict?: boolean;
    },
  ): AoANTRead;
  static init({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>> & {
    strict?: boolean;
  }): AoANTWrite;
  static init({
    signer,
    strict = false,
    ...config
  }: OptionalSigner<Required<ProcessConfiguration>> & { strict?: boolean }):
    | AoANTRead
    | AoANTWrite {
    // ao supported implementation
    if (isProcessConfiguration(config) || isProcessIdConfiguration(config)) {
      if (!signer) {
        return new AoANTReadable({ strict, ...config });
      }
      return new AoANTWriteable({ signer, strict, ...config });
    }

    throw new InvalidContractConfigurationError();
  }
}

export class AoANTReadable implements AoANTRead {
  protected process: AOProcess;
  private strict: boolean;

  constructor(config: Required<ProcessConfiguration> & { strict?: boolean }) {
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
  }

  async getState(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<AoANTState> {
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
    const tags = [
      { name: 'Sub-Domain', value: undername },
      { name: 'Action', value: 'Record' },
    ];

    const record = await this.process.read<AoANTRecord>({
      tags,
    });
    if (strict) parseSchemaResult(AntRecordSchema.passthrough(), record);

    return record;
  }

  /**
   * @returns {Promise<Record<string, AoANTRecord>>} All the undernames managed by the ANT.
   * @example
   * Get the current records
   * ```ts
   * ant.getRecords();
   * ````
   */
  async getRecords(
    { strict }: AntReadOptions = { strict: this.strict },
  ): Promise<Record<string, AoANTRecord>> {
    const tags = [{ name: 'Action', value: 'Records' }];
    const records = await this.process.read<Record<string, AoANTRecord>>({
      tags,
    });

    if (strict) parseSchemaResult(AntRecordsSchema, records);
    return records;
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
   * @param undername @type {string} The record you want to set the transactionId and ttlSeconds of.
   * @param transactionId @type {string} The transactionId of the record.
   * @param ttlSeconds @type {number} The time to live of the record.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async setRecord(
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
   * @param undername @type {string} The record you want to remove.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removeRecord({ subDomain: "shorts" });
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
        { name: 'Description', value: JSON.stringify(keywords) },
      ],
      signer: this.signer,
    });
  }

  /**
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
   * @param name @type {string} The name you want to release. The name will be put up for auction on the IO contract. 50% of the winning bid will be distributed to the ANT owner at the time of release. If no bids, the name will be released and can be reregistered by anyone.
   * @param ioProcessId @type {string} The processId of the IO contract. This is where the ANT will send the message to release the name.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.releaseName({ name: "ardrive", ioProcessId: IO_TESTNET_PROCESS_ID });
   * ```
   */
  async releaseName(
    { name, ioProcessId }: { name: string; ioProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Release-Name' },
        { name: 'Name', value: name },
        { name: 'IO-Process-Id', value: ioProcessId },
      ],
      signer: this.signer,
    });
  }

  /**
   * Sends a message to the IO contract to reassign the name to a new ANT. This can only be done by the current owner of the ANT.
   * @param name @type {string} The name you want to reassign.
   * @param ioProcessId @type {string} The processId of the IO contract.
   * @param antProcessId @type {string} The processId of the ANT contract.
   * @returns {Promise<AoMessageResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.reassignName({ name: "ardrive", ioProcessId: IO_TESTNET_PROCESS_ID, antProcessId: NEW_ANT_PROCESS_ID });
   * ```
   */
  async reassignName(
    {
      name,
      ioProcessId,
      antProcessId,
    }: { name: string; ioProcessId: string; antProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Reassign-Name' },
        { name: 'Name', value: name },
        { name: 'IO-Process-Id', value: ioProcessId },
        { name: 'Process-Id', value: antProcessId },
      ],
      signer: this.signer,
    });
  }

  /**
   * Approves a primary name request for a given name or address.
   */
  async approvePrimaryNameRequest(
    {
      name,
      address,
      ioProcessId,
    }: { name: string; address: WalletAddress; ioProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Approve-Primary-Name' },
        { name: 'Name', value: name },
        { name: 'Recipient', value: address },
        { name: 'IO-Process-Id', value: ioProcessId },
      ],
      signer: this.signer,
    });
  }

  async removePrimaryNames(
    { names, ioProcessId }: { names: string[]; ioProcessId: string },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        ...(options?.tags ?? []),
        { name: 'Action', value: 'Remove-Primary-Names' },
        { name: 'Names', value: names.join(',') },
        { name: 'IO-Process-Id', value: ioProcessId },
      ],
      signer: this.signer,
    });
  }
}
