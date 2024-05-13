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
  WalletAddress,
  WriteContract,
  WriteInteractionResult,
  WriteParameters,
} from '../../types.js';
import { sha256B64Url, toB64Url } from '../../utils/base64.js';
import { getContractManifest } from '../../utils/smartweave.js';
import { getAllPages } from '../api/graphql.js';
import { buildDeployedSmartweaveContractsQuery } from '../api/queries/smartweave-deployed-contracts.js';
import { buildControlledOrOwnedByQuery } from '../api/queries/smartweave-transferred-or-controlled-by.js';
import { FailedRequestError, WriteInteractionError } from '../error.js';
import { DefaultLogger } from '../logger.js';
import { defaultWarp } from '../warp.js';
import { RemoteContract } from './remote-contract.js';

LoggerFactory.INST.logLevel('error');

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
        tx.setOwner(toB64Url(signer.publicKey));
        const dataToSign = await tx.getSignatureData();
        const signatureUint8Array = await signer.sign(dataToSign);
        const signatureBuffer = Buffer.from(signatureUint8Array);
        const id = sha256B64Url(signatureBuffer);
        tx.setSignature({
          id: id,
          owner: toB64Url(signer.publicKey),
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
      throw new WriteInteractionError(error);
    }
  }

  /**
   * Get all the contracts that are possibly owned or controlled by the owner
   * NOTE: this requires validation of the contract state to ensure that the provided address is still the owner.
   * This a best effort to get the contracts that are owned by the provided address.
   * Results of this can be cached to improve performance client-side.
   * @param address {@type string} the address of the owner to get the contracts for
   * @returns {@type string[]}
   * @example
   * ```typescript
   * const contracts = await warpContract.getContractsForOwner({ address: 'address' });
   * ```
   */
  async getContractsForOwner({
    address,
    // TODO: add blockheight filter to allow for querying after a certain block height (optimizes performance cache implementations)
  }: {
    address: WalletAddress;
  }): Promise<string[]> {
    const ids: Set<string> = new Set();
    // if cacheUrl is set, we can use the remote cache to get the contracts - assumes the cache url complies with the /wallet/:address/contracts endpoint
    if (this.cacheUrl !== undefined) {
      const removeProvider = new RemoteContract<T>(this.configuration());
      const res = await removeProvider.getContractsForOwner({
        address,
      });
      res.forEach((id) => ids.add(id));
    }

    if (ids.size === 0) {
      // if cacheUrl is not set, we need to query the transactions from graphql

      await Promise.all([
        // Get all the transactions where the deployer
        getAllPages({
          queryBuilder: (cursor) =>
            buildDeployedSmartweaveContractsQuery({ address, cursor }),
          pageCallback: (response) => {
            response.data.data.transactions.edges.forEach((edge) => {
              ids.add(edge.node.id);
            });
          },
          arweave: this.warp.arweave,
        }),
        // get all ants that were transfered to the owner or where the owner was set as a controller
        getAllPages({
          queryBuilder: (cursor) =>
            buildControlledOrOwnedByQuery({ address, cursor }),
          pageCallback: (response) => {
            response.data.data.transactions.edges.forEach((edge) => {
              ids.add(edge.node.id);
            });
          },
          arweave: this.warp.arweave,
        }),
      ]);
    }

    return [...ids];
  }
}
