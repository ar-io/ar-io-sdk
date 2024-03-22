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
  BaseContract,
  ContractConfiguration,
  ContractSigner,
  EvaluationParameters,
  HTTPClient,
  Logger,
  ReadContract,
} from '../../types.js';
import { AxiosHTTPService } from '../http.js';
import { DefaultLogger } from '../logger.js';

// TODO: this assumes the API structure matches the current arns-service API - we will want to consider another interface that exposes relevant APIs with client implementations (arns-service, DRE nodes, etc.)
export class RemoteContract<T> implements BaseContract<T>, ReadContract {
  private logger: Logger;
  private http: HTTPClient;
  private contractTxId: string;

  constructor({
    url = 'https://api.arns.app',
    contractTxId,
    logger = new DefaultLogger(),
  }: {
    contractTxId: string;
    url?: string;
    logger?: DefaultLogger;
  }) {
    this.contractTxId = contractTxId;
    this.logger = logger;
    this.http = new AxiosHTTPService({
      url: `${url}/v1/contract/${contractTxId}`,
    });
  }

  configuration(): { contractTxId: string } {
    return {
      contractTxId: this.contractTxId,
    };
  }

  /* eslint-disable */
  // @ts-ignore
  connect(signer: ContractSigner): this {
    /* eslint-enable */
    throw new Error('Cannot connect to a remote contract');
  }

  async getState({ evaluationOptions }: EvaluationParameters = {}): Promise<T> {
    this.logger.debug(`Fetching contract state`, {
      contractTxId: this.contractTxId,
      evaluationOptions,
    });
    const { state } = await this.http.get<
      { sortKey: string } | { blockHeight: number } | Record<string, never>,
      { state: T }
    >({
      endpoint: ``,
      params: evaluationOptions?.evalTo,
    });
    return state;
  }

  async readInteraction<I, K>({
    functionName,
    inputs,
    evaluationOptions,
  }: EvaluationParameters<{ functionName: string; inputs?: I }>): Promise<K> {
    this.logger.debug(`Evaluating read interaction on contract`, {
      functionName,
      inputs,
      evaluationOptions,
    });
    const { result } = await this.http.get<
      I | Record<string, never>,
      { result: K }
    >({
      endpoint: `/read/${functionName}`,
      params: {
        ...evaluationOptions?.evalTo,
        ...inputs,
      },
    });
    return result;
  }
}
