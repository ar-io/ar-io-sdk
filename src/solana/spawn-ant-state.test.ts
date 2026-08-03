/**
 * Unit tests for `validateSpawnAntState` — the fast-fail guard for optional
 * ANT metadata + `@` target supplied to an atomic `buyRecord` (or a spawn).
 * Mirrors the on-chain `ario_ant::initialize` limits.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { validateSpawnAntState } from './spawn-ant.js';

const TX = 'a'.repeat(43); // valid 43-char Arweave id shape

describe('validateSpawnAntState', () => {
  it('accepts undefined / empty state', () => {
    assert.doesNotThrow(() => validateSpawnAntState(undefined));
    assert.doesNotThrow(() => validateSpawnAntState({}));
  });

  it('accepts a fully-populated valid state', () => {
    assert.doesNotThrow(() =>
      validateSpawnAntState({
        ticker: 'BLOG',
        description: 'x'.repeat(512),
        keywords: Array.from({ length: 16 }, (_, i) => `k${i}`),
        logo: TX,
        transactionId: TX,
        targetProtocol: 0,
      }),
    );
  });

  it('rejects a description over 512 chars', () => {
    assert.throws(
      () => validateSpawnAntState({ description: 'x'.repeat(513) }),
      /512 characters/,
    );
  });

  it('rejects more than 16 keywords', () => {
    assert.throws(
      () =>
        validateSpawnAntState({
          keywords: Array.from({ length: 17 }, (_, i) => `k${i}`),
        }),
      /16 entries/,
    );
  });

  it('rejects a malformed logo but allows an empty one', () => {
    assert.throws(() => validateSpawnAntState({ logo: 'too-short' }), /logo/);
    assert.doesNotThrow(() => validateSpawnAntState({ logo: '' }));
    assert.doesNotThrow(() => validateSpawnAntState({ logo: TX }));
  });

  it('shape-checks the @ target only for an Arweave targetProtocol', () => {
    // Arweave (0 / undefined) → must match the 43-char id shape.
    assert.throws(
      () => validateSpawnAntState({ transactionId: 'nope', targetProtocol: 0 }),
      /@ target/,
    );
    assert.throws(
      () => validateSpawnAntState({ transactionId: 'nope' }),
      /@ target/,
    );
    // IPFS (1) → the target is a CID, so the Arweave shape check is skipped.
    assert.doesNotThrow(() =>
      validateSpawnAntState({
        transactionId: 'QmSomeCidValue',
        targetProtocol: 1,
      }),
    );
    // Empty target is treated as unset.
    assert.doesNotThrow(() => validateSpawnAntState({ transactionId: '' }));
  });
});
