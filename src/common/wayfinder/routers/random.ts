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
import { WayfinderRouter } from '../../../types/wayfinder.js';
import { randomInt } from '../../../utils/random.js';
import { GatewaysProvider } from '../gateways.js';

export class RandomGatewayRouter implements WayfinderRouter {
  public readonly name = 'random';
  private gatewaysProvider: GatewaysProvider;
  private blocklist: string[];
  constructor({
    gatewaysProvider,
    blocklist = [],
  }: {
    gatewaysProvider: GatewaysProvider;
    blocklist?: string[];
  }) {
    this.gatewaysProvider = gatewaysProvider;
    this.blocklist = blocklist;
  }

  async getTargetGateway(): Promise<URL> {
    const allGateways = await this.gatewaysProvider.getGateways();
    const gateways = allGateways.filter(
      (g) => g.status === 'joined' && !this.blocklist.includes(g.settings.fqdn),
    );

    const targetGateway = gateways[randomInt(0, gateways.length)];
    if (targetGateway === undefined) {
      throw new Error('No target gateway found');
    }
    return new URL(
      `${targetGateway.settings.protocol}://${targetGateway.settings.fqdn}:${targetGateway.settings.port}`,
    );
  }
}
