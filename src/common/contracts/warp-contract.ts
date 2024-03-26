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
import { DataItem, Signer } from 'warp-arbundles';
import {
  Contract,
  InteractionResult,
  LoggerFactory,
  Transaction,
  Warp,
  WarpFactory,
  defaultCacheOptions,
} from 'warp-contracts';

import { defaultArweave } from '../../constants.js';
import {
  BaseContract,
  ContractSigner,
  EvaluationParameters,
  Logger,
  ReadContract,
  WriteContract,
  WriteParameters,
} from '../../types.js';
import { getContractManifest } from '../../utils/smartweave.js';
import { FailedRequestError, WriteInteractionError } from '../error.js';
import { DefaultLogger } from '../logger.js';

LoggerFactory.INST.setOptions({
  logLevel: 'fatal',
});

export class WarpContract<T>
  implements BaseContract<T>, ReadContract, WriteContract
{
  private contract: Contract<T>;
  private contractTxId: string;
  private cacheUrl: string | undefined;
  private arweave: Arweave;
  private log: Logger;
  private signer: ContractSigner | undefined;

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
    signer,
    arweave = defaultArweave,
    log = new DefaultLogger({
      level: 'debug',
    }),
  }: {
    contractTxId: string;
    cacheUrl?: string;
    warp?: Warp;
    signer?: ContractSigner;
    arweave?: Arweave;
    log?: Logger;
  }) {
    this.contractTxId = contractTxId;
    this.contract = warp.contract<T>(contractTxId);
    this.cacheUrl = cacheUrl;
    this.arweave = arweave;
    this.log = log;
    if (signer) {
      this.connect(signer);
    }
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
    this.signer = signer;
    this.contract = this.contract.connect(signer as Signer);
    return this;
  }
  async getState({ evaluationOptions = {} }: EvaluationParameters): Promise<T> {
    await this.ensureContractInit();
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

  async ensureContractInit(): Promise<void> {
    this.log.debug(`Checking contract initialized`, {
      contractTxId: this.contractTxId,
    });

    // Get contact manifest and sync state
    const { evaluationOptions = {} } = await getContractManifest({
      arweave: this.arweave,
      contractTxId: this.contractTxId,
    });
    this.contract.setEvaluationOptions(evaluationOptions);
    await this.syncState();
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
    dryWrite = true,
  }: EvaluationParameters<WriteParameters<Input>>): Promise<
    Transaction | DataItem | InteractionResult<unknown, unknown>
  > {
    try {
      if (!this.signer) {
        throw new Error(
          'Contract not connected - call .connect(signer) to connect a signer for write interactions ',
        );
      }
      this.log.debug(`Write interaction: ${functionName}`, {
        contractTxId: this.contractTxId,
      });
      // Sync state before writing
      await this.ensureContractInit();

      // run dry write before actual write
      const result = await this.contract.dryWrite<Input>({
        function: functionName,
        ...inputs,
      });
      if (result.type !== 'ok') {
        throw new Error(
          `Failed to dry write contract interaction ${functionName}: ${result.errorMessage}`,
        );
      }

      if (dryWrite) {
        this.log.debug(`Dry write interaction successful`, {
          contractTxId: this.contractTxId,
          functionName,
        });
        return result;
      }

      const writeResult = await this.contract.writeInteraction<Input>({
        function: functionName,
        ...inputs,
      });

      if (!writeResult?.interactionTx) {
        throw new Error(`Failed to write contract interaction ${functionName}`);
      }

      return writeResult.interactionTx;
    } catch (error) {
      throw new WriteInteractionError(error);
    }
  }
}
