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
import { EventEmitter } from 'eventemitter3';
import { pLimit } from 'plimit-lit';

import { ANTRegistry } from '../common/ant-registry.js';
import { ANT } from '../common/ant.js';
import { AOProcess } from '../common/index.js';
import { ARIO } from '../common/io.js';
import { ILogger, Logger } from '../common/logger.js';
import { ARIO_MAINNET_PROCESS_ID } from '../constants.js';
import { AoANTRegistryRead } from '../types/ant-registry.js';
import { AoANTState } from '../types/ant.js';
import {
  AoARIORead,
  AoArNSNameData,
  AoClient,
  ProcessId,
  WalletAddress,
} from '../types/index.js';

/**
 * @beta This API is in beta and may change in the future.
 */
export const getANTProcessesOwnedByWallet = async ({
  address,
  registry = ANTRegistry.init(),
}: {
  address: WalletAddress;
  registry?: AoANTRegistryRead;
}): Promise<ProcessId[]> => {
  const res = await registry.accessControlList({ address });
  return [...new Set([...res.Owned, ...res.Controlled])];
};

function timeout(ms: number, promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout'));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class ArNSEventEmitter extends EventEmitter {
  protected contract: AoARIORead;
  private timeoutMs: number; // timeout for each request to 3 seconds
  private throttle;
  private logger: ILogger;
  private strict: boolean;
  private antAoClient: AoClient;
  constructor({
    contract = ARIO.init({
      processId: ARIO_MAINNET_PROCESS_ID,
    }),
    timeoutMs = 60_000,
    concurrency = 30,
    logger = Logger.default,
    strict = false,
    antAoClient = connect({
      MODE: 'legacy',
    }),
  }: {
    contract?: AoARIORead;
    timeoutMs?: number;
    concurrency?: number;
    logger?: ILogger;
    strict?: boolean;
    antAoClient?: AoClient;
  } = {}) {
    super();
    this.contract = contract;
    this.timeoutMs = timeoutMs;
    this.throttle = pLimit(concurrency);
    this.logger = logger;
    this.strict = strict;
    this.antAoClient = antAoClient;
  }

  async fetchProcessesOwnedByWallet({
    address,
    pageSize,
    antRegistry = ANTRegistry.init(),
  }: {
    address: WalletAddress;
    pageSize?: number;
    antRegistry?: AoANTRegistryRead;
  }) {
    const uniqueContractProcessIds: Record<
      string,
      {
        state: AoANTState | undefined;
        names: Record<string, AoArNSNameData>;
      }
    > = {};
    const antIdRes = await antRegistry.accessControlList({ address });
    const antIds = new Set([...antIdRes.Owned, ...antIdRes.Controlled]);
    await timeout(
      this.timeoutMs,
      fetchAllArNSRecords({ contract: this.contract, emitter: this, pageSize }),
    )
      .catch((e) => {
        this.emit('error', `Error getting ArNS records: ${e}`);
        this.logger.error(`Error getting ArNS records`, {
          message: e?.message,
          stack: e?.stack,
        });
        return {};
      })
      .then((records: Record<string, AoArNSNameData>) => {
        Object.entries(records).forEach(([name, arnsRecord]) => {
          if (antIds.has(arnsRecord.processId)) {
            if (uniqueContractProcessIds[arnsRecord.processId] == undefined) {
              uniqueContractProcessIds[arnsRecord.processId] = {
                state: undefined,
                names: {},
              };
            }
            uniqueContractProcessIds[arnsRecord.processId].names[name] =
              arnsRecord;
          }
        });
      });

    const idCount = Object.keys(uniqueContractProcessIds).length;
    this.emit('progress', 0, idCount);
    // check the contract owner and controllers
    await Promise.all(
      Object.keys(uniqueContractProcessIds).map(async (processId, i) =>
        this.throttle(async () => {
          if (uniqueContractProcessIds[processId].state !== undefined) {
            this.emit('progress', i + 1, idCount);
            return;
          }
          const ant = ANT.init({
            process: new AOProcess({
              processId,
              ao: this.antAoClient,
            }),
            strict: this.strict,
          });
          const state: AoANTState | undefined = (await timeout(
            this.timeoutMs,
            ant.getState(),
          ).catch((e) => {
            this.emit(
              'error',
              `Error getting state for process ${processId}: ${e}`,
            );
            return undefined;
          })) as AoANTState | undefined;

          if (
            state?.Owner === address ||
            state?.Controllers.includes(address)
          ) {
            uniqueContractProcessIds[processId].state = state;
            this.emit(
              'process',
              processId,
              uniqueContractProcessIds[processId],
            );
          }
          this.emit('progress', i + 1, idCount);
        }),
      ),
    );
    this.emit('end', uniqueContractProcessIds);
  }
}

export const fetchAllArNSRecords = async ({
  contract = ARIO.init({
    processId: ARIO_MAINNET_PROCESS_ID,
  }),
  emitter,
  logger = Logger.default,
  pageSize = 1000,
}: {
  contract?: AoARIORead;
  emitter?: EventEmitter;
  logger?: ILogger;
  pageSize?: number;
}): Promise<Record<string, AoArNSNameData>> => {
  let cursor: string | undefined;
  const startTimestamp = Date.now();
  const records: Record<string, AoArNSNameData> = {};
  do {
    const pageResult = await contract
      .getArNSRecords({ cursor, limit: pageSize })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((e: any) => {
        logger?.error(`Error getting ArNS records`, {
          message: e?.message,
          stack: e?.stack,
        });

        emitter?.emit('arns:error', `Error getting ArNS records: ${e}`);

        return undefined;
      });

    if (!pageResult) {
      return {};
    }

    pageResult.items.forEach((record) => {
      const { name, ...recordDetails } = record;
      records[name] = recordDetails;
    });

    logger.debug('Fetched page of ArNS records', {
      totalRecordCount: pageResult.totalItems,
      fetchedRecordCount: Object.keys(records).length,
      cursor: pageResult.nextCursor,
    });

    emitter?.emit('arns:pageLoaded', {
      totalRecordCount: pageResult.totalItems,
      fetchedRecordCount: Object.keys(records).length,
      records: pageResult.items,
      cursor: pageResult.nextCursor,
    });

    cursor = pageResult.nextCursor;
  } while (cursor !== undefined);

  emitter?.emit('arns:end', records);

  logger.debug('Fetched all ArNS records', {
    totalRecordCount: Object.keys(records).length,
    durationMs: Date.now() - startTimestamp,
  });

  return records;
};
