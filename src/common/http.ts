/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { AxiosInstance } from 'axios';

import { HTTPClient } from '../types/index.js';
import { createAxiosInstance } from '../utils/http-client.js';
import { FailedRequestError, NotFound, UnknownError } from './error.js';
import { ILogger, Logger } from './logger.js';

export class AxiosHTTPService implements HTTPClient {
  private axios: AxiosInstance;
  private logger: ILogger;

  constructor({
    url,
    logger = Logger.default,
  }: {
    url: string;
    logger?: ILogger;
  }) {
    this.logger = logger;
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: url,
      },
      logger: this.logger,
    });
  }
  async get<I, K>({
    endpoint,
    signal,
    allowedStatuses = [200, 202],
    headers,
    params,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    allowedStatuses?: number[];
    headers?: Record<string, string>;
    params?: I;
  }): Promise<K> {
    this.logger.debug(
      `Get request to endpoint: ${endpoint} with params ${JSON.stringify(params, undefined, 2)}`,
    );
    const { status, statusText, data } = await this.axios.get<K>(endpoint, {
      headers,
      signal,
      params,
    });
    this.logger.debug(`Response status: ${status} ${statusText}`);

    if (!allowedStatuses.includes(status)) {
      switch (status) {
        case 404:
          throw new NotFound(statusText);
        case 400:
          throw new FailedRequestError(status, statusText);
        default:
          throw new UnknownError(statusText);
      }
    }

    return data;
  }
}
