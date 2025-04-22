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
import { AoARIORead, AoGateway } from '../types/io.js';
import { ARIO } from './io.js';

/**
 * ar:///info vs ar://ar-io/observer/reports/current
 *
 * ar://vilenarios
 *
 * ar://<TX-ID>/<PATH>?<QUERY-STRING>
 */

type ArNSNameResolutionData = {
  ttlSeconds: number;
  txId: string;
  processId: string;
  owner: string;
  undernameLimit: number;
  index: number;
};
interface ArNSNameResolver {
  resolveArNSName({ name }: { name: string }): Promise<ArNSNameResolutionData>;
}

interface WayfinderRoutingStrategy {
  getTargetGateway(): Promise<string>;
}

interface WayfinderRouter {
  getRedirectUrl({ reference }: { reference: string }): Promise<URL>;
  fetch<T>({ reference }: { reference: string }): Promise<T>;
}

export class FixedGatewayStrategy implements WayfinderRoutingStrategy {
  private gateway: string;

  constructor({ gateway }: { gateway: string }) {
    this.gateway = gateway;
  }

  async getTargetGateway(): Promise<string> {
    return this.gateway;
  }
}

export class RandomGatewayStrategy implements WayfinderRoutingStrategy {
  private ario: AoARIORead;

  constructor({ ario }: { ario: AoARIORead }) {
    this.ario = ario;
  }

  async getTargetGateway(): Promise<string> {
    // TODO: use a seed to ensure consistent results
    const seed = Math.random();
    // TODO: use read through promise cache to fetch gateways and store them in the cache
    const { items: gateways } = await this.ario.getGateways({
      sortBy: 'gatewayAddress',
      limit: 1000,
    });
    const targetGateway = gateways[Math.floor(seed * gateways.length)];
    return `${targetGateway.settings.protocol}://${targetGateway.settings.fqdn}:${targetGateway.settings.port}`;
  }
}

export class PriorityGatewayStrategy implements WayfinderRoutingStrategy {
  private ario: AoARIORead;
  private limit: number;
  private sortBy: Pick<
    AoGateway,
    'operatorStake' | 'totalDelegatedStake' | 'stats' | 'weights'
  >;
  private sortOrder: 'asc' | 'desc';

  constructor({
    ario,
    limit,
    sortBy,
    sortOrder,
  }: {
    ario: AoARIORead;
    limit: number;
    sortBy: Pick<
      AoGateway,
      'operatorStake' | 'totalDelegatedStake' | 'stats' | 'weights'
    >;
    sortOrder: 'asc' | 'desc';
    // TODO: support blocklist
  }) {
    this.ario = ario;
    this.limit = limit;
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
  }

  async getTargetGateway() {
    // TODO: use a seed to ensure consistent results
    const seed = Math.random();
    const { items: gateways } = await this.ario.getGateways({
      sortOrder: this.sortOrder,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore support for AoGatewayWithAddress
      sortBy: this.sortBy,
      limit: this.limit,
    });

    // filter out gateways that are in the blocklist
    const targetGateway = gateways[Math.floor(seed * gateways.length)];
    return `${targetGateway.settings.protocol}://${targetGateway.settings.fqdn}:${targetGateway.settings.port}`;
  }
}

export class ARIOGatewayNameResolver implements ArNSNameResolver {
  private strategy: WayfinderRoutingStrategy;

  constructor({ strategy }: { strategy: WayfinderRoutingStrategy }) {
    this.strategy = strategy;
  }

  async resolveArNSName({
    name,
  }: {
    name: string;
  }): Promise<ArNSNameResolutionData> {
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

export const WayfinderRoutingStrategy = {
  random: RandomGatewayStrategy,
  priority: PriorityGatewayStrategy,
  fixed: FixedGatewayStrategy,
} as const;

export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txidRegex = /^[a-z0-9]{43}$/;

export class Wayfinder implements WayfinderRoutingStrategy, WayfinderRouter {
  // TODO: private verificationSettings: {
  //   trustedGatewayFQDNs: string[];
  //   localVerify: boolean;
  // };
  private routingStrategy: WayfinderRoutingStrategy;
  private ario: AoARIORead;
  private resolver: ArNSNameResolver;
  // TODO: private blocklistGatewayFQDNs: string[];
  // TODO: stats provider

  // TODO: metricsProvider for otel/prom support
  constructor({
    ario = ARIO.mainnet(),
    routingStrategy = new RandomGatewayStrategy({ ario }),
    resolver = new ARIOGatewayNameResolver({
      strategy: routingStrategy,
    }),
    // TODO: stats provider
  }: {
    ario?: AoARIORead;
    routingStrategy?: WayfinderRoutingStrategy;
    resolver?: ArNSNameResolver;
    // TODO: support blocklist
    // TODO: stats provider
  }) {
    this.ario = ario;
    this.routingStrategy = routingStrategy;
    this.resolver = resolver;
  }

  async getRedirectUrl({ reference }: { reference: string }): Promise<URL> {
    // break out the ar://
    const [protocol, path] = reference.split('://');
    if (protocol !== 'ar') {
      throw new Error('Invalid reference, must start with ar://');
    }

    if (path.startsWith('/')) {
      // route to gateway
      return new URL(await this.getTargetGateway(), path);
    }
    if (arnsRegex.test(path)) {
      // TODO: handle `/` after the arns name
      const name = path.split('/')[0];
      const { txId } = await this.resolver.resolveArNSName({ name });
      return new URL(await this.getTargetGateway(), `${txId}${path}`);
    }
    if (txidRegex.test(path)) {
      // TODO: handle `/` after the txid
      const txid = path.split('/')[0];
      return new URL(await this.getTargetGateway(), `${txid}${path}`);
    }

    throw new Error('Invalid reference');
  }

  async fetch<T>({ reference }: { reference: string }): Promise<T> {
    // must start with ar://
    const url = await this.getRedirectUrl({ reference });
    const data = await fetch(url);
    if (!data.ok) {
      throw new Error(`Failed to fetch data from ${url}`);
    }
    // TODO: return desired data type
    return data.json() as T;
  }

  /**
   * @returns the target gateway
   */
  async getTargetGateway(): Promise<string> {
    return this.routingStrategy.getTargetGateway();
  }

  // TODO: add verification support
  // TODO: handle support for gateway urls prefixed with ar:///
}
