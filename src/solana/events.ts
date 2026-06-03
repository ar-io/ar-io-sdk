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
 * AR.IO Solana event decoders — STUB.
 *
 * The local event codegen pipeline has been removed. Event decoders will be
 * restored once `@ar.io/solana-contracts` publishes them. Until then, the
 * parse functions return empty arrays and the union types are `never`.
 */

import type { Rpc, Signature, SolanaRpcApi } from '@solana/kit';

/** Placeholder — no event variants are available until the contracts package ships event decoders. */
export type AnyArioCoreEvent = never;
export type AnyArioGarEvent = never;
export type AnyArioArnsEvent = never;
export type AnyArioAntEvent = never;
export type AnyArioAntEscrowEvent = never;

export type AnyEvent =
  | AnyArioCoreEvent
  | AnyArioGarEvent
  | AnyArioArnsEvent
  | AnyArioAntEvent
  | AnyArioAntEscrowEvent;

export type EventName = never;

export function parseEventsFromLogs(_logs: readonly string[]): AnyEvent[] {
  return [];
}

export async function parseTransactionEvents(
  _rpc: Rpc<SolanaRpcApi>,
  _signature: Signature,
  _opts?: { commitment?: 'processed' | 'confirmed' | 'finalized' },
): Promise<AnyEvent[]> {
  return [];
}

export function isEvent<N extends EventName>(
  ev: AnyEvent,
  _name: N,
): ev is Extract<AnyEvent, { name: N }> {
  return (ev as { name?: unknown }).name === _name;
}
