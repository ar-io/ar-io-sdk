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
import { ArconnectSigner, ArweaveSigner } from 'arbundles';

import { ARNS_TESTNET_REGISTRY_TX } from '../constants.js';
import {
  ArIOContract,
  ArIOState,
  ArNSAuctionData,
  ArNSNameData,
  EpochDistributionData,
  EvaluationOptions,
  EvaluationParameters,
  Gateway,
  Observations,
  RegistrationType,
  SmartWeaveContract,
  WeightedObserver,
} from '../types.js';
import { RemoteContract } from './contracts/remote-contract.js';

// TODO: append this with other configuration options (e.g. local vs. remote evaluation)
export type ContractConfiguration =
  | {
      contract?: SmartWeaveContract<unknown>;
    }
  | {
      contractTxId: string;
    };

function isContractConfiguration<T>(
  config: ContractConfiguration,
): config is { contract: SmartWeaveContract<T> } {
  return 'contract' in config;
}

function isContractTxIdConfiguration(
  config: ContractConfiguration,
): config is { contractTxId: string } {
  return 'contractTxId' in config;
}

export class ArIO implements ArIOContract {
  private contract: SmartWeaveContract<ArIOState>;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private signer: ArweaveSigner | ArconnectSigner;

  constructor({
    signer,
    ...config
  }: ContractConfiguration & {
    signer: ArweaveSigner | ArconnectSigner;
  }) {
    this.signer = signer;

    const isContract = isContractConfiguration<ArIOState>(config);
    const isContractTxId = isContractTxIdConfiguration(config);
    const isBoth = isContract && isContractTxId;
    switch (true) {
      case isBoth:
        throw new Error(
          'ArIO contract configuration must include either `contract` or `contractTxId`, but not both',
        );
      case isContract:
        this.contract = config.contract;
        return;
      case isContractTxId:
        this.contract = new RemoteContract<ArIOState>({
          contractTxId: config.contractTxId,
        });
        return;
      default:
        this.contract = new RemoteContract<ArIOState>({
          contractTxId: ARNS_TESTNET_REGISTRY_TX,
        });
    }
  }

  /**
   * Returns the current state of the contract.
   */
  async getState(params: EvaluationParameters): Promise<ArIOState> {
    const state = await this.contract.getContractState(params);
    return state;
  }

  /**
   * Returns the ARNS record for the given domain.
   */
  async getArNSRecord({
    domain,
    evaluationOptions,
  }: EvaluationParameters<{ domain: string }>): Promise<
    ArNSNameData | undefined
  > {
    const records = await this.getArNSRecords({ evaluationOptions });
    return records[domain];
  }

  /**
   * Returns all ArNS records.
   */
  async getArNSRecords({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<Record<string, ArNSNameData>> {
    const state = await this.contract.getContractState({ evaluationOptions });
    return state.records;
  }

  /**
   * Returns the balance of the given address.
   */
  async getBalance({
    address,
    evaluationOptions,
  }: EvaluationParameters<{ address: string }>): Promise<number> {
    const balances = await this.getBalances({ evaluationOptions });
    return balances[address] || 0;
  }

  /**
   * Returns the balances of all addresses.
   */
  async getBalances({ evaluationOptions }: EvaluationParameters = {}): Promise<
    Record<string, number>
  > {
    const state = await this.contract.getContractState({ evaluationOptions });
    return state.balances;
  }

  /**
   * Returns the gateway for the given address, including weights.
   */
  async getGateway({
    address,
    evaluationOptions,
  }: EvaluationParameters<{ address: string }>): Promise<Gateway | undefined> {
    return this.contract
      .readInteraction<{ target: string }, Gateway>({
        functionName: 'gateway',
        inputs: {
          target: address,
        },
        evaluationOptions,
      })
      .catch(() => {
        return undefined;
      });
  }

  /**
   * Returns all gateways, including weights.
   */
  async getGateways({ evaluationOptions }: EvaluationParameters = {}): Promise<
    Record<string, Gateway> | Record<string, never>
  > {
    return this.contract.readInteraction({
      functionName: 'gateways',
      evaluationOptions,
    });
  }

  /**
   * Returns the current epoch.
   */
  async getCurrentEpoch({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<EpochDistributionData> {
    return this.contract.readInteraction({
      functionName: 'epoch',
      evaluationOptions,
    });
  }

  /**
   * Returns the epoch information for the provided block height.
   */
  async getEpoch({
    blockHeight,
    evaluationOptions,
  }: {
    blockHeight: number;
  } & EvaluationParameters): Promise<EpochDistributionData> {
    return this.contract.readInteraction<
      { height: number },
      EpochDistributionData
    >({
      functionName: 'epoch',
      inputs: {
        height: blockHeight,
      },
      evaluationOptions,
    });
  }

  /**
   * Returns the prescribed observers for the current epoch. If you are looking for prescribed observers for a past epoch, use `evaluationOptions: { blockHeight: <blockHeightDuringEpoch> }`.
   */
  async getPrescribedObservers({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<WeightedObserver[]> {
    return this.contract.readInteraction<never, WeightedObserver[]>({
      functionName: 'prescribedObservers',
      evaluationOptions,
    });
  }
  async getObservations({
    evaluationOptions,
  }: EvaluationParameters<{
    epochStartHeight?: number;
  }> = {}): Promise<Observations> {
    const { observations } = await this.contract.getContractState({
      evaluationOptions,
    });
    return observations;
  }
  async getDistributions({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<EpochDistributionData> {
    const { distributions } = await this.contract.getContractState({
      evaluationOptions,
    });
    return distributions;
  }

  async getAuction({
    domain,
    type,
    evaluationOptions,
  }: EvaluationParameters<{
    domain: string;
    type?: RegistrationType;
  }>): Promise<ArNSAuctionData> {
    return this.contract.readInteraction({
      functionName: 'auction',
      inputs: {
        name: domain,
        type,
      },
      evaluationOptions,
    });
  }
  async getAuctions({
    evaluationOptions,
  }: {
    evaluationOptions?: EvaluationOptions | Record<string, never> | undefined;
  }): Promise<Record<string, ArNSAuctionData>> {
    const { auctions } = await this.contract.getContractState({
      evaluationOptions,
    });

    return auctions;
  }
}
