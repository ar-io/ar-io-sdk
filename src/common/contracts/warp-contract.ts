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
import { ArconnectSigner } from 'arbundles';
import {
  Contract,
  CustomSignature,
  LoggerFactory,
  Signature,
  Transaction,
  Warp,
} from 'warp-contracts';

import {
  BaseContract,
  ContractSigner,
  EvaluationParameters,
  Logger,
  OptionalSigner,
  ReadContract,
  WriteContract,
  WriteInteractionResult,
  WriteParameters,
} from '../../types.js';
import { sha256B64Url, toB64Url } from '../../utils/base64.js';
import { getContractManifest } from '../../utils/smartweave.js';
import { FailedRequestError, WriteInteractionError } from '../error.js';
import { DefaultLogger } from '../logger.js';
import { defaultWarp } from '../warp.js';

LoggerFactory.INST.logLevel('fatal');

export class WarpContract<T>
  implements BaseContract<T>, ReadContract, WriteContract
{
  private contract: Contract<T>;
  private contractTxId: string;
  private cacheUrl: string | undefined;
  private logger: Logger;
  private warp: Warp;

  constructor({
    contractTxId,
    cacheUrl = 'https://api.arns.app',
    warp = defaultWarp,
    logger = new DefaultLogger({
      level: 'info',
    }),
  }: {
    contractTxId: string;
    cacheUrl?: string;
    warp?: Warp;
    logger?: Logger;
  }) {
    this.contractTxId = contractTxId;
    this.contract = warp.contract(contractTxId);
    this.cacheUrl = cacheUrl;
    this.warp = warp;
    this.logger = logger;
  }

  configuration(): { contractTxId: string; cacheUrl: string | undefined } {
    return {
      contractTxId: this.contractTxId,
      cacheUrl: this.cacheUrl,
    };
  }

  // TODO: could abstract into our own interface that constructs different signers
  async createWarpSigner(signer: ContractSigner): Promise<CustomSignature> {
    // ensure appropriate permissions are granted with injected signers.
    if (signer.publicKey === undefined && signer instanceof ArconnectSigner) {
      await signer.setPublicKey();
    }
    const warpSigner = new Signature(this.warp, {
      signer: async (tx: Transaction) => {
        const publicKey = await signer.publicKey;
        const dataToSign = await tx.getSignatureData();
        const signatureUint8Array = await signer.sign(dataToSign);
        const signatureBuffer = Buffer.from(signatureUint8Array);
        const id = sha256B64Url(signatureBuffer);
        tx.setSignature({
          id: id,
          owner: toB64Url(publicKey),
          signature: toB64Url(signatureBuffer),
        });
      },
      type: 'arweave',
    });
    return warpSigner;
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

  async ensureContractInit({ signer }: OptionalSigner = {}): Promise<void> {
    this.logger.debug(`Checking contract initialized`, {
      contractTxId: this.contractTxId,
    });

    // Get contact manifest and sync state
    this.logger.debug(`Fetching contract manifest`, {
      contractTxId: this.contractTxId,
    });

    const { evaluationOptions = {} } = await getContractManifest({
      arweave: this.warp.arweave,
      contractTxId: this.contractTxId,
    });

    this.contract.setEvaluationOptions(evaluationOptions);

    if (signer) this.contract.connect(await this.createWarpSigner(signer));

    if (this.cacheUrl !== undefined) {
      this.logger.debug(`Syncing contract state`, {
        contractTxId: this.contractTxId,
        remoteCacheUrl: this.cacheUrl,
      });

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
  }: EvaluationParameters<{ functionName: string; inputs?: I }>): Promise<K> {
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
    signer,
    // TODO: support dryWrite
  }: WriteParameters<Input>): Promise<WriteInteractionResult> {
    try {
      this.logger.debug(`Write interaction: ${functionName}`, {
        contractTxId: this.contractTxId,
      });
      // Sync state before writing
      await this.ensureContractInit({ signer });

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

      const writeResult = await this.contract.writeInteraction<Input>(
        {
          function: functionName,
          ...inputs,
        },
        {
          disableBundling: true,
        },
      );

      if (!writeResult?.interactionTx) {
        throw new Error(
          `Failed to write contract interaction: ${functionName}`,
        );
      }

      this.logger.debug('Successfully wrote contract interaction', {
        contractTxId: this.contractTxId,
        interactionTxId: writeResult.originalTxId,
      });

      return writeResult.interactionTx;
    } catch (error) {
      this.logger.error(
        `Failed to write contract interaction: ${error.message}`,
        {
          contractTxId: this.contractTxId,
        },
      );
      throw new WriteInteractionError(error.message);
    }
  }
}
