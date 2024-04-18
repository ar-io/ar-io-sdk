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
   * // Overload 1: When signer is provided
   * const writable = ANT.init({ signer: mySigner, contract: myContract });
   *
   * @example
   * // Overload 2: When signer is not provided
   * const readable = ANT.init({ contract: myContract });
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
   * Returns the current state of the contract.
   */
  async getState({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<ANTState> {
    const state = await this.contract.getState({ evaluationOptions });
    return state;
  }

  async getRecord({
    domain,
    evaluationOptions,
  }: EvaluationParameters<{ domain: string }>): Promise<ANTRecord> {
    const records = await this.getRecords({ evaluationOptions });
    return records[domain];
  }

  async getRecords({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<Record<string, ANTRecord>> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.records;
  }

  async getOwner({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.owner;
  }

  async getControllers({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string[]> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.controllers;
  }

  async getName({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.name;
  }

  async getTicker({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.ticker;
  }

  async getBalances({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  } = {}): Promise<Record<string, number>> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.balances;
  }

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
  async setName({ name }: { name: string }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: ANT_CONTRACT_FUNCTIONS.SET_NAME,
      inputs: { name },
      signer: this.signer,
    });
  }
}
