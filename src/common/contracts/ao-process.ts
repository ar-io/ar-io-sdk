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
import { connect } from '@permaweb/aoconnect';
import { createData } from 'arbundles';

import { AOContract, AoClient, ContractSigner, Logger } from '../../types.js';
import { version } from '../../version.js';
import { WriteInteractionError } from '../error.js';
import { DefaultLogger } from '../logger.js';

export class AOProcess implements AOContract {
  private logger: Logger;
  private processId: string;
  private ao: AoClient;

  constructor({
    processId,
    connectionConfig,
    logger = new DefaultLogger({ level: 'info' }),
  }: {
    processId: string;
    connectionConfig?: {
      CU_URL: string;
      MU_URL: string;
      GATEWAY_URL: string;
      GRAPHQL_URL: string;
    };
    logger?: DefaultLogger;
  }) {
    this.processId = processId;
    this.logger = logger;
    this.ao = connect({
      MU_URL: connectionConfig?.MU_URL,
      CU_URL: connectionConfig?.CU_URL,
      GATEWAY_URL: connectionConfig?.GATEWAY_URL,
      GRAPHQL_URL: connectionConfig?.GRAPHQL_URL,
    });
  }

  // TODO: could abstract into our own interface that constructs different signers
  async createAoSigner(
    signer: ContractSigner,
  ): Promise<
    (args: {
      data: string | Buffer;
      tags?: { name: string; value: string }[];
      target?: string;
      anchor?: string;
    }) => Promise<{ id: string; raw: ArrayBuffer }>
  > {
    // ensure appropriate permissions are granted with injected signers.
    if (signer.publicKey === undefined && 'setPublicKey' in signer) {
      await signer.setPublicKey();
    }

    const aoSigner = async ({ data, tags, target, anchor }) => {
      const dataItem = createData(data, signer, { tags, target, anchor });
      const signedData = dataItem.sign(signer).then(async () => ({
        id: await dataItem.id,
        raw: await dataItem.getRaw(),
      }));
      return signedData;
    };

    return aoSigner;
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

        const tagsOutput = result.Messages[0].Tags;
        const error = tagsOutput.find((tag) => tag.name === 'Error');
        if (error) {
          throw new Error(`${error.Value}: ${result.Messages[0].Data}`);
        }

        if (result.Messages.length === 0) {
          throw new Error('Process does not support provided action.');
        }

        this.logger.debug(`Read interaction result`, {
          result: result.Messages[0].Data,
        });

        const response: K = JSON.parse(result.Messages[0].Data);
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

  async send<I, K>({
    tags,
    data,
    signer,
    retries = 3,
  }: {
    tags: Array<{ name: string; value: string }>;
    data?: I;
    signer: ContractSigner;
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
          data: typeof data !== 'string' ? JSON.stringify(data) : data,
          signer: await this.createAoSigner(signer),
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

        const resultData: K = JSON.parse(output.Messages[0].Data);

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
        // throw on write interaction errors. No point retrying write interactions, waste of gas.
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

  async spawn({
    module,
    scheduler,
    signer,
  }: {
    module: string;
    scheduler: string;
    signer: ContractSigner;
  }): Promise<string> {
    // TODO: add error handling for non existent module/scheduler
    this.logger.debug('Spawning process', {
      module,
      scheduler,
    });
    const spawnResult = await this.ao.spawn({
      module,
      scheduler,
      signer: await this.createAoSigner(signer),
    });

    this.logger.debug('Spawned process', {
      processId: spawnResult,
      spawnResult,
    });

    return spawnResult;
  }
}
