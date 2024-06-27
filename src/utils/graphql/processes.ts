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
import EventEmitter from 'eventemitter3';
import { pLimit } from 'plimit-lit';

import { ANT } from '../../common/ant.js';
import { IO } from '../../common/io.js';
import { ioDevnetProcessId } from '../../constants.js';
import {
  AoANTState,
  AoArNSNameData,
  AoIORead,
  ProcessId,
  WalletAddress,
} from '../../types.js';

export const getANTProcessesOwnedByWallet = async ({
  address,
  contract = IO.init({
    processId: ioDevnetProcessId,
  }),
}: {
  address: WalletAddress;
  contract?: AoIORead;
}): Promise<ProcessId[]> => {
  const throttle = pLimit(50);
  // get the record names of the registry - TODO: this may need to be paginated
  const uniqueContractProcessIds = await contract
    .getArNSRecords()
    .then((records) =>
      Object.values(records)
        .filter((record) => record.processId !== undefined)
        .map((record) => record.processId),
    );

  // check the contract owner and controllers
  const ownedOrControlledByWallet = await Promise.all(
    uniqueContractProcessIds.map(async (processId) =>
      throttle(async () => {
        const ant = ANT.init({
          processId,
        });
        const { Owner, Controllers } = await ant.getState();

        if (Owner === address || Controllers.includes(address)) {
          return processId;
        }
        return;
      }),
    ),
  );

  if (ownedOrControlledByWallet.length === 0) {
    return [];
  }

  // TODO: insert gql query to find ANT processes owned by wallet given wallet not currently in the registry
  return [...new Set(ownedOrControlledByWallet)] as string[];
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
  protected contract: AoIORead;
  private timeoutMs: number; // timeout for each request to 3 seconds
  private throttle;
  constructor({
    contract = IO.init({
      processId: ioDevnetProcessId,
    }),
    timeoutMs = 60_000,
    concurrency = 30,
  }: {
    contract?: AoIORead;
    timeoutMs?: number;
    concurrency?: number;
  }) {
    super();
    this.contract = contract;
    this.timeoutMs = timeoutMs;
    this.throttle = pLimit(concurrency);
  }

  async fetchProcessesOwnedByWallet({ address }: { address: WalletAddress }) {
    const uniqueContractProcessIds: Record<
      string,
      { state: AoANTState | undefined; names: Record<string, AoArNSNameData> }
    > = {};

    await timeout(
      this.timeoutMs,
      this.contract.getArNSRecords().catch((e) => {
        this.emit('error', `Error getting ArNS records: ${e}`);
        return {};
      }),
    ).then((records) => {
      if (!records) return;
      Object.entries(records).forEach(([name, record]) => {
        if (record.processId === undefined) {
          return;
        }
        if (uniqueContractProcessIds[record.processId] === undefined) {
          uniqueContractProcessIds[record.processId] = {
            state: undefined,
            names: {},
          };
        }
        uniqueContractProcessIds[record.processId].names[name] = record;
      });
    });

    const idCount = Object.keys(uniqueContractProcessIds).length;
    // check the contract owner and controllers
    this.emit('progress', 0, idCount);
    await Promise.all(
      Object.keys(uniqueContractProcessIds).map(async (processId, i) =>
        this.throttle(async () => {
          if (uniqueContractProcessIds[processId].state !== undefined) {
            this.emit('progress', i + 1, idCount);
            return;
          }
          const ant = ANT.init({
            processId,
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
