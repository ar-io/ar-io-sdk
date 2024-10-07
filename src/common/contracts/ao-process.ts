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
import { TurboFactory, TurboSigner } from '@ardrive/turbo-sdk';
import { Signer, createData } from '@dha-team/arbundles';
import { connect } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import arweaveGraphql from 'arweave-graphql';
import pako from 'pako';

import { AOContract, AoClient, AoSigner } from '../../types.js';
import { createAoSigner } from '../../utils/ao.js';
import { safeDecode } from '../../utils/json.js';
import { sha256 } from '../../utils/sha256.js';
import { version } from '../../version.js';
import { defaultArweave } from '../arweave.js';
import { WriteInteractionError } from '../error.js';
import { AxiosHTTPService } from '../http.js';
import { ILogger, Logger } from '../logger.js';

export class AOProcess implements AOContract {
  private logger: ILogger;
  private processId: string;
  private ao: AoClient;

  constructor({
    processId,
    ao = connect(),
    logger = Logger.default,
  }: {
    processId: string;
    ao?: AoClient;
    logger?: ILogger;
  }) {
    this.processId = processId;
    this.logger = logger;
    this.ao = ao;
  }

  async read<K>({
    tags,
    retries = 3,
  }: {
    tags?: Array<{ name: string; value: string }>;
    retries?: number;
  }): Promise<K> {
    let attempts = 0;
    let lastError: Error | undefined;
    while (attempts < retries) {
      try {
        this.logger.debug(`Evaluating read interaction on contract`, {
          tags,
        });
        // map tags to inputs
        const result = await this.ao.dryrun({
          process: this.processId,
          tags,
        });

        if (result.Messages === undefined || result.Messages.length === 0) {
          throw new Error(
            `Process ${this.processId} does not support provided action.`,
          );
        }

        const tagsOutput = result.Messages[0].Tags;
        const error = tagsOutput.find((tag) => tag.name === 'Error');
        if (error) {
          throw new Error(`${error.Value}: ${result.Messages[0].Data}`);
        }

        this.logger.debug(`Read interaction result`, {
          result: result.Messages[0].Data,
        });

        // return empty object if no data is returned
        if (result.Messages[0].Data === undefined) {
          return {} as K;
        }

        const response: K = safeDecode<K>(result.Messages[0].Data);
        return response;
      } catch (e) {
        attempts++;
        this.logger.debug(`Read attempt ${attempts} failed`, {
          error: e,
          tags,
        });
        lastError = e;
        // exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 2 ** attempts * 1000),
        );
      }
    }
    throw lastError;
  }

  async send<K>({
    tags,
    data,
    signer,
    retries = 3,
  }: {
    tags: Array<{ name: string; value: string }>;
    data?: string | undefined;
    signer: AoSigner;
    retries?: number;
  }): Promise<{ id: string; result?: K }> {
    // main purpose of retries is to handle network errors/new process delays
    let attempts = 0;
    let lastError: Error | undefined;
    while (attempts < retries) {
      try {
        this.logger.debug(`Evaluating send interaction on contract`, {
          tags,
          data,
          processId: this.processId,
        });

        // TODO: do a read as a dry run to check if the process supports the action

        const messageId = await this.ao.message({
          process: this.processId,
          // TODO: any other default tags we want to add?
          tags: [...tags, { name: 'AR-IO-SDK', value: version }],
          data,
          signer,
        });

        this.logger.debug(`Sent message to process`, {
          messageId,
          processId: this.processId,
        });

        // check the result of the send interaction
        const output = await this.ao.result({
          message: messageId,
          process: this.processId,
        });

        this.logger.debug('Message result', {
          output,
          messageId,
          processId: this.processId,
        });

        // check if there are any Messages in the output
        if (output.Messages?.length === 0 || output.Messages === undefined) {
          return { id: messageId };
        }

        const tagsOutput = output.Messages[0].Tags;
        const error = tagsOutput.find((tag) => tag.name === 'Error');
        // if there's an Error tag, throw an error related to it
        if (error) {
          const result = output.Messages[0].Data;
          throw new WriteInteractionError(`${error.Value}: ${result}`);
        }

        if (output.Messages.length === 0) {
          throw new Error(
            `Process ${this.processId} does not support provided action.`,
          );
        }

        if (output.Messages[0].Data === undefined) {
          return { id: messageId };
        }

        const resultData: K = safeDecode<K>(output.Messages[0].Data);

        this.logger.debug('Message result data', {
          resultData,
          messageId,
          processId: this.processId,
        });

        return { id: messageId, result: resultData };
      } catch (error) {
        this.logger.error('Error sending message to process', {
          error: error.message,
          processId: this.processId,
          tags,
        });
        // throw on write interaction errors. No point retrying wr ite interactions, waste of gas.
        if (error.message.includes('500')) {
          this.logger.debug('Retrying send interaction', {
            attempts,
            retries,
            error: error.message,
            processId: this.processId,
          });
          // exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 2 ** attempts * 2000),
          );
          attempts++;
          lastError = error;
        } else throw error;
      }
    }
    throw lastError;
  }

  static async clone({
    processId,
    signer,
    network = {
      CU_URL: 'https://cu.ao-testnet.xyz',
    },
    ao = connect({
      CU_URL: network.CU_URL,
    }),
    arweave = defaultArweave,
  }: {
    processId: string;
    signer: Signer;
    ao?: AoClient;
    arweave?: Arweave;
    network?: { CU_URL: string; SCHEDULER?: string };
  }): Promise<{ processId: string; memory: any; checkpoint: string }> {
    const cuService = new AxiosHTTPService({
      url: network.CU_URL,
    });
    const gql = arweaveGraphql(`${arweave.getConfig().api.host}/graphql`);

    // need to retrieve the process information from a gateway
    const processTx = await gql
      .getTransactions({
        ids: [processId],
      })
      .then((res) => res.transactions.edges[0].node);
    // parse the scheduler ID and module ID from the tags
    const { schedulerId, moduleId } = processTx.tags.reduce(
      (acc: { moduleId: string | null; schedulerId: string | null }, tag) => {
        const tagName = tag.name;
        const tagValue = tag.value;
        if (tagName === 'Scheduler') {
          acc.schedulerId = tagValue;
        } else if (tag.name === 'Module') {
          acc.moduleId = tagValue;
        }
        return acc;
      },
      { schedulerId: null, moduleId: null },
    );
    if (schedulerId === null || moduleId === null) {
      throw new Error('Process missing required tags');
    }

    const currentMemory = await cuService.get<unknown, Uint8Array>({
      endpoint: `/state/${processId}`,
    });

    const newProcessId = await ao.spawn({
      scheduler: network.SCHEDULER ?? schedulerId,
      module: moduleId,
      tags: [
        ...processTx.tags.filter(
          (
            tag, // filter out tags that are set internally by the SDK
          ) =>
            tag.name !== 'Scheduler' &&
            tag.name !== 'Module' &&
            tag.name !== 'Data-Protocol' &&
            tag.name !== 'Variant' &&
            tag.name !== 'Type' &&
            tag.name !== 'SDK',
        ),
        { name: 'Original-Process', value: processId },
        { name: 'AR-IO-SDK', value: version },
      ],
      signer: createAoSigner(signer),
    });
    // deploy new checkpoint with the current memory
    const networkInfo = await arweave.network.getInfo();
    const newCheckpointDataItem = createData(pako.gzip(currentMemory), signer, {
      tags: [
        { name: 'Data-Protocol', value: 'ao' },
        { name: 'Variant', value: 'ao.TN.1' },
        { name: 'Type', value: 'Checkpoint' },
        { name: 'Module', value: moduleId },
        { name: 'Process', value: newProcessId },
        { name: 'Nonce', value: '0' },
        { name: 'Timestamp', value: Date.now().toString() },
        { name: 'Block-Height', value: networkInfo.height.toString() },
        { name: 'Content-Type', value: 'application/octet-stream' },
        {
          name: 'SHA-256',
          value: await sha256(currentMemory.toString()),
        },
        {
          name: 'Content-Encoding',
          value: 'gzip',
        },
        {
          name: 'Original-Process',
          value: processId,
        },
        {
          name: 'AR-IO-SDK',
          value: version,
        },
      ],
    });
    const turboAuthenticated = TurboFactory.authenticated({
      signer: signer as TurboSigner,
    });
    await newCheckpointDataItem.sign(signer);
    const checkpointRes = await turboAuthenticated.uploadSignedDataItem({
      dataItemSizeFactory: () => newCheckpointDataItem.getRaw().length,
      dataItemStreamFactory: () => newCheckpointDataItem.getRaw(),
    });

    return {
      processId: newProcessId,
      memory: currentMemory,
      checkpoint: checkpointRes.id,
    };
  }
}
