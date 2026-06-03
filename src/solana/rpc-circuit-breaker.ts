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
   * @default 50
   */
  errorThresholdPercentage?: number;
  /**
   * Time in ms to wait before entering half-open state and retrying
   * the primary.
   * @default 30_000
   */
  resetTimeout?: number;
  /**
   * Minimum number of requests within the rolling window before the
   * circuit can trip. Prevents opening the circuit after a single failure.
   * @default 5
   */
  volumeThreshold?: number;
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

  const breaker = new CircuitBreaker(
    (request: TransportRequest) => primaryTransport(request),
    {
      timeout: opts.timeout ?? 10_000,
      errorThresholdPercentage: opts.errorThresholdPercentage ?? 50,
      resetTimeout: opts.resetTimeout ?? 30_000,
      volumeThreshold: opts.volumeThreshold ?? 5,
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

  const transport = ((request: TransportRequest) =>
    breaker.fire(request)) as RpcTransport;

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
