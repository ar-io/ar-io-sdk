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
  DataHashProvider,
  DataVerifier,
  WayfinderRouter,
} from '../../types/wayfinder.js';
import { ARIO } from '../io.js';
import { Logger } from '../logger.js';
import {
  NetworkGatewaysProvider,
  SimpleCacheGatewaysProvider,
  StaticGatewaysProvider,
} from './gateways.js';
import { TrustedGatewaysHashProvider } from './gateways/trusted-gateways.js';
import { RandomGatewayRouter } from './routers/random.js';
import { HashVerifier } from './verification/hash-verifier.js';

// local types for wayfinder
type HttpClientArgs = unknown[];
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
export type WayfinderEvent =
  | { type: 'verification-passed'; txId: string }
  | { type: 'verification-failed'; txId: string; error: Error }
  | { type: 'verification-skipped'; originalUrl: string }
  | {
      type: 'verification-progress';
      txId: string;
      processedBytes: number;
      totalBytes: number;
    }
  | { type: 'routing-started'; originalUrl: string }
  | { type: 'routing-succeeded'; originalUrl: string; targetGateway: string }
  | { type: 'routing-failed'; originalUrl: string; error: Error }
  | {
      type: 'identified-transaction-id';
      originalUrl: string;
      targetGateway: string;
      txId: string;
    };

export interface WayfinderEventArgs {
  onVerificationPassed?: (
    payload: Omit<
      Extract<WayfinderEvent, { type: 'verification-passed' }>,
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
      this.on('verification-passed', onVerificationPassed);
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
}: {
  originalStream: T;
  contentLength: number;
  verifyData: DataVerifier['verifyData'];
  txId: string;
  emitter?: WayfinderEmitter;
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
      try {
        await verificationPromise;
        emitter?.emit('verification-passed', {
          txId,
        });
        tappedClientStream.end();
      } catch (error) {
        emitter?.emit('verification-failed', {
          error,
          txId,
        });
        tappedClientStream.destroy(error);
      }
    });

    originalStream.on('error', (err) => {
      emitter?.emit('verification-failed', {
        error: err,
        txId,
      });
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
          try {
            // due to backpressure, if the client does not consume the stream, the verification will not complete (particularly important for fetch, where the response body needs to be awaited for verification to complete)
            await verificationPromise;
            emitter?.emit('verification-passed', {
              txId,
            });
            controller.close();
          } catch (err) {
            emitter?.emit('verification-failed', {
              txId,
              error: err as Error,
            });
            controller.error(err);
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
        reader.cancel(reason);
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
  emitter = new WayfinderEmitter(),
  logger,
}: {
  httpClient: T;
  resolveUrl: (params: {
    originalUrl: string | URL;
    logger?: Logger;
  }) => Promise<URL>;
  verifyData?: <T extends Readable | ReadableStream | Buffer>({
    data,
    txId,
  }: {
    data: T;
    txId: string;
  }) => Promise<void>;
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

    if (typeof originalUrl !== 'string') {
      logger?.debug('Original URL is not a string, skipping routing', {
        originalUrl,
      });
      return fn(...rawArgs);
    }

    emitter?.emit('routing-started', {
      originalUrl: originalUrl.toString(),
    });

    // route the request to the target gateway
    const redirectUrl = await resolveUrl({
      originalUrl,
      logger,
    });
    emitter?.emit('routing-succeeded', {
      originalUrl,
      targetGateway: redirectUrl.toString(),
    });
    logger?.debug(`Redirecting request to ${redirectUrl}`, {
      originalUrl,
      redirectUrl,
    });
    // make the request to the target gateway using the redirect url and http client
    const response = await fn(redirectUrl.toString(), ...rest);
    // TODO: trigger a routing event with the raw response object?
    logger?.debug(`Successfully routed request to ${redirectUrl}`, {
      redirectUrl,
      originalUrl,
    });

    // only verify data if the redirect url is different from the original url
    if (response && redirectUrl.toString() !== originalUrl.toString()) {
      if (verifyData) {
        // if the headers do not have .get on them, we need to parse the headers manually
        const headers = new Headers();
        let headersObject = (response as any).headers ?? {};

        if (typeof headersObject.get !== 'function') {
          headersObject = Object.fromEntries(headersObject);
          for (const [key, value] of Object.entries(headersObject)) {
            headers.set(key, value as string);
          }
        } else {
          for (const [key, value] of headersObject.entries()) {
            headers.set(key, value);
          }
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
            redirectUrl,
            originalUrl,
          });
          emitter?.emit('verification-skipped', {
            originalUrl,
          });
          return response;
        }

        emitter?.emit('identified-transaction-id', {
          originalUrl,
          targetGateway: redirectUrl.toString(),
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
          throw new Error('Failed to parse data hash from response headers', {
            cause: {
              redirectUrl: redirectUrl.toString(),
              originalUrl: originalUrl.toString(),
              txId,
            },
          });
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

          const newClientStream = tapAndVerifyStream<typeof responseBody>({
            originalStream: responseBody,
            contentLength,
            verifyData,
            txId,
            emitter,
          });

          if (responseBody instanceof ReadableStream) {
            // specific to fetch
            return wrapVerifiedResponse(
              response as Response,
              newClientStream,
              txId,
            );
          } else if (responseBody instanceof Readable) {
            // overwrite the response body with the new client stream
            (response as any).txId = txId;
            (response as any).body = newClientStream;
            return response;
          } else {
            // TODO: content-application/json and it's smaller than 10mb
            // TODO: add tests and verify this works for all non-Readable/streamed responses
            try {
              // if strict set to true
              await verifyData({
                data: responseBody,
                txId,
              });
              emitter?.emit('verification-passed', {
                txId,
              });
            } catch (error) {
              logger?.debug('Failed to verify data hash', {
                error,
                txId,
              });
              emitter?.emit('verification-failed', {
                txId,
                error,
              });
            }
            return response;
          }
        }
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
   * The router to use for requests
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new SimpleCacheGatewaysProvider({
   *       gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
   *       ttlSeconds: 60 * 60 * 24, // 1 day
   *     }),
   *   }),
   * });
   *
   * // Returns a target gateway based on the routing strategy
   * const targetGateway = await wayfinder.router.getTargetGateway();
   */
  public readonly router: WayfinderRouter;
  /**
   * The native http client used by wayfinder
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new SimpleCacheGatewaysProvider({
   *       gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
   *       ttlSeconds: 60 * 60 * 24, // 1 day
   *     }),
   *   }),
   *   httpClient: axios,
   * });
   *
   */
  public readonly httpClient: T;
  /**
   * The function that resolves the redirect url for ar:// requests to a target gateway
   *
   * @example
   * const wayfinder = new Wayfinder({
   *   router: new RandomGatewayRouter({
   *     gatewaysProvider: new SimpleCacheGatewaysProvider({
   *       gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
   *       ttlSeconds: 60 * 60 * 24, // 1 day
   *     }),
   *   }),
   *   httpClient: axios,
   * });
   *
   * // returns the redirected URL based on the routing strategy and the original url
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
   *     gatewaysProvider: new SimpleCacheGatewaysProvider({
   *       gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
   *       ttlSeconds: 60 * 60 * 24, // 1 day
   *     }),
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
  public readonly verifyData: DataVerifier['verifyData'];
  /**
   * The event emitter for wayfinder that emits verification events.
   *
   * const wayfinder = new Wayfinder()
   *
   * wayfinder.emitter.on('verification-passed', (event) => {
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
  // TODO: consider changing this to events or event emitter
  public readonly emitter: WayfinderEmitter;

  constructor({
    httpClient,
    // TODO: consider changing router to routingStrategy or strategy
    router = new RandomGatewayRouter({
      gatewaysProvider: new SimpleCacheGatewaysProvider({
        gatewaysProvider: new NetworkGatewaysProvider({ ario: ARIO.mainnet() }),
        ttlSeconds: 60 * 60 * 24, // 1 day
      }),
    }),
    logger = Logger.default,
    // TODO: support disabling verification or create some PassThroughVerifier like thing
    verifier = new HashVerifier({
      trustedHashProvider: new TrustedGatewaysHashProvider({
        gatewaysProvider: new StaticGatewaysProvider({
          gateways: ['https://permagate.io'],
        }),
      }),
    }),
    events,
    // TODO: stats provider
  }: {
    httpClient: T;
    router?: WayfinderRouter;
    logger?: Logger;
    verifier?: DataVerifier;
    hashProvider?: DataHashProvider;
    events?: WayfinderEventArgs;
    // TODO: fallback handling for when the target gateway is not available
    // TODO: stats provider
  }) {
    this.router = router;
    this.httpClient = httpClient;
    this.emitter = new WayfinderEmitter(events);
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

// TODO: add a chart for verification strategies and what they do
// include complexity, performance, and security
// explain use cases that each strategy is best for

// e.g.

/**
 *
 *  type    | complexity | performance | security
 * ---------|------------|-------------|---------
 *  hash    | low        | high        | low
 * ---------|------------|-------------|---------
 *  data root    | medium       | medium      | low | only L1
 * ---------|------------|-------------|---------
 * signature    | medium       | medium      | medium
 * ---------|------------|-------------|---------
 *  composite | high       | low         | high
 * ---------|------------|-------------|---------
 *
 *
 */
