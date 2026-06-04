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
/**
 * Circuit-breaker wrapper for Solana RPC transports using
 * [opossum](https://nodeshift.dev/opossum/).
 *
 * When the primary RPC endpoint starts failing (rate-limits, downtime, etc.)
 * the circuit opens and subsequent calls are routed transparently to a
 * fallback RPC until the primary recovers.
 *
 * Works at the **transport level** — no Proxy magic required. Every RPC
 * method (`getAccountInfo`, `sendTransaction`, etc.) goes through the same
 * transport function, so a single circuit breaker covers them all.
 *
 * Usage:
 * ```ts
 * import { ARIO, createCircuitBreakerRpc } from '@ar.io/sdk';
 *
 * const rpc = createCircuitBreakerRpc({
 *   primaryUrl: 'https://my-premium-rpc.example.com',
 *   fallbackUrl: 'https://api.mainnet-beta.solana.com',
 * });
 *
 * const ario = ARIO.init({ rpc });
 * ```
 */
import {
  type RpcTransport,
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
} from '@solana/kit';
import CircuitBreaker from 'opossum';

import { Logger } from '../common/logger.js';
import type { SolanaRpc } from './types.js';

const logger = new Logger({ level: 'error' });

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CircuitBreakerRpcOptions {
  /**
   * Time in ms before a single RPC request is considered timed-out.
   * Set to `false` to disable the opossum-level timeout (rely on the
   * underlying transport timeout only).
   * @default 10_000
   */
  timeout?: number | false;
  /**
   * Error percentage (0-100) at which to open the circuit.
   * @default 25
   */
  errorThresholdPercentage?: number;
  /**
   * Time in ms to wait before entering half-open state and retrying
   * the primary.
   * @default 60_000
   */
  resetTimeout?: number;
  /**
   * Minimum number of requests within the rolling window before the
   * circuit can trip. Prevents opening the circuit after a single failure.
   * @default 3
   */
  volumeThreshold?: number;
  /**
   * Ceiling for requests allowed through per second. Implemented as an
   * adaptive token bucket *in front of* the breaker: excess requests are
   * queued (FIFO) until a token frees, smoothing bursts so you stay under a
   * provider's rate limit (avoids HTTP 429 / Solana error #8100002).
   *
   * The bucket auto-tunes on 429s: it honors `Retry-After`, drops to
   * `x-ratelimit-rps-limit` when the provider advertises one (public Solana
   * RPC does; QuickNode generally does not), otherwise halves the rate
   * (AIMD). It recovers back up toward this ceiling on sustained success.
   *
   * The queue wait happens *before* `breaker.fire`, so it does NOT count
   * against {@link CircuitBreakerRpcOptions.timeout}.
   *
   * Throttling is always on; omitting this (or passing `<= 0`) uses the
   * {@link DEFAULT_MAX_RPS} default. To effectively remove the limit, pass a
   * very large number.
   * @default 5
   */
  maxRequestsPerSecond?: number;
  /**
   * Maximum number of concurrent in-flight requests (opossum `capacity`
   * semaphore). Unlike {@link CircuitBreakerRpcOptions.maxRequestsPerSecond},
   * excess requests are **rejected immediately** rather than queued — this is
   * concurrency control, not a rate limit. For avoiding 429s you usually want
   * `maxRequestsPerSecond` instead.
   * @default undefined (unlimited)
   */
  maxConcurrent?: number;
}

export interface CircuitBreakerRpcConfig {
  /** URL for the primary (preferred) RPC endpoint. */
  primaryUrl: string;
  /** URL for the fallback RPC endpoint (used when the circuit opens). */
  fallbackUrl: string;
  /** Opossum circuit-breaker tuning knobs. */
  circuitBreakerOptions?: CircuitBreakerRpcOptions;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

// ---------------------------------------------------------------------------
// Adaptive rate gate (token bucket + cooldown)
// ---------------------------------------------------------------------------

/** Default ceiling when `maxRequestsPerSecond` is not provided. */
const DEFAULT_MAX_RPS = 5;
/** Multiply the current rate by this on a 429 with no usable header. */
const AIMD_DECREASE = 0.5;
/** Never throttle below this many requests/second. */
const MIN_RATE = 1;
/** Consecutive successes before nudging the rate up by 1 (additive recovery). */
const RECOVERY_SUCCESSES = 20;
/** Fraction of a provider-advertised limit to actually use (safety margin). */
const RATE_SAFETY_FACTOR = 0.9;
/** Cooldown applied on a 429 that carries no `Retry-After`. */
const DEFAULT_COOLDOWN_MS = 1_000;

interface RateGate {
  /** Resolves once a token is available and any cooldown has elapsed. */
  acquire(): Promise<void>;
  /** Change the steady refill rate (req/s). */
  setRate(ratePerSecond: number): void;
  /** Block all releases until `ms` from now (e.g. honoring `Retry-After`). */
  pauseFor(ms: number): void;
}

/**
 * Token-bucket throttle whose rate can be retuned at runtime and which can be
 * paused on demand. Tokens refill continuously at the current rate, capped at
 * one second's worth (the burst allowance); waiters are released FIFO.
 */
function createRateGate(initialRate: number): RateGate {
  let rate = Math.max(MIN_RATE, initialRate);
  let capacity = Math.max(1, rate);
  let tokens = capacity;
  let lastRefill = Date.now();
  let pausedUntil = 0;
  const queue: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (ms: number) => {
    if (timer !== null) return;
    timer = setTimeout(
      () => {
        timer = null;
        pump();
      },
      Math.max(ms, 1),
    );
  };

  const refill = () => {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    if (elapsed > 0) {
      tokens = Math.min(capacity, tokens + elapsed * rate);
      lastRefill = now;
    }
  };

  const pump = () => {
    const now = Date.now();
    if (pausedUntil > now) {
      schedule(pausedUntil - now);
      return;
    }
    refill();
    while (tokens >= 1) {
      const release = queue.shift();
      if (!release) break;
      tokens -= 1;
      release();
    }
    if (queue.length > 0) {
      // Wake when the next whole token will have accrued.
      schedule(Math.ceil(((1 - tokens) / rate) * 1000));
    }
  };

  return {
    acquire: () =>
      new Promise<void>((resolve) => {
        queue.push(resolve);
        pump();
      }),
    setRate: (ratePerSecond: number) => {
      rate = Math.max(MIN_RATE, ratePerSecond);
      capacity = Math.max(1, rate);
      tokens = Math.min(tokens, capacity);
      lastRefill = Date.now();
      pump();
    },
    pauseFor: (ms: number) => {
      const until = Date.now() + Math.max(0, ms);
      if (until > pausedUntil) pausedUntil = until;
      schedule(ms);
    },
  };
}

// ---------------------------------------------------------------------------
// 429 / rate-limit header parsing
// ---------------------------------------------------------------------------

/**
 * If `err` is a transport HTTP 429, return its response `Headers`; else null.
 * Duck-typed against the `@solana/errors` HTTP-error context
 * (`{ statusCode, headers }`) so we avoid a hard dependency on the error code.
 */
function http429Headers(err: unknown): Headers | null {
  const ctx = (err as { context?: { statusCode?: number; headers?: unknown } })
    ?.context;
  if (ctx?.statusCode === 429 && ctx.headers instanceof Headers) {
    return ctx.headers;
  }
  return null;
}

/** Parse `Retry-After` (delta-seconds or HTTP-date) into ms, or null. */
function parseRetryAfterMs(headers: Headers): number | null {
  const v = headers.get('retry-after');
  if (v === null || v === '') return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(v);
  return Number.isNaN(when) ? null : Math.max(0, when - Date.now());
}

/** Provider-advertised requests/second limit (`x-ratelimit-rps-limit`), or null. */
function parseRpsLimit(headers: Headers): number | null {
  const v = Number(headers.get('x-ratelimit-rps-limit'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a {@link SolanaRpc} whose transport is backed by an opossum circuit
 * breaker. Reads and writes flow through the primary transport; when it
 * becomes unhealthy the circuit opens and subsequent calls are routed to
 * the fallback transport until the primary recovers.
 */
export function createCircuitBreakerRpc({
  primaryUrl,
  fallbackUrl,
  circuitBreakerOptions: opts = {},
}: CircuitBreakerRpcConfig): SolanaRpc {
  const primaryTransport = createDefaultRpcTransport({ url: primaryUrl });
  const fallbackTransport = createDefaultRpcTransport({ url: fallbackUrl });

  type TransportRequest = Parameters<typeof primaryTransport>[0];

  // Throttling is always on. `maxRequestsPerSecond` is the *ceiling*: every
  // request flows through an adaptive token bucket that backs off on HTTP 429
  // (honoring `Retry-After` and `x-ratelimit-rps-limit` when present, AIMD
  // otherwise) and recovers back toward the ceiling on sustained success.
  const ceilingRate =
    opts.maxRequestsPerSecond !== undefined && opts.maxRequestsPerSecond > 0
      ? opts.maxRequestsPerSecond
      : DEFAULT_MAX_RPS;
  const gate = createRateGate(ceilingRate);
  let currentRate = ceilingRate;
  let successStreak = 0;

  const onError = (err: unknown) => {
    const headers = http429Headers(err);
    if (!headers) return; // only adapt to rate-limit (429) failures
    successStreak = 0;

    const advertised = parseRpsLimit(headers);
    const next =
      advertised !== null
        ? Math.min(
            ceilingRate,
            Math.max(MIN_RATE, advertised * RATE_SAFETY_FACTOR),
          )
        : Math.max(MIN_RATE, currentRate * AIMD_DECREASE);
    if (next !== currentRate) {
      currentRate = next;
      gate.setRate(currentRate);
    }

    const retryAfter = parseRetryAfterMs(headers);
    gate.pauseFor(retryAfter ?? DEFAULT_COOLDOWN_MS);
    logger.warn(
      `[rpc-circuit-breaker] 429 — throttling to ${currentRate.toFixed(1)} req/s` +
        `, cooling down ${retryAfter ?? DEFAULT_COOLDOWN_MS}ms`,
    );
  };

  const onSuccess = () => {
    if (currentRate >= ceilingRate) return;
    if (++successStreak >= RECOVERY_SUCCESSES) {
      successStreak = 0;
      currentRate = Math.min(ceilingRate, currentRate + 1);
      gate.setRate(currentRate);
    }
  };

  const breaker = new CircuitBreaker(
    (request: TransportRequest) => primaryTransport(request),
    {
      timeout: opts.timeout ?? 10_000,
      errorThresholdPercentage: opts.errorThresholdPercentage ?? 25,
      resetTimeout: opts.resetTimeout ?? 60_000,
      volumeThreshold: opts.volumeThreshold ?? 3,
      ...(opts.maxConcurrent !== undefined && opts.maxConcurrent > 0
        ? { capacity: opts.maxConcurrent }
        : {}),
    },
  );

  breaker.fallback((request: TransportRequest) => fallbackTransport(request));

  breaker.on('open', () => {
    logger.warn('[rpc-circuit-breaker] circuit OPEN — routing to fallback RPC');
  });
  breaker.on('halfOpen', () => {
    logger.info(
      '[rpc-circuit-breaker] circuit HALF-OPEN — probing primary RPC',
    );
  });
  breaker.on('close', () => {
    logger.info('[rpc-circuit-breaker] circuit CLOSED — primary RPC recovered');
  });

  // Adapt the rate to the *primary's* health via opossum's events: `failure`
  // fires whenever the primary call rejects (a 429 included) even when the
  // fallback then masks it by resolving `fire()`, and `success` fires on a
  // healthy primary call. A plain try/catch around `fire()` would miss the
  // fallback-masked 429s entirely.
  breaker.on('failure', (err: unknown) => onError(err));
  breaker.on('success', () => onSuccess());

  const transport = (async (request: TransportRequest) => {
    // Throttle entry to the breaker so we stay under the provider's rate
    // limit; the queue wait sits outside `fire`, so opossum's per-request
    // timeout only measures the actual transport call.
    await gate.acquire();
    return breaker.fire(request);
  }) as RpcTransport;

  return createSolanaRpcFromTransport(transport) as SolanaRpc;
}

/**
 * Convenience: pick a sensible public fallback URL based on the primary URL.
 *
 * - Primary contains `devnet` → devnet public RPC
 * - Everything else → mainnet-beta public RPC
 */
export function defaultFallbackUrl(primaryUrl: string): string {
  if (/devnet/i.test(primaryUrl)) return DEFAULT_DEVNET_RPC;
  return DEFAULT_MAINNET_RPC;
}
