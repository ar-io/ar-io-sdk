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
import { EventEmitter } from 'eventemitter3';
import { base32 } from 'rfc4648';

import {
  DataVerificationStrategy,
  GatewaysProvider,
  RoutingStrategy,
} from '../../types/wayfinder.js';
import { ARIO } from '../io.js';
import { Logger } from '../logger.js';
import { NetworkGatewaysProvider } from './gateways/network.js';
import { SimpleCacheGatewaysProvider } from './gateways/simple-cache.js';
import { StaticGatewaysProvider } from './gateways/static.js';
import { FastestPingRoutingStrategy } from './routing/strategies/ping.js';
import { HashVerificationStrategy } from './verification/strategies/hash-verifier.js';
import { TrustedGatewaysHashProvider } from './verification/trusted.js';

// local types for wayfinder
type WayfinderHttpClient = typeof fetch;

// known regexes for wayfinder urls
export const arnsRegex = /^[a-z0-9_-]{1,51}$/;
export const txIdRegex = /^[A-Za-z0-9_-]{43}$/;

/**
 * Core function that converts a wayfinder url to the proper ar-io gateway URL
 * @param originalUrl - the wayfinder url to resolve
 * @param selectedGateway - the target gateway to resolve the url against
 * @returns the resolved url that can be used to make a request
 */
export const resolveWayfinderUrl = ({
  originalUrl,
  selectedGateway,
  logger,
}: {
  originalUrl: string | URL;
  selectedGateway: URL;
  logger?: Logger;
}): URL => {
  if (originalUrl.toString().startsWith('ar://')) {
    logger?.debug(`Applying wayfinder routing protocol to ${originalUrl}`, {
      originalUrl,
    });
    const [, path] = originalUrl.toString().split('ar://');

    // e.g. ar:///info should route to the info endpoint of the target gateway
    if (path.startsWith('/')) {
      logger?.debug(`Routing to ${path.slice(1)} on ${selectedGateway}`, {
        originalUrl,
        selectedGateway,
      });
      return new URL(path.slice(1), selectedGateway);
    }

    // Split path to get the first part (name/txId) and remaining path components
    const [firstPart, ...rest] = path.split('/');

    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(firstPart)) {
      const sandbox = sandboxFromId(firstPart);
      return new URL(
        `${firstPart}${rest.length > 0 ? '/' + rest.join('/') : ''}`,
        `${selectedGateway.protocol}//${sandbox}.${selectedGateway.hostname}`,
      );
    }

    if (arnsRegex.test(firstPart)) {
      // TODO: tests to ensure arns names support query params and paths
      const arnsUrl = `${selectedGateway.protocol}//${firstPart}.${selectedGateway.hostname}${selectedGateway.port ? `:${selectedGateway.port}` : ''}`;
      logger?.debug(`Routing to ${path} on ${arnsUrl}`, {
        originalUrl,
        selectedGateway,
      });
      return new URL(rest.length > 0 ? rest.join('/') : '', arnsUrl);
    }

    // TODO: support .eth addresses
    // TODO: "gasless" routing via DNS TXT records
  }

  logger?.debug('No wayfinder routing protocol applied', {
    originalUrl,
  });

  // return the original url if it's not a wayfinder url
  return new URL(originalUrl);
};

/**
 * Wayfinder event emitter with verification events
 */
export type WayfinderEvent = {
  'verification-succeeded': { txId: string };
  'verification-failed': Error;
  'verification-skipped': { originalUrl: string };
  'verification-progress': {
    txId: string;
    processedBytes: number;
    totalBytes: number;
  };
  'routing-started': { originalUrl: string };
  'routing-skipped': { originalUrl: string };
  'routing-succeeded': {
    originalUrl: string;
    selectedGateway: string;
    redirectUrl: string;
  };
  'routing-failed': Error;
  'identified-transaction-id': {
    originalUrl: string;
    selectedGateway: string;
    txId: string;
  };
};

export interface WayfinderEventArgs {
  onVerificationSucceeded?: (
    payload: WayfinderEvent['verification-succeeded'],
  ) => void;
  onVerificationFailed?: (
    payload: WayfinderEvent['verification-failed'],
  ) => void;
  onVerificationProgress?: (
    payload: WayfinderEvent['verification-progress'],
  ) => void;
}

export class WayfinderEmitter extends EventEmitter<WayfinderEvent> {
  constructor({
    onVerificationSucceeded,
    onVerificationFailed,
    onVerificationProgress,
  }: WayfinderEventArgs = {}) {
    super();
    if (onVerificationSucceeded) {
      this.on('verification-succeeded', onVerificationSucceeded);
    }
    if (onVerificationFailed) {
      this.on('verification-failed', onVerificationFailed);
    }
    if (onVerificationProgress) {
      this.on('verification-progress', onVerificationProgress);
    }
  }
}

export function tapAndVerifyReadableStream({
  originalStream,
  contentLength,
  verifyData,
  txId,
  emitter,
  strict = false,
}: {
  originalStream: ReadableStream;
  contentLength: number;
  verifyData: DataVerificationStrategy['verifyData'];
  txId: string;
  emitter?: WayfinderEmitter;
  strict?: boolean;
}): ReadableStream {
  if (
    originalStream instanceof ReadableStream &&
    typeof originalStream.tee === 'function'
  ) {
    /**
     * NOTE: tee requires the streams both streams to be consumed, so we need to make sure we consume the client branch
     * by the caller. This means when `request` is called, the client stream must be consumed by the caller via await request.text()
     * for verification to complete.
     *
     * It is feasible to make the verification stream not to depend on the client branch being consumed, should the DX not be obvious.
     */
    const [verifyBranch, clientBranch] = originalStream.tee();

    // setup our promise to verify the data
    const verificationPromise = verifyData({
      data: verifyBranch,
      txId,
    });

    let bytesProcessed = 0;
    const reader = clientBranch.getReader();
    const clientStreamWithVerification = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (strict) {
            // in strict mode, we wait for verification to complete before closing the controller
            try {
              await verificationPromise;
              emitter?.emit('verification-succeeded', { txId });
              controller.close();
            } catch (err) {
              // emit the verification failed event
              emitter?.emit('verification-failed', err);

              // In strict mode, we report the error to the client stream
              controller.error(
                new Error('Verification failed', { cause: err }),
              );
            }
          } else {
            // trigger the verification promise and emit events for the result
            verificationPromise
              .then(() => {
                emitter?.emit('verification-succeeded', { txId });
              })
              .catch((error) => {
                emitter?.emit('verification-failed', error);
              });
            // in non-strict mode, we close the controller immediately and handle verification asynchronously
            controller.close();
          }
        } else {
          bytesProcessed += value.length;
          emitter?.emit('verification-progress', {
            txId,
            totalBytes: contentLength,
            processedBytes: bytesProcessed,
          });
          controller.enqueue(value);
        }
      },
      cancel(reason) {
        // cancel the reader regardless of verification status
        reader.cancel(reason);

        // emit the verification cancellation event
        emitter?.emit('verification-failed', {
          txId,
          error: new Error('Verification cancelled', {
            cause: {
              reason,
            },
          }),
        });
      },
    });
    return clientStreamWithVerification;
  }
  throw new Error('Unsupported body type for cloning');
}

/**
 * Gets the sandbox hash for a given transaction id
 */
export function sandboxFromId(id: string): string {
  return base32
    .stringify(Buffer.from(id, 'base64'), { pad: false })
    .toLowerCase();
}

/**
 * Creates a wrapped fetch function that supports ar:// protocol
 *
 * This function leverages a Proxy to intercept calls to fetch
 * and redirects them to the target gateway using the resolveUrl function.
 *
 * Any URLs provided that are not wayfinder urls will be passed directly to fetch.
 *
 * @param resolveUrl - the function to construct the redirect url for ar:// requests
 * @returns a wrapped fetch function that supports ar:// protocol and always returns Response
 */
export const createWayfinderClient = ({
  resolveUrl,
  verifyData,
  selectGateway,
  emitter = new WayfinderEmitter(),
  logger,
  strict = false,
}: {
  selectGateway: () => Promise<URL>;
  resolveUrl: (params: {
    originalUrl: string | URL;
    selectedGateway: URL;
    logger?: Logger;
  }) => URL;
  verifyData?: DataVerificationStrategy['verifyData'];
  logger?: Logger;
  emitter?: WayfinderEmitter;
  strict?: boolean;
}) => {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    if (typeof url !== 'string') {
      logger?.debug('URL is not a string, skipping routing', {
        url,
      });
      emitter?.emit('routing-skipped', {
        originalUrl: JSON.stringify(url),
      });
      return fetch(url, init);
    }

    emitter?.emit('routing-started', {
      originalUrl: url.toString(),
    });

    const maxRetries = 3;
    const retryDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // select the target gateway
        const selectedGateway = await selectGateway();

        logger?.debug('Selected gateway', {
          originalUrl: url,
          selectedGateway: selectedGateway.toString(),
        });

        // route the request to the target gateway
        const redirectUrl = resolveUrl({
          originalUrl: url,
          selectedGateway,
          logger,
        });

        emitter?.emit('routing-succeeded', {
          originalUrl: url,
          selectedGateway: selectedGateway.toString(),
          redirectUrl: redirectUrl.toString(),
        });

        logger?.debug(`Redirecting request`, {
          originalUrl: url,
          redirectUrl: redirectUrl.toString(),
        });

        // make the request to the target gateway using the redirect url
        const response = await fetch(redirectUrl.toString(), {
          // enforce CORS given we're likely going to a different origin, but always allow the client to override
          redirect: 'follow',
          mode: 'cors',
          ...init,
        });

        logger?.debug(`Successfully routed request to gateway`, {
          redirectUrl: redirectUrl.toString(),
          originalUrl: url.toString(),
        });

        // only verify data if the redirect url is different from the original url
        if (redirectUrl.toString() !== url.toString()) {
          if (verifyData) {
            const headers = response.headers;

            // transaction id is either in the response headers or the path of the request as the first parameter
            const txId =
              headers.get('x-arns-resolved-id') ??
              redirectUrl.pathname.split('/')[1];

            const contentLength = +(headers.get('content-length') ?? 0);

            if (!txIdRegex.test(txId)) {
              // no transaction id found, skip verification
              logger?.debug('No transaction id found, skipping verification', {
                redirectUrl: redirectUrl.toString(),
                originalUrl: url,
              });
              emitter?.emit('verification-skipped', {
                originalUrl: url,
              });
              return response;
            }

            emitter?.emit('identified-transaction-id', {
              originalUrl: url,
              selectedGateway: redirectUrl.toString(),
              txId,
            });

            // Check if the response has a body
            if (response.body) {
              const newClientStream = tapAndVerifyReadableStream({
                originalStream: response.body,
                contentLength,
                verifyData,
                txId,
                emitter,
                strict,
              });

              return new Response(newClientStream, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              });
            } else {
              // No response body to verify, skip verification
              logger?.debug('No response body to verify', {
                redirectUrl: redirectUrl.toString(),
                originalUrl: url,
                txId,
              });
              return response;
            }
          }
        }
        return response;
      } catch (error) {
        logger?.debug('Failed to route request', {
          error: error.message,
          stack: error.stack,
          originalUrl: url,
          attempt: i + 1,
          maxRetries,
        });
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw new Error('Failed to route request after max retries', {
      cause: {
        originalUrl: url,
        maxRetries,
      },
    });
  };
};

/**
 * The main class for the wayfinder
 */
export class Wayfinder {
  /**
   * The gateways provider is responsible for providing the list of gateways to use for routing requests.
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   gatewaysProvider: new SimpleCacheGatewaysProvider({
   *     gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
   *     ttlSeconds: 60 * 60 * 24, // 1 day
   *   }),
   * });
   */
  public readonly gatewaysProvider: GatewaysProvider;

  /**
   * The routing strategy to use when routing requests.
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   strategy: new FastestPingStrategy({
   *     timeoutMs: 1000,
   *   }),
   * });
   */
  public readonly routingStrategy: RoutingStrategy;

  /**
   * A helper function that resolves the redirect url for ar:// requests to a target gateway.
   *
   * Note: no verification is done when resolving an ar://<path> url to a wayfinder route.
   * In order to verify the data, you must use the `request` function or request the data and
   * verify it yourself via the `verifyData` function.
   *
   * @example
   * const { resolveUrl } = new Wayfinder();
   *
   * // returns the redirected URL based on the routing strategy and the original url
   * const redirectUrl = await resolveUrl({ originalUrl: 'ar://example' });
   *
   * window.open(redirectUrl.toString(), '_blank');
   */
  public readonly resolveUrl: (params: {
    originalUrl: string;
    logger?: Logger;
  }) => Promise<URL>;

  /**
   * A wrapped fetch function that supports ar:// protocol. If a verification strategy is provided,
   * the request will be verified and events will be emitted as the request is processed.
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   verificationStrategy: new HashVerificationStrategy({
   *     trustedHashProvider: new TrustedGatewaysHashProvider({
   *       gatewaysProvider: new StaticGatewaysProvider({
   *         gateways: ['https://permagate.io'],
   *       }),
   *     }),
   *   }),
   * })
   *
   * // request an arns name
   * const response = await wayfinder.request('ar://ardrive')
   *
   * // request a transaction id
   * const response = await wayfinder.request('ar://1234567890')
   *
   * // Set strict mode to true to make verification blocking
   * const wayfinder = new Wayfinder({
   *   strict: true,
   * });
   *
   * // This will throw an error if verification fails
   * try {
   *   const response = await wayfinder.request('ar://1234567890');
   * } catch (error) {
   *   console.error('Verification failed', error);
   * }
   */
  public readonly request: WayfinderHttpClient;

  /**
   * The function that verifies the data hash for a given transaction id.
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   verifyData: (data, txId) => {
   *     // some custom verification logic
   *     return true;
   *   },
   * });
   */
  public readonly verifyData: DataVerificationStrategy['verifyData'];

  /**
   * Whether verification should be strict (blocking) or not.
   * If true, verification failures will cause requests to fail.
   * If false, verification will be performed asynchronously and failures will only emit events.
   */
  public readonly strict: boolean;

  /**
   * The event emitter for wayfinder that emits verification events.
   *
   * const wayfinder = new Wayfinder()
   *
   * wayfinder.emitter.on('verification-succeeded', (event) => {
   *   console.log('Verification passed!', event);
   * })
   *
   * wayfinder.emitter.on('verification-failed', (event) => {
   *   console.log('Verification failed!', event);
   * })
   *
   * or implement the events interface and pass it in, using callback functions
   *
   * const wayfinder = new Wayfinder({
   *   events: {
   *     onVerificationPassed: (event) => {
   *       console.log('Verification passed!', event);
   *     },
   *     onVerificationFailed: (event) => {
   *       console.log('Verification failed!', event);
   *     },
   *     onVerificationProgress: (event) => {
   *       console.log('Verification progress!', event);
   *     },
   *   }
   * })
   *
   * const response = await wayfind('ar://example');
   */
  public readonly emitter: WayfinderEmitter;

  /**
   * The constructor for the wayfinder
   * @param routingStrategy - the routing strategy to use for requests
   * @param verificationStrategy - the verification strategy to use for requests
   * @param gatewaysProvider - the gateways provider to use for routing requests
   * @param logger - the logger to use for logging
   * @param strict - if true, verification will be blocking and will fail requests if verification fails; if false, verification will be non-blocking
   */
  constructor({
    logger = Logger.default,
    gatewaysProvider = new SimpleCacheGatewaysProvider({
      gatewaysProvider: new NetworkGatewaysProvider({
        ario: ARIO.mainnet(),
      }),
      ttlSeconds: 60 * 60, // 1 hour
    }),
    routingStrategy = new FastestPingRoutingStrategy({
      timeoutMs: 1000,
    }),
    verificationStrategy = new HashVerificationStrategy({
      trustedHashProvider: new TrustedGatewaysHashProvider({
        gatewaysProvider: new StaticGatewaysProvider({
          gateways: ['https://permagate.io'],
        }),
      }),
    }),
    events = {
      onVerificationSucceeded: (event) => {
        logger.debug('Verification passed!', event);
      },
      onVerificationFailed: (event) => {
        logger.error('Verification failed!', event);
      },
      onVerificationProgress: (event) => {
        logger.debug('Verification progress!', event);
      },
    },
    strict = false,
  }: {
    routingStrategy?: RoutingStrategy;
    gatewaysProvider?: GatewaysProvider;
    verificationStrategy?: DataVerificationStrategy;
    logger?: Logger;
    events?: WayfinderEventArgs;
    strict?: boolean;
  } = {}) {
    this.routingStrategy = routingStrategy;
    this.gatewaysProvider = gatewaysProvider;
    this.emitter = new WayfinderEmitter(events);
    this.verifyData =
      verificationStrategy.verifyData.bind(verificationStrategy);
    this.strict = strict;

    // top level function to easily resolve wayfinder urls using the routing strategy and gateways provider
    this.resolveUrl = async ({ originalUrl, logger }) => {
      const selectedGateway = await this.routingStrategy.selectGateway({
        gateways: await this.gatewaysProvider.getGateways(),
      });
      return resolveWayfinderUrl({
        originalUrl,
        selectedGateway,
        logger,
      });
    };

    // create a wayfinder client with the routing strategy and gateways provider
    this.request = createWayfinderClient({
      selectGateway: async () => {
        return this.routingStrategy.selectGateway({
          gateways: await this.gatewaysProvider.getGateways(),
        });
      },
      resolveUrl: resolveWayfinderUrl,
      verifyData: this.verifyData,
      emitter: this.emitter,
      logger,
      strict,
    });

    logger?.debug(
      `Wayfinder initialized with ${routingStrategy.constructor.name} routing strategy`,
    );
  }
}
