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
import { AoARIORead } from '../../../types/io.js';
import { WayfinderRouter } from '../../../types/wayfinder.js';
import { randomInt } from '../wayfinder.js';

export class RandomGatewayRouter implements WayfinderRouter {
  public readonly name = 'random';
  private ario: AoARIORead;
  private blocklist: string[];
  constructor({
    ario,
    blocklist = [],
    // TODO: some entropy source like crypto.randomBytes
  }: {
    ario: AoARIORead;
    blocklist?: string[];
  }) {
    this.ario = ario;
    this.blocklist = blocklist;
  }

  async getTargetGateway(): Promise<URL> {
    // TODO: use read through promise cache to fetch gateways and store them in the cache - TODO: make sure it's joined
    const { items: gateways } = await this.ario.getGateways({
      sortBy: 'gatewayAddress',
      limit: 1000,
    });
    const filteredGateways = gateways
      .filter((gateway) => gateway.status === 'joined')
      .filter((gateway) => !this.blocklist.includes(gateway.settings.fqdn));

    const targetGateway =
      filteredGateways[randomInt(0, filteredGateways.length)];
    if (targetGateway === undefined) {
      throw new Error('No target gateway found');
    }
    return new URL(
      `${targetGateway.settings.protocol}://${targetGateway.settings.fqdn}:${targetGateway.settings.port}`,
    );
  }
}
