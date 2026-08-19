/**
 * Unit tests for the ADR-0029 epoch-rent-receipt client surface:
 *
 *   - `getEpochRentReceiptPDA` — the hand-rolled PDA derivation. Codama emits
 *     no finder for `EpochRentReceipt` (the account is reached only through
 *     `remaining_accounts` and `admin_close_orphaned_epoch_rent_receipt`, so
 *     the IDL carries no seed metadata), which makes this derivation the one
 *     place a typo would silently produce a wrong-but-valid address.
 *   - `buildCloseEpochRentAccounts` — the `remaining_accounts` tail for
 *     `close_epoch`.
 *
 * Mirrors `programs/ario-gar/src/instructions/epoch.rs`:
 *   create_epoch: `ctx.remaining_accounts.first()` is the receipt; when absent
 *                 the epoch is created with `has_rent_receipt = 0`.
 *   close_epoch:  branches on `epoch.has_rent_receipt != 0` — NOT on what the
 *                 caller passed — then requires
 *                 `remaining_accounts = [receipt, creator]`, both writable.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AccountRole, type Address, getAddressDecoder } from '@solana/kit';

import { buildCloseEpochRentAccounts } from './io-writeable.js';
import { getEpochPDA, getEpochRentReceiptPDA } from './pda.js';

const dec = getAddressDecoder();
function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}
const GAR = 'ARioGarProgramXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' as Address;
const RECEIPT = pk(7);
const CREATOR = pk(8);

describe('getEpochRentReceiptPDA', () => {
  it('is deterministic for a given index', async () => {
    const [a] = await getEpochRentReceiptPDA(42, GAR);
    const [b] = await getEpochRentReceiptPDA(42, GAR);
    assert.equal(a, b);
  });

  it('differs per epoch index', async () => {
    const [a] = await getEpochRentReceiptPDA(42, GAR);
    const [b] = await getEpochRentReceiptPDA(43, GAR);
    assert.notEqual(a, b);
  });

  it('accepts number and bigint identically (u64 LE seed)', async () => {
    const [a] = await getEpochRentReceiptPDA(780, GAR);
    const [b] = await getEpochRentReceiptPDA(780n, GAR);
    assert.equal(a, b);
  });

  it('is NOT the Epoch PDA for the same index (distinct seed prefix)', async () => {
    const [receipt] = await getEpochRentReceiptPDA(780, GAR);
    const [epoch] = await getEpochPDA(780, GAR);
    assert.notEqual(receipt, epoch);
  });

  it('is program-scoped', async () => {
    const [a] = await getEpochRentReceiptPDA(1, GAR);
    const [b] = await getEpochRentReceiptPDA(1, pk(123));
    assert.notEqual(a, b);
  });
});

describe('buildCloseEpochRentAccounts', () => {
  it('returns no extra accounts for a pre-ADR-0029 epoch (flag clear)', () => {
    // This is what keeps un-upgraded crankers working through the transition.
    assert.deepEqual(buildCloseEpochRentAccounts(0, RECEIPT, null, 100), []);
  });

  it('ignores a creator that happens to be known when the flag is clear', () => {
    // The program refunds `payer` in this branch; passing extras would be wrong.
    assert.deepEqual(buildCloseEpochRentAccounts(0, RECEIPT, CREATOR, 100), []);
  });

  it('returns [receipt, creator] in that exact order when the flag is set', () => {
    const got = buildCloseEpochRentAccounts(1, RECEIPT, CREATOR, 100);
    assert.equal(got.length, 2);
    assert.equal(
      got[0].address,
      RECEIPT,
      'receipt must be remaining_accounts[0]',
    );
    assert.equal(
      got[1].address,
      CREATOR,
      'creator must be remaining_accounts[1]',
    );
  });

  it('marks both accounts writable — the program drains both', () => {
    const got = buildCloseEpochRentAccounts(1, RECEIPT, CREATOR, 100);
    assert.equal(got[0].role, AccountRole.WRITABLE);
    assert.equal(got[1].role, AccountRole.WRITABLE);
  });

  it('treats any non-zero flag byte as set, matching `has_rent_receipt != 0`', () => {
    for (const flag of [1, 2, 255]) {
      assert.equal(
        buildCloseEpochRentAccounts(flag, RECEIPT, CREATOR, 100).length,
        2,
        `flag ${flag} should take the receipted branch`,
      );
    }
  });

  it('throws a diagnosable error when the flag is set but the receipt is gone', () => {
    assert.throws(
      () => buildCloseEpochRentAccounts(1, RECEIPT, null, 4242),
      /Epoch 4242 .*flagged.*rent receipt.*MissingEpochRentReceipt/s,
    );
  });
});
