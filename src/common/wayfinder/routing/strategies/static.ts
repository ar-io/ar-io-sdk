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

export class StaticRoutingStrategy implements RoutingStrategy {
  public readonly name = 'static';
  private gateway: URL;
  private logger: Logger;
  constructor({
    gateway,
    logger = Logger.default,
  }: {
    gateway: string;
    logger?: Logger;
  }) {
    try {
      this.gateway = new URL(gateway);
    } catch (error) {
      throw new Error(`Invalid URL provided for static gateway: ${gateway}`);
    }
    this.logger = logger;
  }

  // provided gateways are ignored
  async selectGateway({
    gateways = [],
  }: {
    gateways?: URL[];
  } = {}): Promise<URL> {
    if (gateways.length > 0) {
      this.logger.warn(
        'StaticRoutingStrategy does not accept provided gateways. Ignoring provided gateways...',
        {
          providedGateways: gateways.length,
          internalGateway: this.gateway,
        },
      );
    }
    return this.gateway;
  }
}
