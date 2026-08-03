/**
 * Unit tests for `validateSpawnAntState` — the fast-fail guard for optional
 * ANT metadata + `@` target supplied to an atomic `buyRecord` (or a spawn).
 * Mirrors the on-chain `ario_ant::initialize` limits.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { generateKeyPairSigner } from '@solana/kit';

import {
  buildSpawnAntInstructions,
  DEFAULT_ANT_TRANSACTION_ID,
  validateSpawnAntState,
} from './spawn-ant.js';

const TX = 'a'.repeat(43); // valid 43-char Arweave id shape

const utf8Hex = (s: string) => Buffer.from(s, 'utf8').toString('hex');
const ixHex = (data: unknown) =>
  Buffer.from(data as Uint8Array).toString('hex');

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

/**
 * Proves that metadata supplied at buy/spawn time is actually forwarded into
 * the on-chain `ario_ant::initialize` instruction (the second instruction the
 * spawn builder emits). `buyRecord` passes `{ name, ...antState }` straight into
 * `buildSpawnAntInstructions`, so this covers the end-to-end threading: if the
 * spawn stopped forwarding a field, or `buyRecord` stopped spreading `antState`,
 * the encoded bytes would no longer contain these values.
 */
describe('buildSpawnAntInstructions threads metadata into initialize', () => {
  const MARKER_TARGET = 'b'.repeat(43);
  const MARKER_DESC = 'ZZUNIQUEDESCRIPTIONMARKER';
  const MARKER_KEYWORD = 'ZZUNIQUEKEYWORD';
  const MARKER_TICKER = 'ZZTICK';

  it('encodes the supplied @ target, ticker, description, and keywords', async () => {
    const signer = await generateKeyPairSigner();
    const { instructions } = await buildSpawnAntInstructions({
      signer,
      state: {
        name: 'threading-test',
        ticker: MARKER_TICKER,
        description: MARKER_DESC,
        keywords: [MARKER_KEYWORD],
        transactionId: MARKER_TARGET,
      },
    });
    // [0] = CreateV1 (MPL Core), [1] = ario_ant::initialize.
    const initData = ixHex(instructions[1]!.data);
    assert.ok(
      initData.includes(utf8Hex(MARKER_TARGET)),
      'target not forwarded',
    );
    assert.ok(
      initData.includes(utf8Hex(MARKER_TICKER)),
      'ticker not forwarded',
    );
    assert.ok(
      initData.includes(utf8Hex(MARKER_DESC)),
      'description not forwarded',
    );
    assert.ok(
      initData.includes(utf8Hex(MARKER_KEYWORD)),
      'keyword not forwarded',
    );
  });

  it('falls back to the default target when none is supplied', async () => {
    const signer = await generateKeyPairSigner();
    const { instructions } = await buildSpawnAntInstructions({
      signer,
      state: { name: 'threading-test' },
    });
    const initData = ixHex(instructions[1]!.data);
    assert.ok(
      initData.includes(utf8Hex(DEFAULT_ANT_TRANSACTION_ID)),
      'default target not used',
    );
    assert.ok(
      !initData.includes(utf8Hex(MARKER_DESC)),
      'unexpected description bytes',
    );
  });
});
