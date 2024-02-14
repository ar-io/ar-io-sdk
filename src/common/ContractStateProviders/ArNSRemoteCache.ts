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
import { ContractStateProvider, HTTPServiceInterface } from '../../types.js';
import { validateArweaveId } from '../../utils/index.js';
import { BadRequest } from '../error.js';
import { AxiosHTTPService } from '../http.js';
import { DefaultLogger } from '../logger.js';

export class ArNSRemoteCache implements ContractStateProvider {
  protected logger: DefaultLogger;
  http: HTTPServiceInterface;
  constructor({
    url = 'api.arns.app',
    protocol = 'https',
    logger = new DefaultLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
    version = 'v1',
  }: {
    protocol?: 'http' | 'https' | 'ws';
    url?: string;
    logger?: DefaultLogger;
    version?: string;
  }) {
    this.logger = logger;
    this.http = new AxiosHTTPService({
      url: `${protocol}://${url}/${version}`,
      logger,
    });
  }

  async getContractState<ContractState>({
    contractTxId,
  }: {
    contractTxId: string;
  }): Promise<ContractState> {
    if (!validateArweaveId(contractTxId)) {
      throw new BadRequest(`Invalid contract id: ${contractTxId}`);
    }
    this.logger.debug(`Fetching contract state`);

    const response = await this.http
      .get<ContractState>({ endpoint: `/contract/${contractTxId}` })
      .catch((error) => {
        this.logger.debug(`Failed to fetch contract state: ${error}`);
        return error;
      });

    if (!response) {
      throw new BadRequest(
        `Failed to fetch contract state. ${response?.status} ${response?.statusText()}`,
      );
    }
    const result = await response.json();

    this.logger.debug(
      `Fetched contract state. Size: ${response?.headers?.get('content-length')} bytes.`,
    );

    return result;
  }
}
