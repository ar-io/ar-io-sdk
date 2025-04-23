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
  getGateways(): Promise<AoGatewayWithAddress[]>;
}

export class ARIOGatewaysProvider implements GatewaysProvider {
  private ario: AoARIORead;

  constructor({ ario }: { ario: AoARIORead }) {
    this.ario = ario;
  }

  async getGateways(): Promise<AoGatewayWithAddress[]> {
    let cursor: string | undefined;
    let attempts = 0;
    const gateways: AoGatewayWithAddress[] = [];
    do {
      try {
        const { items: newGateways, nextCursor } = await this.ario.getGateways({
          limit: 1000,
          cursor,
        });
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
    return gateways.filter((g) => g.status === 'joined');
  }
}

export class StaticGatewaysProvider implements GatewaysProvider {
  private gateways: AoGatewayWithAddress[];
  constructor({ gateways }: { gateways: AoGatewayWithAddress[] }) {
    this.gateways = gateways;
  }

  async getGateways(): Promise<AoGatewayWithAddress[]> {
    return this.gateways;
  }
}

export class SimpleCacheGatewaysProvider implements GatewaysProvider {
  private gatewaysProvider: GatewaysProvider;
  private ttlSeconds: number;
  private lastUpdated: number;
  private gatewaysCache: AoGatewayWithAddress[];
  constructor({
    gatewaysProvider,
    ttlSeconds,
  }: {
    gatewaysProvider: GatewaysProvider;
    ttlSeconds: number;
  }) {
    this.gatewaysCache = [];
    this.gatewaysProvider = gatewaysProvider;
    this.ttlSeconds = ttlSeconds;
  }

  async getGateways(): Promise<AoGatewayWithAddress[]> {
    const now = Date.now();
    if (
      this.gatewaysCache.length === 0 ||
      now - this.lastUpdated > this.ttlSeconds * 1000
    ) {
      try {
        // preserve the cache if the fetch fails
        const allGateways = await this.gatewaysProvider.getGateways();
        this.gatewaysCache = allGateways.filter((g) => g.status === 'joined');
        this.lastUpdated = now;
      } catch (error) {
        console.error('Error fetching gateways', error);
      }
    }
    return this.gatewaysCache;
  }
}
