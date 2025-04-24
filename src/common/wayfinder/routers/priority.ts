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
import { GatewaysProvider } from '../gateways.js';
import { randomInt } from '../wayfinder.js';

// TODO: one of N where N are in the last time window have met certain performance thresholds
// TODO: look at bitorrent routing protocols for inspiration
// TODO: router that looks at local stats/metrics and adjusts based on those

export class PriorityGatewayRouter implements WayfinderRouter {
  public readonly name = 'priority';
  private gatewaysProvider: GatewaysProvider;
  private limit: number;
  private sortBy: 'totalDelegatedStake' | 'startTimestamp' | 'operatorStake';
  private sortOrder: 'asc' | 'desc';
  private blocklist: string[];
  constructor({
    gatewaysProvider,
    limit = 1,
    sortBy = 'operatorStake',
    sortOrder = 'desc',
    blocklist = [],
  }: {
    gatewaysProvider: GatewaysProvider;
    limit?: number;
    sortBy?: 'totalDelegatedStake' | 'operatorStake' | 'startTimestamp';
    sortOrder?: 'asc' | 'desc';
    blocklist?: string[];
  }) {
    this.gatewaysProvider = gatewaysProvider;
    this.limit = limit;
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    this.blocklist = blocklist;
  }

  async getTargetGateway(): Promise<URL> {
    const allGateways = await this.gatewaysProvider.getGateways();
    const gateways = allGateways.filter(
      (gateway) =>
        gateway.status === 'joined' &&
        !this.blocklist.includes(gateway.settings.fqdn),
    );
    const sortedGateways = gateways
      .sort(
        this.sortOrder === 'asc'
          ? (a, b) => a[this.sortBy] - b[this.sortBy]
          : (a, b) => b[this.sortBy] - a[this.sortBy],
      )
      .slice(0, this.limit);

    const targetGateway = sortedGateways[randomInt(0, sortedGateways.length)];

    if (targetGateway === undefined) {
      throw new Error('No target gateway found');
    }

    return new URL(
      `${targetGateway.settings.protocol}://${targetGateway.settings.fqdn}:${targetGateway.settings.port}`,
    );
  }
}
