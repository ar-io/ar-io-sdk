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
import {
  ArweaveTransactionID,
  ContractStateProvider,
  HTTPClient,
} from '../../types.js';
import { AxiosHTTPService } from '../http.js';
import { DefaultLogger } from '../logger.js';

export class ArNSRemoteCache implements ContractStateProvider {
  private logger: DefaultLogger;
  private http: HTTPClient;
  private apiVersion = 'v1' as const; // use v1 endpoints
  constructor({
    url = 'https://api.arns.app',
    logger = new DefaultLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
  }: {
    url?: string;
    logger?: DefaultLogger;
  }) {
    this.logger = logger;
    this.http = new AxiosHTTPService({
      url: `${url}/${this.apiVersion}`,
      logger,
    });
  }

  async getContractState<ContractState>({
    contractTxId,
  }: {
    contractTxId: ArweaveTransactionID;
  }): Promise<ContractState> {
    this.logger.debug(`Fetching contract state`);

    const state = await this.http.get<ContractState>({
      endpoint: `/contract/${contractTxId.toString()}`,
    });

    return state;
  }
}
