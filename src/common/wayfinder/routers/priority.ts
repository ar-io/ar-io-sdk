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
import { AoARIORead } from '../../../web/index.js';
import { NetworkGatewaysProvider } from '../gateways.js';

// TODO: one of N where N are in the last time window have met certain performance thresholds
// TODO: look at bitorrent routing protocols for inspiration
// TODO: router that looks at local stats/metrics and adjusts based on those

export class PriorityGatewayRouter implements WayfinderRouter {
  public readonly name = 'priority';
  public readonly gatewaysProvider: NetworkGatewaysProvider;
  constructor({
    ario,
    sortBy,
    sortOrder,
    limit,
  }: {
    ario: AoARIORead;
    sortBy: 'operatorStake' | 'totalDelegatedStake' | 'startTimestamp';
    sortOrder: 'asc' | 'desc';
    limit: number;
  }) {
    this.gatewaysProvider = new NetworkGatewaysProvider({
      ario,
      sortBy,
      sortOrder,
      limit,
    });
  }

  async getTargetGateway(): Promise<URL> {
    const gateways = await this.gatewaysProvider.getGateways();
    const targetGateway = gateways[randomInt(0, gateways.length)];
    if (targetGateway === undefined) {
      throw new Error('No target gateway found');
    }
    return targetGateway;
  }
}
