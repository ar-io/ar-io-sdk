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
import AoLoader from '@permaweb/ao-loader';
import { connect } from '@permaweb/aoconnect';

import { AOContract, AoClient, AoSigner } from '../../types/index.js';
import { getRandomText } from '../../utils/base64.js';
import { errorMessageFromOutput } from '../../utils/index.js';
import { safeDecode } from '../../utils/json.js';
import { version } from '../../version.js';
import { WriteInteractionError } from '../error.js';
import { ILogger, Logger } from '../logger.js';

export const STUB_PROCESS_ID = 'process-id-'.padEnd(43, '1');
export const STUB_ADDRESS = 'arweave-address-'.padEnd(43, '1');
export const STUB_ETH_ADDRESS = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c';
export const STUB_ANT_REGISTRY_ID = 'ant-registry-'.padEnd(43, '1');

export const AO_LOADER_HANDLER_ENV = {
  Process: {
    Id: STUB_ADDRESS,
    Owner: STUB_ADDRESS,
    Tags: [
      { name: 'Authority', value: 'XXXXXX' },
      { name: 'ANT-Registry-Id', value: STUB_ANT_REGISTRY_ID },
    ],
  },
  Module: {
    Id: ''.padEnd(43, '1'),
    Tags: [{ name: 'Authority', value: 'YYYYYY' }],
  },
};

export const AO_LOADER_OPTIONS = {
  format: 'wasm32-unknown-emscripten-metering',
  inputEncoding: 'JSON-1',
  outputEncoding: 'JSON-1',
  memoryLimit: '1073741824', // 1 GiB in bytes
  computeLimit: (9e12).toString(),
  extensions: [],
};

export type HandleFunction = Awaited<ReturnType<typeof AoLoader>>;

export class LocalAO implements Partial<AoClient> {
  wasmModule: any;
  handle: HandleFunction;
  memory: ArrayBufferLike | null;

  handlerEnv: typeof AO_LOADER_HANDLER_ENV;

  nonce: string;
  resultsCache: Map<string, Awaited<ReturnType<AoClient['result']>>> =
    new Map();
  constructor({
    wasmModule,
    handle,
    handlerEnv,
    memory = null,
    nonce = '0'.padStart(43, '0'),
  }: {
    wasmModule: any;
    handle: HandleFunction;
    handlerEnv: typeof AO_LOADER_HANDLER_ENV;
    memory: ArrayBufferLike | null;
    nonce?: string;
  }) {
    this.wasmModule = wasmModule;
    this.memory = memory;
    this.handle = handle;
    this.nonce = nonce;
    this.handlerEnv = handlerEnv;
  }

  static async init({
    wasmModule,
    aoLoaderOptions,
    handlerEnv = AO_LOADER_HANDLER_ENV,
    memory = null,
  }: {
    wasmModule: any;
    aoLoaderOptions: typeof AO_LOADER_OPTIONS;
    handlerEnv?: typeof AO_LOADER_HANDLER_ENV;
    memory?: ArrayBufferLike | null;
  }): Promise<LocalAO> {
    const handle = await AoLoader(wasmModule, aoLoaderOptions);

    return new LocalAO({
      wasmModule,
      handlerEnv,
      memory,
      handle,
    });
  }

  async dryrun(
    params: Parameters<AoClient['dryrun']>[0],
    handlerEnvOverrides?: typeof AO_LOADER_HANDLER_ENV,
  ): ReturnType<AoClient['dryrun']> {
    const res = await this.handle(
      this.memory,
      {
        Id: this.nonce,
        ...params,
      },
      {
        ...this.handlerEnv,
        ...(handlerEnvOverrides ?? {}),
      },
    );
    delete res.Memory;

    return res;
  }

  async message(
    params: Parameters<AoClient['message']>[0],
    handlerEnvOverrides?: typeof AO_LOADER_HANDLER_ENV,
  ): Promise<string> {
    const newNonce = (parseInt(this.nonce) + 1).toString().padStart(43, '0');
    const res = await this.handle(
      this.memory,
      {
        Id: newNonce,
        Data: params.data,
        Tags: params.tags,
      },
      {
        ...this.handlerEnv,
        ...(handlerEnvOverrides ?? {}),
      },
    );
    const { Memory, ...rest } = res;
    this.memory = Memory;
    this.nonce = newNonce;
    this.resultsCache.set(this.nonce, rest);
    return this.nonce;
  }

  async result(
    params: Parameters<AoClient['result']>[0],
  ): ReturnType<AoClient['result']> {
    const res = this.resultsCache.get(params.message);
    if (!res) throw new Error('Message does exist');
    return res;
  }

  // TODO: implement rest of AoClient tooling
}

export class AOProcess implements AOContract {
  private logger: ILogger;
  private ao: AoClient;
  public readonly processId: string;

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
        const result = await this.ao.dryrun(dryRunInput);
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
            `Process ${this.processId} does not support provided action.`,
            {
              result,
              tags,
              processId: this.processId,
            },
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

        const response: K = safeDecode<K>(messageData);
        return response;
      } catch (error: any) {
        attempts++;
        this.logger.debug(`Read attempt ${attempts} failed`, {
          error: error?.message,
          stack: error?.stack,
          tags,
          processId: this.processId,
        });
        lastError = error;

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
      } catch (error: any) {
        this.logger.error('Error sending message to process', {
          error: error?.message,
          stack: error?.stack,
          processId: this.processId,
          tags,
        });

        // throw on write interaction errors. No point retrying write interactions, waste of gas.
        if (error.message.includes('500')) {
          this.logger.debug('Retrying send interaction', {
            attempts,
            retries,
            error: error?.message,
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
