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
  EvalToParams,
  Gateway,
  HTTPClient,
  ReadInteractionFilters,
} from '../../types/index.js';
import { isBlockHeight, isSortKey } from '../../utils/index.js';
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
  sortKeyOrBlockHeightParams(historicalIndex: any): EvalToParams {
    if (isSortKey(historicalIndex?.sortKey)) {
      return { sortKey: historicalIndex.sortKey };
    }
    if (isBlockHeight(historicalIndex?.blockHeight)) {
      return { blockHeight: historicalIndex.blockHeight };
    }
    return {};
  }
  private validateContractTxId(id: string) {
    if (!ARWEAVE_TX_REGEX.test(id)) {
      throw new Error(`Invalid contract tx id: ${id}`);
    }
  }

  async getGateway({
    address,
    evaluationParameters,
  }: { address: string } & ReadInteractionFilters) {
    this.logger.debug(`Fetching gateway ${address}`);

    const gateway = await this.getGateways({ evaluationParameters }).then(
      (gateways) => {
        if (gateways[address] === undefined) {
          throw new NotFound(`Gateway not found: ${address}`);
        }
        return gateways[address];
      },
    );
    return gateway;
  }

  async getGateways({ evaluationParameters }: ReadInteractionFilters = {}) {
    this.logger.debug(`Fetching gateways`);

    const params = this.sortKeyOrBlockHeightParams(
      evaluationParameters?.evalTo,
    );

    const { result } = await this.http.get<
      ArNSStateResponse<'result', Record<string, Gateway>>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/read/gateways`,
      params,
    });
    return result;
  }

  async getBalance({
    address,
    evaluationParameters,
  }: { address: string } & ReadInteractionFilters) {
    this.logger.debug(`Fetching balance for ${address}`);

    const params = this.sortKeyOrBlockHeightParams(
      evaluationParameters?.evalTo,
    );

    const { result } = await this.http
      .get<ArNSStateResponse<'result', number>>({
        endpoint: `/contract/${this.contractTxId.toString()}/state/balances/${address}`,
        params,
      })
      .catch((e) => {
        if (e instanceof NotFound) {
          return { result: 0 };
        }
        throw e;
      });
    return result;
  }

  async getBalances({ evaluationParameters }: ReadInteractionFilters = {}) {
    this.logger.debug(`Fetching balances`);

    const params = this.sortKeyOrBlockHeightParams(
      evaluationParameters?.evalTo,
    );

    const { result } = await this.http.get<
      ArNSStateResponse<'result', Record<string, number>>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/state/balances`,
      params,
    });
    return result;
  }

  async getArNSRecord({
    domain,
    evaluationParameters,
  }: { domain: string } & ReadInteractionFilters): Promise<ArNSNameData> {
    this.logger.debug(`Fetching record for ${domain}`);

    const params = this.sortKeyOrBlockHeightParams(
      evaluationParameters?.evalTo,
    );

    const { result } = await this.http.get<
      ArNSStateResponse<'result', ArNSNameData>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/state/records/${domain}`,
      params,
    });
    return result;
  }

  async getArNSRecords({
    evaluationParameters,
  }: ReadInteractionFilters = {}): Promise<Record<string, ArNSNameData>> {
    this.logger.debug(`Fetching all records`);

    const params = this.sortKeyOrBlockHeightParams(
      evaluationParameters?.evalTo,
    );

    const { result } = await this.http.get<
      ArNSStateResponse<'result', Record<string, ArNSNameData>>
    >({
      endpoint: `/contract/${this.contractTxId.toString()}/state/records`,
      params,
    });
    return result;
  }
}
