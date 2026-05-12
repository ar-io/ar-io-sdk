/**
 * AR.IO Solana event decoders — consumer-facing API.
 *
 * Anchor `#[event]` emits surface as `Program data: <base64>` log lines
 * inside the surrounding instruction's logs. The base64 blob is
 * `[discriminator(8) || borsh_payload]`, where the discriminator is
 * `sha256("event:<EventName>")[..8]`.
 *
 * This module wraps the per-program codecs in
 * `sdk/src/solana/generated/<program>/events/` (auto-emitted by
 * `sdk/scripts/events-codegen.mjs`) into:
 *   - a discriminated union `AnyEvent` covering every event the
 *     AR.IO contracts emit
 *   - per-program union types for filtering
 *   - log-walking utilities that route `Program data:` lines back to
 *     the program that emitted them (so events emitted from a CPI'd
 *     handler get attributed to the correct program)
 *   - a typed `parseTransactionEvents(rpc, signature)` helper
 *
 * Event payloads are returned with `bigint` for u64 / i64 fields and
 * `Address` for pubkey fields, matching the rest of the kit-native
 * SDK. To narrow on a specific event, use the `name` discriminator or
 * the per-event type guards exported alongside the union.
 *
 * Live event subscription (websocket / Helius / Geyser) is out of
 * scope here — this module is the decoder layer that all those
 * mechanisms can build on. See `parseTransactionEvents` for the
 * pull-based model.
 */

import {
  type Address,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
  getBase64Encoder,
} from '@solana/kit';

import { ARIO_ANT_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/ant';
import { ARIO_ANT_ESCROW_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/ant-escrow';
import { ARIO_ARNS_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/arns';
import { ARIO_CORE_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/core';
import { ARIO_GAR_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/gar';

import * as escrowEvents from './generated/ant-escrow/events/index.js';
import * as antEvents from './generated/ant/events/index.js';
import * as arnsEvents from './generated/arns/events/index.js';
import * as coreEvents from './generated/core/events/index.js';
import * as garEvents from './generated/gar/events/index.js';

const PROGRAM_DATA_PREFIX = 'Program data: ';

// ---------------------------------------------------------------------------
// Decoder dispatch table
//
// The dispatch table is built lazily on first use. It maps:
//   discriminator(hex) → { name, programId, decode }
// where `decode(blob)` slices the leading 8 discriminator bytes off and
// borsh-decodes the rest using the matching `getXxxDecoder()` from the
// generated tree.
//
// Building the table on first use keeps cold-import cost low (no work
// at module load time for consumers that never call into events).
// ---------------------------------------------------------------------------

type Dispatch = {
  name: EventName;
  programId: Address;
  decode: (blob: Uint8Array) => unknown;
};

let DISPATCH: Map<string, Dispatch> | null = null;

function buildDispatch(): Map<string, Dispatch> {
  const table = new Map<string, Dispatch>();
  const groups: Array<[Address, Record<string, unknown>]> = [
    [ARIO_CORE_PROGRAM_ADDRESS, coreEvents],
    [ARIO_GAR_PROGRAM_ADDRESS, garEvents],
    [ARIO_ARNS_PROGRAM_ADDRESS, arnsEvents],
    [ARIO_ANT_PROGRAM_ADDRESS, antEvents],
    [ARIO_ANT_ESCROW_PROGRAM_ADDRESS, escrowEvents],
  ];
  for (const [programId, mod] of groups) {
    for (const [exportName, exportValue] of Object.entries(mod)) {
      // Discriminators export as `EVENT_NAME_DISCRIMINATOR` constants of
      // type Uint8Array. The matching decoder is `getEventNameDecoder`.
      if (
        !exportName.endsWith('_DISCRIMINATOR') ||
        !(exportValue instanceof Uint8Array)
      ) {
        continue;
      }
      // Recover the event PascalCase name from the SCREAMING_SNAKE
      // discriminator constant: TRANSFER_EVENT_DISCRIMINATOR → TransferEvent
      const eventName = screamingSnakeToPascal(
        exportName.slice(0, -'_DISCRIMINATOR'.length),
      ) as EventName;
      const decoderKey = `get${eventName}Decoder`;
      const decoderFactory = (mod as Record<string, unknown>)[decoderKey];
      if (typeof decoderFactory !== 'function') {
        // Should never happen — codegen always emits both consts together —
        // but skip defensively rather than crash at import time.
        continue;
      }
      const decoder = (
        decoderFactory as () => { decode: (b: Uint8Array) => unknown }
      ).call(null);
      const hex = bytesToHex(exportValue);
      table.set(hex, {
        name: eventName,
        programId,
        decode: (blob) => decoder.decode(blob),
      });
    }
  }
  return table;
}

function dispatch(): Map<string, Dispatch> {
  if (DISPATCH === null) DISPATCH = buildDispatch();
  return DISPATCH;
}

// ---------------------------------------------------------------------------
// Public types — discriminated union of every event the AR.IO contracts emit.
//
// Each variant carries:
//   - `programId`: which program emitted it (resolved by walking the
//     surrounding `Program <id> invoke/success` log frames; correctly
//     attributes CPI emits)
//   - `name`: the event type name (the discriminator for narrowing)
//   - `data`: the decoded payload, typed against the matching
//     `EventName` shape from the generated tree
//
// New events automatically join the union via the
// `*EventsByName` mapped types below — they're regenerated on every
// `yarn codegen` run.
// ---------------------------------------------------------------------------

/** Maps event-name → decoded payload type, per program. */
type CoreEventByName = {
  [K in keyof typeof coreEvents as K extends `get${infer N}Decoder`
    ? N
    : never]: typeof coreEvents extends Record<
    `get${string & K}Decoder`,
    () => infer D
  >
    ? D extends { decode(b: Uint8Array): infer P }
      ? P
      : never
    : never;
};
type GarEventByName = {
  [K in keyof typeof garEvents as K extends `get${infer N}Decoder`
    ? N
    : never]: typeof garEvents extends Record<
    `get${string & K}Decoder`,
    () => infer D
  >
    ? D extends { decode(b: Uint8Array): infer P }
      ? P
      : never
    : never;
};
type ArnsEventByName = {
  [K in keyof typeof arnsEvents as K extends `get${infer N}Decoder`
    ? N
    : never]: typeof arnsEvents extends Record<
    `get${string & K}Decoder`,
    () => infer D
  >
    ? D extends { decode(b: Uint8Array): infer P }
      ? P
      : never
    : never;
};
type AntEventByName = {
  [K in keyof typeof antEvents as K extends `get${infer N}Decoder`
    ? N
    : never]: typeof antEvents extends Record<
    `get${string & K}Decoder`,
    () => infer D
  >
    ? D extends { decode(b: Uint8Array): infer P }
      ? P
      : never
    : never;
};
type EscrowEventByName = {
  [K in keyof typeof escrowEvents as K extends `get${infer N}Decoder`
    ? N
    : never]: typeof escrowEvents extends Record<
    `get${string & K}Decoder`,
    () => infer D
  >
    ? D extends { decode(b: Uint8Array): infer P }
      ? P
      : never
    : never;
};

/** Per-program decoded-event union (each variant tagged by `name`). */
export type AnyArioCoreEvent = {
  [K in keyof CoreEventByName]: {
    programId: typeof ARIO_CORE_PROGRAM_ADDRESS;
    name: K;
    data: CoreEventByName[K];
  };
}[keyof CoreEventByName];
export type AnyArioGarEvent = {
  [K in keyof GarEventByName]: {
    programId: typeof ARIO_GAR_PROGRAM_ADDRESS;
    name: K;
    data: GarEventByName[K];
  };
}[keyof GarEventByName];
export type AnyArioArnsEvent = {
  [K in keyof ArnsEventByName]: {
    programId: typeof ARIO_ARNS_PROGRAM_ADDRESS;
    name: K;
    data: ArnsEventByName[K];
  };
}[keyof ArnsEventByName];
export type AnyArioAntEvent = {
  [K in keyof AntEventByName]: {
    programId: typeof ARIO_ANT_PROGRAM_ADDRESS;
    name: K;
    data: AntEventByName[K];
  };
}[keyof AntEventByName];
export type AnyArioAntEscrowEvent = {
  [K in keyof EscrowEventByName]: {
    programId: typeof ARIO_ANT_ESCROW_PROGRAM_ADDRESS;
    name: K;
    data: EscrowEventByName[K];
  };
}[keyof EscrowEventByName];

/** Top-level union covering every event from every AR.IO program. */
export type AnyEvent =
  | AnyArioCoreEvent
  | AnyArioGarEvent
  | AnyArioArnsEvent
  | AnyArioAntEvent
  | AnyArioAntEscrowEvent;

/** All event-name strings that can appear as `AnyEvent.name`. */
export type EventName = AnyEvent['name'];

// ---------------------------------------------------------------------------
// Public API: parsing event payloads from logs / transactions.
// ---------------------------------------------------------------------------

/**
 * Parse every AR.IO event from a transaction's `log_messages` array.
 *
 * The logs are walked top-down. We track the current program by
 * pushing on `Program <id> invoke [N]` and popping on `Program <id>
 * success` / `failed`. Each `Program data: <base64>` line is attributed
 * to the program at the top of the stack — so a `StakePaymentEvent`
 * emitted by ario-gar from inside an ario-arns CPI is correctly
 * attributed to ario-gar.
 *
 * Lines whose discriminator doesn't match any known AR.IO event are
 * silently skipped — they may be from another program in the same tx
 * (e.g., SPL Token's debit/credit logs aren't event emissions, but
 * other Anchor programs in the same tx might emit unrelated events).
 *
 * Failed instructions inside a tx still emit logs up to the failure
 * point. We don't filter those out — caller can cross-reference the
 * tx's `meta.err` if it cares.
 */
export function parseEventsFromLogs(logs: readonly string[]): AnyEvent[];
export function parseEventsFromLogs<N extends EventName>(
  logs: readonly string[],
  filter: N,
): Array<Extract<AnyEvent, { name: N }>>;
export function parseEventsFromLogs<N extends EventName>(
  logs: readonly string[],
  filter?: N,
): AnyEvent[] | Array<Extract<AnyEvent, { name: N }>> {
  const table = dispatch();
  const stack: Address[] = [];
  const out: AnyEvent[] = [];
  for (const line of logs) {
    // Track CPI nesting via the standard Solana log format:
    //   "Program <pubkey> invoke [N]"
    //   "Program <pubkey> success"
    //   "Program <pubkey> failed: ..."
    const invoke = line.match(
      /^Program ([A-HJ-NP-Za-km-z1-9]{32,44}) invoke \[\d+\]$/,
    );
    if (invoke) {
      stack.push(invoke[1] as Address);
      continue;
    }
    const ended = line.match(
      /^Program ([A-HJ-NP-Za-km-z1-9]{32,44}) (success|failed:.*)$/,
    );
    if (ended) {
      // Pop the matching stack frame. Solana guarantees these are
      // properly nested.
      const top = stack.length > 0 ? stack[stack.length - 1] : undefined;
      if (top === ended[1]) stack.pop();
      continue;
    }
    if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue;
    const blob = decodeBase64(line.slice(PROGRAM_DATA_PREFIX.length).trim());
    if (blob === null || blob.length < 8) continue;
    const hex = bytesToHex(blob.subarray(0, 8));
    const entry = table.get(hex);
    if (!entry) continue;
    // Use the program at the top of the stack as the emitter. If for
    // some reason the stack is empty (malformed logs), fall back to
    // the dispatch entry's programId (matches the discriminator's
    // declared owner).
    const programId =
      stack.length > 0 ? stack[stack.length - 1] : entry.programId;
    const data = entry.decode(blob);
    out.push({ programId, name: entry.name, data } as AnyEvent);
  }
  if (filter !== undefined) {
    return out.filter(
      (e): e is Extract<AnyEvent, { name: typeof filter }> => e.name === filter,
    );
  }
  return out;
}

/**
 * Fetch a transaction by signature and return its decoded events.
 *
 * Uses `getTransaction` with `maxSupportedTransactionVersion: 0` and
 * `commitment: 'confirmed'` by default. Returns `[]` if the tx is
 * still pending, missing, or had no logs (rare — Anchor programs
 * always log).
 */
export async function parseTransactionEvents(
  rpc: Rpc<SolanaRpcApi>,
  signature: Signature,
  opts: { commitment?: 'processed' | 'confirmed' | 'finalized' } = {},
): Promise<AnyEvent[]> {
  const commitment = opts.commitment ?? 'confirmed';
  const tx = await rpc
    .getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
      encoding: 'json',
    })
    .send();
  const logs = tx?.meta?.logMessages ?? [];
  return parseEventsFromLogs(logs);
}

// ---------------------------------------------------------------------------
// Type guards — sugar so `if (isNamePurchasedEvent(ev)) { ev.data.cost ... }`
// narrows correctly without writing `ev.name === 'NamePurchasedEvent'`.
// One per event would be 73 lines of boilerplate; we expose a
// generic `isEvent<N>(ev, name)` instead. Consumers can wrap if they
// want a specific named guard.
// ---------------------------------------------------------------------------

/**
 * Generic type-narrowing predicate for any event name.
 *
 * ```ts
 * for (const ev of events) {
 *   if (isEvent(ev, 'NamePurchasedEvent')) {
 *     // ev.data is typed as NamePurchasedEvent here
 *     console.log(ev.data.buyer, ev.data.cost);
 *   }
 * }
 * ```
 */
export function isEvent<N extends EventName>(
  ev: AnyEvent,
  name: N,
): ev is Extract<AnyEvent, { name: N }> {
  return ev.name === name;
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function screamingSnakeToPascal(s: string): string {
  // TRANSFER_EVENT → TransferEvent
  return s
    .split('_')
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

function decodeBase64(b64: string): Uint8Array | null {
  // @solana/kit's getBase64Encoder is a codec helper for the *string*
  // representation; for raw decoding we use Buffer when running on Node
  // (the SDK targets Node 18+) and atob otherwise. Wrap it so callers
  // get a predictable Uint8Array regardless of runtime.
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    // Browser path — atob returns a binary string we then unpack.
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    void getBase64Encoder; // keep the import alive for future kit-native variants
    return null;
  }
}
