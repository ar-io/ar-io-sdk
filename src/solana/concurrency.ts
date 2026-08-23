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
 * Bounded-concurrency map for batched RPC reads.
 *
 * The bulk readers fetch accounts in chunks of 100 (Solana's
 * `getMultipleAccounts` ceiling) but used to `await` each chunk before
 * starting the next, so wall-clock time grew linearly with the number of
 * chunks: 648 devnet gateways took ~210ms across 7 serialized round trips
 * where the same 7 in parallel took ~110ms, and mainnet's larger registry
 * makes that gap wider still.
 *
 * The cap matters as much as the parallelism. An unbounded `Promise.all` over
 * every chunk turns one bulk read into a burst as wide as the registry, which
 * is a good way to earn an HTTP 429 from a public RPC — so this runs a fixed
 * pool instead.
 *
 * Internal helper — not re-exported from `./index.ts`.
 */

/**
 * Default pool size for chunked account fetches.
 *
 * Four is a deliberate compromise: it cuts a 13-chunk mainnet gateway read to
 * ~4 waves instead of 13, while staying far below the burst width that trips
 * provider rate limits. Callers that know their RPC's limits can pass their
 * own.
 */
export const ACCOUNT_FETCH_CONCURRENCY = 4;

/** Split `items` into consecutive slices of at most `size`. */
export function chunkArray<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/**
 * Map `items` through `fn` with at most `limit` calls in flight.
 *
 * Results are returned in INPUT order regardless of completion order — the
 * bulk readers index into the result array positionally (`accounts[i * 3]`),
 * so any reordering here would silently mis-assign decoded accounts to mints.
 *
 * Rejection semantics match a plain sequential loop: the first failure
 * rejects the whole call.
 */
export async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  const poolSize = Math.max(1, Math.min(limit, items.length));

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: poolSize }, worker));
  return results;
}
