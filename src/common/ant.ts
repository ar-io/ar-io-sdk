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
import {
  ANTRecord,
  ArweaveNameTokenRead,
  ProcessConfiguration,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';

export class ANT {}

export class ANTReadable implements ArweaveNameTokenRead {
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

  async getInfo(): Promise<any> {
    const tags = [{ name: 'Action', value: 'Info' }];
    const info = await this.process.read<any>({
      tags,
    });
    return info;
  }

  /**
   * @param name @type {string} The domain name.
   * @returns {Promise<ANTRecord>} The record of the undername domain.
   * @example
   * Get the current record
   * ```ts
   * ant.getRecord({ name: "john" });
   * ```
   */
  async getRecord({ name }: { name: string }): Promise<ANTRecord> {
    const tags = [
      { name: 'Sub-Domain', value: name },
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
  async getControllers(): Promise<string[]> {
    const tags = [{ name: 'Action', value: 'Get-Controllers' }];
    const controllers = await this.process.read<string[]>({
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
   * @returns {Promise<Record<string, number>>} The balances of the ANT
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

// export class ANTWritable extends ANTReadable {
//   protected declare contract: WarpContract<ANTState>;
//   private signer: ContractSigner;

//   constructor({
//     signer,
//     ...config
//   }: WithSigner<
//     { contract: WarpContract<ANTState> } | { contractTxId: string }
//   >) {
//     if (isContractConfiguration<ANTState>(config)) {
//       super({ contract: config.contract });
//       this.signer = signer;
//     } else if (isContractTxIdConfiguration(config)) {
//       super({
//         contract: new WarpContract<ANTState>({
//           contractTxId: config.contractTxId,
//         }),
//       });
//       this.signer = signer;
//     } else {
//       throw new InvalidContractConfigurationError();
//     }
//   }

//   /**
//    * @param target @type {string} The address of the account you want to transfer the ANT to.
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.transfer({ target: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
//    * ```
//    */
//   async transfer(
//     {
//       target,
//     }: {
//       target: string;
//     },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.TRANSFER,
//         inputs: { target },
//         signer: this.signer,
//       },
//       options,
//     );
//   }

//   /**
//    * @param controller @type {string} The address of the account you want to set as a controller.
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.setController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
//    * ```
//    */
//   async setController(
//     {
//       controller,
//     }: {
//       controller: string;
//     },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.SET_CONTROLLER,
//         inputs: { target: controller },
//         signer: this.signer,
//       },
//       options,
//     );
//   }

//   /**
//    * @param controller @type {string} The address of the account you want to remove from the controllers list
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.removeController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
//    * ```
//    */
//   async removeController(
//     {
//       controller,
//     }: {
//       controller: string;
//     },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.REMOVE_CONTROLLER,
//         inputs: { target: controller },
//         signer: this.signer,
//       },
//       options,
//     );
//   }

//   /**
//    * @param subDomain @type {string} The record you want to set the transactionId and ttlSeconds of.
//    * @param transactionId @type {string} The transactionId of the record.
//    * @param ttlSeconds @type {number} The time to live of the record.
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.setController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
//    * ```
//    */
//   async setRecord(
//     {
//       subDomain,
//       transactionId,
//       ttlSeconds,
//     }: {
//       subDomain: string;
//       transactionId: string;
//       ttlSeconds: number;
//     },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.SET_RECORD,
//         inputs: { subDomain, transactionId, ttlSeconds },
//         signer: this.signer,
//       },
//       options,
//     );
//   }

//   /**
//    * @param subDomain @type {string} The record you want to remove.
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.removeRecord({ subDomain: "shorts" });
//    * ```
//    */
//   async removeRecord(
//     {
//       subDomain,
//     }: {
//       subDomain: string;
//     },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.REMOVE_RECORD,
//         inputs: { subDomain },
//         signer: this.signer,
//       },
//       options,
//     );
//   }

//   /**
//    * @param ticker @type {string} Sets the ANT Ticker.
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.setTicker({ ticker: "KAPOW" });
//    * ```
//    */
//   async setTicker(
//     {
//       ticker,
//     }: {
//       ticker: string;
//     },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.SET_TICKER,
//         inputs: { ticker },
//         signer: this.signer,
//       },
//       options,
//     );
//   }
//   /**
//    * @param name @type {string} Sets the Name of the ANT.
//    * @returns {Promise<WriteInteractionResult>} The result of the interaction.
//    * @example
//    * ```ts
//    * ant.setName({ name: "ships at sea" });
//    * ```
//    */
//   async setName(
//     { name }: { name: string },
//     options?: WriteOptions,
//   ): Promise<WriteInteractionResult> {
//     return this.contract.writeInteraction(
//       {
//         functionName: ANT_CONTRACT_FUNCTIONS.SET_NAME,
//         inputs: { name },
//         signer: this.signer,
//       },
//       options,
//     );
//   }
// }
