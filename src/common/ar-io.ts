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
import { ARNS_TESTNET_REGISTRY_TX } from '../constants.js';
import {
  AntState,
  ArIOContract,
  ArIOState,
  ArNSAntContract,
  ArNSNameData,
  EvaluationOptions,
  Gateway,
  SmartWeaveContract,
} from '../types/index.js';
import { ArIORemoteContract, WarpContract } from './index.js';

export type ContractConfiguration = {
  contract?: SmartWeaveContract;
};

export class ArIO implements ArIOContract {
  private contract: SmartWeaveContract; // TODO: this could just be scoped to WarpContract<ArIOState> | ArIORemoteContract<ArIOState>

  constructor({
    contract = new ArIORemoteContract<ArIOContract>({
      contractTxId: ARNS_TESTNET_REGISTRY_TX,
    }),
  }: {
    contract?: SmartWeaveContract
  }) {
    this.contract = contract;
  }

  async getState(params: EvaluationOptions): Promise<ArIOState> {
    return this.contract.getContractState(params);
  }
  async getArNSRecord(
    params: { domain: string } & EvaluationOptions,
  ): Promise<ArNSNameData> {
    const records = await this.getArNSRecords(params);
    return records[params.domain];
  }
  async getArNSRecords(
    params: EvaluationOptions,
  ): Promise<Record<string, ArNSNameData>> {
    const state = await this.contract.getContractState(params);
    return state.records;
  }
  async getBalance(
    params: { address: string } & EvaluationOptions,
  ): Promise<number> {
    const balances = await this.getBalances(params);
    return balances[params.address] || 0;
  }
  async getBalances(
    params: EvaluationOptions,
  ): Promise<Record<string, number>> {
    const state = await this.contract.getContractState(params);
    return state.balances;
  }
  async getGateway(
    params: { address: string } & EvaluationOptions,
  ): Promise<Gateway> {
    return this.contract.readInteraction({
      functionName: 'gateway',
      inputs: {
        target: params.address,
      },
      evaluationParameters: params.evaluationParameters,
    });
  }
  async getGateways(
    params: EvaluationOptions,
  ): Promise<Record<string, Gateway>> {
    return this.contract.readInteraction({
      functionName: 'gateways',
      evaluationParameters: params.evaluationParameters,
    });
  }
}

export class AntContract implements ArNSAntContract {
  private contract: SmartWeaveContract;

  constructor({ contractTxId, contract = new ArIORemoteContract({
    contractTxId,
  }) }: { contractTxId: string } & ContractConfiguration) {
    this.contract = contract;
  }

  async getState(params: EvaluationOptions): Promise<AntState> {
    return this.contract.getContractState(params);
  }

  async getRecord(
    params: { undername: string } & EvaluationOptions,
  ): Promise<{ ttlSeconds: number; transactionId: string }> {
    const state = await this.contract.getContractState(params);
    return state.records[params.undername];
  }

  async getRecords(
    params: EvaluationOptions,
  ): Promise<Record<string, { ttlSeconds: number; transactionId: string }>> {
    const state = await this.contract.getContractState(params);
    return state.records;
  }

  async getOwner(
    params: { domain: string } & EvaluationOptions,
  ): Promise<string> {
    const state = await this.contract.getContractState(params);
    return state.owner;
  }

  async getControllers(params: EvaluationOptions): Promise<string[]> {
    const state = await this.contract.getContractState(params);
    return state.controllers;
  }
}
