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
  AR_IO_CONTRACT_FUNCTIONS,
  ArIOReadContract,
  ArIOState,
  ArIOWriteContract,
  ArNSAuctionData,
  ArNSNameData,
  ContractConfiguration,
  ContractSigner,
  EpochDistributionData,
  EvaluationOptions,
  EvaluationParameters,
  Gateway,
  JoinNetworkParams,
  Observations,
  RegistrationType,
  TransactionId,
  UpdateGatewaySettingsParams,
  WalletAddress,
  WeightedObserver,
  WithSigner,
  WriteInteractionResult,
} from '../types.js';
import {
  isContractConfiguration,
  isContractTxIdConfiguration,
} from '../utils/smartweave.js';
import { RemoteContract } from './contracts/remote-contract.js';
import { InvalidContractConfigurationError, WarpContract } from './index.js';

export class ArIO {
  static createContract(
    config: ContractConfiguration,
  ): WarpContract<ArIOState> {
    if (isContractConfiguration<ArIOState>(config)) {
      if (config.contract instanceof WarpContract) {
        return config.contract;
      }
    } else if (isContractTxIdConfiguration(config)) {
      return new WarpContract<ArIOState>({ contractTxId: config.contractTxId });
    }
    throw new InvalidContractConfigurationError();
  }

  /**
   * Initializes an ArIO instance.
   *
   * There are two overloads for this function:
   * 1. When a signer is provided in the configuration, it returns an instance of ArIOWritable.
   * 2. When a signer is NOT provided in the configuration, it returns an instance of ArIOReadable.
   *
   *
   * @param {ContractConfiguration & WithSigner} config - The configuration object.
   *    If a signer is provided, it should be an object that implements the ContractSigner interface.
   *
   * @returns {ArIOWritable | ArIOReadable} - An instance of ArIOWritable if a signer is provided, otherwise an instance of ArIOReadable.
   * @throws {Error} - Throws an error if the configuration is invalid.
   *
   * @example
   * // Overload 1: When signer is provided
   * const writable = ArIO.init({ signer: mySigner, contract: myContract });
   *
   * @example
   * // Overload 2: When signer is not provided
   * const readable = ArIO.init({ contract: myContract });
   */
  static init(
    config: ContractConfiguration &
      WithSigner &
      ({ contract: WarpContract<ArIOState> } | { contractTxId: string }),
  ): ArIOWritable;
  static init(
    config?: ContractConfiguration &
      ({ contract?: RemoteContract<ArIOState> } | { contractTxId: string }),
  ): ArIOReadable;
  static init(
    config: ContractConfiguration & {
      signer?: ContractSigner;
    } = {},
  ) {
    if (config?.signer) {
      const signer = config.signer;
      const contract = this.createContract(config);
      return new ArIOWritable({ signer, contract });
    } else {
      return new ArIOReadable(config);
    }
  }
}

export class ArIOReadable implements ArIOReadContract {
  protected contract: RemoteContract<ArIOState> | WarpContract<ArIOState>;

  constructor(
    config: ContractConfiguration = {
      contract: new RemoteContract<ArIOState>({
        contractTxId: ARNS_TESTNET_REGISTRY_TX,
      }),
    },
  ) {
    if (isContractConfiguration<ArIOState>(config)) {
      this.contract = config.contract;
    } else if (isContractTxIdConfiguration(config)) {
      this.contract = new RemoteContract<ArIOState>({
        contractTxId: config.contractTxId,
      });
    } else {
      throw new Error('Invalid configuration.');
    }
  }

  /**
   * Returns the current state of the contract.
   */
  async getState(params: EvaluationParameters = {}): Promise<ArIOState> {
    const state = await this.contract.getState(params);
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
    const state = await this.contract.getState({ evaluationOptions });
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
    const state = await this.contract.getState({ evaluationOptions });
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
        functionName: AR_IO_CONTRACT_FUNCTIONS.GATEWAY,
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
      functionName: AR_IO_CONTRACT_FUNCTIONS.GATEWAYS,
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
      functionName: AR_IO_CONTRACT_FUNCTIONS.EPOCH,
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
      functionName: AR_IO_CONTRACT_FUNCTIONS.EPOCH,
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
      functionName: AR_IO_CONTRACT_FUNCTIONS.PRESCRIBED_OBSERVERS,
      evaluationOptions,
    });
  }
  async getObservations({
    evaluationOptions,
  }: EvaluationParameters<{
    epochStartHeight?: number;
  }> = {}): Promise<Observations> {
    const { observations } = await this.contract.getState({
      evaluationOptions,
    });
    return observations;
  }
  async getDistributions({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<EpochDistributionData> {
    const { distributions } = await this.contract.getState({
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
  } = {}): Promise<Record<string, ArNSAuctionData>> {
    const { auctions } = await this.contract.getState({
      evaluationOptions,
    });

    return auctions;
  }
}

export class ArIOWritable extends ArIOReadable implements ArIOWriteContract {
  protected declare contract: WarpContract<ArIOState>;
  private signer: ContractSigner;
  constructor({
    contract,
    signer,
  }: {
    contract: WarpContract<ArIOState>;
  } & WithSigner) {
    super({ contract });
    this.signer = signer;
  }

  async joinNetwork(
    params: JoinNetworkParams,
  ): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.JOIN_NETWORK,
      inputs: params,
      signer: this.signer,
    });
  }
  async updateGatewaySettings(
    params: UpdateGatewaySettingsParams,
  ): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.UPDATE_GATEWAY_SETTINGS,
      inputs: params,
      signer: this.signer,
    });
  }

  async increaseDelegateStake(params: {
    target: string;
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.DELEGATE_STAKE,
      inputs: params,
      signer: this.signer,
    });
  }

  async decreaseDelegateStake(params: {
    target: string;
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.DECREASE_DELEGATE_STAKE,
      inputs: params,
      signer: this.signer,
    });
  }

  async increaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.INCREASE_OPERATOR_STAKE,
      inputs: params,
      signer: this.signer,
    });
  }

  async decreaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult> {
    const res = this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.DECREASE_OPERATOR_STAKE,
      inputs: params,
      signer: this.signer,
    });
    return res;
  }

  async saveObservations(params: {
    reportTxId: TransactionId;
    failedGateways: WalletAddress[];
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.SAVE_OBSERVATIONS,
      inputs: {
        observerReportTxId: params.reportTxId,
        failedGateways: params.failedGateways,
      },
      signer: this.signer,
    });
  }
}
