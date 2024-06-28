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
import Arweave from 'arweave';

import { ioDevnetProcessId } from '../constants.js';
import {
  ArNSReservedNameData,
  EpochDistributionData,
  EpochObservations,
  WeightedObserver,
} from '../contract-state.js';
import {
  AoArNSNameData,
  AoEpochData,
  AoGateway,
  AoIORead,
  AoIOWrite,
  EpochInput,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../io.js';
import { mIOToken } from '../token.js';
import {
  AoMessageResult,
  ContractSigner,
  JoinNetworkParams,
  OptionalSigner,
  ProcessConfiguration,
  TransactionId,
  UpdateGatewaySettingsParams,
  WalletAddress,
  WithSigner,
  WriteOptions,
} from '../types.js';
import { AOProcess } from './contracts/ao-process.js';
import { InvalidContractConfigurationError } from './error.js';
import { DefaultLogger } from './logger.js';

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

  constructor(config?: ProcessConfiguration, arweave = Arweave.init({})) {
    if (!config) {
      this.process = new AOProcess({
        processId: ioDevnetProcessId,
      });
    } else if (isProcessConfiguration(config)) {
      this.process = config.process;
    } else if (isProcessIdConfiguration(config)) {
      this.process = new AOProcess({
        processId: config.processId,
        logger: new DefaultLogger({
          level: 'info',
        }),
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
  }> {
    return this.process.read<{
      Name: string;
      Ticker: string;
      Logo: string;
      Denomination: number;
    }>({
      tags: [{ name: 'Action', value: 'Info' }],
    });
  }
  async getEpoch(epoch?: EpochInput): Promise<AoEpochData> {
    const allTags = [
      { name: 'Action', value: 'Epoch' },
      {
        // TODO: default this to the current network time
        name: 'Timestamp',
        value: (epoch as { timestamp?: number }).timestamp?.toString() ?? '',
      },
      {
        name: 'Block-Height',
        value: (epoch as { blockHeight?: number })?.blockHeight?.toString(),
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

    // if it only contains the action, add default timestamp
    if (prunedTags.length === 1) {
      prunedTags.push({
        name: 'Timestamp',
        value: (await this.arweave.blocks.getCurrent()).timestamp.toString(),
      });
    }

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

  async getArNSRecords(): Promise<Record<string, AoArNSNameData>> {
    return this.process.read<Record<string, AoArNSNameData>>({
      tags: [{ name: 'Action', value: 'Records' }],
    });
  }

  async getArNSReservedNames(): Promise<
    Record<string, ArNSReservedNameData> | Record<string, never>
  > {
    return this.process.read<Record<string, ArNSReservedNameData>>({
      tags: [{ name: 'Action', value: 'Reserved-Names' }],
    });
  }

  async getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<ArNSReservedNameData | undefined> {
    return this.process.read<ArNSReservedNameData>({
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

  async getBalances(): Promise<Record<WalletAddress, number>> {
    return this.process.read<Record<string, number>>({
      tags: [{ name: 'Action', value: 'Balances' }],
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

  async getGateways(): Promise<
    Record<string, AoGateway> | Record<string, never>
  > {
    return this.process.read<Record<string, AoGateway>>({
      tags: [{ name: 'Action', value: 'Gateways' }],
    });
  }

  async getCurrentEpoch(): Promise<AoEpochData> {
    return this.process.read<AoEpochData>({
      tags: [
        { name: 'Action', value: 'Epoch' },
        { name: 'Timestamp', value: `${Date.now()}` },
      ],
    });
  }

  async getPrescribedObservers(
    epoch?: EpochInput,
  ): Promise<WeightedObserver[]> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Observers' },
      {
        name: 'Timestamp',
        value: (epoch as { timestamp?: number }).timestamp?.toString(),
      },
      {
        name: 'Block-Height',
        value: (epoch as { blockHeight?: number })?.blockHeight?.toString(),
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

    // if it only contains the action, add default timestamp
    if (prunedTags.length === 1) {
      prunedTags.push({
        name: 'Timestamp',
        value: `${Date.now()}`,
      });
    }

    return this.process.read<WeightedObserver[]>({
      tags: prunedTags,
    });
  }

  async getPrescribedNames(epoch?: EpochInput): Promise<string[]> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Prescribed-Names' },
      {
        name: 'Timestamp',
        value: (epoch as { timestamp?: number }).timestamp?.toString(),
      },
      {
        name: 'Block-Height',
        value: (epoch as { blockHeight?: number })?.blockHeight?.toString(),
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

    // if it only contains the action, add default timestamp
    if (prunedTags.length === 1) {
      prunedTags.push({
        name: 'Timestamp',
        value: `${Date.now()}`, // TODO; replace with fetch the current network time
      });
    }

    return this.process.read<string[]>({
      tags: prunedTags,
    });
  }

  async getObservations(epoch?: EpochInput): Promise<EpochObservations> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Observations' },
      {
        name: 'Timestamp',
        value: (epoch as { timestamp?: number }).timestamp?.toString(),
      },
      {
        name: 'Block-Height',
        value: (epoch as { blockHeight?: number })?.blockHeight?.toString(),
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

    // if it only contains the action, add default timestamp
    if (prunedTags.length === 1) {
      prunedTags.push({
        name: 'Timestamp',
        value: (await this.arweave.blocks.getCurrent()).timestamp.toString(),
      });
    }

    return this.process.read<EpochObservations>({
      tags: prunedTags,
    });
  }

  async getDistributions(epoch?: EpochInput): Promise<EpochDistributionData> {
    const allTags = [
      { name: 'Action', value: 'Epoch-Distributions' },
      {
        name: 'Timestamp',
        value: (epoch as { timestamp?: number }).timestamp?.toString() ?? '',
      },
      {
        name: 'Block-Height',
        value: (epoch as { blockHeight?: number })?.blockHeight?.toString(),
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

    // if it only contains the action, add default timestamp
    if (prunedTags.length === 1) {
      prunedTags.push({
        name: 'Timestamp',
        value: (await this.arweave.blocks.getCurrent()).timestamp.toString(),
      });
    }
    return this.process.read<EpochDistributionData>({
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
        value: `${Date.now()}`,
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
}

export class IOWriteable extends IOReadable implements AoIOWrite {
  protected declare process: AOProcess;
  private signer: ContractSigner;
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
          processId: ioDevnetProcessId,
        }),
      });
      this.signer = signer;
    } else if (isProcessConfiguration(config)) {
      super({ process: config.process });
      this.signer = signer;
    } else if (isProcessIdConfiguration(config)) {
      super({
        process: new AOProcess({
          processId: config.processId,
        }),
      });
      this.signer = signer;
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
    }: Omit<JoinNetworkParams, 'observerWallet' | 'qty'> & {
      observerAddress: string;
      operatorStake: number | mIOToken;
    },
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
        value: allowDelegatedStaking.toString(),
      },
      {
        name: 'Delegate-Reward-Share-Ratio',
        value: delegateRewardShareRatio.toString(),
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
        value: minDelegatedStake.valueOf().toString(),
      },
      {
        name: 'Note',
        value: note,
      },
      {
        name: 'Port',
        value: port.toString(),
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
        value: autoStake.toString(),
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
    }: Omit<UpdateGatewaySettingsParams, 'observerWallet'> & {
      observerAddress: string;
    },
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
    return this.process.send<
      {
        reportTxId: TransactionId;
        failedGateways: WalletAddress[];
      },
      never
    >({
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
      data: {
        reportTxId: params.reportTxId,
        failedGateways: params.failedGateways,
      },
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
}
