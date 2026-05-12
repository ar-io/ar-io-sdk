/**
 * Unit tests for the SDK event decoder layer.
 *
 * Coverage:
 *   - Per-event encode → format-as-Program-data-line → decode round-trip,
 *     for one event from each program, exercising every codec primitive
 *     used by the codegen (pubkey, u64, i64, u8, u16, u32, bool, string,
 *     fixed-byte arrays, Option<T>).
 *   - CPI nesting: an event emitted from inside a CPI'd handler is
 *     attributed to the CPI'd program, not the outer caller.
 *   - Filter overload narrows correctly.
 *   - `isEvent` type guard.
 *   - Unknown discriminators are silently skipped (forward compat with
 *     events from other programs landing in the same tx).
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, address } from '@solana/kit';

import { type AnyEvent, isEvent, parseEventsFromLogs } from './events.js';
import {
  ESCROW_DEPOSITED_EVENT_DISCRIMINATOR,
  getEscrowDepositedEventEncoder,
} from './generated/ant-escrow/events/escrowDepositedEvent.js';
import {
  ANT_METADATA_UPDATED_EVENT_DISCRIMINATOR,
  getAntMetadataUpdatedEventEncoder,
} from './generated/ant/events/antMetadataUpdatedEvent.js';
import {
  NAME_PURCHASED_EVENT_DISCRIMINATOR,
  getNamePurchasedEventEncoder,
} from './generated/arns/events/namePurchasedEvent.js';
import {
  NAME_RESERVED_EVENT_DISCRIMINATOR,
  getNameReservedEventEncoder,
} from './generated/arns/events/nameReservedEvent.js';
import {
  CONFIG_UPDATED_EVENT_DISCRIMINATOR,
  getConfigUpdatedEventEncoder,
} from './generated/core/events/configUpdatedEvent.js';
import {
  TRANSFER_EVENT_DISCRIMINATOR,
  getTransferEventEncoder,
} from './generated/core/events/transferEvent.js';
import {
  GATEWAY_JOINED_EVENT_DISCRIMINATOR,
  getGatewayJoinedEventEncoder,
} from './generated/gar/events/gatewayJoinedEvent.js';

import { ARIO_ANT_ESCROW_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/ant-escrow';
import { ARIO_ANT_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/ant';
import { ARIO_ARNS_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/arns';
import { ARIO_CORE_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/core';
import { ARIO_GAR_PROGRAM_ADDRESS } from '@ar.io/solana-contracts/gar';

// Fixture pubkeys — real 32-byte base58 addresses so address() validates.
// Using well-known program ids so failure diffs are easy to read.
const PK_A = address('11111111111111111111111111111111'); // System Program (all-zero pubkey)
const PK_B = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'); // SPL Token Program

/** Format a payload as the `Program data: <base64>` line Solana logs. */
function asProgramDataLine(bytes: Uint8Array): string {
  return `Program data: ${Buffer.from(bytes).toString('base64')}`;
}

/** Wrap an event payload in the program-invoke/success frames Solana
 *  emits for top-level invocations. The default program is
 *  ario-core; pass a custom one to simulate emit from a different
 *  caller. */
function topLevelLogs(programId: Address, payloads: Uint8Array[]): string[] {
  return [
    `Program ${programId} invoke [1]`,
    'Program log: Instruction: Test',
    ...payloads.map(asProgramDataLine),
    `Program ${programId} success`,
  ];
}

describe('parseEventsFromLogs — top-level emits', () => {
  it('decodes TransferEvent from ario-core', () => {
    const enc = getTransferEventEncoder();
    const blob = enc.encode({
      from: PK_A,
      to: PK_B,
      amount: 1_000_000n,
      timestamp: 1_700_000_000n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_CORE_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    const ev = events[0];
    assert.equal(ev.programId, ARIO_CORE_PROGRAM_ADDRESS);
    assert.equal(ev.name, 'TransferEvent');
    if (ev.name !== 'TransferEvent') return;
    assert.equal(ev.data.from, PK_A);
    assert.equal(ev.data.to, PK_B);
    assert.equal(ev.data.amount, 1_000_000n);
    assert.equal(ev.data.timestamp, 1_700_000_000n);
  });

  it('decodes GatewayJoinedEvent from ario-gar (covers `string` codec)', () => {
    const enc = getGatewayJoinedEventEncoder();
    const blob = enc.encode({
      operator: PK_A,
      stake: 50_000_000_000n,
      fqdn: 'gateway.example.com',
      timestamp: 1_700_000_000n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_GAR_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'GatewayJoinedEvent');
    if (events[0].name !== 'GatewayJoinedEvent') return;
    assert.equal(events[0].data.fqdn, 'gateway.example.com');
    assert.equal(events[0].data.stake, 50_000_000_000n);
  });

  it('decodes NamePurchasedEvent from ario-arns (covers `u8` discriminators)', () => {
    const enc = getNamePurchasedEventEncoder();
    const blob = enc.encode({
      buyer: PK_A,
      name: 'mysite',
      purchaseType: 0, // Lease
      years: 2,
      cost: 100_000_000n,
      ant: PK_B,
      fundingSource: 0, // Balance
      timestamp: 1_700_000_000n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_ARNS_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'NamePurchasedEvent');
    if (events[0].name !== 'NamePurchasedEvent') return;
    assert.equal(events[0].data.purchaseType, 0);
    assert.equal(events[0].data.years, 2);
    assert.equal(events[0].data.fundingSource, 0);
  });

  it('decodes NameReservedEvent (covers `Option<Pubkey>` and `Option<i64>`)', () => {
    const enc = getNameReservedEventEncoder();
    // @solana/kit encodes Option<T> as
    //   { __option: 'Some', value: T } | { __option: 'None' }
    // (preserving the borsh wire format: `1 || encode(T)` for Some, `0` for None).
    // Encoders accept both that shape *and* nullable input (`T | null`)
    // via OptionOrNullable; decoders always return the tagged form.
    const withTarget = enc.encode({
      authority: PK_A,
      name: 'reserved-name',
      target: PK_B, // OptionOrNullable accepts a bare value as Some(value)
      expiresAt: 1_800_000_000n,
      timestamp: 1_700_000_000n,
    });
    const eventsWith = parseEventsFromLogs(
      topLevelLogs(ARIO_ARNS_PROGRAM_ADDRESS, [withTarget]),
    );
    assert.equal(eventsWith.length, 1);
    assert.equal(eventsWith[0].name, 'NameReservedEvent');
    if (eventsWith[0].name !== 'NameReservedEvent') return;
    assert.deepEqual(eventsWith[0].data.target, {
      __option: 'Some',
      value: PK_B,
    });
    assert.deepEqual(eventsWith[0].data.expiresAt, {
      __option: 'Some',
      value: 1_800_000_000n,
    });

    // Test the `None` variant.
    const withoutTarget = enc.encode({
      authority: PK_A,
      name: 'unrestricted',
      target: null,
      expiresAt: null,
      timestamp: 1_700_000_000n,
    });
    const eventsNone = parseEventsFromLogs(
      topLevelLogs(ARIO_ARNS_PROGRAM_ADDRESS, [withoutTarget]),
    );
    assert.equal(eventsNone.length, 1);
    if (eventsNone[0].name !== 'NameReservedEvent') return;
    assert.deepEqual(eventsNone[0].data.target, { __option: 'None' });
    assert.deepEqual(eventsNone[0].data.expiresAt, { __option: 'None' });
  });

  it('decodes ConfigUpdatedEvent (covers fixed-byte array `[u8; 32]`)', () => {
    const enc = getConfigUpdatedEventEncoder();
    const newValue = new Uint8Array(32);
    // Encode a u64 as little-endian in bytes 0..8 (matches contract behavior
    // for duration fields).
    new DataView(newValue.buffer).setBigUint64(0, 86_400n, true);
    const blob = enc.encode({
      admin: PK_A,
      field: 0, // CORE_CONFIG_FIELD_MIN_VAULT_DURATION
      newValue,
      timestamp: 1_700_000_000n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_CORE_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    if (events[0].name !== 'ConfigUpdatedEvent') return;
    assert.equal(events[0].data.field, 0);
    // The first 8 bytes round-trip the encoded u64.
    const view = new DataView(
      events[0].data.newValue.buffer,
      events[0].data.newValue.byteOffset,
    );
    assert.equal(view.getBigUint64(0, true), 86_400n);
  });

  it('decodes AntMetadataUpdatedEvent with new_value: String', () => {
    const enc = getAntMetadataUpdatedEventEncoder();
    const blob = enc.encode({
      mint: PK_A,
      caller: PK_B,
      field: 0, // ANT_METADATA_FIELD_NAME
      newValue: 'My ANT',
      timestamp: 1_700_000_000n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_ANT_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    if (events[0].name !== 'AntMetadataUpdatedEvent') return;
    assert.equal(events[0].data.newValue, 'My ANT');
    assert.equal(events[0].data.field, 0);
  });

  it('decodes EscrowDepositedEvent (covers fixed-byte array `[u8; 64]`)', () => {
    const enc = getEscrowDepositedEventEncoder();
    const recipientPubkey = new Uint8Array(64);
    // Simulate a 32-byte Solana recipient padded into a 64-byte slot.
    for (let i = 0; i < 32; i++) recipientPubkey[i] = i + 1;
    const blob = enc.encode({
      escrow: PK_A,
      depositor: PK_B,
      assetId: PK_A,
      assetType: 0, // ASSET_TYPE_ANT
      amount: 0n,
      recipientProtocol: 0,
      recipientPubkey,
      recipientPubkeyLen: 32,
      timestamp: 1_700_000_000n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_ANT_ESCROW_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    if (events[0].name !== 'EscrowDepositedEvent') return;
    assert.equal(events[0].data.assetType, 0);
    assert.equal(events[0].data.recipientPubkeyLen, 32);
    assert.equal(events[0].data.recipientPubkey.length, 64);
    assert.equal(events[0].data.recipientPubkey[0], 1);
    assert.equal(events[0].data.recipientPubkey[31], 32);
  });
});

describe('parseEventsFromLogs — CPI nesting attribution', () => {
  it("attributes events emitted from a CPI to the CPI'd program, not the caller", () => {
    // Simulate ario-arns invoking ario-gar's deduct_delegation_for_payment,
    // which emits StakePaymentEvent. We set up the invoke nesting that
    // Solana actually produces.
    const transferBlob = getTransferEventEncoder().encode({
      from: PK_A,
      to: PK_B,
      amount: 5n,
      timestamp: 1_700_000_000n,
    });
    const namePurchasedBlob = getNamePurchasedEventEncoder().encode({
      buyer: PK_A,
      name: 'cpi',
      purchaseType: 1,
      years: 0,
      cost: 5n,
      ant: PK_B,
      fundingSource: 1, // Delegation
      timestamp: 1_700_000_000n,
    });

    const logs = [
      // Outer: ario-arns
      `Program ${ARIO_ARNS_PROGRAM_ADDRESS} invoke [1]`,
      'Program log: Instruction: BuyNameFromDelegation',
      // Inner CPI: ario-core (token transfer emit)
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} invoke [2]`,
      'Program log: Instruction: Transfer',
      asProgramDataLine(transferBlob), // Should attribute to ario-core
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} success`,
      // Back in ario-arns scope — its own NamePurchasedEvent.
      asProgramDataLine(namePurchasedBlob), // Should attribute to ario-arns
      `Program ${ARIO_ARNS_PROGRAM_ADDRESS} success`,
    ];
    const events = parseEventsFromLogs(logs);
    assert.equal(events.length, 2);
    assert.equal(
      events[0].programId,
      ARIO_CORE_PROGRAM_ADDRESS,
      "TransferEvent attributed to ario-core (the CPI'd callee)",
    );
    assert.equal(events[0].name, 'TransferEvent');
    assert.equal(
      events[1].programId,
      ARIO_ARNS_PROGRAM_ADDRESS,
      'NamePurchasedEvent attributed to ario-arns (the outer caller)',
    );
    assert.equal(events[1].name, 'NamePurchasedEvent');
  });
});

describe('parseEventsFromLogs — filter overload', () => {
  it('narrows return type when a filter is passed', () => {
    const transferBlob = getTransferEventEncoder().encode({
      from: PK_A,
      to: PK_B,
      amount: 1n,
      timestamp: 0n,
    });
    const purchaseBlob = getNamePurchasedEventEncoder().encode({
      buyer: PK_A,
      name: 'x',
      purchaseType: 0,
      years: 1,
      cost: 1n,
      ant: PK_B,
      fundingSource: 0,
      timestamp: 0n,
    });
    const logs = [
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} invoke [1]`,
      asProgramDataLine(transferBlob),
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} success`,
      `Program ${ARIO_ARNS_PROGRAM_ADDRESS} invoke [1]`,
      asProgramDataLine(purchaseBlob),
      `Program ${ARIO_ARNS_PROGRAM_ADDRESS} success`,
    ];
    const allEvents = parseEventsFromLogs(logs);
    assert.equal(allEvents.length, 2);

    const purchases = parseEventsFromLogs(logs, 'NamePurchasedEvent');
    assert.equal(purchases.length, 1);
    // TS narrows: ev.data.cost is bigint without a type guard.
    assert.equal(purchases[0].data.cost, 1n);
  });
});

describe('isEvent type guard', () => {
  it('narrows an AnyEvent to a specific variant', () => {
    const blob = getTransferEventEncoder().encode({
      from: PK_A,
      to: PK_B,
      amount: 42n,
      timestamp: 0n,
    });
    const events: AnyEvent[] = parseEventsFromLogs(
      topLevelLogs(ARIO_CORE_PROGRAM_ADDRESS, [blob]),
    );
    assert.equal(events.length, 1);
    const ev = events[0];
    assert.ok(isEvent(ev, 'TransferEvent'));
    if (isEvent(ev, 'TransferEvent')) {
      // Typed access — `ev.data.amount` is bigint.
      assert.equal(ev.data.amount, 42n);
    }
    assert.ok(!isEvent(ev, 'NamePurchasedEvent'));
  });
});

describe('parseEventsFromLogs — robustness', () => {
  it('silently skips Program data lines with unknown discriminators', () => {
    const unknownBlob = new Uint8Array(16);
    unknownBlob.set([0xde, 0xad, 0xbe, 0xef, 0xfa, 0xce, 0xfe, 0xed], 0);
    const knownBlob = getTransferEventEncoder().encode({
      from: PK_A,
      to: PK_B,
      amount: 1n,
      timestamp: 0n,
    });
    const events = parseEventsFromLogs(
      topLevelLogs(ARIO_CORE_PROGRAM_ADDRESS, [unknownBlob, knownBlob]),
    );
    assert.equal(events.length, 1, 'unknown blob skipped, known blob decoded');
    assert.equal(events[0].name, 'TransferEvent');
  });

  it('returns empty array for logs with no Program data lines', () => {
    const logs = [
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} invoke [1]`,
      'Program log: nothing happened',
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} success`,
    ];
    assert.equal(parseEventsFromLogs(logs).length, 0);
  });

  it('handles logs with `failed:` instead of `success`', () => {
    // Even on failed invocations, events emitted before the failure
    // appear in logs. The `Program <id> failed: ...` line still pops
    // the stack so subsequent attributions are correct.
    const blob = getTransferEventEncoder().encode({
      from: PK_A,
      to: PK_B,
      amount: 1n,
      timestamp: 0n,
    });
    const logs = [
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} invoke [1]`,
      asProgramDataLine(blob),
      `Program ${ARIO_CORE_PROGRAM_ADDRESS} failed: custom program error: 0x1`,
    ];
    const events = parseEventsFromLogs(logs);
    assert.equal(events.length, 1);
    assert.equal(events[0].programId, ARIO_CORE_PROGRAM_ADDRESS);
  });
});

describe('discriminator integrity', () => {
  it('every discriminator constant is unique across all programs', () => {
    // Cheap startup safety: if Anchor ever derives two events to the
    // same 8-byte prefix (vanishingly unlikely with sha256 but worth
    // pinning), the dispatch table would silently route one to the
    // other. Detect at test time so it fails CI before shipping.
    const allDiscrs: Array<[string, Uint8Array]> = [
      ['TransferEvent', TRANSFER_EVENT_DISCRIMINATOR],
      ['ConfigUpdatedEvent', CONFIG_UPDATED_EVENT_DISCRIMINATOR],
      ['GatewayJoinedEvent', GATEWAY_JOINED_EVENT_DISCRIMINATOR],
      ['NamePurchasedEvent', NAME_PURCHASED_EVENT_DISCRIMINATOR],
      ['NameReservedEvent', NAME_RESERVED_EVENT_DISCRIMINATOR],
      ['AntMetadataUpdatedEvent', ANT_METADATA_UPDATED_EVENT_DISCRIMINATOR],
      ['EscrowDepositedEvent', ESCROW_DEPOSITED_EVENT_DISCRIMINATOR],
    ];
    const seen = new Map<string, string>();
    for (const [name, bytes] of allDiscrs) {
      const hex = Buffer.from(bytes).toString('hex');
      const prior = seen.get(hex);
      assert.ok(
        !prior,
        `Discriminator collision: ${name} === ${prior} (${hex})`,
      );
      seen.set(hex, name);
    }
  });
});
