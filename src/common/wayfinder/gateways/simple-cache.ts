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
import { GatewaysProvider } from '../../../types/wayfinder.js';
import { Logger } from '../../../web/index.js';

export class SimpleCacheGatewaysProvider implements GatewaysProvider {
  private gatewaysProvider: GatewaysProvider;
  private ttlSeconds: number;
  private lastUpdated: number;
  private gatewaysCache: URL[];
  private logger: Logger;
  constructor({
    gatewaysProvider,
    ttlSeconds = 60 * 60, // 1 hour
    logger = Logger.default,
  }: {
    gatewaysProvider: GatewaysProvider;
    ttlSeconds?: number;
    logger?: Logger;
  }) {
    this.gatewaysCache = [];
    this.gatewaysProvider = gatewaysProvider;
    this.ttlSeconds = ttlSeconds;
    this.logger = logger;
  }

  async getGateways(): Promise<URL[]> {
    const now = Date.now();
    if (
      this.gatewaysCache.length === 0 ||
      now - this.lastUpdated > this.ttlSeconds * 1000
    ) {
      try {
        // preserve the cache if the fetch fails
        const allGateways = await this.gatewaysProvider.getGateways();
        this.gatewaysCache = allGateways;
        this.lastUpdated = now;
      } catch (error) {
        this.logger.error('Error fetching gateways', error);
      }
    }
    return this.gatewaysCache;
  }
}
