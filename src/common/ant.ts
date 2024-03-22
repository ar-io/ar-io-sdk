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
  ANTContract,
  ANTRecord,
  ANTState,
  BaseContract,
  ContractConfiguration,
  ContractSigner,
  EvaluationOptions,
  EvaluationParameters,
  isContractConfiguration,
  isContractTxIdConfiguration,
} from '../types.js';
import { RemoteContract } from './contracts/remote-contract.js';
import { WarpContract } from './index.js';

export class ANT implements ANTContract, BaseContract<ANTState> {
  private contract: BaseContract<ANTState>;
  private signer: ContractSigner | undefined;

  constructor({ signer, ...config }: ContractConfiguration) {
    this.signer = signer;
    if (isContractConfiguration<ANTState>(config)) {
      this.contract = config.contract;
    } else if (isContractTxIdConfiguration(config)) {
      this.contract = new RemoteContract<ANTState>({
        contractTxId: config.contractTxId,
      });
    }
  }

  connect(signer: ContractSigner): this {
    this.signer = signer;
    if (this.contract instanceof RemoteContract) {
      const config = this.contract.configuration();
      this.contract = new WarpContract<ANTState>({
        ...config,
        signer,
      });
    }
    this.contract.connect(this.signer);

    return this;
  }
  /**
   * Returns the current state of the contract.
   */
  async getState(params: EvaluationParameters): Promise<ANTState> {
    const state = await this.contract.getState(params);
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
  }): Promise<Record<string, ANTRecord>> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.records;
  }

  async getOwner({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  }): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.owner;
  }

  async getControllers({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  }): Promise<string[]> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.controllers;
  }

  async getName({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  }): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.name;
  }

  async getTicker({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  }): Promise<string> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.ticker;
  }

  async getBalances({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  }): Promise<Record<string, number>> {
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
