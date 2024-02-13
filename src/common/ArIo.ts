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
import Arweave from 'arweave';
import fetchBuilder from 'fetch-retry';

import { IContractStateProvider } from '../types.js';

export class ArIoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArIoError';
  }
}

export class ArIo implements IContractStateProvider {
  _arweave: Arweave;
  _contractStateProviders: IContractStateProvider[];
  http: typeof fetch;
  log: (message: string) => void;

  constructor({
    arweave,
    contractStateProviders,
    logger,
  }: {
    arweave?: Arweave;
    contractStateProviders: IContractStateProvider[];
    logger?: (message: string) => void;
  }) {
    this._arweave = arweave ?? Arweave.init({}); // use default arweave instance if not provided
    this._contractStateProviders = contractStateProviders;
    this.http = fetchBuilder(fetch, {
      retries: 3,
      retryDelay: 2000,
      retryOn: [429, 500, 502, 503, 504],
    });
    this.log =
      logger ??
      ((message: string) => {
        console.debug(`[ArIo Client]: ${message}`);
      });
  }

  /**
   * Fetches the state of a contract from the Arweave network.
   * @param contractId - The contract ID to fetch the state for.
   * @param strategy - The strategy to use when fetching the state - 'race', 'compare', or 'fallback'.
   * - 'race' will call each provider and return the first result.
   * - 'compare' will call each provider and return the result that has the highest blockheight evaluated.
   * - 'fallback' will call first remote providers, then gql providers if remote fetch failed.
   * @returns The state of the contract.
   *
   * @example
   * const state = await ario.getContractState('contractId', 'fallback');
   */
  async getContractState<ContractState>(
    contractId: string,
    strategy: 'race' | 'compare' | 'fallback' = 'race',
  ): Promise<ContractState> {
    this.log(
      `Fetching contract state for contract [${contractId}] using a ${strategy} strategy `,
    );
    switch (strategy) {
      case 'race':
        return Promise.race(
          this._contractStateProviders.map((provider) =>
            provider.getContractState<ContractState>(contractId),
          ),
        );
      case 'compare':
        // TODO: implement compare strategy
        throw new Error('Not implemented');
      case 'fallback':
        // TODO: implement fallback strategy
        throw new Error('Not implemented');
      default: {
        const message = `Invalid strategy provided for contract [${contractId}]: ${strategy}`;
        this.log(message);
        throw new ArIoError(message);
      }
    }
  }
}
