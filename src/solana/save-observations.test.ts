/**
 * Unit tests for the save_observations encoding helpers + observer-side
 * pre-flight gate (resolveObserverLookup / getEpochObservationStatus).
 *
 * The bitmap + reportTxId helpers are pure functions extracted from
 * SolanaARIOWriteable.saveObservations() — no rpc/signer plumbing is
 * needed to validate the wire-format invariants the on-chain program
 * relies on.
 *
 * The pre-flight gate test stubs the rpc layer with canned account
 * bytes (same pattern as prune-discovery.test.ts) so we can exercise
 * the gate logic end-to-end without standing up Surfpool.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  address,
  createSolanaRpc,
  getAddressEncoder,
} from '@solana/kit';
import bs58 from 'bs58';

import { getEpochEncoder } from './generated/gar/accounts/epoch.js';
import { SolanaARIOReadable } from './io-readable.js';
import { buildObservationBitmap, encodeReportTxId } from './io-writeable.js';

const PUBKEY_1 = 'GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PUBKEY_2 = 'GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const PUBKEY_3 = 'GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const PUBKEY_4 = 'GatewayDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const PUBKEY_5 = 'GatewayEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

// Real Arweave TX ID format: 43 base64url chars decoding to 32 bytes.
const VALID_ARWEAVE_TX = 'oork_YifB3-JQQZg8EgMPQJytua_QCHKNmMqt5kmnCo';

describe('save_observations encoding', () => {
  describe('buildObservationBitmap', () => {
    it('returns all-passed when no gateways are failed', () => {
      const bitmap = buildObservationBitmap([PUBKEY_1, PUBKEY_2, PUBKEY_3], []);
      assert.equal(bitmap.length, 375);
      // First byte = bits 0..7. Three gateways present → bits 0,1,2 set,
      // bits 3..7 cleared (beyond active count).
      assert.equal(bitmap[0], 0b00000111);
      // Subsequent bytes are all 0 (no gateways at indices ≥ 8).
      for (let i = 1; i < 375; i++) {
        assert.equal(bitmap[i], 0, `byte ${i} should be 0`);
      }
    });

    it('clears the bit for a failed gateway at the matching index', () => {
      const bitmap = buildObservationBitmap(
        [PUBKEY_1, PUBKEY_2, PUBKEY_3],
        [PUBKEY_2], // index 1 fails
      );
      // Bits 0 + 2 set, bit 1 cleared, bits 3..7 cleared.
      assert.equal(bitmap[0], 0b00000101);
    });

    it('handles failures across byte boundaries', () => {
      // 16 gateways with #7 and #8 failed (byte 0 bit 7 + byte 1 bit 0).
      const sixteen = Array.from({ length: 16 }, (_, i) =>
        `Gateway${String.fromCharCode(65 + i).repeat(43)}`.slice(0, 44),
      );
      const bitmap = buildObservationBitmap(sixteen, [sixteen[7], sixteen[8]]);
      // byte 0: bits 0..6 set, bit 7 cleared → 0b01111111 = 0x7F
      assert.equal(bitmap[0], 0x7f);
      // byte 1: bit 0 cleared, bits 1..7 set → 0b11111110 = 0xFE
      assert.equal(bitmap[1], 0xfe);
    });

    it('clears trailing bits beyond the active gateway count', () => {
      // 5 gateways; bytes 1..374 must all be 0.
      const bitmap = buildObservationBitmap(
        [PUBKEY_1, PUBKEY_2, PUBKEY_3, PUBKEY_4, PUBKEY_5],
        [],
      );
      assert.equal(bitmap[0], 0b00011111);
      for (let i = 1; i < 375; i++) {
        assert.equal(bitmap[i], 0, `byte ${i} should be 0`);
      }
    });

    it('ignores failed-gateway entries not in the registry list', () => {
      const bitmap = buildObservationBitmap(
        [PUBKEY_1, PUBKEY_2],
        // PUBKEY_3 not in registry — silently ignored, not an error.
        [PUBKEY_3],
      );
      assert.equal(bitmap[0], 0b00000011);
    });

    it('handles all gateways failing', () => {
      const bitmap = buildObservationBitmap(
        [PUBKEY_1, PUBKEY_2, PUBKEY_3],
        [PUBKEY_1, PUBKEY_2, PUBKEY_3],
      );
      // All three failed → bits 0,1,2 cleared.
      assert.equal(bitmap[0], 0);
    });

    it('handles the empty registry case', () => {
      const bitmap = buildObservationBitmap([], []);
      assert.equal(bitmap.length, 375);
      for (let i = 0; i < 375; i++) {
        assert.equal(bitmap[i], 0);
      }
    });
  });

  describe('encodeReportTxId', () => {
    // Convention: base64url-decode the 43-char Arweave TX ID to its
    // raw 32-byte SHA-256 hash, store that. Lossless — consumers can
    // base64url-encode back to the original txid for permaweb lookups.

    it('returns 32 zero bytes for undefined', () => {
      const out = encodeReportTxId(undefined);
      assert.equal(out.length, 32);
      assert.ok(out.every((b) => b === 0));
    });

    it('returns 32 zero bytes for empty string', () => {
      const out = encodeReportTxId('');
      assert.equal(out.length, 32);
      assert.ok(out.every((b) => b === 0));
    });

    it('round-trips a real Arweave TX ID base64url ↔ 32 bytes (lossless)', () => {
      const out = encodeReportTxId(VALID_ARWEAVE_TX);
      assert.equal(out.length, 32);
      // base64url-encode the 32 bytes back; should be byte-identical to input.
      const reencoded = out
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      assert.equal(reencoded, VALID_ARWEAVE_TX);
    });

    it('throws on a too-short base64url input', () => {
      assert.throws(
        () => encodeReportTxId('short'),
        /43-char base64url Arweave TX ID/,
      );
    });

    it('throws on a too-long base64url input', () => {
      const tooLong = VALID_ARWEAVE_TX + 'aBcD';
      assert.throws(() => encodeReportTxId(tooLong), /decoding to \d+ bytes/);
    });

    it('throws on non-base64url characters (catches typos, whitespace, !, etc.)', () => {
      assert.throws(
        () => encodeReportTxId('oork_YifB3-JQQZg8EgMPQJytua_QCHKN!Mqt5kmnCo'),
        /non-base64url characters/,
      );
    });

    it('decodes - and _ to the same bytes as base64 + and /', () => {
      // base64url's - and _ are aliases for standard-base64's + and /.
      // Build two txid strings that should decode to identical bytes
      // and assert the encoder treats them equivalently.
      // (The round-trip test above already covers a real Arweave ID
      // containing both - and _.)
      const urlForm = 'oork_YifB3-JQQZg8EgMPQJytua_QCHKNmMqt5kmnCo';
      const stdForm = 'oork/YifB3+JQQZg8EgMPQJytua/QCHKNmMqt5kmnCo';
      const urlOut = encodeReportTxId(urlForm);
      // Standard-base64 form is invalid input (we reject non-base64url
      // chars), so we use a low-level helper to verify the assumption
      // that they would decode to the same bytes if accepted.
      const stdPadded = stdForm.padEnd(44, '=');
      const stdDecoded = Buffer.from(stdPadded, 'base64');
      assert.deepEqual(urlOut, stdDecoded);
    });
  });
});

// =========================================================================
// SolanaARIOReadable observer-helpers (rpc-stubbed)
// =========================================================================
//
// These exercise the pre-flight gate logic so a sink can decide whether
// to attempt `save_observations` without paying for a tx simulation that
// would just bounce. Same rpc-stub pattern as prune-discovery.test.ts:
// inject canned `getAccountInfo` responses and verify the helper's
// interpretation.

const addressEncoder = getAddressEncoder();
// Real valid pubkeys (each decodes to exactly 32 bytes). Synthetic
// "AAA...AAA" strings either over- or under-flow 32 bytes depending on
// the leading char's base58 value, which makes them fiddly to construct
// — easier to just use known-good Solana addresses.
const PUBKEY_OBSERVER_A =
  '3MW2cDG42ggKNoNhsmtVt7oYeauNQ8skiYHQZKyD3fUm' as Address;
const PUBKEY_OBSERVER_B =
  '7SqEYgFBeR3CzLTtdz1tnsj7B6RjRD5q1rjzVgriQvCS' as Address;
const PUBKEY_GATEWAY =
  'EMXyG64b1cDFb3MVczh2tbNbcqeH5WJsaQgFhgA8B6yA' as Address;

function makeAccountInfoStub(results: Map<string, Uint8Array | null>): unknown {
  return {
    getAccountInfo: (pubkey: Address) => ({
      send: async () => {
        const bytes = results.get(pubkey as string) ?? null;
        if (bytes === null) {
          return { value: null };
        }
        return {
          value: {
            data: [
              Buffer.from(bytes).toString('base64'),
              'base64',
            ] as readonly [string, string],
            lamports: 1,
            owner: '11111111111111111111111111111111',
            executable: false,
            rentEpoch: 0,
          },
        };
      },
    }),
  };
}

function buildReadable(rpc: unknown): SolanaARIOReadable {
  return new SolanaARIOReadable({
    rpc: rpc as ReturnType<typeof createSolanaRpc>,
  });
}

/** Build a synthetic ObserverLookup account buffer: 8 disc + 32 gateway + 1 bump. */
function buildObserverLookupBuffer(gateway: Address, bump = 254): Uint8Array {
  const buf = new Uint8Array(41);
  // Disc bytes don't matter for this test — the readable skips them.
  buf.set(addressEncoder.encode(gateway), 8);
  buf[40] = bump;
  return buf;
}

/** Build a synthetic Epoch account buffer using the codama-generated
 *  encoder so it stays in lockstep with the IDL (including the
 *  devnet-shrunk variant). Beats hand-rolled offset arithmetic that
 *  silently breaks when the on-chain layout changes. */
function buildEpochBuffer(opts: {
  epochIndex: bigint;
  startTimestamp: bigint;
  endTimestamp: bigint;
  activeGatewayCount: number;
  observerCount: number;
  prescribedObservers: Address[]; // up to 50 entries
  hasObservedBits?: number[]; // bit indices (0..49) that are set
}): Uint8Array {
  const PLACEHOLDER_PUBKEY = '11111111111111111111111111111111' as Address;
  const observers: Address[] = [];
  for (let i = 0; i < 50; i++) {
    observers.push(opts.prescribedObservers[i] ?? PLACEHOLDER_PUBKEY);
  }
  const observerGateways: Address[] = new Array(50).fill(PLACEHOLDER_PUBKEY);
  const hasObserved = new Uint8Array(7);
  for (const bitIdx of opts.hasObservedBits ?? []) {
    hasObserved[Math.floor(bitIdx / 8)] |= 1 << (bitIdx % 8);
  }
  return getEpochEncoder().encode({
    epochIndex: opts.epochIndex,
    startTimestamp: opts.startTimestamp,
    endTimestamp: opts.endTimestamp,
    totalEligibleRewards: 0n,
    perGatewayReward: 0n,
    perObserverReward: 0n,
    rewardRate: 0n,
    totalCompositeWeightLo: 0n,
    totalCompositeWeightHi: 0n,
    hashchain: new Uint8Array(32),
    activeGatewayCount: opts.activeGatewayCount,
    distributionIndex: 0,
    tallyIndex: 0,
    observerCount: opts.observerCount,
    nameCount: 0,
    observationsSubmitted: 0,
    rewardsDistributed: 0,
    weightsTallied: 0,
    prescriptionsDone: 0,
    bump: 0,
    observationsClosed: 0,
    failureCounts: new Array(30).fill(0),
    prescribedObservers: observers,
    prescribedObserverGateways: observerGateways,
    prescribedNames: [new Uint8Array(32), new Uint8Array(32)],
    hasObserved,
    padding2: new Uint8Array(1),
  });
}

describe('SolanaARIOReadable.getObserverLookup', () => {
  it('returns undefined when the ObserverLookup PDA does not exist', async () => {
    const rpc = makeAccountInfoStub(new Map([['', null]]));
    const readable = buildReadable(rpc);
    const result = await readable.getObserverLookup(PUBKEY_OBSERVER_A);
    assert.equal(result, undefined);
  });

  it('returns gateway + bump when ObserverLookup PDA exists', async () => {
    // The ObserverLookup PDA derivation is internal; the test stub
    // returns the same canned bytes for whatever PDA the readable
    // queries (a single-entry map keyed by "" intentionally matches
    // because the stub falls back to null only when the entry is
    // explicitly null — we use a wildcard-style stub here).
    const buf = buildObserverLookupBuffer(PUBKEY_GATEWAY, 253);
    const rpc = {
      getAccountInfo: () => ({
        send: async () => ({
          value: {
            data: [Buffer.from(buf).toString('base64'), 'base64'] as readonly [
              string,
              string,
            ],
            lamports: 1,
            owner: '11111111111111111111111111111111',
            executable: false,
            rentEpoch: 0,
          },
        }),
      }),
    };
    const readable = buildReadable(rpc);
    const result = await readable.getObserverLookup(PUBKEY_OBSERVER_A);
    assert.ok(result !== undefined);
    assert.equal(result.gateway, PUBKEY_GATEWAY);
    assert.equal(result.bump, 253);
  });
});

describe('SolanaARIOReadable.getEpochObservationStatus', () => {
  it('returns prescribed=true + observerIdx when signer is in the prescribed list', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const buf = buildEpochBuffer({
      epochIndex: 0n,
      startTimestamp: BigInt(nowSec - 100),
      endTimestamp: BigInt(nowSec + 100),
      activeGatewayCount: 5,
      observerCount: 3,
      prescribedObservers: [
        PUBKEY_OBSERVER_A,
        PUBKEY_OBSERVER_B,
        PUBKEY_GATEWAY,
      ],
    });
    const rpc = {
      getAccountInfo: () => ({
        send: async () => ({
          value: {
            data: [Buffer.from(buf).toString('base64'), 'base64'] as readonly [
              string,
              string,
            ],
            lamports: 1,
            owner: '11111111111111111111111111111111',
            executable: false,
            rentEpoch: 0,
          },
        }),
      }),
    };
    const readable = buildReadable(rpc);
    const status = await readable.getEpochObservationStatus(
      0,
      PUBKEY_OBSERVER_B,
    );
    assert.equal(status.prescribed, true);
    assert.equal(status.observerIdx, 1);
    assert.equal(status.alreadyObserved, false);
    assert.equal(status.windowOpen, true);
  });

  it('returns prescribed=false + observerIdx=-1 when signer is not in the prescribed list', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const buf = buildEpochBuffer({
      epochIndex: 0n,
      startTimestamp: BigInt(nowSec - 100),
      endTimestamp: BigInt(nowSec + 100),
      activeGatewayCount: 5,
      observerCount: 2,
      prescribedObservers: [PUBKEY_OBSERVER_A, PUBKEY_OBSERVER_B],
    });
    const rpc = {
      getAccountInfo: () => ({
        send: async () => ({
          value: {
            data: [Buffer.from(buf).toString('base64'), 'base64'] as readonly [
              string,
              string,
            ],
            lamports: 1,
            owner: '11111111111111111111111111111111',
            executable: false,
            rentEpoch: 0,
          },
        }),
      }),
    };
    const readable = buildReadable(rpc);
    const status = await readable.getEpochObservationStatus(0, PUBKEY_GATEWAY);
    assert.equal(status.prescribed, false);
    assert.equal(status.observerIdx, -1);
  });

  it('returns alreadyObserved=true when the has_observed bit at the observer slot is set', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const buf = buildEpochBuffer({
      epochIndex: 5n,
      startTimestamp: BigInt(nowSec - 100),
      endTimestamp: BigInt(nowSec + 100),
      activeGatewayCount: 10,
      observerCount: 3,
      prescribedObservers: [
        PUBKEY_OBSERVER_A,
        PUBKEY_OBSERVER_B,
        PUBKEY_GATEWAY,
      ],
      hasObservedBits: [1], // observer B (idx 1) already submitted
    });
    const rpc = {
      getAccountInfo: () => ({
        send: async () => ({
          value: {
            data: [Buffer.from(buf).toString('base64'), 'base64'] as readonly [
              string,
              string,
            ],
            lamports: 1,
            owner: '11111111111111111111111111111111',
            executable: false,
            rentEpoch: 0,
          },
        }),
      }),
    };
    const readable = buildReadable(rpc);
    const status = await readable.getEpochObservationStatus(
      5,
      PUBKEY_OBSERVER_B,
    );
    assert.equal(status.prescribed, true);
    assert.equal(status.observerIdx, 1);
    assert.equal(status.alreadyObserved, true);
  });

  it('returns windowOpen=false when current time is past endTimestamp', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const buf = buildEpochBuffer({
      epochIndex: 2n,
      startTimestamp: BigInt(nowSec - 3700),
      endTimestamp: BigInt(nowSec - 100), // closed 100s ago
      activeGatewayCount: 5,
      observerCount: 1,
      prescribedObservers: [PUBKEY_OBSERVER_A],
    });
    const rpc = {
      getAccountInfo: () => ({
        send: async () => ({
          value: {
            data: [Buffer.from(buf).toString('base64'), 'base64'] as readonly [
              string,
              string,
            ],
            lamports: 1,
            owner: '11111111111111111111111111111111',
            executable: false,
            rentEpoch: 0,
          },
        }),
      }),
    };
    const readable = buildReadable(rpc);
    const status = await readable.getEpochObservationStatus(
      2,
      PUBKEY_OBSERVER_A,
    );
    assert.equal(status.prescribed, true);
    assert.equal(status.windowOpen, false);
    assert.equal(status.endTimestampSec, nowSec - 100);
  });

  it('throws when the Epoch account does not exist', async () => {
    const rpc = makeAccountInfoStub(new Map());
    const readable = buildReadable(rpc);
    await assert.rejects(
      () => readable.getEpochObservationStatus(99, PUBKEY_OBSERVER_A),
      /Epoch 99 not found/,
    );
  });
});

// =========================================================================
// Regression: resolveEpochIndex(undefined) returns currentEpochIndex - 1
// =========================================================================
//
// On-chain `epoch_settings.current_epoch_index` is "NEXT epoch to be
// created" (incremented inside `create_epoch` AFTER the PDA is created).
// Returning it unchanged from `getEpoch(undefined)` was a bug that broke
// observer startup on a live cluster — the cranker sits between
// close_epoch(N-1) and create_epoch(N), `current_epoch_index = N`, but
// Epoch[N] doesn't exist yet. Fix: floor-1 with min 0.

describe('SolanaARIOReadable.getEpoch(undefined) — current_epoch_index off-by-one', () => {
  /** Build a synthetic EpochSettings account: 8 disc + 32 authority +
   *  the leading numeric fields (we only need current_epoch_index). */
  function buildEpochSettingsBuffer(opts: {
    currentEpochIndex: bigint;
    genesisTimestamp?: bigint;
  }): Uint8Array {
    // Layout per deserializeEpochSettingsFull. Header offsets:
    //   8 disc + 32 authority + 8 epoch_duration + 1 prescribed_observer_count
    //   + 1 prescribed_name_count + 8 min_observer_stake + 2 slash_rate
    //   + 1 enabled + 8 current_epoch_index + 8 genesis_timestamp
    const buf = new Uint8Array(256); // generous over-alloc; only the prefix matters
    const dv = new DataView(buf.buffer);
    const base = 8 + 32; // disc + authority
    dv.setBigInt64(base + 0, 3600n, true); // epoch_duration
    buf[base + 8] = 5; // prescribed_observer_count
    buf[base + 9] = 10; // prescribed_name_count
    dv.setBigUint64(base + 10, 0n, true); // min_observer_stake
    dv.setUint16(base + 18, 0, true); // slash_rate
    buf[base + 20] = 1; // enabled
    dv.setBigUint64(base + 21, opts.currentEpochIndex, true);
    dv.setBigInt64(base + 29, opts.genesisTimestamp ?? 1_700_000_000n, true);
    return buf;
  }

  function buildEpochBufferMinimal(epochIndex: bigint): Uint8Array {
    // Use codama encoder for layout parity (devnet-shrunk size = 3468).
    return buildEpochBuffer({
      epochIndex,
      startTimestamp: 0n,
      endTimestamp: 0n,
      activeGatewayCount: 0,
      observerCount: 0,
      prescribedObservers: [],
    });
  }

  it('returns currentEpochIndex - 1 when called with undefined (active epoch, not next-to-create)', async () => {
    // EpochSettings says current_epoch_index = 17 (next to create) and
    // Epoch[16] is the active one. Calling getEpoch(undefined) MUST
    // return Epoch[16] data, not throw "Epoch 17 not found".
    const settingsBuf = buildEpochSettingsBuffer({ currentEpochIndex: 17n });
    const epoch16Buf = buildEpochBufferMinimal(16n);

    let getAccountCallCount = 0;
    const rpc = {
      getAccountInfo: (_pubkey: Address) => ({
        send: async () => {
          getAccountCallCount += 1;
          // First call: EpochSettings (during resolveEpochIndex).
          // Second call: Epoch[16] (during fetchEpoch).
          const data = getAccountCallCount === 1 ? settingsBuf : epoch16Buf;
          return {
            value: {
              data: [
                Buffer.from(data).toString('base64'),
                'base64',
              ] as readonly [string, string],
              lamports: 1,
              owner: '11111111111111111111111111111111',
              executable: false,
              rentEpoch: 0,
            },
          };
        },
      }),
      // getEpoch() also calls getObservations() which iterates program
      // accounts. Stub it to return empty.
      getProgramAccounts: () => ({ send: async () => [] }),
    };
    const readable = buildReadable(rpc);
    const epoch = await readable.getEpoch();
    // Confirm we fetched epoch 16 (currentEpochIndex - 1), not epoch 17.
    assert.equal(epoch.epochIndex, 16);
  });

  it('floors at 0 when currentEpochIndex is 0 (pre-bootstrap edge case)', async () => {
    const settingsBuf = buildEpochSettingsBuffer({ currentEpochIndex: 0n });
    const epoch0Buf = buildEpochBufferMinimal(0n);
    let getAccountCallCount = 0;
    const rpc = {
      getAccountInfo: () => ({
        send: async () => {
          getAccountCallCount += 1;
          const data = getAccountCallCount === 1 ? settingsBuf : epoch0Buf;
          return {
            value: {
              data: [
                Buffer.from(data).toString('base64'),
                'base64',
              ] as readonly [string, string],
              lamports: 1,
              owner: '11111111111111111111111111111111',
              executable: false,
              rentEpoch: 0,
            },
          };
        },
      }),
      getProgramAccounts: () => ({ send: async () => [] }),
    };
    const readable = buildReadable(rpc);
    const epoch = await readable.getEpoch();
    // currentEpochIndex = 0 → floors at 0, fetches Epoch[0] (which may
    // or may not exist; for this test we mock its presence).
    assert.equal(epoch.epochIndex, 0);
  });
});

// Silence "unused" lint by referencing bs58 (used to confirm imports
// resolve under the test runner).
void bs58;
void address;
