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
import {
  AoPrimaryName,
  AoPrimaryNameRequest,
  WalletAddress,
} from '../types/index.js';
import { AOProcess } from './contracts/ao-process.js';
import { HB } from './hyperbeam/hb.js';
import { Logger } from './logger.js';

/**
 * Base interface for ARIO read providers
 */
export interface ARIOReadProvider {
  getBalance(params: { address: WalletAddress }): Promise<number>;
  getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest>;
  getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<AoPrimaryName>;
}

/**
 * Base interface for ARIO write providers
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ARIOWriteProvider {
  // Write methods will be added as they are implemented
  // Currently all write operations are stubbed
}

/**
 * HyperBeam provider for read operations
 */
export class ARIOHyperBEAMReadProvider implements ARIOReadProvider {
  constructor(
    public readonly hb: HB,
    private logger: Logger,
  ) {}

  async getBalance({ address }: { address: WalletAddress }): Promise<number> {
    this.logger.debug('Getting balance from HyperBEAM', { address });
    const res = await this.hb
      .compute<number>({
        path: `balances/${address}`,
      })
      .then((res) => Number(res))
      .catch((error) => {
        this.logger.error('Failed to get balance from HyperBEAM', {
          cause: error,
        });
        throw error;
      });
    return res;
  }

  async getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest> {
    this.logger.debug('Getting primary name request from HyperBEAM', {
      initiator: params.initiator,
    });
    const res = await this.hb
      .compute<Omit<AoPrimaryNameRequest, 'initiator'>>({
        path: `/primary-names/requests/${params.initiator}`,
      })
      .catch((error) => {
        this.logger.error('Failed to get primary name request from HyperBEAM', {
          cause: error,
        });
        throw error;
      });
    // Ensure initiator is included in the result
    return {
      ...res,
      initiator: params.initiator,
    };
  }

  // Stub methods for read operations not yet implemented in HyperBeam
  // All stub methods have unused parameters - this is intentional
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async getPrimaryName(
    _params: { address: WalletAddress } | { name: string },
  ): Promise<AoPrimaryName> {
    // This method is not fully implemented in HyperBeam provider because it requires
    // getArNSRecord which is not available here. Use ARIOCompositeReadProvider instead.
    throw new Error(
      'getPrimaryName requires getArNSRecord - use ARIOCompositeReadProvider',
    );
  }
  async getInfo(): Promise<never> {
    throw new Error('getInfo not implemented in HyperBeam provider');
  }

  async getTokenSupply(): Promise<never> {
    throw new Error('getTokenSupply not implemented in HyperBeam provider');
  }

  async getEpochSettings(): Promise<never> {
    throw new Error('getEpochSettings not implemented in HyperBeam provider');
  }

  async getGateway(_params: unknown): Promise<never> {
    throw new Error('getGateway not implemented in HyperBeam provider');
  }

  async getGatewayDelegates(_params: unknown): Promise<never> {
    throw new Error(
      'getGatewayDelegates not implemented in HyperBeam provider',
    );
  }

  async getGatewayDelegateAllowList(_params: unknown): Promise<never> {
    throw new Error(
      'getGatewayDelegateAllowList not implemented in HyperBeam provider',
    );
  }

  async getGateways(_params?: unknown): Promise<never> {
    throw new Error('getGateways not implemented in HyperBeam provider');
  }

  async getDelegations(_params: unknown): Promise<never> {
    throw new Error('getDelegations not implemented in HyperBeam provider');
  }

  async getAllowedDelegates(_params: unknown): Promise<never> {
    throw new Error(
      'getAllowedDelegates not implemented in HyperBeam provider',
    );
  }

  async getGatewayVaults(_params: unknown): Promise<never> {
    throw new Error('getGatewayVaults not implemented in HyperBeam provider');
  }

  async getBalances(_params?: unknown): Promise<never> {
    throw new Error('getBalances not implemented in HyperBeam provider');
  }

  async getArNSRecord(_params: unknown): Promise<never> {
    throw new Error('getArNSRecord not implemented in HyperBeam provider');
  }

  async getArNSRecords(_params?: unknown): Promise<never> {
    throw new Error('getArNSRecords not implemented in HyperBeam provider');
  }

  async getArNSRecordsForAddress(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSRecordsForAddress not implemented in HyperBeam provider',
    );
  }

  async getArNSReservedNames(_params?: unknown): Promise<never> {
    throw new Error(
      'getArNSReservedNames not implemented in HyperBeam provider',
    );
  }

  async getArNSReservedName(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSReservedName not implemented in HyperBeam provider',
    );
  }

  async getArNSReturnedNames(_params?: unknown): Promise<never> {
    throw new Error(
      'getArNSReturnedNames not implemented in HyperBeam provider',
    );
  }

  async getArNSReturnedName(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSReturnedName not implemented in HyperBeam provider',
    );
  }

  async getEpoch(_params?: unknown): Promise<never> {
    throw new Error('getEpoch not implemented in HyperBeam provider');
  }

  async getCurrentEpoch(): Promise<never> {
    throw new Error('getCurrentEpoch not implemented in HyperBeam provider');
  }

  async getPrescribedObservers(_params?: unknown): Promise<never> {
    throw new Error(
      'getPrescribedObservers not implemented in HyperBeam provider',
    );
  }

  async getPrescribedNames(_params?: unknown): Promise<never> {
    throw new Error('getPrescribedNames not implemented in HyperBeam provider');
  }

  async getObservations(_params?: unknown): Promise<never> {
    throw new Error('getObservations not implemented in HyperBeam provider');
  }

  async getDistributions(_params?: unknown): Promise<never> {
    throw new Error('getDistributions not implemented in HyperBeam provider');
  }

  async getEligibleEpochRewards(_params?: unknown): Promise<never> {
    throw new Error(
      'getEligibleEpochRewards not implemented in HyperBeam provider',
    );
  }

  async getTokenCost(_params: unknown): Promise<never> {
    throw new Error('getTokenCost not implemented in HyperBeam provider');
  }

  async getCostDetails(_params: unknown): Promise<never> {
    throw new Error('getCostDetails not implemented in HyperBeam provider');
  }

  async getRegistrationFees(): Promise<never> {
    throw new Error(
      'getRegistrationFees not implemented in HyperBeam provider',
    );
  }

  async getDemandFactor(): Promise<never> {
    throw new Error('getDemandFactor not implemented in HyperBeam provider');
  }

  async getDemandFactorSettings(): Promise<never> {
    throw new Error(
      'getDemandFactorSettings not implemented in HyperBeam provider',
    );
  }

  async getVaults(_params?: unknown): Promise<never> {
    throw new Error('getVaults not implemented in HyperBeam provider');
  }

  async getVault(_params: unknown): Promise<never> {
    throw new Error('getVault not implemented in HyperBeam provider');
  }

  async getPrimaryNameRequests(_params?: unknown): Promise<never> {
    throw new Error(
      'getPrimaryNameRequests not implemented in HyperBeam provider',
    );
  }

  async getPrimaryNames(_params?: unknown): Promise<never> {
    throw new Error('getPrimaryNames not implemented in HyperBeam provider');
  }

  async getRedelegationFee(_params: unknown): Promise<never> {
    throw new Error('getRedelegationFee not implemented in HyperBeam provider');
  }

  async getGatewayRegistrySettings(): Promise<never> {
    throw new Error(
      'getGatewayRegistrySettings not implemented in HyperBeam provider',
    );
  }

  async getAllDelegates(_params?: unknown): Promise<never> {
    throw new Error('getAllDelegates not implemented in HyperBeam provider');
  }

  async getAllGatewayVaults(_params?: unknown): Promise<never> {
    throw new Error(
      'getAllGatewayVaults not implemented in HyperBeam provider',
    );
  }

  async resolveArNSName(_params: unknown): Promise<never> {
    throw new Error('resolveArNSName not implemented in HyperBeam provider');
  }
}

/**
 * HyperBeam provider for write operations
 */
export class ARIOHyperBEAMWriteProvider implements ARIOWriteProvider {
  constructor(
    public readonly hb: HB,
    private logger: Logger,
  ) {}

  // Write operations are not yet implemented for HyperBeam
  // All write operations should use the legacy provider
  // Stub methods throw errors to indicate they're not implemented
  // All stub methods have unused parameters - this is intentional
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async transfer(_params: {
    target: WalletAddress;
    qty: number;
  }): Promise<never> {
    throw new Error('transfer not implemented in HyperBeam provider');
  }

  async vaultedTransfer(_params: unknown): Promise<never> {
    throw new Error('vaultedTransfer not implemented in HyperBeam provider');
  }

  async revokeVault(_params: unknown): Promise<never> {
    throw new Error('revokeVault not implemented in HyperBeam provider');
  }

  async createVault(_params: unknown): Promise<never> {
    throw new Error('createVault not implemented in HyperBeam provider');
  }

  async extendVault(_params: unknown): Promise<never> {
    throw new Error('extendVault not implemented in HyperBeam provider');
  }

  async increaseVault(_params: unknown): Promise<never> {
    throw new Error('increaseVault not implemented in HyperBeam provider');
  }

  async joinNetwork(_params: unknown): Promise<never> {
    throw new Error('joinNetwork not implemented in HyperBeam provider');
  }

  async leaveNetwork(_options?: unknown): Promise<never> {
    throw new Error('leaveNetwork not implemented in HyperBeam provider');
  }

  async updateGatewaySettings(_params: unknown): Promise<never> {
    throw new Error(
      'updateGatewaySettings not implemented in HyperBeam provider',
    );
  }

  async increaseOperatorStake(_params: unknown): Promise<never> {
    throw new Error(
      'increaseOperatorStake not implemented in HyperBeam provider',
    );
  }

  async decreaseOperatorStake(_params: unknown): Promise<never> {
    throw new Error(
      'decreaseOperatorStake not implemented in HyperBeam provider',
    );
  }

  async delegateStake(_params: unknown): Promise<never> {
    throw new Error('delegateStake not implemented in HyperBeam provider');
  }

  async decreaseDelegateStake(_params: unknown): Promise<never> {
    throw new Error(
      'decreaseDelegateStake not implemented in HyperBeam provider',
    );
  }

  async instantWithdrawal(_params: unknown): Promise<never> {
    throw new Error('instantWithdrawal not implemented in HyperBeam provider');
  }

  async saveObservations(_params: unknown): Promise<never> {
    throw new Error('saveObservations not implemented in HyperBeam provider');
  }

  async buyRecord(_params: unknown): Promise<never> {
    throw new Error('buyRecord not implemented in HyperBeam provider');
  }

  async upgradeRecord(_params: unknown): Promise<never> {
    throw new Error('upgradeRecord not implemented in HyperBeam provider');
  }

  async extendLease(_params: unknown): Promise<never> {
    throw new Error('extendLease not implemented in HyperBeam provider');
  }

  async increaseUndernameLimit(_params: unknown): Promise<never> {
    throw new Error(
      'increaseUndernameLimit not implemented in HyperBeam provider',
    );
  }

  async cancelWithdrawal(_params: unknown): Promise<never> {
    throw new Error('cancelWithdrawal not implemented in HyperBeam provider');
  }

  async requestPrimaryName(_params: unknown): Promise<never> {
    throw new Error('requestPrimaryName not implemented in HyperBeam provider');
  }

  async setPrimaryName(_params: unknown): Promise<never> {
    throw new Error('setPrimaryName not implemented in HyperBeam provider');
  }

  async redelegateStake(_params: unknown): Promise<never> {
    throw new Error('redelegateStake not implemented in HyperBeam provider');
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/**
 * Legacy provider for read operations (uses CU/process.read)
 */
export class ARIOLegacyReadProvider implements ARIOReadProvider {
  constructor(
    private process: AOProcess,
    private logger: Logger,
  ) {}

  async getBalance({ address }: { address: WalletAddress }): Promise<number> {
    return this.process.read<number>({
      tags: [
        { name: 'Action', value: 'Balance' },
        { name: 'Address', value: address },
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
      tags: allTags.filter((tag) => tag.value !== undefined),
    });
  }

  // Stub methods for read operations - these should be called on ARIOReadable
  // These methods throw errors to indicate they should be called on the main ARIO class
  // All stub methods have unused parameters - this is intentional
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async getInfo(): Promise<never> {
    throw new Error(
      'getInfo should be called on ARIOReadable, not directly on provider',
    );
  }

  async getTokenSupply(): Promise<never> {
    throw new Error(
      'getTokenSupply should be called on ARIOReadable, not directly on provider',
    );
  }

  async getEpochSettings(): Promise<never> {
    throw new Error(
      'getEpochSettings should be called on ARIOReadable, not directly on provider',
    );
  }

  async getGateway(_params: unknown): Promise<never> {
    throw new Error(
      'getGateway should be called on ARIOReadable, not directly on provider',
    );
  }

  async getGatewayDelegates(_params: unknown): Promise<never> {
    throw new Error(
      'getGatewayDelegates should be called on ARIOReadable, not directly on provider',
    );
  }

  async getGatewayDelegateAllowList(_params: unknown): Promise<never> {
    throw new Error(
      'getGatewayDelegateAllowList should be called on ARIOReadable, not directly on provider',
    );
  }

  async getGateways(_params?: unknown): Promise<never> {
    throw new Error(
      'getGateways should be called on ARIOReadable, not directly on provider',
    );
  }

  async getDelegations(_params: unknown): Promise<never> {
    throw new Error(
      'getDelegations should be called on ARIOReadable, not directly on provider',
    );
  }

  async getAllowedDelegates(_params: unknown): Promise<never> {
    throw new Error(
      'getAllowedDelegates should be called on ARIOReadable, not directly on provider',
    );
  }

  async getGatewayVaults(_params: unknown): Promise<never> {
    throw new Error(
      'getGatewayVaults should be called on ARIOReadable, not directly on provider',
    );
  }

  async getBalances(_params?: unknown): Promise<never> {
    throw new Error(
      'getBalances should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSRecord(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSRecord should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSRecords(_params?: unknown): Promise<never> {
    throw new Error(
      'getArNSRecords should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSRecordsForAddress(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSRecordsForAddress should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSReservedNames(_params?: unknown): Promise<never> {
    throw new Error(
      'getArNSReservedNames should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSReservedName(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSReservedName should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSReturnedNames(_params?: unknown): Promise<never> {
    throw new Error(
      'getArNSReturnedNames should be called on ARIOReadable, not directly on provider',
    );
  }

  async getArNSReturnedName(_params: unknown): Promise<never> {
    throw new Error(
      'getArNSReturnedName should be called on ARIOReadable, not directly on provider',
    );
  }

  async getEpoch(_params?: unknown): Promise<never> {
    throw new Error(
      'getEpoch should be called on ARIOReadable, not directly on provider',
    );
  }

  async getCurrentEpoch(): Promise<never> {
    throw new Error(
      'getCurrentEpoch should be called on ARIOReadable, not directly on provider',
    );
  }

  async getPrescribedObservers(_params?: unknown): Promise<never> {
    throw new Error(
      'getPrescribedObservers should be called on ARIOReadable, not directly on provider',
    );
  }

  async getPrescribedNames(_params?: unknown): Promise<never> {
    throw new Error(
      'getPrescribedNames should be called on ARIOReadable, not directly on provider',
    );
  }

  async getObservations(_params?: unknown): Promise<never> {
    throw new Error(
      'getObservations should be called on ARIOReadable, not directly on provider',
    );
  }

  async getDistributions(_params?: unknown): Promise<never> {
    throw new Error(
      'getDistributions should be called on ARIOReadable, not directly on provider',
    );
  }

  async getEligibleEpochRewards(_params?: unknown): Promise<never> {
    throw new Error(
      'getEligibleEpochRewards should be called on ARIOReadable, not directly on provider',
    );
  }

  async getTokenCost(_params: unknown): Promise<never> {
    throw new Error(
      'getTokenCost should be called on ARIOReadable, not directly on provider',
    );
  }

  async getCostDetails(_params: unknown): Promise<never> {
    throw new Error(
      'getCostDetails should be called on ARIOReadable, not directly on provider',
    );
  }

  async getRegistrationFees(): Promise<never> {
    throw new Error(
      'getRegistrationFees should be called on ARIOReadable, not directly on provider',
    );
  }

  async getDemandFactor(): Promise<never> {
    throw new Error(
      'getDemandFactor should be called on ARIOReadable, not directly on provider',
    );
  }

  async getDemandFactorSettings(): Promise<never> {
    throw new Error(
      'getDemandFactorSettings should be called on ARIOReadable, not directly on provider',
    );
  }

  async getVaults(_params?: unknown): Promise<never> {
    throw new Error(
      'getVaults should be called on ARIOReadable, not directly on provider',
    );
  }

  async getVault(_params: unknown): Promise<never> {
    throw new Error(
      'getVault should be called on ARIOReadable, not directly on provider',
    );
  }

  async getPrimaryNameRequests(_params?: unknown): Promise<never> {
    throw new Error(
      'getPrimaryNameRequests should be called on ARIOReadable, not directly on provider',
    );
  }

  async getPrimaryNames(_params?: unknown): Promise<never> {
    throw new Error(
      'getPrimaryNames should be called on ARIOReadable, not directly on provider',
    );
  }

  async getRedelegationFee(_params: unknown): Promise<never> {
    throw new Error(
      'getRedelegationFee should be called on ARIOReadable, not directly on provider',
    );
  }

  async getGatewayRegistrySettings(): Promise<never> {
    throw new Error(
      'getGatewayRegistrySettings should be called on ARIOReadable, not directly on provider',
    );
  }

  async getAllDelegates(_params?: unknown): Promise<never> {
    throw new Error(
      'getAllDelegates should be called on ARIOReadable, not directly on provider',
    );
  }

  async getAllGatewayVaults(_params?: unknown): Promise<never> {
    throw new Error(
      'getAllGatewayVaults should be called on ARIOReadable, not directly on provider',
    );
  }

  async resolveArNSName(_params: unknown): Promise<never> {
    throw new Error(
      'resolveArNSName should be called on ARIOReadable, not directly on provider',
    );
  }
}

/**
 * Legacy provider for write operations
 */
export class ARIOLegacyWriteProvider implements ARIOWriteProvider {
  constructor(
    private process: AOProcess,
    private logger: Logger,
  ) {}

  // Write operations are stubbed - actual implementation should be in ARIOWriteable
  // These methods throw errors to indicate they should be called on the main ARIO class
  // All stub methods have unused parameters - this is intentional
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async transfer(_params: {
    target: WalletAddress;
    qty: number;
  }): Promise<never> {
    throw new Error(
      'transfer should be called on ARIOWriteable, not directly on provider',
    );
  }

  async vaultedTransfer(_params: unknown): Promise<never> {
    throw new Error(
      'vaultedTransfer should be called on ARIOWriteable, not directly on provider',
    );
  }

  async revokeVault(_params: unknown): Promise<never> {
    throw new Error(
      'revokeVault should be called on ARIOWriteable, not directly on provider',
    );
  }

  async createVault(_params: unknown): Promise<never> {
    throw new Error(
      'createVault should be called on ARIOWriteable, not directly on provider',
    );
  }

  async extendVault(_params: unknown): Promise<never> {
    throw new Error(
      'extendVault should be called on ARIOWriteable, not directly on provider',
    );
  }

  async increaseVault(_params: unknown): Promise<never> {
    throw new Error(
      'increaseVault should be called on ARIOWriteable, not directly on provider',
    );
  }

  async joinNetwork(_params: unknown): Promise<never> {
    throw new Error(
      'joinNetwork should be called on ARIOWriteable, not directly on provider',
    );
  }

  async leaveNetwork(_options?: unknown): Promise<never> {
    throw new Error(
      'leaveNetwork should be called on ARIOWriteable, not directly on provider',
    );
  }

  async updateGatewaySettings(_params: unknown): Promise<never> {
    throw new Error(
      'updateGatewaySettings should be called on ARIOWriteable, not directly on provider',
    );
  }

  async increaseOperatorStake(_params: unknown): Promise<never> {
    throw new Error(
      'increaseOperatorStake should be called on ARIOWriteable, not directly on provider',
    );
  }

  async decreaseOperatorStake(_params: unknown): Promise<never> {
    throw new Error(
      'decreaseOperatorStake should be called on ARIOWriteable, not directly on provider',
    );
  }

  async delegateStake(_params: unknown): Promise<never> {
    throw new Error(
      'delegateStake should be called on ARIOWriteable, not directly on provider',
    );
  }

  async decreaseDelegateStake(_params: unknown): Promise<never> {
    throw new Error(
      'decreaseDelegateStake should be called on ARIOWriteable, not directly on provider',
    );
  }

  async instantWithdrawal(_params: unknown): Promise<never> {
    throw new Error(
      'instantWithdrawal should be called on ARIOWriteable, not directly on provider',
    );
  }

  async saveObservations(_params: unknown): Promise<never> {
    throw new Error(
      'saveObservations should be called on ARIOWriteable, not directly on provider',
    );
  }

  async buyRecord(_params: unknown): Promise<never> {
    throw new Error(
      'buyRecord should be called on ARIOWriteable, not directly on provider',
    );
  }

  async upgradeRecord(_params: unknown): Promise<never> {
    throw new Error(
      'upgradeRecord should be called on ARIOWriteable, not directly on provider',
    );
  }

  async extendLease(_params: unknown): Promise<never> {
    throw new Error(
      'extendLease should be called on ARIOWriteable, not directly on provider',
    );
  }

  async increaseUndernameLimit(_params: unknown): Promise<never> {
    throw new Error(
      'increaseUndernameLimit should be called on ARIOWriteable, not directly on provider',
    );
  }

  async cancelWithdrawal(_params: unknown): Promise<never> {
    throw new Error(
      'cancelWithdrawal should be called on ARIOWriteable, not directly on provider',
    );
  }

  async requestPrimaryName(_params: unknown): Promise<never> {
    throw new Error(
      'requestPrimaryName should be called on ARIOWriteable, not directly on provider',
    );
  }

  async setPrimaryName(_params: unknown): Promise<never> {
    throw new Error(
      'setPrimaryName should be called on ARIOWriteable, not directly on provider',
    );
  }

  async redelegateStake(_params: unknown): Promise<never> {
    throw new Error(
      'redelegateStake should be called on ARIOWriteable, not directly on provider',
    );
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/**
 * Composite provider that handles routing and fallback strategy
 */
export class ARIOCompositeReadProvider implements ARIOReadProvider {
  private hyperbeamProvider: ARIOHyperBEAMReadProvider | null = null;
  private legacyProvider: ARIOLegacyReadProvider;

  constructor(
    private process: AOProcess,
    private logger: Logger,
    private getArNSRecordFn: (params: { name: string }) => Promise<{
      processId: string;
    }>,
    hb?: HB,
  ) {
    this.legacyProvider = new ARIOLegacyReadProvider(process, logger);
    if (hb) {
      this.hyperbeamProvider = new ARIOHyperBEAMReadProvider(hb, logger);
    }
  }

  async getBalance({ address }: { address: WalletAddress }): Promise<number> {
    if (
      this.hyperbeamProvider &&
      (await this.hyperbeamProvider.hb.checkHyperBeamCompatibility())
    ) {
      try {
        return await this.hyperbeamProvider.getBalance({ address });
      } catch (error) {
        this.logger.info(
          'Failed to get balance from HyperBEAM, failing over to CU read',
          { address },
        );
        // Fall through to legacy
      }
    }
    return this.legacyProvider.getBalance({ address });
  }

  async getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<AoPrimaryNameRequest> {
    if (
      this.hyperbeamProvider &&
      (await this.hyperbeamProvider.hb.checkHyperBeamCompatibility())
    ) {
      try {
        return await this.hyperbeamProvider.getPrimaryNameRequest(params);
      } catch (error) {
        this.logger.info(
          'Failed to get primary name request from HyperBEAM, failing over to CU read',
          { initiator: params.initiator },
        );
        // Fall through to legacy
      }
    }
    return this.legacyProvider.getPrimaryNameRequest(params);
  }

  async getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<AoPrimaryName> {
    if (
      this.hyperbeamProvider &&
      (await this.hyperbeamProvider.hb.checkHyperBeamCompatibility())
    ) {
      try {
        // For getPrimaryName, we need special handling because HyperBeam
        // doesn't return processId, so we need to combine with getArNSRecord
        let owner: WalletAddress;

        if ('name' in params) {
          // Step 1: Get owner from /primary-names/names/<name>
          owner = await this.hyperbeamProvider.hb.compute<WalletAddress>({
            path: `/primary-names/names/${params.name}`,
          });
        } else {
          owner = params.address;
        }

        // Step 2: Get {name, startTimestamp} from /primary-names/owners/<owner>
        const ownerData = await this.hyperbeamProvider.hb.compute<{
          name: string;
          startTimestamp: number;
        }>({
          path: `/primary-names/owners/${owner}`,
        });
        const name = ownerData.name;
        const startTimestamp = ownerData.startTimestamp;

        // Step 3: Get processId from getArNSRecordFn
        const record = await this.getArNSRecordFn({ name });
        const processId = record.processId;

        // Combine all data
        return {
          owner,
          name,
          startTimestamp,
          processId,
        };
      } catch (error) {
        this.logger.info(
          'Failed to get primary name from HyperBEAM, failing over to CU read',
          { params },
        );
        // Fall through to legacy
      }
    }
    return this.legacyProvider.getPrimaryName(params);
  }

  // Stub methods for read operations not yet implemented
  // These delegate to legacy provider (since HyperBeam doesn't support them yet)
  async getInfo(): Promise<never> {
    return this.legacyProvider.getInfo();
  }

  async getTokenSupply(): Promise<never> {
    return this.legacyProvider.getTokenSupply();
  }

  async getEpochSettings(): Promise<never> {
    return this.legacyProvider.getEpochSettings();
  }

  async getGateway(params: unknown): Promise<never> {
    return this.legacyProvider.getGateway(params);
  }

  async getGatewayDelegates(params: unknown): Promise<never> {
    return this.legacyProvider.getGatewayDelegates(params);
  }

  async getGatewayDelegateAllowList(params: unknown): Promise<never> {
    return this.legacyProvider.getGatewayDelegateAllowList(params);
  }

  async getGateways(params?: unknown): Promise<never> {
    return this.legacyProvider.getGateways(params);
  }

  async getDelegations(params: unknown): Promise<never> {
    return this.legacyProvider.getDelegations(params);
  }

  async getAllowedDelegates(params: unknown): Promise<never> {
    return this.legacyProvider.getAllowedDelegates(params);
  }

  async getGatewayVaults(params: unknown): Promise<never> {
    return this.legacyProvider.getGatewayVaults(params);
  }

  async getBalances(params?: unknown): Promise<never> {
    return this.legacyProvider.getBalances(params);
  }

  async getArNSRecord(params: unknown): Promise<never> {
    return this.legacyProvider.getArNSRecord(params);
  }

  async getArNSRecords(params?: unknown): Promise<never> {
    return this.legacyProvider.getArNSRecords(params);
  }

  async getArNSRecordsForAddress(params: unknown): Promise<never> {
    return this.legacyProvider.getArNSRecordsForAddress(params);
  }

  async getArNSReservedNames(params?: unknown): Promise<never> {
    return this.legacyProvider.getArNSReservedNames(params);
  }

  async getArNSReservedName(params: unknown): Promise<never> {
    return this.legacyProvider.getArNSReservedName(params);
  }

  async getArNSReturnedNames(params?: unknown): Promise<never> {
    return this.legacyProvider.getArNSReturnedNames(params);
  }

  async getArNSReturnedName(params: unknown): Promise<never> {
    return this.legacyProvider.getArNSReturnedName(params);
  }

  async getEpoch(params?: unknown): Promise<never> {
    return this.legacyProvider.getEpoch(params);
  }

  async getCurrentEpoch(): Promise<never> {
    return this.legacyProvider.getCurrentEpoch();
  }

  async getPrescribedObservers(params?: unknown): Promise<never> {
    return this.legacyProvider.getPrescribedObservers(params);
  }

  async getPrescribedNames(params?: unknown): Promise<never> {
    return this.legacyProvider.getPrescribedNames(params);
  }

  async getObservations(params?: unknown): Promise<never> {
    return this.legacyProvider.getObservations(params);
  }

  async getDistributions(params?: unknown): Promise<never> {
    return this.legacyProvider.getDistributions(params);
  }

  async getEligibleEpochRewards(params?: unknown): Promise<never> {
    return this.legacyProvider.getEligibleEpochRewards(params);
  }

  async getTokenCost(params: unknown): Promise<never> {
    return this.legacyProvider.getTokenCost(params);
  }

  async getCostDetails(params: unknown): Promise<never> {
    return this.legacyProvider.getCostDetails(params);
  }

  async getRegistrationFees(): Promise<never> {
    return this.legacyProvider.getRegistrationFees();
  }

  async getDemandFactor(): Promise<never> {
    return this.legacyProvider.getDemandFactor();
  }

  async getDemandFactorSettings(): Promise<never> {
    return this.legacyProvider.getDemandFactorSettings();
  }

  async getVaults(params?: unknown): Promise<never> {
    return this.legacyProvider.getVaults(params);
  }

  async getVault(params: unknown): Promise<never> {
    return this.legacyProvider.getVault(params);
  }

  async getPrimaryNameRequests(params?: unknown): Promise<never> {
    return this.legacyProvider.getPrimaryNameRequests(params);
  }

  async getPrimaryNames(params?: unknown): Promise<never> {
    return this.legacyProvider.getPrimaryNames(params);
  }

  async getRedelegationFee(params: unknown): Promise<never> {
    return this.legacyProvider.getRedelegationFee(params);
  }

  async getGatewayRegistrySettings(): Promise<never> {
    return this.legacyProvider.getGatewayRegistrySettings();
  }

  async getAllDelegates(params?: unknown): Promise<never> {
    return this.legacyProvider.getAllDelegates(params);
  }

  async getAllGatewayVaults(params?: unknown): Promise<never> {
    return this.legacyProvider.getAllGatewayVaults(params);
  }

  async resolveArNSName(params: unknown): Promise<never> {
    return this.legacyProvider.resolveArNSName(params);
  }
}

/**
 * Composite provider for write operations
 */
export class ARIOCompositeWriteProvider implements ARIOWriteProvider {
  private hyperbeamProvider: ARIOHyperBEAMWriteProvider | null = null;
  private legacyProvider: ARIOLegacyWriteProvider;

  constructor(
    private process: AOProcess,
    private logger: Logger,
    hb?: HB,
  ) {
    this.legacyProvider = new ARIOLegacyWriteProvider(process, logger);
    if (hb) {
      this.hyperbeamProvider = new ARIOHyperBEAMWriteProvider(hb, logger);
    }
  }

  // Write operations are stubbed - actual implementation should be in ARIOWriteable
  // These methods delegate to legacy provider (since HyperBeam doesn't support writes yet)
  async transfer(params: {
    target: WalletAddress;
    qty: number;
  }): Promise<never> {
    return this.legacyProvider.transfer(params);
  }

  async vaultedTransfer(params: unknown): Promise<never> {
    return this.legacyProvider.vaultedTransfer(params);
  }

  async revokeVault(params: unknown): Promise<never> {
    return this.legacyProvider.revokeVault(params);
  }

  async createVault(params: unknown): Promise<never> {
    return this.legacyProvider.createVault(params);
  }

  async extendVault(params: unknown): Promise<never> {
    return this.legacyProvider.extendVault(params);
  }

  async increaseVault(params: unknown): Promise<never> {
    return this.legacyProvider.increaseVault(params);
  }

  async joinNetwork(params: unknown): Promise<never> {
    return this.legacyProvider.joinNetwork(params);
  }

  async leaveNetwork(options?: unknown): Promise<never> {
    return this.legacyProvider.leaveNetwork(options);
  }

  async updateGatewaySettings(params: unknown): Promise<never> {
    return this.legacyProvider.updateGatewaySettings(params);
  }

  async increaseOperatorStake(params: unknown): Promise<never> {
    return this.legacyProvider.increaseOperatorStake(params);
  }

  async decreaseOperatorStake(params: unknown): Promise<never> {
    return this.legacyProvider.decreaseOperatorStake(params);
  }

  async delegateStake(params: unknown): Promise<never> {
    return this.legacyProvider.delegateStake(params);
  }

  async decreaseDelegateStake(params: unknown): Promise<never> {
    return this.legacyProvider.decreaseDelegateStake(params);
  }

  async instantWithdrawal(params: unknown): Promise<never> {
    return this.legacyProvider.instantWithdrawal(params);
  }

  async saveObservations(params: unknown): Promise<never> {
    return this.legacyProvider.saveObservations(params);
  }

  async buyRecord(params: unknown): Promise<never> {
    return this.legacyProvider.buyRecord(params);
  }

  async upgradeRecord(params: unknown): Promise<never> {
    return this.legacyProvider.upgradeRecord(params);
  }

  async extendLease(params: unknown): Promise<never> {
    return this.legacyProvider.extendLease(params);
  }

  async increaseUndernameLimit(params: unknown): Promise<never> {
    return this.legacyProvider.increaseUndernameLimit(params);
  }

  async cancelWithdrawal(params: unknown): Promise<never> {
    return this.legacyProvider.cancelWithdrawal(params);
  }

  async requestPrimaryName(params: unknown): Promise<never> {
    return this.legacyProvider.requestPrimaryName(params);
  }

  async setPrimaryName(params: unknown): Promise<never> {
    return this.legacyProvider.setPrimaryName(params);
  }

  async redelegateStake(params: unknown): Promise<never> {
    return this.legacyProvider.redelegateStake(params);
  }
}
