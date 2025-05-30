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
import { RoutingStrategy } from '../../../../types/wayfinder.js';
import { Logger } from '../../../logger.js';
import { FastestPingRoutingStrategy } from './ping.js';

export class PreferredWithFallbackRoutingStrategy implements RoutingStrategy {
  public readonly name = 'preferred-with-fallback';
  private preferredGateway: URL;
  private fallbackStrategy: RoutingStrategy;
  private logger: Logger;

  constructor({
    preferredGateway,
    fallbackStrategy = new FastestPingRoutingStrategy(),
    logger = Logger.default,
  }: {
    preferredGateway: string;
    fallbackStrategy?: RoutingStrategy;
    logger?: Logger;
  }) {
    try {
      this.preferredGateway = new URL(preferredGateway);
    } catch (error) {
      throw new Error(
        `Invalid URL provided for preferred gateway: ${preferredGateway}`,
      );
    }
    this.fallbackStrategy = fallbackStrategy;
    this.logger = logger;
  }

  async selectGateway({ gateways = [] }: { gateways: URL[] }): Promise<URL> {
    this.logger.debug('Attempting to connect to preferred gateway', {
      preferredGateway: this.preferredGateway.toString(),
    });

    try {
      // Check if the preferred gateway is responsive
      const response = await fetch(this.preferredGateway.toString(), {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000),
      });

      if (response.ok) {
        this.logger.debug('Successfully connected to preferred gateway', {
          preferredGateway: this.preferredGateway.toString(),
        });
        return this.preferredGateway;
      }

      throw new Error(
        `Preferred gateway responded with status: ${response.status}`,
      );
    } catch (error) {
      this.logger.warn(
        'Failed to connect to preferred gateway, falling back to alternative strategy',
        {
          preferredGateway: this.preferredGateway.toString(),
          error: error instanceof Error ? error.message : String(error),
          fallbackStrategy: this.fallbackStrategy.constructor.name,
        },
      );

      // Fall back to the provided routing strategy
      return this.fallbackStrategy.selectGateway({ gateways });
    }
  }
}
