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
import { ANTRecord } from '../contract-state.js';
import {
  AoANTRead,
  AoANTWrite,
  ProcessConfiguration,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../io.js';
import {
  AoMessageResult,
  ContractSigner,
  WalletAddress,
  WithSigner,
} from '../types.js';
import { AOProcess } from './contracts/ao-process.js';
import { InvalidContractConfigurationError } from './error.js';

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

  async getInfo(): Promise<{
    Name: string;
    Ticker: string;
    Denomination: number;
    Owner: string;
  }> {
    const tags = [{ name: 'Action', value: 'Info' }];
    const info = await this.process.read<{
      Name: string;
      Ticker: string;
      Denomination: number;
      Owner: string;
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
  async getRecord({ undername }: { undername: string }): Promise<ANTRecord> {
    const tags = [
      { name: 'Sub-Domain', value: undername },
      { name: 'Action', value: 'Get-Record' },
    ];

    const record = await this.process.read<ANTRecord>({
      tags,
    });
    return record;
  }

  /**
   * @returns {Promise<Record<string, ANTRecord>>} All the undernames managed by the ANT.
   * @example
   * Get the current records
   * ```ts
   * ant.getRecords();
   * ````
   */
  async getRecords(): Promise<Record<string, ANTRecord>> {
    const tags = [{ name: 'Action', value: 'Get-Records' }];
    const records = await this.process.read<Record<string, ANTRecord>>({
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
    const tags = [{ name: 'Action', value: 'Get-Controllers' }];
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
  private signer: ContractSigner;

  constructor({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>>) {
    super(config);
    this.signer = signer;
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
      data: {},
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
      { name: 'Action', value: 'Set-Controller' },
      { name: 'Controller', value: controller },
    ];

    return this.process.send({
      tags,
      data: {},
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
      data: {},
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
      data: { transactionId, ttlSeconds },
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
      data: { undername },
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
      data: { ticker },
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
      data: { name },
      signer: this.signer,
    });
  }
}
