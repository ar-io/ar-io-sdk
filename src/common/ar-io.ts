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
  DENOMINATIONS,
  EpochDistributionData,
  EvaluationOptions,
  EvaluationParameters,
  Gateway,
  JoinNetworkParams,
  Observations,
  OptionalSigner,
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
  /**
   * @param config - @type {ContractConfiguration} The configuration object.
   * @returns {WarpContract<ArIOState>} The contract object.
   * @example
   * Using the contract object
   * ```ts
   * ArIO.createContract({ contract: new WarpContract<ArIOState>({ contractTxId: 'myContractTxId' });
   * ```
   * Using the contractTxId
   * ```ts
   * ArIO.createContract({ contractTxId: 'myContractTxId' });
   * ```
   */
  static createWriteableContract(
    config?: ContractConfiguration<ArIOState>,
  ): WarpContract<ArIOState> {
    if (!config || Object.keys(config).length === 0) {
      return new WarpContract<ArIOState>({
        contractTxId: ARNS_TESTNET_REGISTRY_TX,
      });
    } else if (isContractConfiguration<ArIOState>(config)) {
      return config.contract instanceof WarpContract
        ? config.contract
        : new WarpContract<ArIOState>(config.contract.configuration());
    } else if (isContractTxIdConfiguration(config)) {
      return new WarpContract<ArIOState>({ contractTxId: config.contractTxId });
    } else {
      throw new InvalidContractConfigurationError();
    }
  }

  /**
   * Initializes an ArIO instance.
   *
   * There are multiple overloads for this function:
   * 1. When nothing is provided, it returns an instance of ArIOReadable.
   * 1. When a signer is provided, it returns an instance of ArIOWritable.
   * 2. When a signer is NOT provided, it returns an instance of ArIOReadable.
   *
   * @param {WithSigner<ContractConfiguration<ArIOState>>} config - The configuration object.
   *    If a signer is provided, it should be an object that implements the ContractSigner interface.
   *
   * @returns {ArIOWritable | ArIOReadable} - An instance of ArIOWritable if a signer is provided, otherwise an instance of ArIOReadable.
   * @throws {Error} - Throws an error if the configuration is invalid.
   *
   * @example
   * Overload 1: When nothing is provide, ArIOReadable is returned.
   * ```ts
   * const readable = ArIO.init();
   * ```
   * Overload 2: When signer is not provided with contract, ArIOReadable is returned.
   * ```ts
   * const readable = ArIO.init({ contract: myContract });
   * ```
   * Overload 3: When signer is not provided with a contractTxId, ArIOReadable is returned.
   * ```ts
   * const readable = ArIO.init({ contractTxId: 'myContractTxId' });
   * ```
   * Overload 4: When signer is provided without any contract configuration, ArIOWritable is returned.
   * ```ts
   * const writable = ArIO.init({ signer: mySigner });
   *```
   * Overload 5: When signer is provided with a contract configuration, ArIOWritable is returned.
   * ```ts
   * const writable = ArIO.init({ signer: mySigner, contract: myContract });
   * ```
   * Overload 6: When signer is provided with a contractTxId, ArIOWritable is returned.
   * ```ts
   * const writable = ArIO.init({ signer: mySigner, contractTxId: 'myContractTxId' });
   * ```
   */
  static init(): ArIOReadable;
  static init({ signer }: WithSigner): ArIOWritable;
  static init(
    config?: Required<ContractConfiguration<ArIOState>>,
  ): ArIOReadable;
  static init({
    signer,
    ...config
  }: WithSigner<
    // must be a WarpContract to get a ArIOWriteable
    { contract: WarpContract<ArIOState> } | { contractTxId: string }
  >): ArIOWritable;
  static init(config?: OptionalSigner<ContractConfiguration<ArIOState>>) {
    if (config && config.signer) {
      const { signer, ...rest } = config;
      const contract = this.createWriteableContract(rest);
      return new ArIOWritable({ signer, contract });
    } else {
      return new ArIOReadable(config);
    }
  }
}

export class ArIOReadable implements ArIOReadContract {
  protected contract: RemoteContract<ArIOState> | WarpContract<ArIOState>;

  constructor(config?: ContractConfiguration<ArIOState>) {
    if (!config) {
      this.contract = new RemoteContract<ArIOState>({
        contractTxId: ARNS_TESTNET_REGISTRY_TX,
      });
    } else if (isContractConfiguration<ArIOState>(config)) {
      this.contract = config.contract;
    } else if (isContractTxIdConfiguration(config)) {
      this.contract = new RemoteContract<ArIOState>({
        contractTxId: config.contractTxId,
      });
    } else {
      throw new InvalidContractConfigurationError();
    }
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<ArIOState>} The state of the contract.
   * @example
   * Get the current state
   * ```ts
   * arIO.getState();
   * ```
   * Get the state at a specific block height or sortkey
   * ```ts
   *  arIO.getState({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   *  arIO.getState({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getState(params: EvaluationParameters = {}): Promise<ArIOState> {
    const state = await this.contract.getState(params);
    return state;
  }
  /**
   * @param domain @type {string} The domain name.
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<ArNSNameData | undefined>} The record of the undername domain.
   * @example
   * Get the current record
   * ```ts
   * arIO.getRecord({ domain: "john" });
   * ```
   * Get the record at a specific block height or sortkey
   * ```ts
   *  arIO.getRecord({ domain: "john", evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   *  arIO.getRecord({  domain: "john", evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
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
  async getArNSRecords({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<Record<string, ArNSNameData>> {
    const state = await this.contract.getState({ evaluationOptions });
    return state.records;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @param address @type {string} The address of the account you want the balance of.
   * @returns {Promise<number>} The balance of the provided address
   * @example
   * The current balance of the address.
   * ```ts
   * arIO.getBalance({ address });
   * ```
   * @example
   * Get the balance at a specific block height or sortkey
   * ```ts
   * arIO.getBalance({ address, evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getBalance({ address, evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getBalance({
    address,
    evaluationOptions,
  }: EvaluationParameters<{ address: string }>): Promise<number> {
    const balances = await this.getBalances({ evaluationOptions });
    return balances[address] || 0;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<Record<string, number>>} The balances of the ArIO Contract
   * @example
   * The current balances of the ANT.
   * ```ts
   * arIO.getBalances();
   * ```
   * @example
   * Get the balances at a specific block height or sortkey
   * ```ts
   * arIO.getBalances({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getBalances({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getBalances({ evaluationOptions }: EvaluationParameters = {}): Promise<
    Record<string, number>
  > {
    const state = await this.contract.getState({ evaluationOptions });
    return state.balances;
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @param address @type {string} The address of the gateway you want information about.
   * @returns {Promise<Gateway>} The balance of the provided address
   * @example
   * The current gateway info of the address.
   * ```ts
   * arIO.getGateway({ address });
   * ```
   * @example
   * Get the gateway info of the address at a certain block height or sortkey
   * ```ts
   * arIO.getGateway({ address, evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getGateway({ address, evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
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
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<Record<string, Gateway> >} The registered gateways of the ArIO Network.
   * @example
   * The current gateways.
   * ```ts
   * arIO.getGateways();
   * ```
   * @example
   * Get the gateways at a specific block height or sortkey
   * ```ts
   * arIO.getGateways({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getGateways({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
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
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<EpochDistributionData>} The current distribution data of the epoch.
   * @example
   * The current epoch
   * ```ts
   * arIO.getCurrentEpoch();
   * ```
   * @example
   * Get the epoch at a given block height or sortkey
   * ```ts
   * arIO.getCurrentEpoch({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getCurrentEpoch({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
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
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @param blockHeight @type {number} The block height of the epoch you want to get.
   * @returns {Promise<EpochDistributionData>} The current distribution data of the epoch.
   * @example
   * The current epoch
   * ```ts
   * arIO.getEpoch({ blockeHeight: 1000 });
   * ```
   * @example
   * Get the epoch at a given block height or sortkey
   * ```ts
   * arIO.getEpoch({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getEpoch({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
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
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<WeightedObserver[]>} The current distribution data of the epoch.
   * @example
   * Current prescribed observers
   * ```ts
   * arIO.getPrescribedObservers();
   * ```
   * @example
   * Get the previous prescribed observers at a given block height or sortkey
   * ```ts
   * arIO.getPrescribedObservers({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getPrescribedObservers({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getPrescribedObservers({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<WeightedObserver[]> {
    return this.contract.readInteraction<never, WeightedObserver[]>({
      functionName: AR_IO_CONTRACT_FUNCTIONS.PRESCRIBED_OBSERVERS,
      evaluationOptions,
    });
  }

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<Observations>} The current observations data.
   * @example
   * All observations.
   * ```ts
   * arIO.getObservations();
   * ```
   * @example
   * Get observations at a given block height or sortkey
   * ```ts
   * arIO.getObservations({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getObservations({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
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

  /**
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<EpochDistributionData>} The current distribution data of the epoch.
   * @example
   * Get the current distribution data.
   * ```ts
   * arIO.getDistributions();
   * ```
   * @example
   * Get distributions at a given block height or sortkey
   * ```ts
   * arIO.getDistributions({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getDistributions({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
  async getDistributions({
    evaluationOptions,
  }: EvaluationParameters = {}): Promise<EpochDistributionData> {
    const { distributions } = await this.contract.getState({
      evaluationOptions,
    });
    return distributions;
  }

  /**
   * Fetches the in-auction domain or the pricing data for how much it would cost to initiate the auction.
   *
   * @param domain @type {string} The domain name in auction
   * @param type @type {RegistrationType} The type of registration, relevant for reading auction prices
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<ArNSAuctionData>} The auction data for the specified name.
   * @example
   * Get the current auction data
   * ```ts
   * arIO.getAuction({ domain: 'myDomain' });
   * ```
   * @example
   * Get the auction data at a given block height or sortkey
   * ```ts
   * arIO.getAuction({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getAuction({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
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

  /**
   * Fetches the current auctions.
   *
   * @param evaluationOptions @type {EvaluationOptions} The evaluation options.
   * @returns {Promise<Record<string, ArNSAuctionData>>} The current auctions data.
   * @example
   * Get the current auction data
   * ```ts
   * arIO.getAuctions();
   * ```
   * @example
   * Get the auction data at a given block height or sortkey
   * ```ts
   * arIO.getAuctions({ evaluationOptions: { evalTo: { blockHeight: 1000 } } });
   * arIO.getAuctions({ evaluationOptions: { evalTo: { sortKey: 'mySortKey' } } });
   * ```
   */
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
    signer,
    ...config
  }: WithSigner<
    | {
        contract?: WarpContract<ArIOState>;
      }
    | { contractTxId?: string }
  >) {
    if (Object.keys(config).length === 0) {
      super({
        contract: new WarpContract<ArIOState>({
          contractTxId: ARNS_TESTNET_REGISTRY_TX,
        }),
      });
      this.signer = signer;
    } else if (isContractConfiguration<ArIOState>(config)) {
      super({ contract: config.contract });
      this.signer = signer;
    } else if (isContractTxIdConfiguration(config)) {
      super({
        contract: new WarpContract<ArIOState>({
          contractTxId: config.contractTxId,
        }),
      });
      this.signer = signer;
    } else {
      throw new InvalidContractConfigurationError();
    }
  }

  /**
   * @param target @type {string} The address of the account you want to transfer IO tokens to.
   * @param qty @type {number} The amount of IO or mIO to transfer.
   * @param denomination @type {DENOMINATIONS} The denomination of the amount to transfer (io or mio).
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * mIO transfer
   * ```ts
   * arIO.transfer({
   * target: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk",
   * qty: 1 * 10 ** 6,
   * denomination: DENOMINATIONS.MIO
   * });
   *```
   * IO transfer
   * ```ts
   * arIO.transfer({
   * target: "fGht8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk",
   * qty: 1,
   * denomination: DENOMINATIONS.IO
   * ```
   */
  async transfer({
    target,
    qty,
    denomination = DENOMINATIONS.IO,
  }: {
    target: string;
    qty: number;
    denomination: DENOMINATIONS;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.TRANSFER,
      inputs: {
        target,
        qty,
        denomination,
      },
      signer: this.signer,
    });
  }

  /**
   * @param params @type {JoinNetworkParams} Your gateway configuration.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Join the network with the your configuration.
   * ```ts
   *   const jointNetworkParams = {
    // initial operator stake 
    qty: 4000,
    // delegated staking settings 
    allowDelegatedStaking: true,
    minDelegatedStake: 100,
    delegateRewardShareRatio: 1,
    autoStake: true,
    // gateway metadata info
    label: 'john smith', // min 1, max 64 characters
    note: 'The example gateway', // max 256 characters
    properties: 'FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44', // Arweave transaction ID containing additional properties of the Gateway.
    // gateway info
    fqdn: 'example.com',
    port: 443,
    protocol: 'https',
  };
    * arIO.joinNetwork(jointNetworkParams);
   * ```
   */
  async joinNetwork(
    params: JoinNetworkParams,
  ): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.JOIN_NETWORK,
      inputs: params,
      signer: this.signer,
    });
  }

  /**
   * @param params @type {UpdateGatewaySettingsParams} Gateway settings to update
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Update a setting of the gateway.
   * ```ts
   * arIO.updateGatewaySettings({ autoStake: true });
   * ```
   */
  async updateGatewaySettings(
    params: UpdateGatewaySettingsParams,
  ): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.UPDATE_GATEWAY_SETTINGS,
      inputs: params,
      signer: this.signer,
    });
  }

  /**
   * @param target @type {string} The gateway you wish to delegate stake to.
   * @param qty @type {number} The amount of stake to delegate.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Delegate stake to a gateway.
   * ```ts
   * arIO.increaseDelegateStake({ target: "FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44", qty: 1000 });
   * ```
   */
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

  /**
   * @param target @type {string} The gateway you wish to decrease stake at.
   * @param qty @type {number} The amount of stake to decrease.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Decrease your delegated staked tokens at a gateway.
   * ```ts
   * arIO.decreaseDelegateStake({ target: "FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44", qty: 1000 });
   * ```
   */
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

  /**
   * @param qty @type {number} The amount of stake to increase by.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Increase your staked tokens as an operater
   * ```ts
   * arIO.increaseOperatorStake({ qty: 1000 });
   * ```
   */
  async increaseOperatorStake(params: {
    qty: number;
  }): Promise<WriteInteractionResult> {
    return this.contract.writeInteraction({
      functionName: AR_IO_CONTRACT_FUNCTIONS.INCREASE_OPERATOR_STAKE,
      inputs: params,
      signer: this.signer,
    });
  }

  /**
   * @param qty @type {number} The amount of stake to decrease by.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Decrease your staked tokens as an operator
   * ```ts
   * arIO.decreaseOperatorStake({ qty: 1000 });
   * ```
   */
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

  /**
   * @param reportTxId @type {TransactionId} The transaction ID of the report.
   * @param failedGateways @type {WalletAddress[]} The failed gateways you are reporting.
   * @returns {Promise<WriteInteractionResult>} The result of the interaction.
   * @example
   * Save your observations.
   * ```ts
   * arIO.saveObservations({
   *  reportTxId: '5f7aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2Pe6ko',
   * failedGateways: ['FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44']
   *  });
   * ```
   */
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
