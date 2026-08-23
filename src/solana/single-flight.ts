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
 * Single-flight (a.k.a. request-coalescing) memoization for RPC reads.
 *
 * The SDK's short-TTL caches used to store the RESOLVED value, which meant
 * they only ever helped SEQUENTIAL callers: N concurrent callers all miss the
 * cache before any of them fills it, so all N hit the network. That is exactly
 * backwards — the burst is the case worth collapsing. Measured against devnet,
 * ten concurrent `getGasEstimate()` calls issued 43 requests / 200 KiB where
 * ten sequential calls issued 14 / 21 KiB, and the burst tripped a 429.
 *
 * Storing the PROMISE instead of the value fixes that: the first caller starts
 * the work, everyone else awaits the same promise, and the resolved value is
 * still reused for `ttlMs` afterwards.
 *
 * Internal helper — deliberately not re-exported from `./index.ts`, so it adds
 * nothing to the package's public surface.
 */

/** A cached in-flight or already-settled request. */
type InFlightEntry<V> = {
  promise: Promise<V>;
  expiresAt: number;
};

/** Backing store for {@link memoizeInFlight}. Callers own the Map instance. */
export type InFlightStore<K, V> = Map<K, InFlightEntry<V>>;

/**
 * Return the cached promise for `key`, or start one with `produce()`.
 *
 * @param store - caller-owned Map holding the cached promises.
 * @param key - cache key.
 * @param ttlMs - how long a SETTLED value stays reusable. Use
 *   `Number.POSITIVE_INFINITY` for values that never change (e.g. a mint
 *   address). The in-flight window is always shared regardless of `ttlMs`.
 * @param produce - starts the underlying work. Called at most once per
 *   (key, TTL window).
 * @param keep - decides, after resolution, whether the value is worth
 *   retaining. Returning `false` evicts it once settled, so later callers
 *   re-fetch — while concurrent callers still shared the single request. This
 *   is how "misses are not cached" survives coalescing.
 */
export function memoizeInFlight<K, V>(
  store: InFlightStore<K, V>,
  key: K,
  ttlMs: number,
  produce: () => Promise<V>,
  keep: (value: V) => boolean = () => true,
): Promise<V> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit !== undefined && hit.expiresAt > now) return hit.promise;

  const promise = produce();
  store.set(key, { promise, expiresAt: now + ttlMs });

  // Only ever evict OUR entry: by the time this settles the key may already
  // hold a newer promise (TTL expired, another caller started a fresh fetch),
  // and dropping that one would silently defeat the cache.
  const evictSelf = () => {
    if (store.get(key)?.promise === promise) store.delete(key);
  };

  // A rejection must not be cached — otherwise one transient 429 poisons the
  // key for the whole TTL. Attaching the handler here also keeps Node from
  // reporting an unhandled rejection for the cached promise; callers await the
  // ORIGINAL promise, so they still observe the error.
  void promise.then((value) => {
    if (!keep(value)) evictSelf();
  }, evictSelf);

  return promise;
}
