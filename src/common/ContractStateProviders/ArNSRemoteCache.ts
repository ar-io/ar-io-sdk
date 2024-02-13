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
import fetchBuilder from 'fetch-retry';

import { IContractStateProvider } from '../../types.js';
import { validateArweaveId } from '../../utils/index.js';

export class ArNSRemoteCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArNSRemoteCacheError';
  }
}

/**
 * ArNSRemoteCache class implements the IContractStateProvider interface.
 * It provides methods to interact with a remote ArNS SmartWeave State Evaluator.
 *
 * @property {string} remoteCacheUrl - The URL of the remote cache. Defaults to 'api.arns.app'.
 * @property {string} apiVersion - The API version to use for the remote cache. Defaults to 'v1'.
 * @property {(message: string) => void} log - A logging function. If not provided, it defaults to a function that logs debug messages to the console.
 * @property {typeof fetch} http - A fetch function with retry capabilities.
 * @property {Object} httpOptions - Options to pass to the fetch function.
 *
 * @example
 * const cache = new ArNSRemoteCache({}) || new ArNSRemoteCache({
 *   url: 'https://example.com/cache',
 *   logger: message => console.log(`Custom logger: ${message}`),
 *   version: 'v1',
 *   httpOptions: {
 *     retries: 3,
 *     retryDelay: 2000,
 *     retryOn: [404, 429, 503],
 * },
 * });
 */
export class ArNSRemoteCache implements IContractStateProvider {
  remoteCacheUrl: string;
  apiVersion: string;
  log: (message: string) => void;
  http: typeof fetch;
  constructor({
    url = 'api.arns.app',
    logger,
    version = 'v1',
    httpOptions = {
      retries: 3,
      retryDelay: 2000,
      retryOn: [404, 429, 503],
    },
  }: {
    url?: string;
    logger?: (message: string) => void;
    version?: string;
    httpOptions?: Parameters<typeof fetchBuilder>[1];
  }) {
    this.remoteCacheUrl = url;
    this.apiVersion = version;
    this.log =
      logger ??
      ((message: string) => {
        console.debug(`[ArNS Remote Cache]: ${message}`);
      });
    this.http = fetchBuilder(fetch, httpOptions);
  }

  /**
   * Fetches the state of a contract from the remote cache.
   * @param {string} contractId - The Arweave transaction id of the contract.
   */
  async getContractState<ContractState>(
    contractId: string,
  ): Promise<ContractState> {
    validateArweaveId(contractId);

    this.log(`Fetching contract state for [${contractId}]`);

    const response = await this.http(
      `${this.remoteCacheUrl}/${this.apiVersion}/contract/${contractId}`,
    ).catch((error) => {
      const message = `Failed to fetch contract state for [${contractId}]: ${error}`;

      this.log(message);

      throw new ArNSRemoteCacheError(message);
    });

    this.log(
      `Fetched contract state for [${contractId}]. State size: ${response.headers.get('content-length')} bytes.`,
    );

    return response.json();
  }
}
