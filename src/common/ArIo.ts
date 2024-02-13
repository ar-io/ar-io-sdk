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
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

import { ContractStateProvider } from '../types.js';
import { BaseError } from './error.js';
import { ArIoWinstonLogger } from './logger.js';

export class ArIoError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'ArIoError';
  }
}

const RESPONSE_RETRY_CODES = new Set([429, 503]);

export class ArIo implements ContractStateProvider {
  _arweave: Arweave;
  _contractStateProvider: ContractStateProvider;
  http: AxiosInstance;
  logger: ArIoWinstonLogger;

  constructor({
    arweave,
    contractStateProvider,
    logger = new ArIoWinstonLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
  }: {
    arweave?: Arweave;
    contractStateProvider: ContractStateProvider;
    logger?: ArIoWinstonLogger;
  }) {
    this._arweave = arweave ?? Arweave.init({}); // use default arweave instance if not provided
    this._contractStateProvider = contractStateProvider;
    this.logger = logger;
    this.http = axiosRetry(axios, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        this.logger.debug(`Retrying request: ${error.message}`);
        return RESPONSE_RETRY_CODES.has(error.response!.status);
      },
    }) as any as AxiosInstance;
  }

  /**
   * Fetches the state of a contract.
   * @param {string} contractId - The Arweave transaction id of the contract.
   */
  async getContractState<ContractState>(
    contractId: string,
  ): Promise<ContractState> {
    return await this._contractStateProvider.getContractState(contractId);
  }
}
