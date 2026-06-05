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
 * Map `items` through async `fn` with at most `limit` invocations in flight at
 * once, preserving INPUT ORDER in the returned array regardless of completion
 * order. Used to fan out batched RPC reads (e.g. chunked `fetchEncodedAccounts`
 * calls) without flooding the endpoint with unbounded concurrency.
 *
 * `limit` is clamped to at least 1; an empty `items` resolves to `[]` without
 * invoking `fn`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let next = 0;

  // Spin up `effectiveLimit` workers that pull the next index off a shared
  // cursor until the input is exhausted. Results are written by index so the
  // output order matches the input order, not the completion order.
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));

  return results;
}
