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
import { Logger } from '../../../../common/logger.js';
import { RoutingStrategy } from '../../../../types/wayfinder.js';

export class FastestPingRoutingStrategy implements RoutingStrategy {
  private timeoutMs: number;
  private path: string;
  constructor({
    timeoutMs = 500,
    path = '/ar-io/info',
  }: {
    logger?: Logger;
    timeoutMs?: number;
    path?: string;
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.path = path;
  }

  async selectGateway({ gateways }: { gateways: URL[] }): Promise<URL> {
    if (gateways.length === 0) {
      throw new Error('No gateways provided');
    }

    try {
      const results = await Promise.allSettled(
        gateways.map(async (gateway) => {
          try {
            const startTime = Date.now();
            const response = await fetch(`${gateway}/${this.path}`, {
              method: 'HEAD',
              signal: AbortSignal.timeout(this.timeoutMs),
            });
            const endTime = Date.now();
            const durationMs = endTime - startTime;
            return {
              gateway,
              status: response.status,
              durationMs,
              error: null,
            };
          } catch (error) {
            // Handle network errors
            return {
              gateway,
              status: 'rejected',
              durationMs: Infinity,
              error,
            };
          }
        }),
      );

      // Process results
      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            gateway: gateways[index],
            status: 'rejected',
            durationMs: Infinity,
            error: result.reason,
          };
        }
      });

      // Filter healthy gateways and sort by latency
      const healthyGateways = processedResults
        .filter((result) => result.status === 200)
        .sort((a, b) => a.durationMs - b.durationMs);

      if (healthyGateways.length > 0) {
        return healthyGateways[0].gateway;
      }

      throw new Error('No healthy gateways found');
    } catch (error) {
      throw new Error(
        'Failed to ping gateways: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
