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
import { ARIO } from '../../io.js';
import { randomInt } from '../wayfinder.js';

export class PriorityGatewayRouter implements WayfinderRouter {
  public readonly name = 'priority';
  private ario: AoARIORead;
  private limit: number;
  private sortBy: 'totalDelegatedStake' | 'startTimestamp' | 'operatorStake';
  private sortOrder: 'asc' | 'desc';
  private blocklist: string[];
  constructor({
    ario = ARIO.mainnet(),
    limit = 1,
    sortBy = 'operatorStake',
    sortOrder = 'desc',
    blocklist = [],
  }: {
    ario?: AoARIORead;
    limit?: number;
    sortBy?: 'totalDelegatedStake' | 'operatorStake' | 'startTimestamp';
    sortOrder?: 'asc' | 'desc';
    blocklist?: string[];
  }) {
    this.ario = ario;
    this.limit = limit;
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    this.blocklist = blocklist;
  }

  // TODO: builder pattern to easily change the parameters for the Router

  async getTargetGateway(): Promise<URL> {
    const { items: gateways } = await this.ario.getGateways({
      sortOrder: this.sortOrder,
      sortBy: this.sortBy,
      limit: 100, // filter it after get the results as the contract does not support filters
    });

    // filter out gateways that are not joined
    const filteredGateways = gateways
      .filter((gateway) => gateway.status === 'joined')
      .filter((gateway) => !this.blocklist.includes(gateway.settings.fqdn))
      .slice(0, this.limit - 1);

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
