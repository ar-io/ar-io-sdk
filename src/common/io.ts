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
  AoArNSNameData,
  AoEpochData,
  AoEpochSettings,
  AoGateway,
  AoIORead,
  AoIOWrite,
  AoRegistrationFees,
  EpochInput,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../io.js';
import { AoSigner, mIOToken } from '../token.js';
import {
  AoArNSNameDataWithName,
  AoArNSReservedNameData,
  AoBalanceWithAddress,
  AoEpochDistributionData,
  AoEpochObservationData,
  AoGatewayWithAddress,
  AoJoinNetworkParams,
  AoMessageResult,
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
} from '../types.js';
import { createAoSigner } from '../utils/ao.js';
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
          (
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
      {
        name: 'Epoch-Index',
        value: (params as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<AoEpochSettings>({
      tags: prunedTags,
    });
  }
  async getEpoch(epoch?: EpochInput): Promise<AoEpochData> {
    const allTags = [
      { name: 'Action', value: 'Epoch' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (
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
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<AoEpochData>({
      tags: prunedTags,
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
    pageParams?: PaginationParams,
  ): Promise<PaginationResult<AoArNSNameDataWithName>> {
    const allTags = [
      { name: 'Action', value: 'Paginated-Records' },
      { name: 'Cursor', value: pageParams?.cursor?.toString() },
      { name: 'Limit', value: pageParams?.limit?.toString() },
      { name: 'Sort-By', value: pageParams?.sortBy },
      { name: 'Sort-Order', value: pageParams?.sortOrder },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<PaginationResult<AoArNSNameDataWithName>>({
      tags: prunedTags,
    });
  }

  async getArNSReservedNames(): Promise<
    Record<string, AoArNSReservedNameData> | Record<string, never>
  > {
    return this.process.read<Record<string, AoArNSReservedNameData>>({
      tags: [{ name: 'Action', value: 'Reserved-Names' }],
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
    pageParams?: PaginationParams,
  ): Promise<PaginationResult<AoBalanceWithAddress>> {
    const allTags = [
      { name: 'Action', value: 'Paginated-Balances' },
      { name: 'Cursor', value: pageParams?.cursor?.toString() },
      { name: 'Limit', value: pageParams?.limit?.toString() },
      { name: 'Sort-By', value: pageParams?.sortBy },
      { name: 'Sort-Order', value: pageParams?.sortOrder },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<PaginationResult<AoBalanceWithAddress>>({
      tags: prunedTags,
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

  async getGateways(
    pageParams?: PaginationParams,
  ): Promise<PaginationResult<AoGatewayWithAddress>> {
    const allTags = [
      { name: 'Action', value: 'Paginated-Gateways' },
      { name: 'Cursor', value: pageParams?.cursor?.toString() },
      { name: 'Limit', value: pageParams?.limit?.toString() },
      { name: 'Sort-By', value: pageParams?.sortBy },
      { name: 'Sort-Order', value: pageParams?.sortOrder },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<PaginationResult<AoGatewayWithAddress>>({
      tags: prunedTags,
    });
  }

  async getCurrentEpoch(): Promise<AoEpochData> {
    return this.process.read<AoEpochData>({
      tags: [
        { name: 'Action', value: 'Epoch' },
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
          (
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
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<AoWeightedObserver[]>({
      tags: prunedTags,
    });
  }

  async getPrescribedNames(epoch?: EpochInput): Promise<string[]> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Names' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (
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
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<string[]>({
      tags: prunedTags,
    });
  }

  async getObservations(epoch?: EpochInput): Promise<AoEpochObservationData> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Observations' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (
            await this.arweave.blocks
              .getCurrent()
              .then((block) => {
                return { timestamp: block.timestamp * 1000 };
              })
              .catch(() => {
                return { timestamp: `${Date.now()}` }; // fallback to current time
              })
          ).timestamp.toString(),
      },
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<AoEpochObservationData>({
      tags: prunedTags,
    });
  }

  async getDistributions(epoch?: EpochInput): Promise<AoEpochDistributionData> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Distributions' },
      {
        name: 'Timestamp',
        value:
          (epoch as { timestamp?: number })?.timestamp?.toString() ??
          (
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
      {
        name: 'Epoch-Index',
        value: (epoch as { epochIndex?: number })?.epochIndex?.toString(),
      },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<AoEpochDistributionData>({
      tags: prunedTags,
    });
  }

  async getTokenCost(params: {
    intent: 'Buy-Record';
    purchaseType: 'permabuy' | 'lease';
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
    purchaseType,
    years,
    name,
    quantity,
  }: {
    intent: 'Buy-Record' | 'Extend-Lease' | 'Increase-Undername-Limit';
    purchaseType?: 'permabuy' | 'lease';
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
        value: purchaseType,
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

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.read<number>({
      tags: prunedTags,
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

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.send({
      signer: this.signer,
      tags: prunedTags,
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
        name: 'Delegate-Reward-Share-Ratio',
        value: delegateRewardShareRatio?.toString(),
      },
      {
        name: 'Min-Delegated-Stake',
        value: minDelegatedStake?.valueOf().toString(),
      },
      { name: 'Auto-Stake', value: autoStake?.toString() },
    ];

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.send({
      signer: this.signer,
      tags: prunedTags,
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
      ],
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

    const prunedTags: { name: string; value: string }[] = allTags.filter(
      (tag: {
        name: string;
        value: string | undefined;
      }): tag is { name: string; value: string } => tag.value !== undefined,
    );

    return this.process.send({
      signer: this.signer,
      tags: prunedTags,
    });
  }

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

  async cancelDelegateWithdrawal(
    params: { address: string; vaultId: string },
    options?: WriteOptions | undefined,
  ): Promise<AoMessageResult> {
    const { tags = [] } = options || {};
    return this.process.send({
      signer: this.signer,
      tags: [
        ...tags,
        { name: 'Action', value: 'Cancel-Delegate-Withdrawal' },
        { name: 'Address', value: params.address },
        { name: 'Vault-Id', value: params.vaultId },
      ],
    });
  }
}
