/**
 * Unit tests for `selectFinalizeGoneSwapOperator` — the index math that
 * decides which swapped Gateway PDA `finalizeGone` must pass as writable
 * `remaining_accounts[0]`.
 *
 * Mirrors `programs/ario-gar/src/instructions/gateway.rs::finalize_gone`:
 *   - `index = gateway.registry_index.index`
 *   - `last_index = registry.count - 1`
 *   - swap only when `index != last_index`; the swapped gateway is the one at
 *     the last active slot (`registry.gateways[last_index].address`).
 * `registryAddresses` is slot-ordered with length === `registry.count`, so the
 * last element is exactly that swap source.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { selectFinalizeGoneSwapOperator } from './io-writeable.js';

const REG = ['op0', 'op1', 'op2', 'op3']; // count = 4, last slot index = 3

describe('selectFinalizeGoneSwapOperator', () => {
  it('returns null when the gateway is already the last active slot', () => {
    assert.equal(selectFinalizeGoneSwapOperator(3, REG), null);
  });

  it('returns null for a single-gateway registry (index 0, count 1)', () => {
    assert.equal(selectFinalizeGoneSwapOperator(0, ['only']), null);
  });

  it('returns the last-slot operator when finalizing the first slot', () => {
    assert.equal(selectFinalizeGoneSwapOperator(0, REG), 'op3');
  });

  it('returns the last-slot operator when finalizing a middle slot', () => {
    assert.equal(selectFinalizeGoneSwapOperator(2, REG), 'op3');
  });

  it('throws when the index equals the active count (off-by-one / stale index)', () => {
    assert.throws(
      () => selectFinalizeGoneSwapOperator(4, REG),
      /outside the active registry count/i,
    );
  });

  it('throws when the index exceeds the active count', () => {
    assert.throws(
      () => selectFinalizeGoneSwapOperator(99, REG),
      /outside the active registry count/i,
    );
  });

  it('throws on a negative index', () => {
    assert.throws(
      () => selectFinalizeGoneSwapOperator(-1, REG),
      /outside the active registry count/i,
    );
  });

  it('throws on an empty registry', () => {
    assert.throws(
      () => selectFinalizeGoneSwapOperator(0, []),
      /outside the active registry count/i,
    );
  });
});
