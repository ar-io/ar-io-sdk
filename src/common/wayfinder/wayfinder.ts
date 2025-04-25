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
import { WayfinderRouter } from '../../types/wayfinder.js';
import { ARIO } from '../io.js';
import { ARIOGatewaysProvider } from './gateways.js';
import { RandomGatewayRouter } from './routers/random.js';

// local types for wayfinder
type HttpClientFunction = (...args: [string, ...unknown[]]) => unknown;
type WayfinderHttpClient<T extends HttpClientFunction> = T;

// known regexes for wayfinder urls
export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txIdRegex = /^[a-z0-9]{43}$/;

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
  // TODO: consider changing variable wayfinderUrl
  originalUrl: string | URL; // TODO: add union type to UrlString
  targetGateway: string | URL; // TODO: add union type to UrlString
}): URL => {
  if (originalUrl.toString().startsWith('ar://')) {
    const [, path] = originalUrl.toString().split('ar://');

    // e.g. ar:///info should route to the info endpoint of the target gateway
    if (path.startsWith('/')) {
      return new URL(path.slice(1), targetGateway);
    }

    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(path)) {
      const [txId, ...rest] = path.split('/');
      return new URL(`${txId}${rest.join('/')}`, targetGateway);
    }

    if (arnsRegex.test(path)) {
      // TODO: tests to ensure arns names support query params and paths
      const [name, ...rest] = path.split('/');
      const targetGatewayUrl = new URL(targetGateway);
      const arnsUrl = `${targetGatewayUrl.protocol}//${name}.${targetGatewayUrl.hostname}${targetGatewayUrl.port ? `:${targetGatewayUrl.port}` : ''}`;
      return new URL(rest.join('/'), arnsUrl);
    }

    // TODO: support .eth addresses
    // TODO: "gasless" routing via DNS TXT records (e.g. ar://gatewaypie.com -> TXT record lookup for TX ID and redirect to that gateway)
  }

  // return the original url if it's not a wayfinder url (allows you to use the wayfinder client with non-wayfinder urls)
  return new URL(originalUrl);
};

/**
 * Creates a wrapped http client that supports ar:// protocol
 *
 * This function leverages a Proxy to intercept calls to the http client
 * and redirects them to the target gateway using the resolveUrl function url.
 * It also supports the http client methods like get(), post(), put(), delete(), etc.
 *
 * Any URLs provided that are not wayfinder urls will be returned as is.
 *
 * @param httpClient - the http client to wrap (e.g. axios, fetch, got, etc.)
 * @param resolveUrl - the function to construct the redirect url for ar:// requests
 * @returns a wrapped http client that supports ar:// protocol
 */
export const createWayfinderClient = <T extends HttpClientFunction>({
  httpClient,
  resolveUrl,
}: {
  httpClient: T;
  resolveUrl: (params: { originalUrl: string | URL }) => Promise<URL>;
  // TODO: support a verifyDataHash function that can be used to verify the data
  // TODO: support a logger for debugging
  // TODO: retry strategy to get a new gateway router
}): WayfinderHttpClient<T> => {
  const wayfinderRedirect = async (
    fn: HttpClientFunction,
    rawArgs: [string, ...unknown[]],
  ) => {
    // TODO: handle if first arg is not a string (i.e. just return the result of the function call)
    const [originalUrl, ...rest] = rawArgs;
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
    // axios() or got()
    apply: (_target, _thisArg, argArray) =>
      wayfinderRedirect(httpClient, argArray as [string, ...unknown[]]),

    // support http clients that use methods like `got.get`, `got.post`, `axios.get`, etc. while still using the wayfinder redirect function
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...inner: unknown[]) =>
          wayfinderRedirect(
            value.bind(target),
            inner as [string, ...unknown[]],
          );
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
export class Wayfinder<T extends HttpClientFunction> {
  /**
   * The router to use for requests
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() })
   *   }),
   * });
   */
  public readonly router: WayfinderRouter;
  /**
   * The http client to use for requests
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() })
   *   }),
   *   httpClient: axios,
   * });
   */
  public readonly httpClient: T;
  /**
   * The function that resolves the redirect url for ar:// requests to a target gateway
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() })
   *   }),
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
   * const { request: wayfind } = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() })
   *   }),
   *   httpClient: axios,
   * });;
   *
   * const response = await wayfind('ar://example', {
   *   method: 'POST',
   *   data: {
   *     name: 'John Doe',
   *   },
   * })
   */
  public readonly request: WayfinderHttpClient<T>;
  // TODO: stats provider
  // TODO: metricsProvider for otel/prom support
  // TODO: private verificationSettings: {
  //   trustedGateways: URL[];
  //   method: 'local' | 'remote';
  // };
  constructor({
    // TODO: consider changing router to routingStrategy or strategy
    router = new RandomGatewayRouter({
      // optionally use a cache gateways provider to reduce the number of requests to the contract
      gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() }),
    }),
    httpClient,
    // TODO: add verifier interface that provides a verifyDataHash function
    // TODO: stats provider
  }: {
    router: WayfinderRouter;
    httpClient: T;
    // TODO: fallback handling for when the target gateway is not available
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
