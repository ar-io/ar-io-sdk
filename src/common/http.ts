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
import { AxiosInstance } from 'axios';

import { HTTPClient, Logger } from '../types/index.js';
import { createAxiosInstance } from '../utils/index.js';
import { FailedRequestError, NotFound, UnknownError } from './error.js';

export class AxiosHTTPService implements HTTPClient {
  private axios: AxiosInstance;
  private logger: Logger;

  // TODO: re-implement axios-retry. Currently that package is broken for nodenext.
  constructor({ url, logger }: { url: string; logger: Logger }) {
    this.logger = logger;
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: url,
        maxRedirects: 0,
      },
    });
  }
  async get<T>({
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
    params?: Record<string, unknown>;
  }): Promise<T> {
    this.logger.debug(
      `Get request to endpoint: ${endpoint} with params ${JSON.stringify(params, undefined, 2)}`,
    );
    const { status, statusText, data } = await this.axios.get<T>(endpoint, {
      headers,
      signal,
      params,
    });

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
