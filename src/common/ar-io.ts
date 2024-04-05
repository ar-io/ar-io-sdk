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
  ArIOReadContract,
  ArIOState,
  ArIOWriteContract,
  ArNSAuctionData,
  ArNSNameData,
  CONTRACT_FUNCTIONS,
  ContractConfiguration,
  ContractSigner,
  EpochDistributionData,
  EvaluationOptions,
  EvaluationParameters,
  Gateway,
  JoinNetworkParams,
  Observations,
  RegistrationType,
  UpdateGatewaySettingsParams,
  WeightedObserver,
  WriteInteractionResult,
  isContractConfiguration,
  isContractTxIdConfiguration,
} from '../types.js';
import { mixInto } from '../utils/common.js';
import { RemoteContract } from './contracts/remote-contract.js';
import { InvalidSignerError, WarpContract } from './index.js';

export class ArIO implements ArIOReadContract {
  private contract: RemoteContract<ArIOState> | WarpContract<ArIOState>;
  private signer: ContractSigner | undefined;

  constructor(
    { signer, ...config }: ContractConfiguration = {
      contract: new RemoteContract<ArIOState>({
        contractTxId: ARNS_TESTNET_REGISTRY_TX,
      }),
    },
  ) {
    this.signer = signer;

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

  connected(): boolean {
    return this.signer !== undefined;
  }

  /**
   * Returns the current state of the contract.
   */
  async getState(params: EvaluationParameters): Promise<ArIOState> {
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
        functionName: CONTRACT_FUNCTIONS.GATEWAY,
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
      functionName: CONTRACT_FUNCTIONS.GATEWAYS,
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
      functionName: CONTRACT_FUNCTIONS.EPOCH,
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
      functionName: CONTRACT_FUNCTIONS.EPOCH,
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
      functionName: CONTRACT_FUNCTIONS.PRESCRIBED_OBSERVERS,
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

  connect(signer: ContractSigner): void {
    let writeableContract: WarpContract<ArIOState> | undefined = undefined;

    // create or set the writable contract to be used in our mixin class
    if (this.contract instanceof RemoteContract) {
      writeableContract = new WarpContract(this.contract.configuration());
    } else if (this.contract instanceof WarpContract) {
      writeableContract = this.contract;
    }

    if (!writeableContract) {
      throw new InvalidSignerError();
    }

    mixInto(
      this.contract,
      new ArIOWritable({
        contract: writeableContract,
        signer,
      }),
    );
  }
}

export class ArIOWritable implements ArIOWriteContract {
  private contract: WarpContract<ArIOState>;
  private signer: ContractSigner;
  constructor({
    contract,
    signer,
  }: {
    contract: WarpContract<ArIOState>;
    signer: ContractSigner;
  }) {
    this.contract = contract;
    this.signer = signer;
  }

  async joinNetwork(
    params: JoinNetworkParams,
  ): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: 'joinNetwork',
      inputs: params,
      signer: this.signer,
    });
  }
  async updateGatewaySettings(
    params: UpdateGatewaySettingsParams,
  ): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: 'updateGatewaySettings',
      inputs: params,
      signer: this.signer,
    });
  }

  async increaseDelegateState(params: {
    target: string;
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: 'delegateState',
      inputs: params,
      signer: this.signer,
    });
  }

  async decreaseDelegateState(params: {
    target: string;
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: 'decreaseDelegateState',
      inputs: params,
      signer: this.signer,
    });
  }

  async increaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: 'increaseOperatorStake',
      inputs: params,
      signer: this.signer,
    });
  }

  async decreaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: 'decreaseOperatorStake',
      inputs: params,
      signer: this.signer,
    });
  }
}
