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
import { connect } from '@permaweb/aoconnect';

import {
  AOContract,
  AoClient,
  AoSigner,
  DryRunResult,
  MessageResult,
} from '../../types/index.js';
import { getRandomText } from '../../utils/base64.js';
import { errorMessageFromOutput } from '../../utils/index.js';
import { safeDecode } from '../../utils/json.js';
import { version } from '../../version.js';
import { WriteInteractionError } from '../error.js';
import { ILogger, Logger } from '../logger.js';

export class AOProcess implements AOContract {
  private logger: ILogger;
  public readonly ao: AoClient;
  public readonly processId: string;

  constructor({
    processId,
    ao = connect({
      MODE: 'legacy',
    }),
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

  private isMessageDataEmpty(messageData: string | null | undefined): boolean {
    return (
      messageData === undefined ||
      messageData === 'null' || // This is what the CU returns for 'nil' values that are json.encoded
      messageData === '' ||
      messageData === null
    );
  }

  async read<K>({
    tags,
    retries = 3,
    fromAddress,
  }: {
    tags?: Array<{ name: string; value: string }>;
    retries?: number;
    fromAddress?: string;
  }): Promise<K> {
    this.logger.debug(`Evaluating read interaction on process`, {
      tags,
      processId: this.processId,
    });
    // map tags to inputs
    const dryRunInput = {
      process: this.processId,
      tags,
    };
    if (fromAddress !== undefined) {
      dryRunInput['Owner'] = fromAddress;
    }

    let attempts = 0;
    let result: DryRunResult | undefined = undefined;

    while (attempts < retries) {
      try {
        result = await this.ao.dryrun(dryRunInput);
        // break on successful return of result
        break;
      } catch (error) {
        attempts++;
        this.logger.debug(`Read attempt ${attempts} failed`, {
          error: error?.message,
          stack: error?.stack,
          tags,
          processId: this.processId,
        });

        if (attempts >= retries) {
          this.logger.debug(`Maximum read attempts exceeded`, {
            error: error?.message,
            stack: error?.stack,
            tags,
            processId: this.processId,
            ao: JSON.stringify(this.ao),
          });
          throw new Error(
            `Failed to evaluate a dry-run on process ${this.processId}.`,
          );
        }

        // exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 2 ** attempts * 1000),
        );
      }
    }

    if (result === undefined) {
      throw new Error('Unexpected error when evaluating read interaction');
    }

    this.logger.debug(`Read interaction result`, {
      result,
      processId: this.processId,
    });

    const error = errorMessageFromOutput(result);
    if (error !== undefined) {
      throw new Error(error);
    }

    if (result.Messages === undefined || result.Messages.length === 0) {
      this.logger.debug(
        `Empty result - process ${this.processId} does not support provided action.`,
        {
          result,
          tags,
          processId: this.processId,
        },
      );
      throw new Error(
        (result as any).message ||
          `Process ${this.processId} did not return a valid response. Response: ${JSON.stringify(result)}`,
      );
    }
    const messageData = result.Messages?.[0]?.Data;

    // return undefined if no data is returned
    if (this.isMessageDataEmpty(messageData)) {
      return undefined as K;
    }

    const response: K = safeDecode<K>(messageData);
    return response;
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
    let messageId: string | undefined;
    const anchor = getRandomText(32); // anchor is a random text produce non-deterministic messages IDs when deterministic signers are provided (ETH)

    try {
      this.logger.debug(`Evaluating send interaction on contract`, {
        tags,
        data,
        processId: this.processId,
      });

      /**
       * DO NOT retry messaging if a message was already sent.
       * This could result in a double entry-like condition when sending tokens for example.
       * If the message fails to send we will throw an error and the caller can retry.
       */
      messageId = await this.ao.message({
        process: this.processId,
        tags: [...tags, { name: 'AR-IO-SDK', value: version }],
        data,
        signer,
        anchor,
      });

      this.logger.debug(`Sent message to process`, {
        messageId,
        processId: this.processId,
        anchor,
      });
    } catch (error: any) {
      this.logger.debug('Error sending message to process', {
        error: error?.message,
        stack: error?.stack,
        processId: this.processId,
        tags,
      });
      // throw the error so it can be handled by the caller
      throw error;
    }

    if (messageId === undefined) {
      throw new Error('Failed to send message to process.');
    }

    // get the result of the message before returning, using retries to handle network errors/new process delays
    let result: MessageResult | undefined = undefined;
    let attempts = 0;
    while (attempts < retries) {
      try {
        result = await this.ao.result({
          message: messageId,
          process: this.processId,
        });

        this.logger.debug('Message result', {
          result,
          messageId,
          processId: this.processId,
        });
        break;
      } catch (error: any) {
        attempts++;

        this.logger.debug('Retrying send interaction', {
          attempts,
          retries,
          error: error?.message,
          processId: this.processId,
        });

        if (attempts >= retries) {
          this.logger.debug(
            `Message was sent to process ${this.processId} with id ${messageId} but result was not returned. Review transactions for more details.`,
            {
              error: error?.message,
              stack: error?.stack,
              tags,
              processId: this.processId,
              messageId,
            },
          );
          return { id: messageId };
        }

        // exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 2 ** attempts * 2000),
        );
      }
    }

    if (result === undefined) {
      this.logger.debug(
        `Message was sent to process ${this.processId} with id ${messageId} but the result was not returned. Review transactions for more details.`,
        {
          tags,
          processId: this.processId,
          messageId,
        },
      );
      return { id: messageId };
    }

    const error = errorMessageFromOutput(result);
    if (error !== undefined) {
      throw new WriteInteractionError(error);
    }

    // check if there are any Messages in the output
    if (result.Messages?.length === 0 || result.Messages === undefined) {
      return { id: messageId };
    }

    if (this.isMessageDataEmpty(result.Messages[0].Data)) {
      return { id: messageId };
    }

    const resultData: K = safeDecode<K>(result.Messages[0].Data);

    this.logger.debug('Message result data', {
      resultData,
      messageId,
      processId: this.processId,
    });

    return { id: messageId, result: resultData };
  }
}
