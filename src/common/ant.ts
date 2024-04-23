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
  ANTReadContract,
  ANTRecord,
  ANTState,
  ANT_CONTRACT_FUNCTIONS,
  ContractConfiguration,
  ContractSigner,
  EvaluationOptions,
  EvaluationParameters,
  WithSigner,
  WriteInteractionResult,
} from '../types.js';
import {
  isContractConfiguration,
  isContractTxIdConfiguration,
} from '../utils/smartweave.js';
import { RemoteContract } from './contracts/remote-contract.js';
import { InvalidContractConfigurationError, WarpContract } from './index.js';

export class ANT {
  /**
   * @param config - @type {ContractConfiguration} The configuration object.
   * @returns {WarpContract<ANTState>} The contract object.
   * @example
   * Using the contract object
   * ```ts
   * ANT.createContract({ contract: new WarpContract<ANTState>({ contractTxId: 'myContractTxId' });
   * ```
   * Using the contractTxId
   * ```ts
   * ANT.createContract({ contractTxId: 'myContractTxId' });
   * ```
   */
  static createContract(config: ContractConfiguration): WarpContract<ANTState> {
    if (isContractConfiguration<ANTState>(config)) {
      if (config.contract instanceof WarpContract) {
        return config.contract;
      }
    } else if (isContractTxIdConfiguration(config)) {
      return new WarpContract<ANTState>({ contractTxId: config.contractTxId });
    }
    throw new InvalidContractConfigurationError();
  }

  /**
   * Initializes an ANT instance.
   *
   * There are two overloads for this function:
   * 1. When a signer is provided in the configuration, it returns an instance of ANTWritable.
   * 2. When a signer is NOT provided in the configuration, it returns an instance of ANTReadable.
   *
   *
   * @param {ContractConfiguration & WithSigner} config - The configuration object.
   *    If a signer is provided, it should be an object that implements the ContractSigner interface.
   *
   * @returns {ANTWritable | ANTReadable} - An instance of ANTWritable if a signer is provided, otherwise an instance of ANTReadable.
   * @throws {Error} - Throws an error if the configuration is invalid.
   *
   * @example
   * Overload 1: When signer is provided
   * ```ts
   * const writable = ANT.init({ signer: mySigner, contract: myContract });
   *```
   * Overload 2: When signer is not provided
   * ```ts
   * const readable = ANT.init({ contract: myContract });
   * ```
   */
  static init(
    config: ContractConfiguration &
      WithSigner &
      ({ contract: WarpContract<ANTState> } | { contractTxId: string }),
  ): ANTWritable;
  static init(
    config?: ContractConfiguration &
      ({ contract?: RemoteContract<ANTState> } | { contractTxId: string }),
  ): ANTReadable;
  static init(
    config: ContractConfiguration & {
      signer?: ContractSigner;
    } = {},
  ) {
    if (config?.signer) {
      const signer = config.signer;
      const contract = this.createContract(config);
      return new ANTWritable({ signer, contract });
    } else {
      return new ANTReadable(config);
    }
  }
}

export class ANTReadable implements ANTReadContract {
  protected contract: RemoteContract<ANTState> | WarpContract<ANTState>;

  constructor(config: ContractConfiguration) {
    if (isContractConfiguration<ANTState>(config)) {
      this.contract = config.contract;
    } else if (isContractTxIdConfiguration(config)) {
      this.contract = new RemoteContract<ANTState>({
        contractTxId: config.contractTxId,
      });
    }
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<ANTState>} The state of the contract.
   * @example
   * Get the current state
   * ```ts
   * ant.getState();
   * ```
   * Get the state at a specific block height or sortkey
   * ```ts
   *  ant.getState({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   *  ant.getState({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getState({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<ANTState> {
    const state = await this.contract.getState({ evaluationOptions });
    return state;
  }

  /**
   * @param domain @type {string} The domain name.
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<ANTRecord>} The record of the undername domain.
   * @example
   * Get the current record
   * ```ts
   * ant.getRecord({ domain: "john" });
   * ```
   * Get the record at a specific block height or sortkey
   * ```ts
   *  ant.getRecord({ domain: "john", evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   *  ant.getRecord({  domain: "john", evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getRecord({
    domain,
    evaluationOptions,
  }: EvaluationParameters<{ domain: string }>): Promise<ANTRecord> {
    const records = await this.getRecords({ evaluationOptions });
    return records[domain];
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<Record<string, ANTRecord>>} All the undernames managed by the ANT.
   * @example
   * Get the current records
   * ```ts
   * ant.getRecords();
   * ```
   * Get the records at a specific block height or sortkey
   * ```ts
   *  ant.getRecords({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   *  ant.getRecords({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getRecords({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<Record<string, ANTRecord>> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.records;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<string>} The owner of the ANT.
   * @example
   * Get the current owner
   * ```ts
   *  ant.getOwner();
   * ```
   * Get the owner at a specific block height or sortkey
   * ```ts
   * ant.getOwner({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * ant.getOwner({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getOwner({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.owner;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<string[]>} The controllers of the ANT.
   * @example
   * Get the controllers of the ANT.
   * ```ts
   * ant.getControllers();
   * ```
   * Get the controllers at a specific block height or sortkey
   * ```ts
   * ant.getControllers({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * ant.getControllers({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getControllers({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string[]> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.controllers;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<string>} The name of the ANT (not the same as ArNS name).
   * @example
   * Get the current name
   * ```ts
   * ant.getName();
   * ```
   * @example
   * Get the ticker at a specific block height or sortkey
   * ```ts
   * ant.getName({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * ant.getName({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getName({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.name;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<string>} The name of the ANT (not the same as ArNS name).
   * @example
   * The current ticker of the ANT.
   * ```ts
   * ant.getTicker();
   * ```
   * @example
   * Get the ticker at a specific block height or sortkey
   * ```ts
   * ant.getTicker({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * ant.getTicker({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getTicker({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.ticker;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<Record<string, number>>} The balances of the ANT
   * @example
   * The current balances of the ANT.
   * ```ts
   * ant.getBalances();
   * ```
   * @example
   * Get the balances at a specific block height or sortkey
   * ```ts
   * ant.getBalances({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * ant.getBalances({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getBalances({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<Record<string, number>> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.balances;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @param address @type {string} The address of the account you want the balance of.
   * @returns {Promise<number>} The balance of the provided address
   * @example
   * The current balance of the address.
   * ```ts
   * ant.getBalance({ address });
   * ```
   * @example
   * Get the balance at a specific block height or sortkey
   * ```ts
   * ant.getBalance({ address, evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * ant.getBalance({ address, evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getBalance({
    address,
    evaluationOptions,
  }: EvaluationParameters<{ address: string }>): Promise<number> {
    const balances = await this.getBalances({ evaluationOptions });
    return balances[address];
  }
}

export class ANTWritable extends ANTReadable {
  protected declare contract: WarpContract<ANTState>;
  private signer: ContractSigner;

  constructor({
    contract,
    signer,
  }: { contract: WarpContract<ANTState> } & WithSigner) {
    super({ contract });
    this.signer = signer;
  }

  /**
   * @param target @type {string} The address of the account you want to transfer the ANT to.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.transfer({ target: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async transfer({
    target,
  }: {
    target: string;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.TRANSFER,
      inputs: { target },
      signer: this.signer,
    });
  }

  /**
   * @param controller @type {string} The address of the account you want to set as a controller.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async setController({
    controller,
  }: {
    controller: string;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.SET_CONTROLLER,
      inputs: { target: controller },
      signer: this.signer,
    });
  }

  /**
   * @param controller @type {string} The address of the account you want to remove from the controllers list
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removeController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async removeController({
    controller,
  }: {
    controller: string;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.REMOVE_CONTROLLER,
      inputs: { target: controller },
      signer: this.signer,
    });
  }

  /**
   * @param subDomain @type {string} The record you want to set the transactionId and ttlSeconds of.
   * @param transactionId @type {string} The transactionId of the record.
   * @param ttlSeconds @type {number} The time to live of the record.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setController({ controller: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk" });
   * ```
   */
  async setRecord({
    subDomain,
    transactionId,
    ttlSeconds,
  }: {
    subDomain: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.SET_RECORD,
      inputs: { subDomain, transactionId, ttlSeconds },
      signer: this.signer,
    });
  }

  /**
   * @param subDomain @type {string} The record you want to remove.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.removeRecord({ subDomain: "shorts" });
   * ```
   */
  async removeRecord({
    subDomain,
  }: {
    subDomain: string;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.REMOVE_RECORD,
      inputs: { subDomain },
      signer: this.signer,
    });
  }

  /**
   * @param ticker @type {string} Sets the ANT Ticker.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setTicker({ ticker: "KAPOW" });
   * ```
   */
  async setTicker({
    ticker,
  }: {
    ticker: string;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.SET_TICKER,
      inputs: { ticker },
      signer: this.signer,
    });
  }
  /**
   * @param name @type {string} Sets the Name of the ANT.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * ```ts
   * ant.setName({ name: "ships at sea" });
   * ```
   */
  async setName({ name }: { name: string }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.SET_NAME,
      inputs: { name },
      signer: this.signer,
    });
  }
}
