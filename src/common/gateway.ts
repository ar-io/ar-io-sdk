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
import { HTTPClient } from '../common.js';
import {
  ArIOGateway,
  ArIOGatewayArNSDomainResolution,
  ArIOGatewayCurrentObserverReports,
  ArIOGatewayHealthCheck,
  ArIOGatewayInfo,
  ArIOGatewayObserverInfo,
} from '../gateway.js';
import { AxiosHTTPService } from './http.js';
import { ILogger, Logger } from './logger.js';

export class Gateway implements ArIOGateway {
  url: string;
  logger: ILogger;
  http: HTTPClient;

  constructor({
    url,
    logger = Logger.default,
    http = new AxiosHTTPService({
      url,
      logger,
    }),
  }: {
    url: string;
    logger?: ILogger;
    http?: HTTPClient;
  }) {
    this.url = url;
    this.logger = logger;
    this.http = http;
  }

  async healthCheck() {
    return this.http.get<undefined, ArIOGatewayHealthCheck>({
      endpoint: '/ar-io/healthcheck',
    });
  }

  async info() {
    return this.http.get<undefined, ArIOGatewayInfo>({
      endpoint: '/ar-io/info',
    });
  }

  async observerInfo() {
    return this.http.get<undefined, ArIOGatewayObserverInfo>({
      endpoint: '/ar-io/observer/info',
    });
  }

  async currentObserverReports() {
    return this.http.get<undefined, ArIOGatewayCurrentObserverReports>({
      endpoint: '/ar-io/observer/reports/current',
    });
  }

  async resolveArNSDomain(arnsDomain: string) {
    return this.http.get<undefined, ArIOGatewayArNSDomainResolution>({
      endpoint: `/ar-io/resolver/records/${arnsDomain}`,
    });
  }
}
