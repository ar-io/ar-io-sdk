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
import EventEmitter from 'node:events';

import {
  DataHashProvider,
  DataVerifier,
  WayfinderRouter,
} from '../../types/wayfinder.js';
import { ARIO } from '../io.js';
import { Logger } from '../logger.js';
import { NetworkGatewaysProvider, StaticGatewaysProvider } from './gateways.js';
import { RandomGatewayRouter } from './routers/random.js';
import { DigestVerifier } from './verification/digest-verifier.js';
import { TrustedGatewaysDigestProvider } from './verification/trusted-gateway-hash-provider.js';

// local types for wayfinder
type HttpClientArgs = [string | URL, ...unknown[]];
type HttpClientFunction = (...args: HttpClientArgs) => unknown;
type WayfinderHttpClient<T extends HttpClientFunction> = T;

// known regexes for wayfinder urls
export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txIdRegex = /^[A-Za-z0-9_-]{43}$/;

/**
 * Core function to resolve a wayfinder url against a target gateway
 * @param originalUrl - the wayfinder url to resolve
 * @param targetGateway - the target gateway to resolve the url against
 * @returns the resolved url that can be used to make a request
 */
export const resolveWayfinderUrl = async ({
  originalUrl,
  targetGateway,
  logger,
}: {
  // TODO: consider changing variable wayfinderUrl
  originalUrl: string | URL; // TODO: add union type to UrlString
  targetGateway: () => Promise<string | URL>; // TODO: add union type to UrlString
  logger?: Logger;
}): Promise<URL> => {
  if (originalUrl.toString().startsWith('ar://')) {
    logger?.debug(`Applying wayfinder routing protocol to ${originalUrl}`, {
      originalUrl,
    });
    const targetGatewayUrl = new URL(await targetGateway());
    logger?.debug(`Selected target gateway: ${targetGatewayUrl}`, {
      originalUrl,
      targetGateway: targetGatewayUrl,
    });

    const [, path] = originalUrl.toString().split('ar://');

    // e.g. ar:///info should route to the info endpoint of the target gateway
    if (path.startsWith('/')) {
      logger?.debug(`Routing to ${path.slice(1)} on ${targetGatewayUrl}`, {
        originalUrl,
        targetGateway: targetGatewayUrl,
      });
      return new URL(path.slice(1), targetGatewayUrl);
    }

    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(path)) {
      const [txId, ...rest] = path.split('/');
      return new URL(`${txId}${rest.join('/')}`, targetGatewayUrl);
    }

    if (arnsRegex.test(path)) {
      // TODO: tests to ensure arns names support query params and paths
      const [name, ...rest] = path.split('/');
      const arnsUrl = `${targetGatewayUrl.protocol}//${name}.${targetGatewayUrl.hostname}${targetGatewayUrl.port ? `:${targetGatewayUrl.port}` : ''}`;
      logger?.debug(`Routing to ${path} on ${arnsUrl}`, {
        originalUrl,
        targetGateway: targetGatewayUrl,
      });
      return new URL(rest.join('/'), arnsUrl);
    }

    // TODO: support .eth addresses
    // TODO: "gasless" routing via DNS TXT records (e.g. ar://gatewaypie.com -> TXT record lookup for TX ID and redirect to that gateway)
  }

  logger?.debug('No wayfinder routing protocol applied', {
    originalUrl,
  });

  // return the original url if it's not a wayfinder url (allows you to use the wayfinder client with non-wayfinder urls)
  return new URL(originalUrl);
};

/**
 * Wayfinder event emitter with verification events
 */
export interface WayfinderEvents {
  'verification-passed': (params: {
    originalUrl: string;
    redirectUrl: string;
    hashType: 'digest' | 'data-root';
    hash: string;
    txId: string;
  }) => void;
  'verification-failed': (params: {
    originalUrl: string;
    redirectUrl: string;
    hashType: 'digest' | 'data-root';
    trustedHash: string;
    computedHash: string;
    txId: string;
    error: Error;
  }) => void;
}
export class WayfinderEmitter extends EventEmitter {
  emit<K extends keyof WayfinderEvents>(
    event: K,
    ...args: Parameters<WayfinderEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof WayfinderEvents>(
    event: K,
    listener: WayfinderEvents[K],
  ): this {
    return super.on(event, listener);
  }
}

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
  verifyData,
  strict = true,
  emitter,
  logger,
}: {
  httpClient: T;
  resolveUrl: (params: {
    originalUrl: string | URL;
    logger?: Logger;
  }) => Promise<URL>;
  verifyData?: ({
    data,
    txId,
  }: {
    data: unknown;
    txId: string;
  }) => Promise<{ hash: string; hashType: 'digest' | 'data-root' }>;
  strict?: boolean;
  logger?: Logger;
  emitter?: WayfinderEmitter;
  // TODO: retry strategy to get a new gateway router
}): WayfinderHttpClient<T> => {
  const wayfinderRedirect = async (
    fn: HttpClientFunction,
    rawArgs: HttpClientArgs,
  ) => {
    // TODO: handle if first arg is not a string (i.e. just return the result of the function call)
    const [originalUrl, ...rest] = rawArgs;
    // route the request to the target gateway
    const redirectUrl = await resolveUrl({
      originalUrl,
      logger,
    });
    logger?.debug(`Redirecting request to ${redirectUrl}`, {
      originalUrl,
      redirectUrl,
    });
    // make the request to the target gateway using the redirect url and http client
    const response = await fn(redirectUrl.toString(), ...rest);
    logger?.debug(`Successfully routed request to ${redirectUrl}`, {
      redirectUrl,
      originalUrl,
    });
    // only verify data if the redirect url is different from the original url
    if (response && redirectUrl.toString() !== originalUrl.toString()) {
      // verify the digest of the response body
      if (verifyData) {
        // clone the response to avoid consuming the original response body
        const clonedResponse = (response as any).clone();
        // txId is either in the response headers or the path of the request as the first parameter
        // todo: we may want to move this parsing to be returned by the resolveUrl function depending on the redirect URL we've constructed
        const txId =
          (response as any).headers.get('x-arns-resolved-tx-id') ||
          redirectUrl.pathname.split('/')[1];
        if (!txId && strict) {
          throw new Error('Failed to parse data hash from response headers', {
            cause: {
              redirectUrl: redirectUrl.toString(),
              originalUrl: originalUrl.toString(),
              txId,
            },
          });
        } else if (!txId) {
          logger?.debug('No data hash provided, skipping verification', {
            redirectUrl: redirectUrl.toString(),
            originalUrl: originalUrl.toString(),
            txId,
            strict,
          });
        } else {
          logger?.debug('Verifying data hash for txId', {
            redirectUrl: redirectUrl.toString(),
            originalUrl: originalUrl.toString(),
            txId,
          });
          verifyData({
            // TODO: handle different response types (e.g. stream, buffer, text, json, etc.)
            data: await (clonedResponse as any).arrayBuffer(),
            txId,
          })
            .then(({ hash, hashType }) => {
              logger?.debug('Successfully verified data hash', {
                redirectUrl: redirectUrl.toString(),
                originalUrl: originalUrl.toString(),
                txId,
              });
              emitter?.emit('verification-passed', {
                originalUrl: originalUrl.toString(),
                redirectUrl: redirectUrl.toString(),
                hashType,
                hash,
                txId,
              });
            })
            .catch((error) => {
              logger?.debug('Failed to verify data hash', {
                redirectUrl: redirectUrl.toString(),
                originalUrl: originalUrl.toString(),
                error,
                txId,
                trustedHash: error.cause?.trustedHash,
                computedHash: error.cause?.computedHash,
              });
              emitter?.emit('verification-failed', {
                originalUrl: originalUrl.toString(),
                redirectUrl: redirectUrl.toString(),
                trustedHash: error.cause?.trustedHash,
                computedHash: error.cause?.computedHash,
                hashType: error.cause?.hashType,
                error,
                txId,
              });
            });
        }

        // set the txid on the response headers so it's easy to listen to the events for the requests
        // TODO: update the return type of the http client to include the txId if verification is enabled
        (response as any).txId = txId;
      }
    }
    // TODO: if strict - wait for verification to finish and succeed before returning the response
    return response;
  };

  return new Proxy(httpClient, {
    // support direct calls: fetch('ar://…', options)
    // axios() or got()
    apply: (_target, _thisArg, argArray) =>
      wayfinderRedirect(httpClient, argArray as HttpClientArgs),

    // support http clients that use functions like `got.get`, `got.post`, `axios.get`, etc. while still using the wayfinder redirect function
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...inner: unknown[]) =>
          wayfinderRedirect(value.bind(target), inner as HttpClientArgs);
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
  public readonly resolveUrl: (params: {
    originalUrl: string;
    logger?: Logger;
  }) => Promise<URL>;
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
  public readonly verifyData: DataVerifier['verifyData'];
  public readonly trustedHash: DataHashProvider['getHash'];
  /**
   * The event emitter for wayfinder that emits verification events
   *
   * @example
   * const { request: wayfind, emitter } = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new ARIOGatewaysProvider({ ario: ARIO.mainnet() })
   *   }),
   * });
   *
   * emitter.on('verification-passed', (event) => {
   *   console.log('Verification passed!', event);
   * });
   *
   * emitter.on('verification-failed', (event) => {
   *   console.log('Verification failed!', event);
   * });
   *
   * const response = await wayfind('ar://example');
   *
   * Optionally wait for verification to complete before returning the response
   * await new Promise((resolve) => {
   *   emitter.on('verification-passed', event => {
   *     if (event.txId === response.txId) {
   *       console.log('Verification passed!');
   *       resolve(event);
   *     }
   *   });
   *   emitter.on('verification-failed', event => {
   *     if (event.txId === response.txId) {
   *       console.log('Verification failed!');
   *       resolve(event);
   *     }
   *   });
   * });
   */
  public readonly emitter: WayfinderEmitter = new WayfinderEmitter();
  constructor({
    // TODO: consider changing router to routingStrategy or strategy
    router = new RandomGatewayRouter({
      // optionally use a cache gateways provider to reduce the number of requests to the contract
      gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
    }),
    httpClient,
    logger = Logger.default,
    verifier = new DigestVerifier({
      trustedHashProvider: new TrustedGatewaysDigestProvider({
        gatewaysProvider: new StaticGatewaysProvider({
          gateways: ['https://permagate.io'],
        }),
      }),
    }),
    // TODO: stats provider
  }: {
    router: WayfinderRouter;
    httpClient: T;
    logger?: Logger;
    verifier?: DataVerifier;
    hashProvider?: DataHashProvider;
    // TODO: fallback handling for when the target gateway is not available
    // TODO: stats provider
  }) {
    this.router = router;
    this.httpClient = httpClient;
    this.verifyData = verifier.verifyData.bind(verifier);
    this.resolveUrl = async ({ originalUrl, logger }) => {
      return resolveWayfinderUrl({
        originalUrl,
        targetGateway: async () => await this.router.getTargetGateway(),
        logger,
      });
    };
    this.request = createWayfinderClient<T>({
      httpClient,
      resolveUrl: this.resolveUrl,
      verifyData: this.verifyData,
      emitter: this.emitter,
      logger,
    });
    logger?.debug(`Wayfinder initialized with ${router.name} routing strategy`);
  }

  // TODO: potential builder pattern to update the Router/blocklist/httpClient
}
