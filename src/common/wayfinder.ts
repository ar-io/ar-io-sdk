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
import { webcrypto } from 'crypto';

import { AoARIORead } from '../types/io.js';
import { ARIO } from './io.js';

export interface WayfinderRoutingStrategy {
  getTargetGateway: (options?: { seed?: number }) => Promise<URL>;
}

export interface WayfinderRouter<T extends AnyFunction> {
  fetch: WayfinderHttpClient<T>;
  getRedirectUrl({ reference }: { reference: string }): Promise<URL>;
}

export class FixedGatewayStrategy implements WayfinderRoutingStrategy {
  public readonly name = 'fixed';
  private gateway: string;

  constructor({ gateway }: { gateway: string }) {
    this.gateway = gateway;
  }

  async getTargetGateway(): Promise<URL> {
    return new URL(this.gateway);
  }
}

// local helper for randomness, does not support seeding
export const randomInt = (min: number, max: number): number => {
  const [rand] = webcrypto.getRandomValues(new Uint32Array(1));
  return min + (rand % (max - min));
};

export class RandomGatewayStrategy implements WayfinderRoutingStrategy {
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

export class PriorityGatewayStrategy implements WayfinderRoutingStrategy {
  public readonly name = 'priority';
  private ario: AoARIORead;
  private limit: number;
  private sortBy: 'totalDelegatedStake' | 'startTimestamp' | 'operatorStake';
  private sortOrder: 'asc' | 'desc';
  private blocklist: string[];
  constructor({
    ario,
    limit = 1,
    sortBy = 'operatorStake',
    sortOrder = 'desc',
    blocklist = [],
  }: {
    ario: AoARIORead;
    limit: number;
    sortBy: 'totalDelegatedStake' | 'operatorStake' | 'startTimestamp';
    sortOrder: 'asc' | 'desc';
    blocklist: string[];
  }) {
    this.ario = ario;
    this.limit = limit;
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    this.blocklist = blocklist;
  }

  // TODO: builder pattern to easily change the parameters for the strategy

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

export type WayfinderRoutingStrategyName = 'random' | 'priority' | 'fixed';

export const WayfinderRoutingStrategies: Record<
  WayfinderRoutingStrategyName,
  new (...args: any[]) => WayfinderRoutingStrategy
> = {
  random: RandomGatewayStrategy,
  priority: PriorityGatewayStrategy,
  fixed: FixedGatewayStrategy,
} as const;

export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txIdRegex = /^[a-z0-9]{43}$/;

// TODO: introduce wayfinder http wrapper class/interface so we can support a variety of http clients to proxy requests through
export type AnyFunction = (...args: any[]) => any;
export type WayfinderHttpClient<T extends AnyFunction> = T;
export const createWayfinderHttpClient = <T extends AnyFunction>({
  httpClient,
}: {
  httpClient: T; // generic http client parameters
}): WayfinderHttpClient<T> => {
  return new Proxy(httpClient, {
    async apply(
      _target,
      thisArg,
      argArray: Parameters<T>,
    ): Promise<ReturnType<T>> {
      const originalUrl = argArray[0];
      let wayfinderUrl = originalUrl;
      if (typeof originalUrl === 'string' && originalUrl.startsWith('ar://')) {
        wayfinderUrl = (
          await thisArg.getRedirectUrl({ reference: originalUrl })
        ).toString();
      }
      // wraps any standard http client with ar:// support
      return httpClient(wayfinderUrl, ...argArray.slice(1)) as ReturnType<T>;
    },
  }) as WayfinderHttpClient<T>;
};

export class Wayfinder<T extends AnyFunction> implements WayfinderRouter<T> {
  public readonly strategy: WayfinderRoutingStrategy;
  public readonly fetch: WayfinderHttpClient<T>;
  public readonly ario: AoARIORead;
  public readonly blocklist: string[];
  // TODO: stats provider
  // TODO: metricsProvider for otel/prom support
  // TODO: a names cache and gateways cache
  // TODO: private verificationSettings: {
  //   trustedGateways: URL[];
  //   method: 'local' | 'remote';
  // };
  constructor({
    ario = ARIO.mainnet(),
    blocklist = [],
    strategy = new RandomGatewayStrategy({ ario, blocklist }),
    fetch,
    // TODO: stats provider
  }: {
    ario?: AoARIORead;
    blocklist?: string[];
    strategy?: WayfinderRoutingStrategy;
    fetch: WayfinderHttpClient<T>;
    // TODO: stats provider
  }) {
    this.strategy = strategy;
    this.fetch = createWayfinderHttpClient<T>({
      httpClient: fetch,
    });
  }

  // TODO: add builder to set http client so it can be easily changed
  // TODO: builder to set routing strategy so it can be easily changed

  // reference equates to ar://<something>
  async getRedirectUrl({ reference }: { reference: string }): Promise<URL> {
    // break out the ar://
    const [protocol, path] = reference.split('://');
    if (protocol !== 'ar') {
      throw new Error('Invalid reference, must start with ar://');
    }

    if (path.startsWith('/')) {
      return new URL(path.slice(1), await this.strategy.getTargetGateway());
    }

    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(path)) {
      const [txId, ...rest] = path.split('/');
      return new URL(
        `${txId}${rest.join('/')}`,
        await this.strategy.getTargetGateway(),
      );
    }

    if (arnsRegex.test(path)) {
      // TODO: arns names may only support query params after the name
      const [name, ...rest] = path.split('/');
      // TODO: check a local base name cache list the name exists
      const gateway = await this.strategy.getTargetGateway();
      const arnsName = `${gateway.protocol}//${name}.${gateway.hostname}${gateway.port ? `:${gateway.port}` : ''}`;
      return new URL(rest.join('/'), arnsName);
    }

    // TODO: throw here if it's not a valid reference
    throw new Error(
      'Invalid reference. Must be of the form ar://<txid> or ar://<name> or ar:///<gateway-api>',
    );
  }

  // TODO: support updating the routing strategy
  // TODO: add verification support
  // TODO: handle support for gateway urls prefixed with ar:///
}
