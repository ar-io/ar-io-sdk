import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { type Address, address, getAddressDecoder } from '@solana/kit';

import {
  type RegistrySlotWeight,
  predictPrescribedObservers,
} from './predict-prescribed-observers.js';

const here = dirname(fileURLToPath(import.meta.url));
const addressDecoder = getAddressDecoder();

interface Vector {
  name: string;
  hashchain: string;
  maxObservers: number;
  slots: { address: string; compositeWeight: string }[];
  expected: string[];
}
const fixture: { vectors: Vector[] } = JSON.parse(
  readFileSync(
    join(here, '__fixtures__', 'predict-prescribed-observers.vectors.json'),
    'utf8',
  ),
);

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Deterministic, valid base58 pubkey from a small integer tag. */
function pubkey(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[1] = (tag >> 8) & 0xff;
  u[31] = 0x2a;
  return addressDecoder.decode(u);
}

function makeSlots(weights: bigint[], startTag = 1): RegistrySlotWeight[] {
  return weights.map((compositeWeight, i) => ({
    address: pubkey(startTag + i),
    compositeWeight,
  }));
}

const ZERO_HASHCHAIN = new Uint8Array(32);

// =========================================================================
// Cross-language parity: TS output must match the Rust reference example
// (ario-gar/examples/predict_prescribed_observers.rs), which replicates the
// on-chain prescribe_epoch selection. Vectors are committed in
// __fixtures__/predict-prescribed-observers.vectors.json — regenerate with
// __fixtures__/generate-prescribe-vectors.mjs if the algorithm changes.
// =========================================================================
describe('predictPrescribedObservers — cross-language parity (Rust)', () => {
  assert.ok(fixture.vectors.length > 0, 'fixture must contain vectors');

  for (const v of fixture.vectors) {
    it(`matches Rust example: ${v.name}`, () => {
      const hashchain = hexToBytes(v.hashchain);
      assert.equal(hashchain.length, 32);
      const slots: RegistrySlotWeight[] = v.slots.map((s) => ({
        address: address(s.address),
        compositeWeight: BigInt(s.compositeWeight),
      }));
      const got = predictPrescribedObservers(
        hashchain,
        slots,
        v.maxObservers,
      ).map(String);
      assert.deepEqual(got, v.expected);
    });
  }
});

// =========================================================================
// Pure-TS unit + edge cases
// =========================================================================
describe('predictPrescribedObservers — edge cases', () => {
  it('throws if hashchain is not exactly 32 bytes', () => {
    assert.throws(
      () => predictPrescribedObservers(new Uint8Array(31), makeSlots([1n]), 1),
      /32 bytes/,
    );
    assert.throws(
      () => predictPrescribedObservers(new Uint8Array(33), makeSlots([1n]), 1),
      /32 bytes/,
    );
  });

  it('returns [] for an empty registry', () => {
    assert.deepEqual(predictPrescribedObservers(ZERO_HASHCHAIN, [], 5), []);
  });

  it('returns [] when total weight is zero', () => {
    const slots = makeSlots([0n, 0n, 0n]);
    assert.deepEqual(predictPrescribedObservers(ZERO_HASHCHAIN, slots, 2), []);
  });

  it('returns [] when maxObservers is zero', () => {
    const slots = makeSlots([100n, 50n]);
    assert.deepEqual(predictPrescribedObservers(ZERO_HASHCHAIN, slots, 0), []);
  });

  it('never selects a zero-weight slot', () => {
    // Only slot index 1 has weight; it must be the sole possible selection.
    const slots = makeSlots([0n, 100n, 0n, 0n]);
    const got = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 3);
    assert.deepEqual(got, [slots[1].address]);
  });

  it('is deterministic for identical inputs', () => {
    const slots = makeSlots([100n, 50n, 25n, 10n, 5n]);
    const a = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 3);
    const b = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 3);
    assert.deepEqual(a, b);
  });

  it('returns distinct operators, all drawn from the input slots', () => {
    const slots = makeSlots([100n, 90n, 80n, 70n, 60n, 50n]);
    const got = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 4);
    const inputSet = new Set(slots.map((s) => String(s.address)));
    const seen = new Set<string>();
    for (const op of got) {
      assert.ok(inputSet.has(String(op)), 'operator must be an input slot');
      assert.ok(!seen.has(String(op)), 'operators must be distinct');
      seen.add(String(op));
    }
  });

  it('caps selection at maxObservers regardless of registry size (the bug)', () => {
    // 500-gateway registry — the failure mode was supplying all 500 and
    // tripping MAX_TX_ACCOUNT_LOCKS = 64. The prediction must never exceed K.
    const weights = Array.from({ length: 500 }, (_, i) =>
      BigInt(1 + ((i * 13) % 97)),
    );
    const slots = makeSlots(weights);
    const got = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 50);
    assert.ok(got.length <= 50, `expected <=50, got ${got.length}`);
  });

  it('selects at most active_count when maxObservers exceeds it', () => {
    const slots = makeSlots([10n, 20n, 30n, 40n]);
    const got = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 100);
    assert.equal(got.length, 4);
    assert.equal(new Set(got.map(String)).size, 4);
  });

  it('may select FEWER than maxObservers when a slot dominates', () => {
    // One slot holds ~all the weight; anti-duplicate + bounded retries means
    // the long tail may never get drawn. The cranker must surface this rather
    // than pad — so the helper must reproduce the short result exactly.
    const slots = makeSlots([1_000_000n, 1n, 1n]);
    const got = predictPrescribedObservers(ZERO_HASHCHAIN, slots, 2);
    assert.ok(got.length >= 1 && got.length <= 2);
  });
});
