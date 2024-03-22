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
import { DataItem, Signer, Transaction } from 'arbundles';
import {
  Contract,
  LoggerFactory,
  Warp,
  WarpFactory,
  defaultCacheOptions,
} from 'warp-contracts';

import {
  BaseContract,
  ContractSigner,
  EvaluationParameters,
  ReadContract,
  WriteContract,
} from '../../types.js';
import { isDataItem, isTransaction } from '../../utils/arweave.js';
import { FailedRequestError, WriteInteractionError } from '../error.js';

LoggerFactory.INST.setOptions({
  logLevel: 'fatal',
});

export class WarpContract<T>
  implements BaseContract<T>, ReadContract, WriteContract
{
  private contract: Contract<T>;
  private contractTxId: string;
  private cacheUrl: string | undefined;

  constructor({
    contractTxId,
    cacheUrl,
    warp = WarpFactory.forMainnet(
      {
        ...defaultCacheOptions,
        inMemory: true, // default to in memory for now, a custom warp implementation can be provided
      },
      true,
    ),
  }: {
    contractTxId: string;
    cacheUrl?: string;
    warp?: Warp;
    signer?: ContractSigner;
  }) {
    this.contractTxId = contractTxId;
    this.contract = warp.contract<T>(contractTxId);
    this.cacheUrl = cacheUrl;
  }

  configuration(): { contractTxId: string; cacheUrl: string | undefined } {
    return {
      contractTxId: this.contractTxId,
      cacheUrl: this.cacheUrl,
    };
  }

  // base contract methods
  connect(signer: ContractSigner) {
    // TODO: Update type to use Signer interface
    this.contract = this.contract.connect(signer as Signer);
    return this;
  }
  async getState({ evaluationOptions = {} }: EvaluationParameters): Promise<T> {
    await this.syncState();
    const evalTo = evaluationOptions?.evalTo;
    let sortKeyOrBlockHeight: string | number | undefined;
    if (evalTo && 'sortKey' in evalTo) {
      sortKeyOrBlockHeight = evalTo.sortKey;
    } else if (evalTo && 'blockHeight' in evalTo) {
      sortKeyOrBlockHeight = evalTo.blockHeight;
    }

    const evaluationResult =
      await this.contract.readState(sortKeyOrBlockHeight);
    if (!evaluationResult.cachedValue.state) {
      throw new FailedRequestError(502, 'Failed to evaluate contract state');
    }
    return evaluationResult.cachedValue.state as T;
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

  async readInteraction<I, K>({
    functionName,
    inputs,
    // TODO: view state only supports sort key so we won't be able to use block height
  }: EvaluationParameters<{ functionName: string; inputs: I }>): Promise<K> {
    const evaluationResult = await this.contract.viewState<unknown, K>({
      function: functionName,
      ...inputs,
    });

    if (!evaluationResult.result) {
      throw new FailedRequestError(
        502,
        'Failed to evaluate contract read interaction: ' +
          JSON.stringify(
            { error: evaluationResult.errorMessage, functionName, inputs },
            null,
            2,
          ),
      );
    }

    return evaluationResult.result;
  }

  async writeInteraction<Input>({
    functionName,
    inputs,
  }: EvaluationParameters<{
    functionName: string;
    inputs: Input;
  }>): Promise<Transaction | DataItem> {
    // Sync state before writing
    await this.syncState();
    const { interactionTx } =
      (await this.contract.writeInteraction<Input>({
        function: functionName,
        ...inputs,
      })) ?? {};

    if (!interactionTx) {
      throw new WriteInteractionError(
        `Failed to write contract interaction ${functionName}`,
      );
    }
    // Flexible way to return information on the transaction, aids in caching and redoployment if desired by simply refetching tx anchor and resigning.
    if (isTransaction(interactionTx)) {
      return interactionTx as Transaction;
    } else if (isDataItem(interactionTx)) {
      return interactionTx as DataItem;
    }

    throw new WriteInteractionError(
      `Failed to write contract interaction ${functionName}`,
    );
  }
}
