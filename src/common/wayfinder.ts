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

interface ArweaveDataFetcher {
  // given any URL[] params passed to a domain, provide it to wayfinder and resolve the data using the chosen strategy
  fetchData({ reference }: { reference: string }): Promise<Buffer>;
}

interface WayfinderRoutingStrategy {
  getTargetGateway(): Promise<string>;
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

export class ARIOArweaveDataFetcher implements ArweaveDataFetcher {
  // TODO: verification support here
  private strategy: WayfinderRoutingStrategy;

  constructor({ strategy }: { strategy: WayfinderRoutingStrategy }) {
    this.strategy = strategy;
  }

  async fetchData({ reference }: { reference: string }): Promise<Buffer> {
    const gateway = await this.strategy.getTargetGateway();
    const url = `${gateway}/${reference}`;
    const data = await fetch(url);
    return Buffer.from(await data.arrayBuffer());
  }
}

export const WayfinderRoutingStrategy = {
  random: RandomGatewayStrategy,
  priority: PriorityGatewayStrategy,
  fixed: FixedGatewayStrategy,
} as const;

export class Wayfinder implements ArweaveDataFetcher, ArNSNameResolver {
  // TODO: private verificationSettings: {
  //   trustedGatewayFQDNs: string[];
  //   localVerify: boolean;
  // };
  private routingStrategy: WayfinderRoutingStrategy;
  private resolver: ArNSNameResolver;
  private arweaveDataFetcher: ArweaveDataFetcher;
  private ario: AoARIORead;
  // TODO: private blocklistGatewayFQDNs: string[];
  // TODO: stats provider

  // TODO: metricsProvider for otel/prom support
  constructor({
    ario,
    routingStrategy,
    resolver,
    arweaveDataFetcher,
    // TODO: stats provider
  }: {
    ario: AoARIORead;
    routingStrategy?: WayfinderRoutingStrategy;
    resolver?: ArNSNameResolver;
    arweaveDataFetcher?: ArweaveDataFetcher;
    // TODO: support blocklist
    // TODO: stats provider
  }) {
    this.ario = ario;
    this.routingStrategy =
      routingStrategy ?? new RandomGatewayStrategy({ ario: this.ario });
    this.resolver =
      resolver ??
      new ARIOGatewayNameResolver({
        strategy: this.routingStrategy,
      });
    this.arweaveDataFetcher =
      arweaveDataFetcher ??
      new ARIOArweaveDataFetcher({
        strategy: this.routingStrategy,
      });
  }

  /**
   * @param reference - the reference to fetch data from (e.g. ar://vilenarios)
   * @returns the data as a buffer
   */
  async fetchData({ reference }: { reference: string }): Promise<Buffer> {
    return this.arweaveDataFetcher.fetchData({ reference });
  }

  /**
   * @returns the target gateway
   */
  async getTargetGateway(): Promise<string> {
    return this.routingStrategy.getTargetGateway();
  }

  /**
   * @param name - the name to resolve
   * @returns the resolution data for the arns name
   */
  async resolveArNSName({
    name,
  }: {
    name: string;
  }): Promise<ArNSNameResolutionData> {
    return this.resolver.resolveArNSName({ name });
  }

  // TODO: add verification support
  // TODO: handle support for gateway urls prefixed with ar:///
}
