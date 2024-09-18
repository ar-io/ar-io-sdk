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
import {
  AoANTRead,
  AoANTRecord,
  AoANTState,
  AoANTWrite,
  AoMessageResult,
  AoSigner,
  OptionalSigner,
  ProcessConfiguration,
  WalletAddress,
  WithSigner,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types.js';
import { createAoSigner } from '../utils/ao.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';

export class ANT {
  static init(
    config: Required<ProcessConfiguration> & { signer?: undefined },
  ): AoANTRead;
  static init({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>>): AoANTWrite;
  static init({
    signer,
    ...config
  }: OptionalSigner<Required<ProcessConfiguration>>): AoANTRead | AoANTWrite {
    // ao supported implementation
    if (isProcessConfiguration(config) || isProcessIdConfiguration(config)) {
      if (!signer) {
        return new AoANTReadable(config);
      }
      return new AoANTWriteable({ signer, ...config });
    }

    throw new InvalidContractConfigurationError();
  }
}

export class AoANTReadable implements AoANTRead {
  protected process: AOProcess;

  constructor(config: Required<ProcessConfiguration>) {
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

  async getState(): Promise<AoANTState> {
    const tags = [{ name: 'Action', value: 'State' }];
    const res = await this.process.read<AoANTState>({
      tags,
    });
    return res;
  }

  async getInfo(): Promise<{
    Name: string;
    Ticker: string;
    Denomination: number;
    Owner: string;
    ['Source-Code-TX-ID']?: string;
  }> {
    const tags = [{ name: 'Action', value: 'Info' }];
    const info = await this.process.read<{
      Name: string;
      Ticker: string;
      Denomination: number;
      Owner: string;
      ['Source-Code-TX-ID']?: string;
    }>({
      tags,
    });
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
  async getRecord({ undername }: { undername: string }): Promise<AoANTRecord> {
    const tags = [
      { name: 'Sub-Domain', value: undername },
      { name: 'Action', value: 'Record' },
    ];

    const record = await this.process.read<AoANTRecord>({
      tags,
    });
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
  async getRecords(): Promise<Record<string, AoANTRecord>> {
    const tags = [{ name: 'Action', value: 'Records' }];
    const records = await this.process.read<Record<string, AoANTRecord>>({
      tags,
    });
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
  async getOwner(): Promise<string> {
    const info = await this.getInfo();
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
  async getControllers(): Promise<WalletAddress[]> {
    const tags = [{ name: 'Action', value: 'Controllers' }];
    const controllers = await this.process.read<WalletAddress[]>({
      tags,
    });
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
  async getName(): Promise<string> {
    const info = await this.getInfo();
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
  async getTicker(): Promise<string> {
    const info = await this.getInfo();
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
  async getBalances(): Promise<Record<string, number>> {
    const tags = [{ name: 'Action', value: 'Balances' }];
    const balances = await this.process.read<Record<string, number>>({
      tags,
    });
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
  async getBalance({ address }: { address: string }): Promise<number> {
    const tags = [
      { name: 'Action', value: 'Balance' },
      { name: 'Recipient', value: address },
    ];
    const balance = await this.process.read<number>({
      tags,
    });
    return balance;
  }
}

export class AoANTWriteable extends AoANTReadable implements AoANTWrite {
  private signer: AoSigner;

  constructor({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>>) {
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
  async transfer({ target }: { target: string }): Promise<AoMessageResult> {
    const tags = [
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
  async addController({
    controller,
  }: {
    controller: string;
  }): Promise<AoMessageResult> {
    const tags = [
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
  async removeController({
    controller,
  }: {
    controller: string;
  }): Promise<AoMessageResult> {
    const tags = [
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
  async setRecord({
    undername,
    transactionId,
    ttlSeconds,
  }: {
    undername: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
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
  async removeRecord({
    undername,
  }: {
    undername: string;
  }): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
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
  async setTicker({ ticker }: { ticker: string }): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
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
   * ant.setName({ name: "ships at sea" });
   * ```
   */
  async setName({ name }: { name: string }): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        { name: 'Action', value: 'Set-Name' },
        { name: 'Name', value: name },
      ],
      signer: this.signer,
    });
  }
}
