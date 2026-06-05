/**
 * Surfpool clock-warp helpers.
 *
 * Wraps Surfpool's `surfnet_*` time-control RPC cheatcodes. Used by
 * any e2e/localnet test that exercises lease expiry, withdrawal
 * locks, epoch rollover, demand-factor period boundaries, etc.
 *
 * Reference: https://docs.surfpool.run/rpc/cheatcodes
 *
 * The on-chain `Clock::unix_timestamp` advances 1:1 with what we set
 * here. All AR.IO programs read clock via `Clock::get()` so a single
 * `warpToTimestamp` is enough to age a lease, advance an epoch, or
 * unlock a withdrawal — no per-program book-keeping required.
 *
 * Caveats:
 *   - Surfpool defaults to `clock` block-production mode (slots
 *     advance every 400ms). After `surfnet_timeTravel`, the clock
 *     keeps advancing from the new value. If a test needs a frozen
 *     wall clock, call `pauseClock()` first.
 *   - `surfnet_timeTravel` accepts ONE of `absoluteTimestamp`,
 *     `absoluteSlot`, or `absoluteEpoch` per call (single-variant
 *     serde enum); the helpers below pick the right shape.
 *   - There's no built-in "warp by relative seconds" RPC. We compute
 *     `current + delta` client-side via `getCurrentTimestamp()`.
 */

const TIME_TRAVEL_METHOD = 'surfnet_timeTravel';
const PAUSE_METHOD = 'surfnet_pauseClock';
const RESUME_METHOD = 'surfnet_resumeClock';

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

/** Surfpool returns this shape for time-cheatcode methods. */
export interface SurfpoolEpochInfo {
  absoluteSlot: number;
  blockHeight: number;
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  transactionCount?: number;
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(
      `Surfpool RPC ${method} HTTP ${res.status}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as JsonRpcResponse<T>;
  if (body.error) {
    throw new Error(
      `Surfpool RPC ${method} error ${body.error.code}: ${body.error.message}`,
    );
  }
  if (body.result === undefined) {
    throw new Error(`Surfpool RPC ${method} returned no result`);
  }
  return body.result;
}

/**
 * Read the current Solana clock's `unix_timestamp` from the running
 * Surfpool. Uses standard Solana `getAccountInfo` against the Clock
 * sysvar, so this works against any RPC, not just Surfpool.
 *
 * Returned in seconds (matches on-chain `Clock::unix_timestamp`).
 */
export async function getCurrentTimestamp(rpcUrl: string): Promise<number> {
  // Clock sysvar layout: u64 slot (8) | i64 epoch_start_timestamp (8) |
  // u64 epoch (8) | u64 leader_schedule_epoch (8) | i64 unix_timestamp (8).
  // unix_timestamp is at byte offset 32.
  const res = await rpcCall<{
    value: { data: [string, string] } | null;
  }>(rpcUrl, 'getAccountInfo', [
    'SysvarC1ock11111111111111111111111111111111',
    { encoding: 'base64' },
  ]);
  if (!res.value) throw new Error('Clock sysvar not found');
  const buf = Buffer.from(res.value.data[0], 'base64');
  // Read i64 LE at offset 32. Buffer.readBigInt64LE returns bigint.
  return Number(buf.readBigInt64LE(32));
}

/**
 * Jump the Surfpool clock to a specific UNIX timestamp (seconds).
 * The block clock keeps advancing from there unless `pauseClock` is
 * called first.
 *
 * Surfpool's `surfnet_timeTravel.absoluteTimestamp` is in
 * **milliseconds**, while the on-chain `Clock::unix_timestamp` (and
 * everything our programs reason about) is in **seconds**. Callers
 * pass seconds; we convert here. Sending the same seconds value that
 * `getCurrentTimestamp()` returns would surface as
 * `Cannot travel to past timestamp: target=<seconds>, current=<ms>`.
 */
export async function warpToTimestamp(
  rpcUrl: string,
  unixSeconds: number,
): Promise<SurfpoolEpochInfo> {
  return rpcCall<SurfpoolEpochInfo>(rpcUrl, TIME_TRAVEL_METHOD, [
    { absoluteTimestamp: unixSeconds * 1000 },
  ]);
}

/** Convenience: warp forward by `seconds` from the current chain clock. */
export async function warpClockBy(
  rpcUrl: string,
  seconds: number,
): Promise<SurfpoolEpochInfo> {
  const now = await getCurrentTimestamp(rpcUrl);
  return warpToTimestamp(rpcUrl, now + seconds);
}

/** Jump to a specific slot. */
export async function warpToSlot(
  rpcUrl: string,
  slot: number,
): Promise<SurfpoolEpochInfo> {
  return rpcCall<SurfpoolEpochInfo>(rpcUrl, TIME_TRAVEL_METHOD, [
    { absoluteSlot: slot },
  ]);
}

/** Jump to a specific epoch. */
export async function warpToEpoch(
  rpcUrl: string,
  epoch: number,
): Promise<SurfpoolEpochInfo> {
  return rpcCall<SurfpoolEpochInfo>(rpcUrl, TIME_TRAVEL_METHOD, [
    { absoluteEpoch: epoch },
  ]);
}

/** Freeze slot advancement. Block production halts until `resumeClock`. */
export async function pauseClock(rpcUrl: string): Promise<SurfpoolEpochInfo> {
  return rpcCall<SurfpoolEpochInfo>(rpcUrl, PAUSE_METHOD, []);
}

/** Resume slot advancement after a `pauseClock`. */
export async function resumeClock(rpcUrl: string): Promise<SurfpoolEpochInfo> {
  return rpcCall<SurfpoolEpochInfo>(rpcUrl, RESUME_METHOD, []);
}
