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

import { AOContract, AoClient, AoSigner } from '../../types/index.js';
import { getRandomText } from '../../utils/base64.js';
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
    let attempts = 0;
    let lastError: Error | undefined;
    while (attempts < retries) {
      try {
        this.logger.debug(`Evaluating read interaction on contract`, {
          tags,
        });
        // map tags to inputs
        const dryRunInput = {
          process: this.processId,
          tags,
        };
        if (fromAddress !== undefined) {
          dryRunInput['Owner'] = fromAddress;
        }
        const result = await this.ao.dryrun(dryRunInput);
        this.logger.debug(`Read interaction result`, {
          result,
        });

        const error = errorMessageFromOutput(result);
        if (error !== undefined) {
          throw new Error(error);
        }

        if (result.Messages === undefined || result.Messages.length === 0) {
          this.logger.debug(
            `Process ${this.processId} does not support provided action.`,
            result,
            tags,
          );
          throw new Error(
            `Process ${this.processId} does not support provided action.`,
          );
        }
        const messageData = result.Messages?.[0]?.Data;

        // return undefined if no data is returned
        if (this.isMessageDataEmpty(messageData)) {
          return undefined as K;
        }

        const response: K = safeDecode<K>(result.Messages[0].Data);
        return response;
      } catch (e) {
        attempts++;
        this.logger.debug(`Read attempt ${attempts} failed`, {
          error: e instanceof Error ? e.message : e,
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
        // anchor is a random text produce non-deterministic messages IDs when deterministic signers are provided (ETH)
        const anchor = getRandomText(32);

        const messageId = await this.ao.message({
          process: this.processId,
          // TODO: any other default tags we want to add?
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

        const error = errorMessageFromOutput(output);
        if (error !== undefined) {
          throw new WriteInteractionError(error);
        }

        // check if there are any Messages in the output
        if (output.Messages?.length === 0 || output.Messages === undefined) {
          return { id: messageId };
        }

        if (output.Messages.length === 0) {
          throw new Error(
            `Process ${this.processId} does not support provided action.`,
          );
        }

        if (this.isMessageDataEmpty(output.Messages[0].Data)) {
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

function errorMessageFromOutput(output: {
  Error?: string;
  Messages?: { Tags?: { name: string; value: string }[] }[];
}): string | undefined {
  const errorData = output.Error;
  if (errorData !== undefined) {
    // TODO: Could clean this one up too, current error is verbose, but not always deterministic for parsing
    // Throw the whole raw error if AO process level error
    return errorData;
  }

  const error = output.Messages?.[0]?.Tags?.find(
    (tag) => tag.name === 'Error',
  )?.value;
  if (error !== undefined) {
    // from [string "aos"]:6846: Name is already registered
    const lineNumber = error.match(/\d+/)?.[0];
    const message = error.replace(/\[string "aos"\]:\d+:/, '');
    // to more user friendly: Name is already registered (line 6846)
    return `${message} (line ${lineNumber})`.trim();
  }

  return undefined;
}
