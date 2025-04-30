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
import { AoARIORead, AoGatewayWithAddress } from '../../types/io.js';

export interface GatewaysProvider {
  getGateways(): Promise<URL[]>;
}

export class NetworkGatewaysProvider implements GatewaysProvider {
  private ario: AoARIORead;
  private sortBy: 'totalDelegatedStake' | 'operatorStake' | 'startTimestamp';
  private sortOrder: 'asc' | 'desc';
  private limit: number;
  private filter: (gateway: AoGatewayWithAddress) => boolean;
  constructor({
    ario,
    sortBy = 'operatorStake',
    sortOrder = 'desc',
    limit = 1000,
    filter = (g) => g.status === 'joined',
  }: {
    ario: AoARIORead;
    sortBy?: 'totalDelegatedStake' | 'operatorStake' | 'startTimestamp';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    blocklist?: string[];
    filter?: (gateway: AoGatewayWithAddress) => boolean;
  }) {
    this.ario = ario;
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    this.limit = limit;
    this.filter = filter;
  }

  async getGateways(): Promise<URL[]> {
    let cursor: string | undefined;
    let attempts = 0;
    const gateways: AoGatewayWithAddress[] = [];
    do {
      try {
<<<<<<< HEAD
        const { items: newGateways = [], nextCursor } =
          await this.ario.getGateways({
            limit: 1000,
            cursor,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder,
          });
=======
        const { items: newGateways, nextCursor } = await this.ario.getGateways({
          limit: 1000,
          cursor,
          sortBy: this.sortBy,
          sortOrder: this.sortOrder,
        });
>>>>>>> f3fbab8 (fix(wayfinder): add initial data root verificaion class)
        gateways.push(...newGateways);
        cursor = nextCursor;
        attempts = 0; // reset attempts if we get a new cursor
      } catch (error) {
        console.error('Error fetching gateways', {
          cursor,
          attempts,
          error,
        });
        attempts++;
      }
    } while (cursor !== undefined && attempts < 3);
    // filter out any gateways that are not joined
    const filteredGateways = gateways.filter(this.filter).slice(0, this.limit);
    return filteredGateways.map(
      (g) =>
        new URL(
          `${g.settings.protocol}://${g.settings.fqdn}:${g.settings.port}`,
        ),
    );
  }
}

export class StaticGatewaysProvider implements GatewaysProvider {
  private gateways: URL[];
<<<<<<< HEAD
  constructor({ gateways }: { gateways: string[] }) {
    this.gateways = gateways.map((g) => new URL(g));
=======
  constructor({ gateways }: { gateways: URL[] }) {
    this.gateways = gateways;
>>>>>>> f3fbab8 (fix(wayfinder): add initial data root verificaion class)
  }

  async getGateways(): Promise<URL[]> {
    return this.gateways;
  }
}

export class SimpleCacheGatewaysProvider implements GatewaysProvider {
  private gatewaysProvider: GatewaysProvider;
  private ttlSeconds: number;
  private lastUpdated: number;
  private gatewaysCache: URL[];
  constructor({
    gatewaysProvider,
    ttlSeconds = 5 * 60, // 5 minutes
  }: {
    gatewaysProvider: GatewaysProvider;
    ttlSeconds?: number;
  }) {
    this.gatewaysCache = [];
    this.gatewaysProvider = gatewaysProvider;
    this.ttlSeconds = ttlSeconds;
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
        console.error('Error fetching gateways', error);
      }
    }
    return this.gatewaysCache;
  }
}
