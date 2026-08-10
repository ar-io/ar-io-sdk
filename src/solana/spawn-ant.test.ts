/**
 * Byte-pinning unit tests for `buildCreateAntInstruction`.
 *
 * Locks the wire format the SDK emits when minting a fresh ANT, so any
 * change to MPL Core's `CreateV1` schema or our default attribute-plugin
 * shape is caught at the unit-test level instead of at deploy time.
 *
 * ADR-028: fresh ANTs now mint with the Attributes-plugin authority =
 * `UpdateAuthority` (plugin authority byte `02`, was `01` = Owner) and the
 * asset `updateAuthority` set to the per-asset `ant_authority` PDA. This is an
 * intentional divergence from legacy (pre-ADR-028) mints — including historical
 * migration-import ANTs, which are `adopt_authority`-adoptable onto the new
 * model. The `authority` byte is the only data-level change; the account list
 * gains the explicit `updateAuthority` at kinobi position 5.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, type ReadonlyUint8Array, address } from '@solana/kit';

import { buildCreateAntInstruction } from './spawn-ant.js';

const FIXED_MINT: Address = address('11111111111111111111111111111112');
const FIXED_AUTH: Address = address('11111111111111111111111111111113');
const FIXED_PAY: Address = address('11111111111111111111111111111114');
// ADR-028: the per-asset `ant_authority` PDA. Fixed placeholder for byte-pinning.
const FIXED_UA: Address = address('11111111111111111111111111111115');

function hex(b: Uint8Array | ReadonlyUint8Array | undefined): string {
  assert.ok(b, 'instruction data must be defined');
  return Buffer.from(b).toString('hex');
}

/** Narrow the kit `Instruction` to its always-set shape after our builder. */
function assertIxData(ix: { data?: ReadonlyUint8Array }): asserts ix is {
  data: ReadonlyUint8Array;
} {
  assert.ok(ix.data, 'instruction must have data');
}
function assertIxAccounts(ix: {
  accounts?: ReadonlyArray<{ address: Address; role?: number }>;
}): asserts ix is {
  accounts: ReadonlyArray<{ address: Address; role?: number }>;
} {
  assert.ok(ix.accounts, 'instruction must have accounts');
}

describe('buildCreateAntInstruction (CreateV1 wire format)', () => {
  it('emits an empty Attributes plugin (UpdateAuthority) by default', () => {
    const ix = buildCreateAntInstruction({
      mint: FIXED_MINT,
      authority: FIXED_AUTH,
      payer: FIXED_PAY,
      updateAuthority: FIXED_UA,
      name: 'test-ant',
      uri: 'ar://abc',
    });

    // Layout (after disc + data_state):
    //   00          CreateV1 disc
    //   00          data_state = AccountState
    //   08000000    name length = 8
    //   746573742d616e74   "test-ant"
    //   08000000    uri length = 8
    //   61723a2f2f616263   "ar://abc"
    //   01          plugins Option = Some
    //   01000000    plugins vec len = 1
    //   06          Plugin::Attributes
    //   00000000    attribute_list len = 0
    //   01          plugin authority Option = Some
    //   02          PluginAuthority::UpdateAuthority (ADR-028; was Owner=01)
    const expected =
      '0000' +
      '08000000' +
      '746573742d616e74' +
      '08000000' +
      '61723a2f2f616263' +
      '0101000000' +
      '06' +
      '00000000' +
      '0102';

    assertIxData(ix);
    assert.equal(hex(ix.data), expected);
    // 38 bytes — only the trailing plugin-authority variant changed (01 → 02);
    // the payload length is unchanged.
    assert.equal(ix.data.length, 38);
  });

  it('emits a populated Attributes plugin when traits are provided', () => {
    const ix = buildCreateAntInstruction({
      mint: FIXED_MINT,
      authority: FIXED_AUTH,
      payer: FIXED_PAY,
      updateAuthority: FIXED_UA,
      name: 'test-ant',
      uri: 'ar://abc',
      attributes: [
        { key: 'ArNS Name', value: 'testname' },
        { key: 'Type', value: 'permabuy' },
        { key: 'Undername Limit', value: '10' },
      ],
    });

    // 108-byte fixture — exact match for the migration mint's
    // 3-attribute payload (validated offline by the previous review).
    const expected =
      '0000' +
      '08000000' +
      '746573742d616e74' +
      '08000000' +
      '61723a2f2f616263' +
      '01' +
      '01000000' + // plugins Some + vec len 1
      '06' +
      '03000000' + // Attributes + 3 entries
      '09000000' +
      '41724e53204e616d65' + // "ArNS Name"
      '08000000' +
      '746573746e616d65' + // "testname"
      '04000000' +
      '54797065' + // "Type"
      '08000000' +
      '7065726d61627579' + // "permabuy"
      '0f000000' +
      '556e6465726e616d65204c696d6974' + // "Undername Limit"
      '02000000' +
      '3130' + // "10"
      '0102'; // PluginAuthority Some + UpdateAuthority (ADR-028)

    assertIxData(ix);
    assert.equal(hex(ix.data), expected);
    assert.equal(ix.data.length, 108);
  });

  it('places mint+authority+payer+updateAuthority in the correct kinobi account positions', () => {
    const ix = buildCreateAntInstruction({
      mint: FIXED_MINT,
      authority: FIXED_AUTH,
      payer: FIXED_PAY,
      updateAuthority: FIXED_UA,
      name: 'x',
      uri: 'y',
    });

    assertIxAccounts(ix);
    // 8 accounts in kinobi createV1 order; positions 1 and 7 are optional
    // placeholders (= MPL Core program id).
    assert.equal(ix.accounts.length, 8);
    assert.equal(ix.accounts[0]!.address, FIXED_MINT, 'pos 0 = asset');
    assert.equal(ix.accounts[2]!.address, FIXED_AUTH, 'pos 2 = authority');
    assert.equal(ix.accounts[3]!.address, FIXED_PAY, 'pos 3 = payer');
    // pos 4 = owner (ADR-028: explicit = authority, so the PDA never becomes owner)
    assert.equal(ix.accounts[4]!.address, FIXED_AUTH, 'pos 4 = owner');
    // pos 5 = updateAuthority (ADR-028: the ant_authority PDA)
    assert.equal(ix.accounts[5]!.address, FIXED_UA, 'pos 5 = updateAuthority');
    // pos 6 = system_program
    assert.equal(
      ix.accounts[6]!.address,
      address('11111111111111111111111111111111'),
      'pos 6 = system_program',
    );
  });

  it('handles single-byte names + uris without overflowing the buffer', () => {
    // Regression: the BorshWriter pre-sizes based on string lengths plus
    // the plugin overhead. A name/uri of length 1 is a degenerate case
    // worth covering.
    const ix = buildCreateAntInstruction({
      mint: FIXED_MINT,
      authority: FIXED_AUTH,
      payer: FIXED_PAY,
      updateAuthority: FIXED_UA,
      name: 'a',
      uri: 'b',
    });
    assertIxData(ix);
    // 2 (disc+data_state) + 5 (name) + 5 (uri) + 12 (empty plugin) = 24 bytes
    assert.equal(ix.data.length, 24);
    assert.equal(
      hex(ix.data),
      '0000' +
        '01000000' +
        '61' +
        '01000000' +
        '62' +
        '0101000000' +
        '06' +
        '00000000' +
        '0102',
    );
  });
});
