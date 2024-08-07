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

import { AOContract, AoClient, AoSigner } from '../../types.js';
import { safeDecode } from '../../utils/json.js';
import { version } from '../../version.js';
import { WriteInteractionError } from '../error.js';
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

        if (result.Messages.length === 0) {
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
}
