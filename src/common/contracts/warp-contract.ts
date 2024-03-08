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
} from 'warp-contracts';

import { EvaluationParameters, SmartWeaveContract } from '../../types.js';
import { FailedRequestError } from '../error.js';

export class WarpContract<T> implements SmartWeaveContract<T> {
  private contract: Contract<T>;
  private contractTxId: string;
  private cacheUrl: string | undefined;

  constructor({
    contractTxId,
    cacheUrl,
    warp = WarpFactory.forMainnet({
      ...defaultCacheOptions,
      inMemory: true, // default to in memory for now, a custom warp implementation can be provided
    }),
  }: {
    contractTxId: string;
    cacheUrl?: string;
    warp: Warp;
  }) {
    this.contract = warp.contract<T>(contractTxId);
    this.cacheUrl = cacheUrl;
  }

  private async syncState() {
    // TODO: get contract manifest and set it before evaluating
    if (this.cacheUrl !== undefined) {
      await this.contract.syncState(
        `${this.cacheUrl}/v1/contract/${this.contractTxId}`,
        {
          validity: true,
        },
      );
    }
  }

  async getContractState({
    evaluationOptions = {},
  }: EvaluationParameters): Promise<T> {
    await this.syncState();
    const evalTo = evaluationOptions?.evalTo;
    let sortKeyOrBlockHeight: string | number | undefined;
    if (evalTo && 'sortKey' in evalTo) {
      sortKeyOrBlockHeight = evalTo.sortKey;
    } else if (evalTo && 'blockHeight') {
      sortKeyOrBlockHeight = evalTo.blockHeight;
    }

    const evaluationResult =
      await this.contract.readState(sortKeyOrBlockHeight);
    if (!evaluationResult.cachedValue.state) {
      throw new FailedRequestError(502, 'Failed to evaluate contract state');
    }
    return evaluationResult.cachedValue.state as T;
  }

  async readInteraction<I, K>({
    functionName,
    inputs,
    // TODO: view state only supports sort key so we won't be able to use block height
  }: EvaluationParameters<{ functionName: string; inputs: I }>): Promise<K> {
    const evaluationResult = await this.contract.viewState<unknown, K>({
      functionName,
      ...inputs,
    });
    if (!evaluationResult.result) {
      throw new FailedRequestError(
        502,
        'Failed to evaluate contract read interaction',
      );
    }
    return evaluationResult.result;
  }
}
