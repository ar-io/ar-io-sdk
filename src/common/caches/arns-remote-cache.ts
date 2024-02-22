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
import { ARNS_TESTNET_REGISTRY_TX } from '../../constants.js';
import {
  ArIOContract,
  ContractCache,
  EvaluatedContractState,
  Gateway,
  HTTPClient,
} from '../../types/index.js';
import { AxiosHTTPService } from '../http.js';
import { DefaultLogger } from '../logger.js';

export class ArNSRemoteCache implements ContractCache, ArIOContract {
  private contractTxId: string;
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
    this.contractTxId = ARNS_TESTNET_REGISTRY_TX;
    this.logger = logger;
    this.http = new AxiosHTTPService({
      url: `${url}/${this.apiVersion}`,
      logger,
    });
  }

  setContractTxId(contractTxId: string): ArIOContract {
    this.contractTxId = contractTxId;
    return this;
  }

  async getContractState<ContractState>({
    contractTxId,
  }: {
    contractTxId: string;
  }): Promise<ContractState> {
    this.logger.debug(`Fetching contract state`);

    const { state } = await this.http.get<
      EvaluatedContractState<ContractState>
    >({
      endpoint: `/contract/${contractTxId.toString()}`,
    });

    return state;
  }

  async getGateway({ address }: { address: string }) {
    if (!this.contractTxId) {
      throw new Error(
        'Contract TxId not set, set one before calling this function.',
      );
    }
    this.logger.debug(`Fetching gateway ${address}`);
    const gateway = await this.http.get<Gateway>({
      endpoint: `/gateway/${address}`,
    });
    return gateway;
  }

  async getGateways() {
    if (!this.contractTxId) {
      throw new Error(
        'Contract TxId not set, set one before calling this function.',
      );
    }
    this.logger.debug(`Fetching gateways`);
    const gateways = await this.http.get<Gateway[]>({
      endpoint: `/gateways`,
    });
    return gateways;
  }

  async getBalance({ address }: { address: string }) {
    if (!this.contractTxId) {
      throw new Error(
        'Contract TxId not set, set one before calling this function.',
      );
    }
    this.logger.debug(`Fetching balance for ${address}`);
    const balance = await this.http.get<number>({
      endpoint: `/balance/${address}`,
    });
    return balance;
  }

  async getBalances() {
    if (!this.contractTxId) {
      throw new Error(
        'Contract TxId not set, set one before calling this function.',
      );
    }
    this.logger.debug(`Fetching balances`);
    const balances = await this.http.get<Record<string, number>>({
      endpoint: `/balances`,
    });
    return balances;
  }
}
