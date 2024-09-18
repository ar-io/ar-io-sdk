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
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import { ILogger, Logger } from '../common/logger.js';
import { version } from '../version.js';

export interface AxiosInstanceParameters {
  axiosConfig?: Omit<AxiosRequestConfig, 'validateStatus'>;
  retryConfig?: IAxiosRetryConfig;
  logger?: ILogger;
}

export const createAxiosInstance = ({
  axiosConfig = {},
  logger = Logger.default,
  retryConfig = {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => axiosRetry.isRetryableError(error),
    onRetry(retryCount, error, requestConfig) {
      logger.error(
        `Retrying request ${requestConfig.url} attempt ${retryCount}`,
        error,
      );
    },
  },
}: AxiosInstanceParameters = {}): AxiosInstance => {
  const axiosInstance = axios.create({
    ...axiosConfig,
    maxRedirects: 0,
    headers: {
      ...axiosConfig.headers,
      'x-source-version': `${version}`,
      'x-source-identifier': 'ar-io-sdk',
    },
    validateStatus: () => true, // don't throw on non-200 status codes
  });
  // add retries
  axiosRetry(axiosInstance, retryConfig);
  return axiosInstance;
};
