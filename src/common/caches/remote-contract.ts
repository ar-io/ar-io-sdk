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
  EvaluationParameters,
  HTTPClient,
  Logger,
  SmartWeaveContract,
} from '../../types/index.js';
import { AxiosHTTPService } from '../http.js';
import { DefaultLogger } from '../logger.js';

export class ArIORemoteContract<T> implements SmartWeaveContract {
  private logger: Logger;
  private http: HTTPClient;
  private contractTxId: string;

  constructor({
    url = 'https://api.arns.app',
    contractTxId,
    logger = new DefaultLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
  }: {
    contractTxId: string;
    url?: string;
    logger?: DefaultLogger;
  }) {
    this.logger = logger;
    this.http = new AxiosHTTPService({
      url: `${url}/v1`,
      logger,
    });
    this.contractTxId = contractTxId;
  }

  async getContractState({
    evaluationParameters,
  }: {
    evaluationParameters?: EvaluationParameters;
  }): Promise<T> {
    this.logger.debug(`Fetching contract state`, {
      contractTxId: this.contractTxId,
      evaluationParameters,
    });
    return this.http.get<T>({
      endpoint: `/contract/${this.contractTxId}/state`,
      params: evaluationParameters?.evalTo,
    });
  }

  async readInteraction<K>({
    functionName,
    inputs,
    evaluationParameters,
  }: {
    functionName: string;
    inputs: object;
    evaluationParameters: EvaluationParameters;
  }): Promise<K> {
    this.logger.debug(`Evaluating read interaction on contract`, {
      functionName,
      inputs,
      evaluationParameters,
    });
    return this.http.get<K>({
      endpoint: `/contract/${this.contractTxId}/read/${functionName}`,
      params: {
        ...evaluationParameters.evalTo,
        ...inputs,
      },
    });
  }
}
