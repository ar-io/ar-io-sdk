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
import Arweave from 'arweave';

import { IO_TESTNET_PROCESS_ID } from '../constants.js';
import {
  AoArNSNameDataWithName,
  AoArNSReservedNameData,
  AoAuction,
  AoBalanceWithAddress,
  AoEpochDistributionData,
  AoEpochObservationData,
  AoGatewayWithAddress,
  AoJoinNetworkParams,
  AoMessageResult,
  AoPrimaryName,
  AoPrimaryNameRequest,
  AoRedelegationFeeInfo,
  AoTokenSupplyData,
  AoUpdateGatewaySettingsParams,
  AoWeightedObserver,
  ContractSigner,
  OptionalSigner,
  PaginationParams,
  PaginationResult,
  ProcessConfiguration,
  TransactionId,
  WalletAddress,
  WithSigner,
  WriteOptions,
} from '../types/index.js';
import {
  AoArNSNameData,
  AoArNSReservedNameDataWithName,
  AoAuctionPriceData,
  AoDelegation,
  AoEpochData,
  AoEpochSettings,
  AoGateway,
  AoGatewayDelegateWithAddress,
  AoGatewayVault,
  AoIORead,
  AoIOWrite,
  AoRegistrationFees,
  AoVaultData,
  AoWalletVault,
  EpochInput,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types/io.js';
import { AoSigner, mIOToken } from '../types/token.js';
import { createAoSigner } from '../utils/ao.js';
import {
  getCurrentBlockUnixTimestampMs,
  paginationParamsToTags,
  pruneTags,
} from '../utils/arweave.js';
import { defaultArweave } from './arweave.js';
import { AOProcess } from './contracts/ao-process.js';
import { InvalidContractConfigurationError } from './error.js';

export class IO {
  static init(): AoIORead;
  static init({ process }: { process: AOProcess }): AoIORead;
  static init({
    process,
    signer,
  }: WithSigner<{ process: AOProcess }>): AoIOWrite;
  static init({
    processId,
    signer,
  }: WithSigner<{
    processId: string;
  }>): AoIOWrite;
  static init({
    processId,
    signer,
  }: {
    signer?: ContractSigner | undefined;
    processId: string;
  });
  static init({ processId }: { processId: string }): AoIORead;
  static init(
    config?: OptionalSigner<ProcessConfiguration>,
  ): AoIORead | AoIOWrite {
    if (config && config.signer) {
      const { signer, ...rest } = config;
      return new IOWriteable({
        ...rest,
        signer,
      });
    }
    return new IOReadable(config);
  }
}

export class IOReadable implements AoIORead {
  protected process: AOProcess;
  private arweave: Arweave;

  constructor(config?: ProcessConfiguration, arweave = defaultArweave) {
    if (!config) {
      this.process = new AOProcess({
        processId: IO_TESTNET_PROCESS_ID,
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
    this.arweave = arweave;
  }

  async getInfo(): Promise<{
    Name: string;
    Ticker: string;
    Logo: string;
    Denomination: number;
    Handlers: string[];
    LastTickedEpochIndex: number;
  }> {
    return this.process.read<{
      Name: string;
      Ticker: string;
      Logo: string;
      Denomination: number;
      Handlers: string[];
      LastTickedEpochIndex: number;
    }>({
      tags: [{ name: 'Action', value: 'Info' }],
    });
  }

  async getTokenSupply(): Promise<AoTokenSupplyData> {
    return this.process.read<AoTokenSupplyData>({
      tags: [{ name: 'Action', value: 'Total-Token-Supply' }],
    });
  }

  async getEpochSettings(params?: EpochInput): Promise<AoEpochSettings> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Settings' },
      {
        name: 'Timestamp',
        value:
          (params as { timestamp?: number })?.timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      {
        name: 'Epoch-Index',
        value: (params as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    return this.process.read<AoEpochSettings>({
      tags: pruneTags(allTags),
    });
  }
  async getEpoch(epoch?: EpochInput): Promise<AoEpochData> {
    const allTags = [
      { name: 'Action', value: 'Epoch' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    return this.process.read<AoEpochData>({
      tags: pruneTags(allTags),
    });
  }

  async getArNSRecord({
    name,
  }: {
    name: string;
  }): Promise<AoArNSNameData | undefined> {
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
  }): Promise<AoArNSReservedNameData | undefined> {
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
  }): Promise<AoGateway | undefined> {
    return this.process.read<AoGateway | undefined>({
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
  }: {
    address: WalletAddress;
  } & PaginationParams<WalletAddress>): Promise<
    PaginationResult<WalletAddress>
  > {
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

  async getCurrentEpoch(): Promise<AoEpochData> {
    return this.process.read<AoEpochData>({
      tags: [
        { name: 'Action', value: 'Epoch' },
        {
          name: 'Timestamp',
          value: (
            await getCurrentBlockUnixTimestampMs(this.arweave)
          ).toString(),
        },
      ],
    });
  }

  async getPrescribedObservers(
    epoch?: EpochInput,
  ): Promise<AoWeightedObserver[]> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Observers' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    return this.process.read<AoWeightedObserver[]>({
      tags: pruneTags(allTags),
    });
  }

  async getPrescribedNames(epoch?: EpochInput): Promise<string[]> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Names' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    return this.process.read<string[]>({
      tags: pruneTags(allTags),
    });
  }

  async getObservations(epoch?: EpochInput): Promise<AoEpochObservationData> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Observations' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    return this.process.read<AoEpochObservationData>({
      tags: pruneTags(allTags),
    });
  }

  async getDistributions(epoch?: EpochInput): Promise<AoEpochDistributionData> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Distributions' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    return this.process.read<AoEpochDistributionData>({
      tags: pruneTags(allTags),
    });
  }

  async getTokenCost(params: {
    intent: 'Buy-Record';
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
  async getTokenCost({
    intent,
    type,
    years,
    name,
    quantity,
  }: {
    intent: 'Buy-Record' | 'Extend-Lease' | 'Increase-Undername-Limit';
    type?: 'permabuy' | 'lease';
    years?: number;
    name?: string;
    quantity?: number;
  }): Promise<number> {
    const allTags = [
      { name: 'Action', value: 'Token-Cost' },
      {
        name: 'Intent',
        value: intent,
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
        name: 'Timestamp',
        value: (
          await this.arweave.blocks
            .getCurrent()
            .then((block) => {
              return { timestamp: block.timestamp * 1000 };
            })
            .catch(() => {
              return { timestamp: Date.now() }; // fallback to current time
            })
        ).timestamp.toString(),
      },
    ];

    return this.process.read<number>({
      tags: pruneTags(allTags),
    });
  }

  async getRegistrationFees(): Promise<AoRegistrationFees> {
    return this.process.read<AoRegistrationFees>({
      tags: [{ name: 'Action', value: 'Get-Registration-Fees' }],
    });
  }

  async getDemandFactor(): Promise<number> {
    return this.process.read<number>({
      tags: [{ name: 'Action', value: 'Demand-Factor' }],
    });
  }

  // Auctions
  async getArNSAuctions(
    params?: PaginationParams<AoAuction>,
  ): Promise<PaginationResult<AoAuction>> {
    return this.process.read<PaginationResult<AoAuction>>({
      tags: [
        { name: 'Action', value: 'Auctions' },
        ...paginationParamsToTags<AoAuction>(params),
      ],
    });
  }

  async getArNSAuction({
    name,
  }: {
    name: string;
  }): Promise<AoAuction | undefined> {
    const allTags = [
      { name: 'Action', value: 'Auction-Info' },
      { name: 'Name', value: name },
    ];

    return this.process.read<AoAuction>({
      tags: allTags,
    });
  }

  /**
   * Get auction prices for a given auction at the provided intervals
   *
   * @param {Object} params - The parameters for fetching auction prices
   * @param {string} params.name - The name of the auction
   * @param {('permabuy'|'lease')} [params.type='lease'] - The type of purchase
   * @param {number} [params.years=1] - The number of years for lease (only applicable if type is 'lease')
   * @param {number} [params.timestamp=Date.now()] - The timestamp to fetch prices for
   * @param {number} [params.intervalMs=900000] - The interval in milliseconds between price points (default is 15 minutes)
   * @returns {Promise<AoAuctionPriceData>} The auction price data
   */
  async getArNSAuctionPrices({
    name,
    type,
    years,
    timestamp,
    intervalMs,
  }: {
    name: string;
    type?: 'permabuy' | 'lease';
    years?: number;
    timestamp?: number;
    intervalMs?: number;
  }): Promise<AoAuctionPriceData> {
    const prunedPriceTags: { name: string; value: string }[] = [
      { name: 'Action', value: 'Auction-Prices' },
      { name: 'Name', value: name },
      {
        name: 'Timestamp',
        value:
          timestamp?.toString() ??
          (await getCurrentBlockUnixTimestampMs(this.arweave)).toString(),
      },
      { name: 'Purchase-Type', value: type ?? 'lease' },
      {
        name: 'Years',
        value:
          type == undefined || type === 'lease'
            ? years?.toString() ?? '1'
            : undefined,
      },
      {
        name: 'Price-Interval-Ms',
        value: intervalMs?.toString() ?? '900000',
      },
    ].filter(
      (tag): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<AoAuctionPriceData>({
      tags: prunedPriceTags,
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
    params: PaginationParams & { address: WalletAddress },
  ): Promise<PaginationResult<WalletAddress>> {
    return this.process.read<PaginationResult<WalletAddress>>({
      tags: [
        { name: 'Action', value: 'Paginated-Allowed-Delegates' },
        { name: 'Address', value: params.address },
        ...paginationParamsToTags(params),
      ],
    });
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
    params: PaginationParams<AoPrimaryNameRequest>,
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
}

export class IOWriteable extends IOReadable implements AoIOWrite {
  protected declare process: AOProcess;
  private signer: AoSigner;
  constructor({
    signer,
    ...config
  }: WithSigner<
    | {
        process?: AOProcess;
      }
    | { processId?: string }
  >) {
    if (Object.keys(config).length === 0) {
      super({
        process: new AOProcess({
          processId: IO_TESTNET_PROCESS_ID,
        }),
      });
      this.signer = createAoSigner(signer);
    } else if (isProcessConfiguration(config)) {
      super({ process: config.process });
      this.signer = createAoSigner(signer);
    } else if (isProcessIdConfiguration(config)) {
      super({
        process: new AOProcess({
          processId: config.processId,
        }),
      });
      this.signer = createAoSigner(signer);
    } else {
      throw new InvalidContractConfigurationError();
    }
  }

  async transfer(
    {
      target,
      qty,
    }: {
      target: string;
      qty: number | mIOToken;
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
      stakeQty: number | mIOToken;
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
      decreaseQty: number | mIOToken;
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
      increaseQty: number | mIOToken;
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
      decreaseQty: number | mIOToken;
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
    params: {
      name: string;
      years?: number;
      type: 'lease' | 'permabuy';
      processId: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Buy-Record' },
      { name: 'Name', value: params.name },
      { name: 'Years', value: params.years?.toString() ?? '1' },
      { name: 'Process-Id', value: params.processId },
      { name: 'Purchase-Type', value: params.type || 'lease' },
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
    params: {
      name: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Upgrade-Name' }, // TODO: align on Update-Record vs. Upgrade-Name (contract currently uses Upgrade-Name)
        { name: 'Name', value: params.name },
      ],
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
    params: {
      name: string;
      years: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Extend-Lease' },
        { name: 'Name', value: params.name },
        { name: 'Years', value: params.years.toString() },
      ],
    });
  }

  async increaseUndernameLimit(
    params: {
      name: string;
      increaseCount: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Increase-Undername-Limit' },
        { name: 'Name', value: params.name },
        { name: 'Quantity', value: params.increaseCount.toString() },
      ],
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

  async submitAuctionBid(
    params: {
      name: string;
      processId: string;
      quantity?: number;
      type?: 'lease' | 'permabuy';
      years?: number;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    const allTags = [
      ...tags,
      { name: 'Action', value: 'Auction-Bid' },
      { name: 'Name', value: params.name },
      { name: 'Process-Id', value: params.processId },
      { name: 'Quantity', value: params.quantity?.toString() ?? undefined },
      { name: 'Purchase-Type', value: params.type || 'lease' },
      { name: 'Years', value: params.years?.toString() ?? undefined },
    ];

    return this.process.send({
      signer: this.signer,
      tags: pruneTags(allTags),
    });
  }

  async requestPrimaryName(params: { name: string }): Promise<AoMessageResult> {
    return this.process.send({
      signer: this.signer,
      tags: [
        { name: 'Action', value: 'Request-Primary-Name' },
        { name: 'Name', value: params.name },
      ],
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
      stakeQty: number | mIOToken;
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
