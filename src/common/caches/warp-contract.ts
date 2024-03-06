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
import {
  Contract,
  Warp,
  WarpFactory,
  defaultCacheOptions,
} from 'warp-contracts/web';

import { SmartWeaveContract } from '../../types/index.js';

export const defaultWarpClient = WarpFactory.forMainnet({
  ...defaultCacheOptions,
  inMemory: true, // default to in memory for now, a custom warp implementation can be provided
});

export class WarpContract<T> implements SmartWeaveContract {
  private contract: Contract<T>;
  private contractTxId: string;
  private cacheUrl: string | undefined;

  constructor({
    contractTxId,
    cacheUrl,
    warp = defaultWarpClient,
  }: {
    cacheUrl?: string;
    warp: Warp;
    contractTxId: string;
  }) {
    // sync state
    this.contract = warp.contract<T>(contractTxId);
    this.cacheUrl = cacheUrl;
  }

  private async syncState() {
    if (this.cacheUrl !== undefined) {
      await this.contract.syncState(
        `${this.cacheUrl}/v1/contract/${this.contractTxId}`,
        {
          validity: true,
        },
      );
    }
  }

  async getContractState(): Promise<T> {
    await this.syncState();
    const evaluationResult = await this.contract.readState();
    if (!evaluationResult.cachedValue.state) {
      throw new Error('Contract state is not available');
    }
    return evaluationResult.cachedValue.state;
  }

  async readInteraction<K>({
    functionName,
    inputs,
  }: {
    functionName: string;
    inputs: object;
  }): Promise<K> {
    const evaluationResult = await this.contract.viewState<unknown, K>({
      functionName,
      ...inputs,
    });
    if (!evaluationResult.result) {
      throw new Error('Contract state is not available');
    }
    return evaluationResult.result;
  }
}
