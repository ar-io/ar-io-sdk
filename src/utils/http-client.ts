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
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

import { version } from '../version.js';

// TODO: re-implement axios-retry. Currently latest version of axios-retry is broken for node-next builds on v4.0.0
export interface AxiosInstanceParameters {
  axiosConfig?: Omit<AxiosRequestConfig, 'validateStatus'>;
}

export const createAxiosInstance = ({
  axiosConfig = {},
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

  return axiosInstance;
};
