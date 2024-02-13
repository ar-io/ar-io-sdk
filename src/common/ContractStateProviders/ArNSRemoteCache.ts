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

import { ContractStateProvider } from '../../types.js';
import { validateArweaveId } from '../../utils/index.js';
import { BadRequest, BaseError } from '../error.js';
import { ArIoWinstonLogger } from '../logger.js';

export class ArNSRemoteCacheError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'ArNSRemoteCacheError';
  }
}

const RESPONSE_RETRY_CODES = new Set([429, 503]);
export class ArNSRemoteCache implements ContractStateProvider {
  protected logger: ArIoWinstonLogger;
  http: AxiosInstance;
  constructor({
    url = 'api.arns.app',
    logger = new ArIoWinstonLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
    version = 'v1',
  }: {
    url?: string;
    logger?: ArIoWinstonLogger;
    version?: string;
  }) {
    this.logger = logger;
    const arnsServiceClient = axios.create({
      baseURL: `${url}/${version}`,
    });
    this.http = axiosRetry(arnsServiceClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        this.logger.debug(`Retrying request. Error: ${error}`);
        return RESPONSE_RETRY_CODES.has(error.response!.status);
      },
    }) as any as AxiosInstance;
  }

  async getContractState<ContractState>(
    contractId: string,
  ): Promise<ContractState> {
    validateArweaveId(contractId);
    const contractLogger = this.logger.logger.child({ contractId });
    contractLogger.debug(`Fetching contract state`);

    const response = await this.http<any, any>(`/contract/${contractId}`).catch(
      (error) =>
        contractLogger.debug(`Failed to fetch contract state: ${error}`),
    );

    if (!response) {
      throw new BadRequest(
        `Failed to fetch contract state. ${response?.status} ${response?.statusText()}`,
      );
    }

    contractLogger.debug(
      `Fetched contract state. Size: ${response?.headers?.get('content-length')} bytes.`,
    );

    return response.json();
  }
}
