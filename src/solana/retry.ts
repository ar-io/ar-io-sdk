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
 * Lightweight retry helper with exponential back-off + jitter for Solana RPC
 * read calls.
 *
 * Wraps any async function so transient transport errors (HTTP 429/5xx,
 * network timeouts, etc.) are retried automatically while "normal" failures
 * (account-not-found, deserialization) bubble immediately.
 *
 * Usage:
 * ```ts
 * const account = await withRetry(() => fetchEncodedAccount(rpc, pda));
 * ```
 */

import { Logger } from '../common/logger.js';

const logger = new Logger({ level: 'error' });

export interface RetryOptions {
  /** Maximum number of attempts (first call + retries). @default 6 */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Doubled each attempt. @default 500 */
  baseDelayMs?: number;
  /** Cap on any single delay in ms. @default 5_000 */
  maxDelayMs?: number;
  /** Predicate that decides whether a thrown error is retryable.
   *  Defaults to {@link isRetryableError}. */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5_000;

/**
 * Default retryable-error heuristic.
 *
 * We retry on:
 * - Network / fetch errors (`TypeError: fetch failed`)
 * - HTTP 429 (rate-limit) and 5xx (server) surfaced by kit's transport as
 *   `SolanaError` with "HTTP error (4xx|5xx)" in the message.
 * - Timeout errors from opossum or native `AbortError`.
 *
 * We do NOT retry on:
 * - JSON-RPC application errors (account not found, invalid params, etc.)
 * - Deserialization / decoding errors
 * - Any error without a recognisable transport signature
 */
export function isRetryableError(error: unknown): boolean {
  if (error == null) return false;

  const name = (error as { name?: string }).name ?? '';
  const message = String((error as { message?: string }).message ?? '');
  const code = (error as { context?: { __code?: number } }).context
    ?.__code as unknown;

  // SolanaError from kit's transport for HTTP 429 / 5xx
  if (/HTTP error \(4(?:0[89]|[1-9]\d)|HTTP error \(5\d\d\)/.test(message))
    return true;

  // Specific 429 match (rate-limit) — always retry
  if (/HTTP error \(429\)/.test(message)) return true;

  // Network-level failures: fetch failed, ECONNRESET, ETIMEDOUT, etc.
  if (name === 'TypeError' && /fetch failed/i.test(message)) return true;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(message)) return true;

  // Abort / timeout
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  if (/timed out/i.test(message)) return true;

  // Opossum circuit-breaker open — the breaker itself will fallback, but if
  // we're layered on top we shouldn't retry (the breaker handles it).
  if (/breaker is open/i.test(message)) return false;

  // Numeric Solana JSON-RPC codes that indicate transient overload
  if (typeof code === 'number' && (code === -32005 || code === -32016))
    return true;

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredDelay(base: number, attempt: number, cap: number): number {
  const exponential = base * 2 ** attempt;
  const capped = Math.min(exponential, cap);
  return capped * (0.5 + Math.random() * 0.5);
}

/**
 * Execute `fn` with automatic retries on transient failures.
 *
 * ```ts
 * const data = await withRetry(() => rpc.getAccountInfo(addr).send());
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = opts?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const retryable = opts?.isRetryable ?? isRetryableError;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLast = attempt === maxAttempts - 1;
      if (isLast || !retryable(error)) {
        throw error;
      }

      const delay = jitteredDelay(baseDelayMs, attempt, maxDelayMs);
      logger.debug(
        `[retry] attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`,
        { error: String(error) },
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
