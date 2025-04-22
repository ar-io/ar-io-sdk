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
import axios from 'axios';

import { AoARIORead } from '../types/io.js';
import { ARIO } from './io.js';

type ArNSNameResolutionData = {
  ttlSeconds: number;
  txId: string;
  processId: string;
  owner: string;
  undernameLimit: number;
  undernameIndex: number; // index of the undername relative to the limit
};
export interface ArNSNameResolver {
  resolve({ name }: { name: string }): Promise<ArNSNameResolutionData>;
}

export interface WayfinderRoutingStrategy {
  getTargetGateway(): Promise<URL>;
}

export interface WayfinderRouter {
  http: typeof fetch | typeof axios;
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

export class RandomGatewayStrategy implements WayfinderRoutingStrategy {
  private ario: AoARIORead;
  public readonly name = 'random';
  private blocklist: string[];
  constructor({
    ario,
    blocklist = [],
  }: {
    ario: AoARIORead;
    blocklist?: string[];
  }) {
    this.ario = ario;
    this.blocklist = blocklist;
  }

  async getTargetGateway({ seed = Math.random() }: { seed?: number } = {}) {
    // TODO: use read through promise cache to fetch gateways and store them in the cache - TODO: make sure it's joined
    const { items: gateways } = await this.ario.getGateways({
      sortBy: 'gatewayAddress',
      limit: 1000,
    });
    const filteredGateways = gateways
      .filter((gateway) => gateway.status === 'joined')
      .filter((gateway) => !this.blocklist.includes(gateway.settings.fqdn));
    const targetGateway =
      filteredGateways[Math.floor(seed * filteredGateways.length)];
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

  async getTargetGateway({ seed = Math.random() }: { seed?: number } = {}) {
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
      filteredGateways[Math.floor(seed * filteredGateways.length)];

    if (targetGateway === undefined) {
      throw new Error('No target gateway found');
    }

    return new URL(
      `${targetGateway.settings.protocol}://${targetGateway.settings.fqdn}:${targetGateway.settings.port}`,
    );
  }
}

export class ARIOGatewayNameResolver implements ArNSNameResolver {
  private strategy: WayfinderRoutingStrategy;
  public readonly name = 'ario';
  constructor({ strategy }: { strategy: WayfinderRoutingStrategy }) {
    this.strategy = strategy;
  }

  async resolve({ name }: { name: string }): Promise<ArNSNameResolutionData> {
    const gateway = await this.strategy.getTargetGateway();
    const url = `${gateway}/ar-io/resolver/${name}`;
    const data = await fetch(url);
    if (!data.ok) {
      throw new Error(`Failed to resolve gateway for ${name}`);
    }

    const json = await data.json();
    return json as ArNSNameResolutionData;
  }
}

export type WayfinderRoutingStrategyName = 'random' | 'priority' | 'fixed';

export const WayfinderRoutingStrategies = {
  random: RandomGatewayStrategy,
  priority: PriorityGatewayStrategy,
  fixed: FixedGatewayStrategy,
} as const;

export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txIdRegex = /^[a-z0-9]{43}$/;

type RequestInfo = Parameters<typeof fetch>[0];

// TODO: introduce wayfinder http wrapper class/interface so we can support a variety of http clients to proxy requests through
export interface WayfinderHttpClient<T extends typeof fetch | typeof axios> {
  wrapFetch(...args: Parameters<T>): ReturnType<T>;
}

export class Wayfinder implements WayfinderRoutingStrategy, WayfinderRouter {
  // TODO: private verificationSettings: {
  //   trustedGatewayFQDNs: string[];
  //   localVerify: boolean;
  // };
  private strategy: WayfinderRoutingStrategy;
  // private resolver: ArNSNameResolver;
  public readonly http: typeof fetch | typeof axios;
  // TODO: private blocklistGatewayFQDNs: string[];
  // TODO: stats provider

  // TODO: metricsProvider for otel/prom support
  constructor({
    ario = ARIO.mainnet(),
    blocklist = [],
    strategy = new RandomGatewayStrategy({ ario, blocklist }),
    http = fetch,
    // TODO: stats provider
  }: {
    ario?: AoARIORead;
    blocklist?: string[];
    strategy?: WayfinderRoutingStrategy;
    resolver?: ArNSNameResolver;
    http?: typeof fetch | typeof axios;
    // TODO: support blocklist
    // TODO: stats provider
  }) {
    this.strategy = strategy;

    // add a proxy object to the fetch HTTP request
    this.http = this.wrapFetch({
      route: (url, init) => http(url, init),
    });
  }

  private wrapFetch({
    route,
  }: {
    route: (url: string, init?: RequestInit) => Promise<Response>;
  }): typeof fetch | typeof axios {
    return new Proxy(fetch, {
      async apply(_, thisArg, [url, init]: [RequestInfo, RequestInit?]) {
        let urlString = url;
        if (url.toString().startsWith('ar://')) {
          const redirectUrl = await thisArg.getRedirectUrl({
            reference: String(url),
          });
          urlString = redirectUrl.toString();
        }
        // TODO: add verification handling after we fetch the data, use an event emitter to notify listeners
        return route(urlString.toString(), init);
      },
    }) as typeof fetch;
  }

  // reference equates to ar://<something>
  async getRedirectUrl({ reference }: { reference: string }): Promise<URL> {
    // break out the ar://
    const [protocol, path] = reference.split('://');
    if (protocol !== 'ar') {
      throw new Error('Invalid reference, must start with ar://');
    }

    if (path.startsWith('/')) {
      // route to gateway e.g. ar:///info
      // results https://arweave.net/info - if they are not using an APEX arns name
      return new URL(path.slice(1), await this.getTargetGateway());
    }
    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(path)) {
      const [txId, ...rest] = path.split('/');
      return new URL(`${txId}${rest.join('/')}`, await this.getTargetGateway());
    }

    if (arnsRegex.test(path)) {
      // TODO: arns names may only support query params after the name
      const [name, ...rest] = path.split('/');
      // TODO: check a local base name cache list the name exists
      const gateway = await this.getTargetGateway();
      const arnsName = `${gateway.protocol}//${name}.${gateway.hostname}${gateway.port ? `:${gateway.port}` : ''}`;
      return new URL(rest.join('/'), arnsName);
    }

    // TODO: throw here if it's not a valid reference
    throw new Error(
      'Invalid reference. Must be of the form ar://<txid> or ar://<name> or ar:///<gateway-api>',
    );
  }

  /**
   * @returns the target gateway
   */
  async getTargetGateway(): Promise<URL> {
    return this.strategy.getTargetGateway();
  }

  // TODO: support updating the routing strategy
  // TODO: add verification support
  // TODO: handle support for gateway urls prefixed with ar:///
}
