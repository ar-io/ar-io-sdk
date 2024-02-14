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
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

import { RESPONSE_RETRY_CODES } from '../constants.js';
import { ContractStateProvider } from '../types.js';
import { DefaultLogger } from './logger.js';

export class ArIO implements ContractStateProvider {
  private contractStateProvider: ContractStateProvider;
  http: AxiosInstance;
  logger: DefaultLogger;

  constructor({
    contractStateProvider,
    logger = new DefaultLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
  }: {
    contractStateProvider: ContractStateProvider;
    logger?: DefaultLogger;
  }) {
    this.contractStateProvider = contractStateProvider;
    this.logger = logger;
    this.http = axiosRetry(axios, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        this.logger.debug(`Retrying request: ${error.message}`);
        return (
          !!error.response && RESPONSE_RETRY_CODES.has(error.response.status)
        );
      },
    }) as unknown as AxiosInstance;
  }

  /**
   * Fetches the state of a contract.
   * @param {string} contractTxId - The Arweave transaction id of the contract.
   */
  async getContractState<ContractState>(
    contractTxId: string,
  ): Promise<ContractState> {
    return this.contractStateProvider.getContractState(contractTxId);
  }
}
