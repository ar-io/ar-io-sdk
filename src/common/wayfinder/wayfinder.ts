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

import { WayfinderRouter } from '../../types/wayfinder.js';
import { ARIO } from '../io.js';
import { RandomGatewayRouter } from './routers/random.js';

// local types for wayfinder
type AnyFunction = (...args: any[]) => any;
type WayfinderHttpClient<T extends AnyFunction> = T;

// known regexes for wayfinder urls
export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txIdRegex = /^[a-z0-9]{43}$/;

/**
 * Cryptographically secure helper for randomness, does not support seeding
 * @param min - the minimum value
 * @param max - the maximum value
 * @returns a random integer between min and max
 */
export const randomInt = (min: number, max: number): number => {
  const [rand] = webcrypto.getRandomValues(new Uint32Array(1));
  return min + (rand % (max - min));
};

/**
 * Core function to resolve a wayfinder url against a target gateway
 * @param originalUrl - the wayfinder url to resolve
 * @param targetGateway - the target gateway to resolve the url against
 * @returns the resolved url that can be used to make a request
 */
export const resolveRedirectUrl = ({
  originalUrl,
  targetGateway,
}: {
  originalUrl: string;
  targetGateway: URL;
}): URL => {
  if (originalUrl.startsWith('ar://')) {
    const [, path] = originalUrl.split('ar://');

    if (path.startsWith('/')) {
      return new URL(path.slice(1), targetGateway);
    }

    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(path)) {
      const [txId, ...rest] = path.split('/');
      return new URL(`${txId}${rest.join('/')}`, targetGateway);
    }

    if (arnsRegex.test(path)) {
      // TODO: arns names may only support query params after the name
      const [name, ...rest] = path.split('/');
      // TODO: check a local base name cache list the name exists
      const arnsName = `${targetGateway.protocol}//${name}.${targetGateway.hostname}${targetGateway.port ? `:${targetGateway.port}` : ''}`;
      return new URL(rest.join('/'), arnsName);
    }
  }

  // return the original url if it's not a wayfinder url
  return new URL(originalUrl);
};

/**
 * Creates a wrapped http client that supports ar:// protocol
 * @param httpClient - the http client to wrap (e.g. axios, fetch, etc.)
 * @param resolveUrl - the function to construct the redirect url for ar:// requests
 * @returns a wrapped http client that supports ar:// protocol
 */
export const createWayfinderClient = <T extends AnyFunction>({
  httpClient,
  resolveUrl,
  // TODO: support a verifyDataHash function that can be used to verify the data
}: {
  httpClient: T;
  resolveUrl: (params: { originalUrl: string }) => Promise<URL>;
}): WayfinderHttpClient<T> => {
  return new Proxy(httpClient, {
    async apply(
      _target,
      _thisArg,
      argArray: Parameters<T>,
    ): Promise<ReturnType<T>> {
      const originalUrl = argArray[0];
      // get the resolved url for the request
      const redirectUrl = await resolveUrl({ originalUrl });
      // make the request to the resolved url
      return httpClient(
        redirectUrl.toString(),
        ...argArray.slice(1),
      ) as ReturnType<T>;
    },
  }) as unknown as WayfinderHttpClient<T>;
};
export class Wayfinder<T extends AnyFunction> {
  /**
   * The router to use for requests
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({ ario: ARIO.mainnet() }),
   * });
   */
  public readonly router: WayfinderRouter;
  /**
   * The blocklist of gateways to avoid
   */
  public readonly blocklist: string[];
  /**
   * The http client to use for requests
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({ ario: ARIO.mainnet() }),
   *   httpClient: axios,
   * });
   */
  public readonly httpClient: T;
  /**
   * A wrapped http client that supports ar:// protocol
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({ ario: ARIO.mainnet() }),
   *   httpClient: axios,
   * });
   *
   * const response = await wayfinder.request('ar://example');
   */
  public readonly request: WayfinderHttpClient<T>;
  // TODO: stats provider
  // TODO: metricsProvider for otel/prom support
  // TODO: a names cache and gateways cache
  // TODO: private verificationSettings: {
  //   trustedGateways: URL[];
  //   method: 'local' | 'remote';
  // };
  constructor({
    router = new RandomGatewayRouter({ ario: ARIO.mainnet() }),
    httpClient,
    // TODO: stats provider
    // TODO: caches to reduce the number of requests to the wayfinder
  }: {
    router: WayfinderRouter;
    httpClient: T;
    // TODO: stats provider
    // TODO: caches to reduce the number of requests to the wayfinder
  }) {
    this.router = router;
    this.httpClient = httpClient;
    this.request = createWayfinderClient<T>({
      httpClient,
      // TODO: provide a verifyDataHash function that can be used to verify the data
      resolveUrl: async ({ originalUrl }) =>
        resolveRedirectUrl({
          originalUrl,
          // todo: use a read through cache here or on the router to avoid calling ARIO contract on every request
          targetGateway: await this.router.getTargetGateway(),
        }),
    });
  }

  // TODO: potential builder pattern to update the Router/blocklist/httpClient

  // TODO: add verification support
}
