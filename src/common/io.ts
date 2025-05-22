/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { connect } from '@permaweb/aoconnect';
import Arweave from 'arweave';

import {
  ARIO_MAINNET_PROCESS_ID,
  ARIO_TESTNET_PROCESS_ID,
} from '../constants.js';
import {
  ARIOWithFaucet,
  AoARIORead,
  AoARIOWrite,
  AoAllDelegates,
  AoAllGatewayVaults,
  AoArNSNameData,
  AoArNSNameDataWithName,
  AoArNSPurchaseParams,
  AoArNSReservedNameData,
  AoArNSReservedNameDataWithName,
  AoBalanceWithAddress,
  AoBuyRecordParams,
  AoCreateVaultParams,
  AoDelegation,
  AoEligibleDistribution,
  AoEpochData,
  AoEpochDistributed,
  AoEpochDistributionData,
  AoEpochDistributionTotalsData,
  AoEpochObservationData,
  AoEpochSettings,
  AoExtendLeaseParams,
  AoExtendVaultParams,
  AoGateway,
  AoGatewayDelegateWithAddress,
  AoGatewayRegistrySettings,
  AoGatewayVault,
  AoGatewayWithAddress,
  AoGetCostDetailsParams,
  AoIncreaseUndernameLimitParams,
  AoIncreaseVaultParams,
  AoJoinNetworkParams,
  AoMessageResult,
  AoPaginatedAddressParams,
  AoPrimaryName,
  AoPrimaryNameRequest,
  AoRedelegationFeeInfo,
  AoRegistrationFees,
  AoReturnedName,
  AoRevokeVaultParams,
  AoSigner,
  AoTokenCostParams,
  AoTokenSupplyData,
  AoUpdateGatewaySettingsParams,
  AoVaultData,
  AoVaultedTransferParams,
  AoWalletVault,
  AoWeightedObserver,
  ArNSNameResolutionData,
  ArNSNameResolver,
  CostDetailsResult,
  DemandFactorSettings,
  EpochInput,
  OptionalArweave,
  OptionalPaymentUrl,
  PaginationParams,
  PaginationResult,
  ProcessConfig,
  ProcessConfiguration,
  TransactionId,
  WalletAddress,
  WithSigner,
  WriteOptions,
  isProcessConfiguration,
  isProcessIdConfiguration,
  mARIOToken,
} from '../types/index.js';
import { createAoSigner } from '../utils/ao.js';
import {
  getEpochDataFromGqlWithCUFallback,
  paginationParamsToTags,
  pruneTags,
  removeEligibleRewardsFromEpochData,
  sortAndPaginateEpochDataIntoEligibleDistributions,
} from '../utils/arweave.js';
import { ANT } from './ant.js';
import { defaultArweave } from './arweave.js';
import { AOProcess } from './contracts/ao-process.js';
import { InvalidContractConfigurationError } from './error.js';
import { createFaucet } from './faucet.js';
import {
  TurboArNSPaymentFactory,
  TurboArNSPaymentProviderAuthenticated,
  TurboArNSPaymentProviderUnauthenticated,
  isTurboArNSSigner,
} from './turbo.js';

type ARIOConfigNoSigner = OptionalPaymentUrl<
  OptionalArweave<ProcessConfiguration>
>;
type ARIOConfigWithSigner = WithSigner<
  OptionalPaymentUrl<OptionalArweave<ProcessConfiguration>>
>;

type ARIOConfig = ARIOConfigNoSigner | ARIOConfigWithSigner;

export class ARIO {
  // Overload: No arguments -> returns AoARIORead
  static init(): AoARIORead;

  // Overload: config with signer -> returns AoARIOWrite
  static init(config: ARIOConfigWithSigner): AoARIOWrite;

  // Overload: config without signer -> returns AoARIORead
  static init(config: ARIOConfigNoSigner): AoARIORead;

  // Implementation
  static init(config?: ARIOConfig): AoARIORead | AoARIOWrite {
    if (config !== undefined && 'signer' in config) {
      return new ARIOWriteable(config);
    }
    return new ARIOReadable(config);
  }

  static mainnet(): AoARIORead;
  static mainnet(config: ARIOConfigNoSigner): AoARIORead;
  static mainnet(config: ARIOConfigWithSigner): AoARIOWrite;
  static mainnet(config?: ARIOConfig): AoARIORead | AoARIOWrite {
    if (config !== undefined && 'signer' in config) {
      return new ARIOWriteable({
        ...config,
        process: new AOProcess({
          processId: ARIO_MAINNET_PROCESS_ID,
          ao: connect({
            MODE: 'legacy',
            CU_URL: 'https://cu.ardrive.io',
            ...(config as ProcessConfig)?.process?.ao,
          }),
        }),
      });
    }
    return new ARIOReadable({
      ...config,
      process: new AOProcess({
        processId: ARIO_MAINNET_PROCESS_ID,
        ao: connect({
          CU_URL: 'https://cu.ardrive.io',
          MODE: 'legacy',
          ...(config as ProcessConfig)?.process?.ao,
        }),
      }),
    });
  }

  static testnet(): ARIOWithFaucet<AoARIORead>;
  static testnet(
    config: ARIOConfigNoSigner & { faucetUrl?: string },
  ): ARIOWithFaucet<AoARIORead>;
  static testnet(
    config: ARIOConfigWithSigner & { faucetUrl?: string },
  ): ARIOWithFaucet<AoARIOWrite>;
  static testnet(
    config?: ARIOConfig & { faucetUrl?: string },
  ): ARIOWithFaucet<AoARIORead | AoARIOWrite> {
    if (config !== undefined && 'signer' in config) {
      return createFaucet({
        arioInstance: new ARIOWriteable({
          ...config,
          process: new AOProcess({
            processId: ARIO_TESTNET_PROCESS_ID,
            ao: connect({
              MODE: 'legacy',
              CU_URL: 'https://cu.ardrive.io',
              ...(config as ProcessConfig)?.process?.ao,
            }),
          }),
        }),
        faucetApiUrl: config?.faucetUrl,
      });
    }

    return createFaucet({
      arioInstance: new ARIOReadable({
        ...config,
        process: new AOProcess({
          processId: ARIO_TESTNET_PROCESS_ID,
          ao: connect({
            MODE: 'legacy',
            CU_URL: 'https://cu.ardrive.io',
            ...(config as ProcessConfig)?.process?.ao,
          }),
        }),
      }),
      faucetApiUrl: config?.faucetUrl,
    });
  }
}

export class ARIOReadable implements AoARIORead, ArNSNameResolver {
  public readonly process: AOProcess;
  protected epochSettings: AoEpochSettings | undefined;
  protected arweave: Arweave;
  protected paymentProvider: TurboArNSPaymentProviderUnauthenticated; // TODO: this could be an array/map of payment providers

  constructor(config?: ARIOConfigNoSigner) {
    this.arweave = config?.arweave ?? defaultArweave;
    if (config === undefined || Object.keys(config).length === 0) {
      this.process = new AOProcess({
        processId: ARIO_MAINNET_PROCESS_ID,
      });
    } else if (isProcessConfiguration(config)) {
      this.process = config.process;
    } else if (isProcessIdConfiguration(config)) {
      this.process = new AOProcess({
        processId: config.processId,
      });
    } else {
      throw new InvalidContractConfigurationError();
    }
    this.paymentProvider = TurboArNSPaymentFactory.init({
      paymentUrl: config?.paymentUrl,
    });
  }

  async getInfo(): Promise<{
    Name: string;
    Ticker: string;
    Logo: string;
    Denomination: number;
    Handlers: string[];
    LastCreatedEpochIndex: number;
    LastDistributedEpochIndex: number;
  }> {
    return this.process.read<{
      Name: string;
      Ticker: string;
      Logo: string;
      Denomination: number;
      Handlers: string[];
      LastCreatedEpochIndex: number;
      LastDistributedEpochIndex: number;
    }>({
      tags: [{ name: 'Action', value: 'Info' }],
    });
  }

  async getTokenSupply(): Promise<AoTokenSupplyData> {
    return this.process.read<AoTokenSupplyData>({
      tags: [{ name: 'Action', value: 'Total-Token-Supply' }],
    });
  }

  private async computeEpochIndexForTimestamp(
    timestamp: number,
  ): Promise<number> {
    const epochSettings = await this.getEpochSettings();
    const epochZeroStartTimestamp = epochSettings.epochZeroStartTimestamp;
    const epochLengthMs = epochSettings.durationMs;
    return Math.floor((timestamp - epochZeroStartTimestamp) / epochLengthMs);
  }

  private async computeCurrentEpochIndex(): Promise<number> {
    return this.computeEpochIndexForTimestamp(Date.now());
  }

  private async computeEpochIndex(
    params?: EpochInput,
  ): Promise<number | undefined> {
    const epochIndex = (params as { epochIndex?: number })?.epochIndex;
    if (epochIndex !== undefined) {
      return epochIndex;
    }

    const timestamp = (params as { timestamp?: number })?.timestamp;
    if (timestamp !== undefined) {
      return this.computeEpochIndexForTimestamp(timestamp);
    }

    return undefined;
  }

  async getEpochSettings(): Promise<AoEpochSettings> {
    return (this.epochSettings ??= await this.process.read<AoEpochSettings>({
      tags: [{ name: 'Action', value: 'Epoch-Settings' }],
    }));
  }

  async getEpoch(): Promise<AoEpochData<AoEpochDistributionTotalsData>>;
  async getEpoch(epoch: EpochInput): Promise<AoEpochData<AoEpochDistributed>>;
  async getEpoch(epoch?: EpochInput): Promise<AoEpochData> {
    const epochIndex = await this.computeEpochIndex(epoch);
    const currentIndex = await this.computeCurrentEpochIndex();
    if (epochIndex !== undefined && epochIndex < currentIndex) {
      const epochData = await getEpochDataFromGqlWithCUFallback({
        arweave: this.arweave,
        epochIndex: epochIndex,
        processId: this.process.processId,
        ao: this.process.ao,
      });

      if (!epochData) {
        throw new Error('Epoch data not found for epoch index ' + epochIndex);
      }

      return removeEligibleRewardsFromEpochData(epochData);
    }
    // go to the process epoch and fetch the epoch data
    const allTags = [
      { name: 'Action', value: 'Epoch' },
      {
        name: 'Epoch-Index',
        value: currentIndex.toString(),
      },
    ];

    return this.process.read<AoEpochData<AoEpochDistributionTotalsData>>({
      tags: pruneTags(allTags),
    });
  }

  async getArNSRecord({ name }: { name: string }): Promise<AoArNSNameData> {
    return this.process.read<AoArNSNameData>({
      tags: [
        { name: 'Action', value: 'Record' },
        { name: 'Name', value: name },
      ],
    });
  }

  async getArNSRecords(
    params?: PaginationParams<AoArNSNameDataWithName>,
  ): Promise<PaginationResult<AoArNSNameDataWithName>> {
    return this.process.read<PaginationResult<AoArNSNameDataWithName>>({
      tags: [
        { name: 'Action', value: 'Paginated-Records' },
        ...paginationParamsToTags<AoArNSNameDataWithName>(params),
      ],
    });
  }

  async getArNSReservedNames(
    params?: PaginationParams<AoArNSReservedNameDataWithName>,
  ): Promise<PaginationResult<AoArNSReservedNameDataWithName>> {
    return this.process.read<PaginationResult<AoArNSReservedNameDataWithName>>({
      tags: [
        { name: 'Action', value: 'Reserved-Names' },
        ...paginationParamsToTags<AoArNSReservedNameDataWithName>(params),
      ],
    });
  }

  async getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<AoArNSReservedNameData> {
    return this.process.read<AoArNSReservedNameData>({
      tags: [
        { name: 'Action', value: 'Reserved-Name' },
        { name: 'Name', value: name },
      ],
    });
  }

  async getBalance({ address }: { address: WalletAddress }): Promise<number> {
    return this.process.read<number>({
      tags: [
        { name: 'Action', value: 'Balance' },
        { name: 'Address', value: address },
      ],
    });
  }

  async getBalances(
    params?: PaginationParams<AoBalanceWithAddress>,
  ): Promise<PaginationResult<AoBalanceWithAddress>> {
    return this.process.read<PaginationResult<AoBalanceWithAddress>>({
      tags: [
        { name: 'Action', value: 'Paginated-Balances' },
        ...paginationParamsToTags<AoBalanceWithAddress>(params),
      ],
    });
  }

  async getVault({
    address,
    vaultId,
  }: {
    address: WalletAddress;
    vaultId: string;
  }): Promise<AoVaultData> {
    return this.process.read<AoVaultData>({
      tags: [
        { name: 'Action', value: 'Vault' },
        { name: 'Address', value: address },
        { name: 'Vault-Id', value: vaultId },
      ],
    });
  }

  async getVaults(
    params?: PaginationParams<AoWalletVault>,
  ): Promise<PaginationResult<AoWalletVault>> {
    return this.process.read<PaginationResult<AoWalletVault>>({
      tags: [
        { name: 'Action', value: 'Paginated-Vaults' },
        ...paginationParamsToTags<AoWalletVault>(params),
      ],
    });
  }

  async getGateway({
    address,
  }: {
    address: WalletAddress;
  }): Promise<AoGateway> {
    return this.process.read<AoGateway>({
      tags: [
        { name: 'Action', value: 'Gateway' },
        { name: 'Address', value: address },
      ],
    });
  }

  async getGatewayDelegates({
    address,
    ...pageParams
  }): Promise<PaginationResult<AoGatewayDelegateWithAddress>> {
    return this.process.read<PaginationResult<AoGatewayDelegateWithAddress>>({
      tags: [
        { name: 'Action', value: 'Paginated-Delegates' },
        { name: 'Address', value: address },
        ...paginationParamsToTags<AoGatewayDelegateWithAddress>(pageParams),
      ],
    });
  }

  async getGatewayDelegateAllowList({
    address,
    ...pageParams
  }: AoPaginatedAddressParams): Promise<PaginationResult<WalletAddress>> {
    return this.process.read<PaginationResult<WalletAddress>>({
      tags: [
        { name: 'Action', value: 'Paginated-Allowed-Delegates' },
        { name: 'Address', value: address },
        ...paginationParamsToTags<WalletAddress>(pageParams),
      ],
    });
  }

  async getGateways(
    pageParams?: PaginationParams<AoGatewayWithAddress>,
  ): Promise<PaginationResult<AoGatewayWithAddress>> {
    return this.process.read<PaginationResult<AoGatewayWithAddress>>({
      tags: [
        { name: 'Action', value: 'Paginated-Gateways' },
        ...paginationParamsToTags<AoGatewayWithAddress>(pageParams),
      ],
    });
  }

  async getCurrentEpoch(): Promise<AoEpochData<AoEpochDistributionTotalsData>> {
    return this.process.read<AoEpochData<AoEpochDistributionTotalsData>>({
      tags: [{ name: 'Action', value: 'Epoch' }],
    });
  }

  async getPrescribedObservers(
    epoch?: EpochInput,
  ): Promise<AoWeightedObserver[]> {
    const epochIndex = await this.computeEpochIndex(epoch);
    const currentIndex = await this.computeCurrentEpochIndex();
    if (epochIndex !== undefined && epochIndex < currentIndex) {
      const epochData = await getEpochDataFromGqlWithCUFallback({
        ao: this.process.ao,
        arweave: this.arweave,
        epochIndex: epochIndex,
        processId: this.process.processId,
      });

      if (!epochData) {
        throw new Error('Epoch data not found for epoch index ' + epochIndex);
      }

      return epochData.prescribedObservers;
    }

    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Observers' },
      {
        name: 'Epoch-Index',
        value: currentIndex.toString(),
      },
    ];

    return this.process.read<AoWeightedObserver[]>({
      tags: pruneTags(allTags),
    });
  }

  async getPrescribedNames(epoch?: EpochInput): Promise<string[]> {
    const epochIndex = await this.computeEpochIndex(epoch);
    const currentIndex = await this.computeCurrentEpochIndex();
    if (epochIndex !== undefined && epochIndex < currentIndex) {
      const epochData = await getEpochDataFromGqlWithCUFallback({
        arweave: this.arweave,
        epochIndex: epochIndex,
        processId: this.process.processId,
        ao: this.process.ao,
      });

      if (!epochData) {
        throw new Error('Epoch data not found for epoch index ' + epochIndex);
      }

      return epochData.prescribedNames;
    }
    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Names' },
      {
        name: 'Epoch-Index',
        value: currentIndex.toString(),
      },
    ];

    return this.process.read<string[]>({
      tags: pruneTags(allTags),
    });
  }

  // we need to find the epoch index for the epoch that is currently being distributed and fetch it from gql
  async getObservations(epoch?: EpochInput): Promise<AoEpochObservationData> {
    const epochIndex = await this.computeEpochIndex(epoch);
    const currentIndex = await this.computeCurrentEpochIndex();
    if (epochIndex !== undefined && epochIndex < currentIndex) {
      const epochData = await getEpochDataFromGqlWithCUFallback({
        arweave: this.arweave,
        epochIndex: epochIndex,
        processId: this.process.processId,
        ao: this.process.ao,
      });

      if (!epochData) {
        throw new Error('Epoch data not found for epoch index ' + epochIndex);
      }

      return epochData.observations;
    }
    // go to the process epoch and fetch the observations
    const allTags = [
      { name: 'Action', value: 'Epoch-Observations' },
      {
        name: 'Epoch-Index',
        value: currentIndex.toString(),
      },
    ];

    return this.process.read<AoEpochObservationData>({
      tags: pruneTags(allTags),
    });
  }

  async getDistributions(epoch?: EpochInput): Promise<AoEpochDistributionData> {
    const epochIndex = await this.computeEpochIndex(epoch);
    const currentIndex = await this.computeCurrentEpochIndex();
    if (epochIndex !== undefined && epochIndex < currentIndex) {
      const epochData = await getEpochDataFromGqlWithCUFallback({
        arweave: this.arweave,
        epochIndex: epochIndex,
        processId: this.process.processId,
        ao: this.process.ao,
      });

      if (epochData === undefined) {
        throw new Error('Epoch data not found for epoch index ' + epochIndex);
      }

      return epochData.distributions;
    }
    // go to the process epoch and fetch the distributions
    const allTags = [
      { name: 'Action', value: 'Epoch-Distributions' },
      {
        name: 'Epoch-Index',
        value: currentIndex.toString(),
      },
    ];

    return this.process.read<AoEpochDistributionData>({
      tags: pruneTags(allTags),
    });
  }

  async getEligibleEpochRewards(
    epoch?: EpochInput,
    params?: PaginationParams<AoEligibleDistribution>,
  ): Promise<PaginationResult<AoEligibleDistribution>> {
    const epochIndex = await this.computeEpochIndex(epoch);
    const currentIndex = await this.computeCurrentEpochIndex();
    if (epochIndex !== undefined && epochIndex < currentIndex) {
      const epochData = await getEpochDataFromGqlWithCUFallback({
        arweave: this.arweave,
        epochIndex: epochIndex,
        processId: this.process.processId,
        ao: this.process.ao,
      });

      if (!epochData) {
        throw new Error('Epoch data not found for epoch index ' + epochIndex);
      }

      return sortAndPaginateEpochDataIntoEligibleDistributions(
        epochData,
        params,
      );
    }

    // on current epoch, go to process and fetch the distributions
    const allTags = [
      { name: 'Action', value: 'Epoch-Eligible-Rewards' },
      ...paginationParamsToTags(params),
    ];

    return this.process.read<PaginationResult<AoEligibleDistribution>>({
      tags: pruneTags(allTags),
    });
  }

  async getTokenCost(params: {
    intent: 'Buy-Record' | 'Buy-Name';
    type: 'permabuy' | 'lease';
    years: number;
    name: string;
  }): Promise<number>;
  async getTokenCost(params: {
    intent: 'Extend-Lease';
    years: number;
    name: string;
  }): Promise<number>;
  async getTokenCost(params: {
    intent: 'Increase-Undername-Limit';
    quantity: number;
    name: string;
  }): Promise<number>;
  async getTokenCost(params: {
    intent: 'Upgrade-Name';
    name: string;
  }): Promise<number>;
  async getTokenCost(params: {
    intent: 'Primary-Name-Request';
    name: string;
  }): Promise<number>;
  async getTokenCost({
    intent,
    type,
    years,
    name,
    quantity,
    fromAddress,
  }: AoTokenCostParams): Promise<number> {
    const replacedBuyRecordWithBuyName =
      intent === 'Buy-Record' ? 'Buy-Name' : intent;
    const allTags = [
      { name: 'Action', value: 'Token-Cost' },
      {
        name: 'Intent',
        value: replacedBuyRecordWithBuyName,
      },
      {
        name: 'Name',
        value: name,
      },
      {
        name: 'Years',
        value: years?.toString(),
      },
      {
        name: 'Quantity',
        value: quantity?.toString(),
      },
      {
        name: 'Purchase-Type',
        value: type,
      },
    ];

    return this.process.read<number>({
      tags: pruneTags(allTags),
      fromAddress,
    });
  }

  // TODO: Can overload this function to refine different types of cost details params
  async getCostDetails({
    intent,
    type,
    years,
    name,
    quantity,
    fromAddress,
    fundFrom,
  }: AoGetCostDetailsParams): Promise<CostDetailsResult> {
    const replacedBuyRecordWithBuyName =
      intent === 'Buy-Record' ? 'Buy-Name' : intent;

    if (fundFrom === 'turbo') {
      const { mARIO, winc } = await this.paymentProvider.getArNSPriceDetails({
        intent: replacedBuyRecordWithBuyName,
        name,
        quantity,
        type,
        years,
      });

      return {
        tokenCost: mARIO.valueOf(),
        wincQty: winc,
        discounts: [],
      };
    }

    const allTags = [
      { name: 'Action', value: 'Cost-Details' },
      {
        name: 'Intent',
        value: replacedBuyRecordWithBuyName,
      },
      {
        name: 'Name',
        value: name,
      },
      {
        name: 'Years',
        value: years?.toString(),
      },
      {
        name: 'Quantity',
        value: quantity?.toString(),
      },
      {
        name: 'Purchase-Type',
        value: type,
      },
      {
        name: 'Fund-From',
        value: fundFrom,
      },
    ];

    return this.process.read<CostDetailsResult>({
      tags: pruneTags(allTags),
      fromAddress,
    });
  }

  async getRegistrationFees(): Promise<AoRegistrationFees> {
    return this.process.read<AoRegistrationFees>({
      tags: [{ name: 'Action', value: 'Registration-Fees' }],
    });
  }

  async getDemandFactor(): Promise<number> {
    return this.process.read<number>({
      tags: [{ name: 'Action', value: 'Demand-Factor' }],
    });
  }

  async getDemandFactorSettings(): Promise<DemandFactorSettings> {
    return this.process.read<DemandFactorSettings>({
      tags: [{ name: 'Action', value: 'Demand-Factor-Settings' }],
    });
  }

  async getArNSReturnedNames(
    params?: PaginationParams<AoReturnedName>,
  ): Promise<PaginationResult<AoReturnedName>> {
    return this.process.read<PaginationResult<AoReturnedName>>({
      tags: [
        { name: 'Action', value: 'Returned-Names' },
        ...paginationParamsToTags<AoReturnedName>(params),
      ],
    });
  }

  async getArNSReturnedName({
    name,
  }: {
    name: string;
  }): Promise<AoReturnedName> {
    const allTags = [
      { name: 'Action', value: 'Returned-Name' },
      { name: 'Name', value: name },
    ];

    return this.process.read<AoReturnedName>({
      tags: allTags,
    });
  }

  async getDelegations(
    params: PaginationParams<AoDelegation> & { address: WalletAddress },
  ): Promise<PaginationResult<AoDelegation>> {
    const allTags = [
      { name: 'Action', value: 'Paginated-Delegations' },
      { name: 'Address', value: params.address },
      ...paginationParamsToTags(params),
    ];

    return this.process.read<PaginationResult<AoDelegation>>({
      tags: pruneTags(allTags),
    });
  }

  async getAllowedDelegates(
    params: AoPaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>> {
    return this.getGatewayDelegateAllowList(params);
  }

  async getGatewayVaults(
    params: PaginationParams<AoGatewayVault> & { address: WalletAddress },
  ): Promise<PaginationResult<AoGatewayVault>> {
    return this.process.read<PaginationResult<AoGatewayVault>>({
      tags: [
        { name: 'Action', value: 'Paginated-Gateway-Vaults' },
        { name: 'Address', value: params.address },
        ...paginationParamsToTags(params),
      ],
    });
  }

  async getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest> {
    const allTags = [
      { name: 'Action', value: 'Primary-Name-Request' },
      {
        name: 'Initiator',
        value: params.initiator,
      },
    ];

    return this.process.read<AoPrimaryNameRequest>({
      tags: allTags,
    });
  }

  async getPrimaryNameRequests(
    params?: PaginationParams<AoPrimaryNameRequest>,
  ): Promise<PaginationResult<AoPrimaryNameRequest>> {
    return this.process.read<PaginationResult<AoPrimaryNameRequest>>({
      tags: [
        { name: 'Action', value: 'Primary-Name-Requests' },
        ...paginationParamsToTags(params),
      ],
    });
  }

  async getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<AoPrimaryName> {
    const allTags = [
      { name: 'Action', value: 'Primary-Name' },
      {
        name: 'Address',
        value: (params as { address: WalletAddress })?.address,
      },
      { name: 'Name', value: (params as { name: string })?.name },
    ];

    return this.process.read<AoPrimaryName>({
      tags: pruneTags(allTags),
    });
  }

  async getPrimaryNames(
    params: PaginationParams<AoPrimaryName>,
  ): Promise<PaginationResult<AoPrimaryName>> {
    return this.process.read<PaginationResult<AoPrimaryName>>({
      tags: [
        { name: 'Action', value: 'Primary-Names' },
        ...paginationParamsToTags(params),
      ],
    });
  }

  /**
   * Get current redelegation fee percentage for address
   *
   * @param {Object} params - The parameters for fetching redelegation fee
   * @param {string} params.address - The address to fetch the fee for
   * @returns {Promise<AoMessageResult>} The redelegation fee result
   */
  async getRedelegationFee(params: {
    address: WalletAddress;
  }): Promise<AoRedelegationFeeInfo> {
    return this.process.read({
      tags: [
        { name: 'Action', value: 'Redelegation-Fee' },
        { name: 'Address', value: params.address },
      ],
    });
  }

  async getGatewayRegistrySettings(): Promise<AoGatewayRegistrySettings> {
    return this.process.read({
      tags: [{ name: 'Action', value: 'Gateway-Registry-Settings' }],
    });
  }

  async getAllDelegates(
    params?: PaginationParams<AoAllDelegates>,
  ): Promise<PaginationResult<AoAllDelegates>> {
    return this.process.read({
      tags: [
        { name: 'Action', value: 'All-Paginated-Delegates' },
        ...paginationParamsToTags(params),
      ],
    });
  }

  async getAllGatewayVaults(
    params?: PaginationParams<AoAllGatewayVaults>,
  ): Promise<PaginationResult<AoAllGatewayVaults>> {
    return this.process.read({
      tags: [
        { name: 'Action', value: 'All-Gateway-Vaults' },
        ...paginationParamsToTags(params),
      ],
    });
  }

  async resolveArNSName({
    name,
  }: {
    name: string;
  }): Promise<ArNSNameResolutionData> {
    // derive baseName & undername using last underscore
    const lastUnderscore = name.lastIndexOf('_');
    const baseName =
      lastUnderscore === -1 ? name : name.slice(lastUnderscore + 1);
    const undername =
      lastUnderscore === -1 ? '@' : name.slice(0, lastUnderscore);

    // guard against missing or unregistered ARNS record
    const nameData = await this.getArNSRecord({ name: baseName });

    if (nameData === undefined || nameData.processId === undefined) {
      throw new Error(
        `Base ArNS name ${baseName} not found on ARIO contract (${this.process.processId}).`,
      );
    }

    const ant = ANT.init({
      process: new AOProcess({
        ao: this.process.ao,
        processId: nameData.processId,
      }),
    });
    const [owner, antRecord] = await Promise.all([
      ant.getOwner(),
      ant.getRecord({ undername }),
    ]);
    if (antRecord === undefined) {
      throw new Error(`Record for ${undername} not found on ANT.`);
    }
    if (
      antRecord.ttlSeconds === undefined ||
      antRecord.transactionId === undefined
    ) {
      throw new Error(
        `Invalid record on ANT. Must have ttlSeconds and transactionId. Record: ${JSON.stringify(
          antRecord,
        )}`,
      );
    }
    return {
      name,
      owner,
      txId: antRecord.transactionId,
      ttlSeconds: antRecord.ttlSeconds,
      priority: antRecord.priority,
      // NOTE: we may want return the actual index of the record based on sorting
      // in case ANT tries to set duplicate priority values to get around undername limits
      processId: nameData.processId,
      undernameLimit: nameData.undernameLimit,
      type: nameData.type,
    };
  }
}

export class ARIOWriteable extends ARIOReadable implements AoARIOWrite {
  private signer: AoSigner;
  protected paymentProvider:
    | TurboArNSPaymentProviderAuthenticated
    | TurboArNSPaymentProviderUnauthenticated;

  constructor({ signer, paymentUrl, ...config }: ARIOConfigWithSigner) {
    if (config === undefined) {
      super({
        process: new AOProcess({
          processId: ARIO_MAINNET_PROCESS_ID,
        }),
      });
    } else {
      super(config);
    }
    this.signer = createAoSigner(signer);
    this.paymentProvider = TurboArNSPaymentFactory.init({
      signer: isTurboArNSSigner(signer) ? signer : undefined,
      paymentUrl,
    });
  }

  async transfer(
    {
      target,
      qty,
    }: {
      target: string;
      qty: number | mARIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      tags: [
        ...tags,
        { name: 'Action', value: 'Transfer' },
        {
          name: 'Recipient',
          value: target,
        },
        {
          name: 'Quantity',
          value: qty.valueOf().toString(),
        },
      ],
      signer: this.signer,
    });
  }

  async vaultedTransfer(
    {
      recipient,
      quantity,
      lockLengthMs,
      revokable = false,
    }: AoVaultedTransferParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};

    return this.process.send({
      tags: [
        ...tags,
        { name: 'Action', value: 'Vaulted-Transfer' },
        { name: 'Recipient', value: recipient },
        { name: 'Quantity', value: quantity.toString() },
        { name: 'Lock-Length', value: lockLengthMs.toString() },
        { name: 'Revokable', value: `${revokable}` },
      ],
      signer: this.signer,
    });
  }

  async revokeVault(
    { vaultId, recipient }: AoRevokeVaultParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      tags: [
        ...tags,
        { name: 'Action', value: 'Revoke-Vault' },
        { name: 'Vault-Id', value: vaultId },
        { name: 'Recipient', value: recipient },
      ],
      signer: this.signer,
    });
  }

  async createVault(
    { lockLengthMs, quantity }: AoCreateVaultParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      tags: [
        ...tags,
        { name: 'Action', value: 'Create-Vault' },
        { name: 'Lock-Length', value: lockLengthMs.toString() },
        { name: 'Quantity', value: quantity.toString() },
      ],
      signer: this.signer,
    });
  }

  async extendVault(
    { vaultId, extendLengthMs }: AoExtendVaultParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      tags: [
        ...tags,
        { name: 'Action', value: 'Extend-Vault' },
        { name: 'Vault-Id', value: vaultId },
        { name: 'Extend-Length', value: extendLengthMs.toString() },
      ],
      signer: this.signer,
    });
  }

  async increaseVault(
    { vaultId, quantity }: AoIncreaseVaultParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      tags: [
        ...tags,
        { name: 'Action', value: 'Increase-Vault' },
        { name: 'Vault-Id', value: vaultId },
        { name: 'Quantity', value: quantity.toString() },
      ],
      signer: this.signer,
    });
  }

  async joinNetwork(
    {
      operatorStake,
      allowDelegatedStaking,
      allowedDelegates,
      delegateRewardShareRatio,
      fqdn,
      label,
      minDelegatedStake,
      note,
      port,
      properties,
      protocol,
      autoStake,
      observerAddress,
    }: AoJoinNetworkParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Join-Network' },
      {
        name: 'Operator-Stake',
        value: operatorStake.valueOf().toString(),
      },
      {
        name: 'Allow-Delegated-Staking',
        value: allowDelegatedStaking?.toString(),
      },
      {
        name: 'Allowed-Delegates',
        value: allowedDelegates?.join(','),
      },
      {
        name: 'Delegate-Reward-Share-Ratio',
        value: delegateRewardShareRatio?.toString(),
      },
      {
        name: 'FQDN',
        value: fqdn,
      },
      {
        name: 'Label',
        value: label,
      },
      {
        name: 'Min-Delegated-Stake',
        value: minDelegatedStake?.valueOf().toString(),
      },
      {
        name: 'Note',
        value: note,
      },
      {
        name: 'Port',
        value: port?.toString(),
      },
      {
        name: 'Properties',
        value: properties,
      },
      {
        name: 'Protocol',
        value: protocol,
      },
      {
        name: 'Auto-Stake',
        value: autoStake?.toString(),
      },
      {
        name: 'Observer-Address',
        value: observerAddress,
      },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  async leaveNetwork(options?: WriteOptions): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [...tags, { name: 'Action', value: 'Leave-Network' }],
    });
  }

  async updateGatewaySettings(
    {
      allowDelegatedStaking,
      allowedDelegates,
      delegateRewardShareRatio,
      fqdn,
      label,
      minDelegatedStake,
      note,
      port,
      properties,
      protocol,
      autoStake,
      observerAddress,
    }: AoUpdateGatewaySettingsParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Update-Gateway-Settings' },
      { name: 'Label', value: label },
      { name: 'Note', value: note },
      { name: 'FQDN', value: fqdn },
      { name: 'Port', value: port?.toString() },
      { name: 'Properties', value: properties },
      { name: 'Protocol', value: protocol },
      { name: 'Observer-Address', value: observerAddress },
      {
        name: 'Allow-Delegated-Staking',
        value: allowDelegatedStaking?.toString(),
      },
      {
        name: 'Allowed-Delegates',
        value: allowedDelegates?.join(','),
      },
      {
        name: 'Delegate-Reward-Share-Ratio',
        value: delegateRewardShareRatio?.toString(),
      },
      {
        name: 'Min-Delegated-Stake',
        value: minDelegatedStake?.valueOf().toString(),
      },
      { name: 'Auto-Stake', value: autoStake?.toString() },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  async delegateStake(
    params: {
      target: string;
      stakeQty: number | mARIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Delegate-Stake' },
        { name: 'Target', value: params.target },
        { name: 'Quantity', value: params.stakeQty.valueOf().toString() },
      ],
    });
  }

  async decreaseDelegateStake(
    params: {
      target: string;
      decreaseQty: number | mARIOToken;
      instant?: boolean;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};

    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Decrease-Delegate-Stake' },
        { name: 'Target', value: params.target },
        { name: 'Quantity', value: params.decreaseQty.valueOf().toString() },
        { name: 'Instant', value: `${params.instant || false}` },
      ],
    });
  }

  /**
   * Initiates an instant withdrawal from a gateway.
   *
   * @param {Object} params - The parameters for initiating an instant withdrawal
   * @param {string} params.address - The gateway address of the withdrawal, if not provided, the signer's address will be used
   * @param {string} params.vaultId - The vault ID of the withdrawal
   * @returns {Promise<AoMessageResult>} The result of the withdrawal
   */
  async instantWithdrawal(
    params: {
      gatewayAddress?: string;
      vaultId: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};

    const allTags = [
      ...tags,
      { name: 'Action', value: 'Instant-Withdrawal' },
      { name: 'Vault-Id', value: params.vaultId },
      { name: 'Address', value: params.gatewayAddress },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  async increaseOperatorStake(
    params: {
      increaseQty: number | mARIOToken;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Increase-Operator-Stake' },
        { name: 'Quantity', value: params.increaseQty.valueOf().toString() },
      ],
    });
  }

  async decreaseOperatorStake(
    params: {
      decreaseQty: number | mARIOToken;
      instant?: boolean;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Decrease-Operator-Stake' },
        { name: 'Quantity', value: params.decreaseQty.valueOf().toString() },
        { name: 'Instant', value: `${params.instant || false}` },
      ],
    });
  }

  async saveObservations(
    params: {
      reportTxId: TransactionId;
      failedGateways: WalletAddress[];
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Save-Observations' },
        {
          name: 'Report-Tx-Id',
          value: params.reportTxId,
        },
        {
          name: 'Failed-Gateways',
          value: params.failedGateways.join(','),
        },
      ],
    });
  }

  async buyRecord(
    params: AoBuyRecordParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    if (params.fundFrom === 'turbo') {
      if (
        !(this.paymentProvider instanceof TurboArNSPaymentProviderAuthenticated)
      ) {
        throw new Error(
          'Turbo funding is not supported for this payment provider',
        );
      }
      return this.paymentProvider.initiateArNSPurchase({
        intent: 'Buy-Name',
        name: params.name,
        years: params.years,
        type: params.type,
        processId: params.processId,
        paidBy: params.paidBy,
      });
    }

    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Buy-Name' },
      { name: 'Name', value: params.name },
      { name: 'Years', value: params.years?.toString() ?? '1' },
      { name: 'Process-Id', value: params.processId },
      { name: 'Purchase-Type', value: params.type || 'lease' },
      { name: 'Fund-From', value: params.fundFrom },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  /**
   * Upgrades an existing leased record to a permabuy.
   *
   * @param {Object} params - The parameters for upgrading a record
   * @param {string} params.name - The name of the record to upgrade
   * @param {Object} [options] - The options for the upgrade
   * @returns {Promise<AoMessageResult>} The result of the upgrade
   */
  async upgradeRecord(
    params: AoArNSPurchaseParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    if (params.fundFrom === 'turbo') {
      if (
        !(this.paymentProvider instanceof TurboArNSPaymentProviderAuthenticated)
      ) {
        throw new Error(
          'Turbo funding is not supported for this payment provider',
        );
      }
      return this.paymentProvider.initiateArNSPurchase({
        intent: 'Upgrade-Name',
        name: params.name,
      });
    }

    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Upgrade-Name' },
      { name: 'Name', value: params.name },
      { name: 'Fund-From', value: params.fundFrom },
    ];
    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  /**
   * Extends the lease of an existing leased record.
   *
   * @param {Object} params - The parameters for extending a lease
   * @param {string} params.name - The name of the record to extend
   * @param {number} params.years - The number of years to extend the lease
   * @param {Object} [options] - The options for the extension
   * @returns {Promise<AoMessageResult>} The result of the extension
   */
  async extendLease(
    params: AoExtendLeaseParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    if (params.fundFrom === 'turbo') {
      if (
        !(this.paymentProvider instanceof TurboArNSPaymentProviderAuthenticated)
      ) {
        throw new Error(
          'Turbo funding is not supported for this payment provider',
        );
      }
      return this.paymentProvider.initiateArNSPurchase({
        intent: 'Extend-Lease',
        name: params.name,
        years: params.years,
      });
    }

    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Extend-Lease' },
      { name: 'Name', value: params.name },
      { name: 'Years', value: params.years.toString() },
      { name: 'Fund-From', value: params.fundFrom },
    ];
    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  async increaseUndernameLimit(
    params: AoIncreaseUndernameLimitParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    if (params.fundFrom === 'turbo') {
      if (
        !(this.paymentProvider instanceof TurboArNSPaymentProviderAuthenticated)
      ) {
        throw new Error(
          'Turbo funding is not supported for this payment provider',
        );
      }
      return this.paymentProvider.initiateArNSPurchase({
        intent: 'Increase-Undername-Limit',
        quantity: params.increaseCount,
        name: params.name,
      });
    }

    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Increase-Undername-Limit' },
      { name: 'Name', value: params.name },
      { name: 'Quantity', value: params.increaseCount.toString() },
      { name: 'Fund-From', value: params.fundFrom },
    ];
    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  /**
   * Cancel a withdrawal from a gateway.
   *
   * @param {Object} params - The parameters for cancelling a withdrawal
   * @param {string} [params.address] - The address of the withdrawal (optional). If not provided, the signer's address will be used.
   * @param {string} params.vaultId - The vault ID of the withdrawal.
   * @param {Object} [options] - The options for the cancellation
   * @returns {Promise<AoMessageResult>} The result of the cancellation
   */
  async cancelWithdrawal(
    params: { gatewayAddress?: WalletAddress; vaultId: string },
    options?: WriteOptions | undefined,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};

    const allTags = [
      ...tags,
      { name: 'Action', value: 'Cancel-Withdrawal' },
      { name: 'Vault-Id', value: params.vaultId },
      { name: 'Address', value: params.gatewayAddress },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  async requestPrimaryName(
    params: AoArNSPurchaseParams,
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    if (params.fundFrom === 'turbo') {
      throw new Error(
        'Turbo funding is not yet supported for primary name requests',
      );
    }

    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Request-Primary-Name' },
      { name: 'Name', value: params.name },
      { name: 'Fund-From', value: params.fundFrom },
    ];
    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  /**
   * Redelegate stake from one gateway to another gateway.
   *
   * @param {Object} params - The parameters for redelegating stake
   * @param {string} params.target - The target gateway address
   * @param {string} params.source - The source gateway address
   * @param {number} params.stakeQty - The quantity of stake to redelegate
   * @param {string} params.vaultId - An optional vault ID to redelegate from
   * @param {Object} [options] - The options for the redelegation
   * @returns {Promise<AoMessageResult>} The result of the redelegation
   */
  async redelegateStake(
    params: {
      target: string;
      source: string;
      stakeQty: number | mARIOToken;
      vaultId?: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Redelegate-Stake' },
      { name: 'Target', value: params.target },
      { name: 'Source', value: params.source },
      { name: 'Quantity', value: params.stakeQty.valueOf().toString() },
      { name: 'Vault-Id', value: params.vaultId },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }
}
