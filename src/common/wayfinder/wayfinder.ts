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
import { PassThrough, Readable } from 'node:stream';

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
type HttpClientArgs = unknown[];
type HttpClientFunction = (...args: HttpClientArgs) => unknown;
type WayfinderHttpClient<T extends HttpClientFunction> = T;

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
  // TODO: consider changing variable wayfinderUrl
  originalUrl: string | URL; // TODO: add union type to UrlString
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

    // TODO: this breaks 43 character named arns names - we should check a a local name cache list before resolving raw transaction ids
    if (txIdRegex.test(path)) {
      const [txId, ...rest] = path.split('/');
      return new URL(`${txId}${rest.join('/')}`, selectedGateway);
    }

    if (arnsRegex.test(path)) {
      // TODO: tests to ensure arns names support query params and paths
      const [name, ...rest] = path.split('/');
      const arnsUrl = `${selectedGateway.protocol}//${name}.${selectedGateway.hostname}${selectedGateway.port ? `:${selectedGateway.port}` : ''}`;
      logger?.debug(`Routing to ${path} on ${arnsUrl}`, {
        originalUrl,
        selectedGateway,
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
export type WayfinderEvent =
  | { type: 'verification-succeeded'; txId: string }
  | { type: 'verification-failed'; txId: string; error: Error }
  | { type: 'verification-skipped'; originalUrl: string }
  | {
      type: 'verification-progress';
      txId: string;
      processedBytes: number;
      totalBytes: number;
    }
  | { type: 'routing-started'; originalUrl: string }
  | {
      type: 'routing-skipped';
      originalUrl: string;
    }
  | {
      type: 'routing-succeeded';
      originalUrl: string;
      selectedGateway: string;
      redirectUrl: string;
    }
  | { type: 'routing-failed'; originalUrl: string; error: Error }
  | {
      type: 'identified-transaction-id';
      originalUrl: string;
      selectedGateway: string;
      txId: string;
    };

export interface WayfinderEventArgs {
  onVerificationPassed?: (
    payload: Omit<
      Extract<WayfinderEvent, { type: 'verification-succeeded' }>,
      'type'
    >,
  ) => void;
  onVerificationFailed?: (
    payload: Omit<
      Extract<WayfinderEvent, { type: 'verification-failed' }>,
      'type'
    >,
  ) => void;
  onVerificationProgress?: (
    payload: Omit<
      Extract<WayfinderEvent, { type: 'verification-progress' }>,
      'type'
    >,
  ) => void;
}

export class WayfinderEmitter extends EventEmitter {
  constructor({
    onVerificationPassed,
    onVerificationFailed,
    onVerificationProgress,
    // TODO: continue this pattern for all events
  }: WayfinderEventArgs = {}) {
    super();
    if (onVerificationPassed) {
      this.on('verification-succeeded', onVerificationPassed);
    }
    if (onVerificationFailed) {
      this.on('verification-failed', onVerificationFailed);
    }
    if (onVerificationProgress) {
      this.on('verification-progress', onVerificationProgress);
    }
  }

  emit<E extends WayfinderEvent['type']>(
    event: E,
    payload: Omit<Extract<WayfinderEvent, { type: E }>, 'type'>,
  ): boolean {
    return super.emit(event, payload);
  }

  on<E extends WayfinderEvent['type']>(
    event: E,
    listener: (
      payload: Omit<Extract<WayfinderEvent, { type: E }>, 'type'>,
    ) => void,
  ): this {
    return super.on(event, listener);
  }

  // TODO: additional callback support defined on the emitter, provided via the constructor
}

export function tapAndVerifyStream<T extends Readable | ReadableStream>({
  originalStream,
  contentLength,
  verifyData,
  txId,
  emitter,
  strict = false,
}: {
  originalStream: T;
  contentLength: number;
  verifyData: DataVerificationStrategy['verifyData'];
  txId: string;
  emitter?: WayfinderEmitter;
  strict?: boolean;
}): T extends Readable ? PassThrough : T {
  // taps node streams
  if (
    originalStream instanceof Readable &&
    typeof originalStream.pipe === 'function'
  ) {
    const tappedClientStream = new PassThrough();
    const streamToVerify = new PassThrough();

    // kick off the verification promise, this will be awaited when the original stream ends
    const verificationPromise = verifyData({
      data: streamToVerify,
      txId,
    });

    let bytesProcessed = 0;
    // pipe the original stream to the verifier and the client stream
    originalStream.on('data', (chunk) => {
      streamToVerify.write(chunk);
      tappedClientStream.write(chunk);
      bytesProcessed += chunk.length;
      // only emit if contentLength is not 0
      if (contentLength !== 0) {
        emitter?.emit('verification-progress', {
          txId,
          totalBytes: contentLength,
          processedBytes: bytesProcessed,
        });
      }
    });

    originalStream.on('end', async () => {
      streamToVerify.end(); // triggers verifier completion and completes the verification promise

      if (strict) {
        // in strict mode, we wait for verification to complete before ending the client stream
        try {
          await verificationPromise;
          emitter?.emit('verification-succeeded', { txId });
          tappedClientStream.end();
        } catch (error) {
          emitter?.emit('verification-failed', { error, txId });
          // In strict mode, destroy the client stream with the error
          tappedClientStream.destroy(
            new Error('Verification failed', { cause: error }),
          );
        }
      } else {
        // in non-strict mode, we end the client stream immediately and handle verification asynchronously
        tappedClientStream.end();

        // trigger the verification promise and emit events for the result
        verificationPromise
          .then(() => {
            emitter?.emit('verification-succeeded', { txId });
          })
          .catch((error) => {
            emitter?.emit('verification-failed', { error, txId });
          });
      }
    });

    originalStream.on('error', (err) => {
      // emit the verification failed event
      emitter?.emit('verification-failed', {
        error: err,
        txId,
      });

      // destroy both streams and propagate the original stream error
      streamToVerify.destroy(err);
      tappedClientStream.destroy(err);
    });
    // send the stream to the verify function and if it errors end the client stream
    return tappedClientStream as T extends Readable ? PassThrough : T;
  }

  // taps web readable streams
  if (
    originalStream instanceof ReadableStream &&
    typeof originalStream.tee === 'function'
  ) {
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
              emitter?.emit('verification-failed', {
                txId,
                error: err as Error,
              });
              // In strict mode, we report the error to the client stream
              controller.error(
                new Error('Verification failed', { cause: err }),
              );
            }
          } else {
            // in non-strict mode, we close the controller immediately and handle verification asynchronously
            controller.close();

            // trigger the verification promise and emit events for the result
            verificationPromise
              .then(() => {
                emitter?.emit('verification-succeeded', { txId });
              })
              .catch((err) => {
                emitter?.emit('verification-failed', {
                  txId,
                  error: err as Error,
                });
                // we don't call controller.error() to avoid breaking the client stream
              });
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

        // note: we don't block or throw errors here even in strict mode
        // since the stream is already being cancelled by the client
      },
    });
    return clientStreamWithVerification as T extends Readable ? PassThrough : T;
  }
  throw new Error('Unsupported body type for cloning');
}

export function wrapVerifiedResponse(
  original: Response,
  newBody: ReadableStream<Uint8Array>,
  txId: string,
): Response {
  // Clone headers (Header objects aren't serializable)
  const headers = new Headers();
  original.headers.forEach((value, key) => headers.set(key, value));

  // Create a new Response with the new body and cloned headers
  const wrapped = new Response(newBody, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });

  // Attach txId for downstream tracking
  (wrapped as any).txId = txId;
  (wrapped as any).redirectedFrom = original.url;

  return wrapped;
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
  selectGateway,
  emitter = new WayfinderEmitter(),
  logger,
  strict = false,
}: {
  httpClient: T;
  selectGateway: () => Promise<URL>;
  resolveUrl: (params: {
    originalUrl: string | URL;
    selectedGateway: URL;
    logger?: Logger;
  }) => URL;
  verifyData?: <T extends Readable | ReadableStream | Buffer>({
    data,
    txId,
  }: {
    data: T;
    txId: string;
  }) => Promise<void>;
  logger?: Logger;
  emitter?: WayfinderEmitter;
  strict?: boolean;
  // TODO: retry strategy to get a new gateway router
}): WayfinderHttpClient<T> => {
  const wayfinderRedirect = async (
    fn: HttpClientFunction,
    rawArgs: HttpClientArgs,
  ) => {
    // TODO: handle if first arg is not a string (i.e. just return the result of the function call)
    const [originalUrl, ...rest] = rawArgs;

    if (typeof originalUrl !== 'string') {
      logger?.debug('Original URL is not a string, skipping routing', {
        originalUrl,
      });
      emitter?.emit('routing-skipped', {
        originalUrl: JSON.stringify(originalUrl),
      });
      return fn(...rawArgs);
    }

    emitter?.emit('routing-started', {
      originalUrl: originalUrl.toString(),
    });

    // TODO: by default we will retry 3 times but this should be configurable and moved to a routing strategy
    const maxRetries = 3;
    const retryDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // select the target gateway
        const selectedGateway = await selectGateway();

        logger?.debug('Selected gateway', {
          originalUrl,
          selectedGateway: selectedGateway.toString(),
        });

        // route the request to the target gateway
        const redirectUrl = resolveUrl({
          originalUrl,
          selectedGateway,
          logger,
        });

        emitter?.emit('routing-succeeded', {
          originalUrl,
          selectedGateway: selectedGateway.toString(),
          redirectUrl: redirectUrl.toString(),
        });

        logger?.debug(`Redirecting request`, {
          originalUrl,
          redirectUrl: redirectUrl.toString(),
        });
        // make the request to the target gateway using the redirect url and http client
        const response = await fn(redirectUrl.toString(), ...rest);
        // TODO: trigger a routing event with the raw response object?
        logger?.debug(`Successfully routed request to gateway`, {
          redirectUrl: redirectUrl.toString(),
          originalUrl: originalUrl.toString(),
        });

        // only verify data if the redirect url is different from the original url
        if (response && redirectUrl.toString() !== originalUrl.toString()) {
          if (verifyData) {
            // if the headers do not have .get on them, we need to parse the headers manually
            const headers = new Headers();
            const headersObject = (response as any).headers ?? {};

            if (headersObject instanceof Map) {
              for (const [key, value] of headersObject.entries()) {
                headers.set(key, value);
              }
            } else if (headersObject instanceof Headers) {
              for (const [key, value] of headersObject.entries()) {
                headers.set(key, value);
              }
            } else if (
              headersObject !== undefined &&
              typeof headersObject === 'object'
            ) {
              for (const [key, value] of Object.entries(headersObject)) {
                headers.set(key, value as string);
              }
            } else {
              throw new Error(
                'Gateway did not return headers needed for verification',
                {
                  cause: {
                    redirectUrl: redirectUrl.toString(),
                    originalUrl: originalUrl.toString(),
                  },
                },
              );
            }

            // transaction id is either in the response headers or the path of the request as the first parameter
            // TODO: we may want to move this parsing to be returned by the resolveUrl function depending on the redirect URL we've constructed
            const txId =
              headers.get('x-arns-resolved-id') ??
              redirectUrl.pathname.split('/')[1];

            // TODO: validate nodes return content length for all responses
            const contentLength = +(headers.get('content-length') ?? 0);

            if (!txIdRegex.test(txId)) {
              // no transaction id found, skip verification
              logger?.debug('No transaction id found, skipping verification', {
                redirectUrl: redirectUrl.toString(),
                originalUrl,
              });
              emitter?.emit('verification-skipped', {
                originalUrl,
              });
              return response;
            }

            emitter?.emit('identified-transaction-id', {
              originalUrl,
              selectedGateway: redirectUrl.toString(),
              txId,
            });

            // parse out the key that contains the response body, we'll use it later when updating the response object
            const responseDataKey = (response as any).body
              ? 'body'
              : (response as any).data
                ? 'data'
                : undefined;

            if (responseDataKey === undefined) {
              throw new Error(
                'No data body or data provided, skipping verification',
                {
                  cause: {
                    redirectUrl: redirectUrl.toString(),
                    originalUrl: originalUrl.toString(),
                  },
                },
              );
            }

            const responseBody = (response as any)[responseDataKey];
            // TODO: determine if it is data item or L1 transaction, and tell the verifier accordingly, just drop in hit to graphql now
            if (txId === undefined) {
              throw new Error(
                'Failed to parse data hash from response headers',
                {
                  cause: {
                    redirectUrl: redirectUrl.toString(),
                    originalUrl: originalUrl.toString(),
                    txId,
                  },
                },
              );
            } else if (responseBody === undefined) {
              throw new Error('No data body provided, skipping verification', {
                cause: {
                  redirectUrl: redirectUrl.toString(),
                  originalUrl: originalUrl.toString(),
                  txId,
                },
              });
            } else {
              logger?.debug('Verifying data hash for txId', {
                redirectUrl: redirectUrl.toString(),
                originalUrl: originalUrl.toString(),
                txId,
              });

              if (
                responseBody instanceof ReadableStream ||
                responseBody instanceof Readable
              ) {
                const newClientStream = tapAndVerifyStream<typeof responseBody>(
                  {
                    originalStream: responseBody,
                    contentLength,
                    verifyData,
                    txId,
                    emitter,
                    strict,
                  },
                );

                if (response instanceof Response) {
                  // specific to fetch
                  return wrapVerifiedResponse(
                    response,
                    newClientStream as ReadableStream,
                    txId,
                  );
                } else {
                  // overwrite the response body with the new client stream
                  (response as any).txId = txId;
                  (response as any).body = newClientStream;
                  return response;
                }
              } else {
                // TODO: content-application/json and it's smaller than 10mb
                // TODO: add tests and verify this works for all non-Readable/streamed responses
                if (strict) {
                  // In strict mode, wait for verification before returning response
                  try {
                    await verifyData({
                      data: responseBody,
                      txId,
                    });
                    emitter?.emit('verification-succeeded', { txId });
                    return response;
                  } catch (error) {
                    logger?.debug('Failed to verify data hash', {
                      error,
                      txId,
                    });
                    emitter?.emit('verification-failed', { txId, error });
                    throw new Error('Verification failed', { cause: error });
                  }
                } else {
                  // In non-strict mode, perform verification in the background
                  verifyData({
                    data: responseBody,
                    txId,
                  })
                    .then(() => {
                      emitter?.emit('verification-succeeded', { txId });
                    })
                    .catch((error) => {
                      logger?.debug('Failed to verify data hash', {
                        error,
                        txId,
                      });
                      emitter?.emit('verification-failed', { txId, error });
                    });
                  return response;
                }
              }
            }
          }
        }
        // TODO: if strict - wait for verification to finish and succeed before returning the response
        return response;
      } catch (error) {
        logger?.debug('Failed to route request', {
          error: error.message,
          stack: error.stack,
          originalUrl,
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
        originalUrl,
        maxRetries,
      },
    });
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
        return (...inner: HttpClientArgs) =>
          wayfinderRedirect(value.bind(target), inner);
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
   * The native http client used by wayfinder. By default, the native fetch api is used.
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   httpClient: axios,
   * });
   *
   */
  public readonly httpClient: T;
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
   *
   * A wrapped http client that supports ar:// protocol. If a verification strategy is provided,
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
   * // request a transaction id with a custom http client
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
  public readonly request: WayfinderHttpClient<T>;

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
   * @param httpClient - the http client to use for requests
   * @param routingStrategy - the routing strategy to use for requests
   * @param verificationStrategy - the verification strategy to use for requests
   * @param gatewaysProvider - the gateways provider to use for routing requests
   * @param logger - the logger to use for logging
   * @param strict - if true, verification will be blocking and will fail requests if verification fails; if false, verification will be non-blocking
   */
  constructor({
    httpClient = fetch as T,
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
      onVerificationPassed: (event) => {
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
    // TODO: stats provider
  }: {
    httpClient?: T;
    routingStrategy?: RoutingStrategy;
    gatewaysProvider?: GatewaysProvider;
    verificationStrategy?: DataVerificationStrategy;
    logger?: Logger;
    events?: WayfinderEventArgs;
    strict?: boolean;
    // TODO: stats provider
  }) {
    this.routingStrategy = routingStrategy;
    this.gatewaysProvider = gatewaysProvider;
    this.httpClient = httpClient;
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
    this.request = createWayfinderClient<T>({
      httpClient,
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

  // TODO: potential builder pattern to update the Router/blocklist/httpClient
}
