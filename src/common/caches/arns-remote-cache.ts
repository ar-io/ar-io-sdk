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
import { ARNS_TESTNET_REGISTRY_TX, ARWEAVE_TX_REGEX } from '../../constants.js';
import {
  ArIOContract,
  ArNSNameData,
  ArNSStateResponse,
  Gateway,
  HTTPClient,
} from '../../types/index.js';
import { NotFound } from '../error.js';
import { AxiosHTTPService } from '../http.js';
import { DefaultLogger } from '../logger.js';

export class ArNSRemoteCache implements ArIOContract {
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
    contractTxId = ARNS_TESTNET_REGISTRY_TX,
  }: {
    url?: string;
    logger?: DefaultLogger;
    contractTxId?: string;
  }) {
    this.validateContractTxId(contractTxId);
    this.contractTxId = contractTxId;
    this.logger = logger;
    this.http = new AxiosHTTPService({
      url: `${url}/${this.apiVersion}`,
      logger,
    });
  }

  private validateContractTxId(id: string) {
    if (!ARWEAVE_TX_REGEX.test(id)) {
      throw new Error(`Invalid contract tx id: ${id}`);
    }
  }

  async getGateway({ address }: { address: string }) {
    this.logger.debug(`Fetching gateway ${address}`);
    const gateway = await this.getGateways().then((gateways) => {
      if (gateways[address] === undefined) {
        throw new NotFound(`Gateway not found: ${address}`);
      }
      return gateways[address];
    });
    return gateway;
  }

  async getGateways() {
    this.logger.debug(`Fetching gateways`);
    const { result } = await this.http.get<
      ArNSStateResponse<'result', Record<string, Gateway>>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/read/gateways`,
    });
    return result;
  }

  async getBalance({ address }: { address: string }) {
    this.logger.debug(`Fetching balance for ${address}`);
    const { result } = await this.http
      .get<ArNSStateResponse<'result', number>>({
        endpoint: `/contract/${this.contractTxId.toString()}/state/balances/${address}`,
      })
      .catch((e) => {
        if (e instanceof NotFound) {
          return { result: 0 };
        }
        throw e;
      });
    return result;
  }

  async getBalances() {
    this.logger.debug(`Fetching balances`);
    const { result } = await this.http.get<
      ArNSStateResponse<'result', Record<string, number>>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/state/balances`,
    });
    return result;
  }

  async getRecord({ domain }: { domain: string }): Promise<ArNSNameData> {
    this.logger.debug(`Fetching record for ${domain}`);
    const { result } = await this.http.get<
      ArNSStateResponse<'result', ArNSNameData>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/state/records/${domain}`,
    });
    return result;
  }

  async getRecords(): Promise<Record<string, ArNSNameData>> {
    this.logger.debug(`Fetching all records`);
    const { result } = await this.http.get<
      ArNSStateResponse<'result', Record<string, ArNSNameData>>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/state/records`,
    });
    return result;
  }
}
