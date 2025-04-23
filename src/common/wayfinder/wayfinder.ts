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
import { ARIOGatewaysProvider } from './gateways.js';
import { RandomGatewayRouter } from './routers/random.js';

// local types for wayfinder
type AnyFunction = (...args: unknown[]) => unknown;
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
export const resolveWayfinderUrl = ({
  originalUrl,
  targetGateway,
}: {
  originalUrl: string | URL;
  targetGateway: string | URL;
}): URL => {
  if (originalUrl.toString().startsWith('ar://')) {
    const [, path] = originalUrl.toString().split('ar://');

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
      const targetGatewayUrl = new URL(targetGateway);
      const arnsUrl = `${targetGatewayUrl.protocol}//${name}.${targetGatewayUrl.hostname}${targetGatewayUrl.port ? `:${targetGatewayUrl.port}` : ''}`;
      return new URL(rest.join('/'), arnsUrl);
    }
  }

  // return the original url if it's not a wayfinder url
  return new URL(originalUrl);
};

/**
 * Creates a wrapped http client that supports ar:// protocol
 * @param httpClient - the http client to wrap (e.g. axios, fetch, got, etc.)
 * @param resolveUrl - the function to construct the redirect url for ar:// requests
 * @returns a wrapped http client that supports ar:// protocol
 */
export const createWayfinderClient = <T extends AnyFunction>({
  httpClient,
  resolveUrl,
  // TODO: support a verifyDataHash function that can be used to verify the data
}: {
  httpClient: T;
  resolveUrl: (params: { originalUrl: string | URL }) => Promise<URL>;
  // TODO: support a verifyDataHash function that can be used to verify the data
}): WayfinderHttpClient<T> => {
  const invoke = async (fn: AnyFunction, rawArgs: [string, ...unknown[]]) => {
    const [originalUrl, ...rest] = rawArgs;
    // TODO: handle if first arg is not a string
    // route the request to the target gateway
    const redirectUrl = await resolveUrl({
      originalUrl,
    });
    // make the request to the target gateway using the redirect url and http client
    const response = await fn(redirectUrl.toString(), ...rest);
    // TODO: if verifyDataHash is provided, verify the data hash before returning
    return response;
  };

  return new Proxy(httpClient, {
    // support direct calls: fetch('ar://…', options)
    // TODO: we may want to type check the argArray to ensure it's an array of [string, ...unknown[]]
    apply: (_target, _thisArg, argArray) =>
      invoke(httpClient, argArray as [string, ...unknown[]]),

    // support http clients that use methods like `got.get`, `got.post`, `axios.get`, etc. while still using the wayfinder invoke function
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...inner: unknown[]) =>
          invoke(value.bind(target), inner as [string, ...unknown[]]);
      }
      return value; // numbers, objects, symbols pass through untouched
    },
  }) as WayfinderHttpClient<T>;
};

/**
 * The main class for the wayfinder
 * @param router - the router to use for requests
 * @param httpClient - the http client to use for requests
 * @param blocklist - the blocklist of gateways to avoid
 */
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
   * The function that resolves the redirect url for ar:// requests to a target gateway
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({ ario: ARIO.mainnet() }),
   *   httpClient: axios,
   * });
   *
   * const redirectUrl = await wayfinder.resolveUrl({ originalUrl: 'ar://example' });
   */
  public readonly resolveUrl: (params: { originalUrl: string }) => Promise<URL>;
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
  // TODO: private verificationSettings: {
  //   trustedGateways: URL[];
  //   method: 'local' | 'remote';
  // };
  constructor({
    router = new RandomGatewayRouter({
      // optionally use a cache gateways provider to reduce the number of requests to the contract
      gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() }),
    }),
    httpClient,
    // TODO: add verifier interface that provides a verifyDataHash function
    // TODO: stats provider
    // TODO: caches to reduce the number of requests to the wayfinder
  }: {
    router: WayfinderRouter;
    httpClient: T;
    // TODO: add verifier interface that provides a verifyDataHash function
    // TODO: stats provider
  }) {
    this.router = router;
    this.httpClient = httpClient;
    this.resolveUrl = async ({ originalUrl }) =>
      resolveWayfinderUrl({
        originalUrl,
        targetGateway: await this.router.getTargetGateway(),
      });
    this.request = createWayfinderClient<T>({
      httpClient,
      resolveUrl: this.resolveUrl,
      // TODO: provide the verifyDataHash function from the verifier to the wayfinder client along with verificationSettings
    });
  }

  // TODO: potential builder pattern to update the Router/blocklist/httpClient

  // TODO: add verification support
}
