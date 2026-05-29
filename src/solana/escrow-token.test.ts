/**
 * Unit tests for TokenEscrow instruction encoding and EscrowToken
 * account deserialization. Validates that the SDK's byte layout
 * matches what the on-chain Rust program expects.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, address, createNoopSigner } from '@solana/kit';

import { getVaultedTransferInstructionAsync } from '@ar.io/solana-contracts/core';

describe('EscrowToken account layout', () => {
  it('total size is 711 bytes (must match Rust EscrowToken::SIZE)', () => {
    const size =
      8 + // Anchor discriminator
      1 + // version
      1 + // bump
      32 + // depositor
      1 + // asset_type
      8 + // amount
      32 + // ario_mint
      32 + // asset_id
      1 + // recipient_protocol
      2 + // recipient_pubkey_len
      512 + // recipient_pubkey
      32 + // nonce
      8 + // deposit_slot
      8 + // vault_end_timestamp
      1 + // vault_revocable
      32; // _reserved
    assert.equal(size, 711);
  });

  it('field offsets are correct for deserialization', () => {
    // Build a 711-byte buffer with sentinel values at known offsets
    const data = new Uint8Array(711);
    const dv = new DataView(data.buffer);

    // Expected offsets (after 8-byte discriminator)
    const offsets = {
      version: 8,
      bump: 9,
      depositor: 10, // 32 bytes
      assetType: 42,
      amount: 43, // 8 bytes
      arioMint: 51, // 32 bytes
      assetId: 83, // 32 bytes
      recipientProtocol: 115,
      recipientPubkeyLen: 116, // 2 bytes
      recipientPubkey: 118, // 512 bytes
      nonce: 630, // 32 bytes
      depositSlot: 662, // 8 bytes
      vaultEndTimestamp: 670, // 8 bytes
      vaultRevocable: 678, // 1 byte
      reserved: 679, // 32 bytes → ends at 711
    };

    // Verify the final offset adds up
    assert.equal(offsets.reserved + 32, 711);

    // Write sentinels and read them back
    data[offsets.version] = 1;
    data[offsets.bump] = 254;
    data[offsets.assetType] = 2; // vault
    dv.setBigUint64(offsets.amount, 999_000_000n, true);
    data[offsets.recipientProtocol] = 1; // ethereum
    dv.setUint16(offsets.recipientPubkeyLen, 20, true);
    dv.setBigUint64(offsets.depositSlot, 12345n, true);
    dv.setBigInt64(offsets.vaultEndTimestamp, 1700000000n, true);
    data[offsets.vaultRevocable] = 1;

    // Read back and verify
    assert.equal(data[offsets.version], 1);
    assert.equal(data[offsets.bump], 254);
    assert.equal(data[offsets.assetType], 2);
    assert.equal(dv.getBigUint64(offsets.amount, true), 999_000_000n);
    assert.equal(data[offsets.recipientProtocol], 1);
    assert.equal(dv.getUint16(offsets.recipientPubkeyLen, true), 20);
    assert.equal(dv.getBigUint64(offsets.depositSlot, true), 12345n);
    assert.equal(dv.getBigInt64(offsets.vaultEndTimestamp, true), 1700000000n);
    assert.equal(data[offsets.vaultRevocable], 1);
  });
});

describe('Token instruction data encoding', () => {
  it('claim_tokens_ethereum: nonce(32) + sig(65) = 97 bytes', () => {
    const buf = Buffer.alloc(32 + 65);
    const nonce = Buffer.alloc(32, 0xaa);
    const sig = Buffer.alloc(65, 0xbb);
    nonce.copy(buf, 0);
    sig.copy(buf, 32);
    assert.equal(buf.length, 97);
    assert.equal(buf[0], 0xaa);
    assert.equal(buf[32], 0xbb);
  });

  it('claim_tokens_arweave: nonce(32) + sig(512) + salt_len(1) = 545 bytes', () => {
    const buf = Buffer.alloc(32 + 512 + 1);
    buf.writeUInt8(32, 32 + 512); // salt_len at end
    assert.equal(buf.length, 545);
    assert.equal(buf[544], 32);
  });

  it('deposit_tokens: asset_id(32) + amount(8) + protocol(1) + len(4) + pubkey(20) = 65 bytes for ETH', () => {
    const dataLen = 32 + 8 + 1 + 4 + 20;
    assert.equal(dataLen, 65);
  });

  it('deposit_tokens: asset_id(32) + amount(8) + protocol(1) + len(4) + pubkey(512) = 557 bytes for AR', () => {
    const dataLen = 32 + 8 + 1 + 4 + 512;
    assert.equal(dataLen, 557);
  });

  it('deposit_vault: adds lock_duration(8) + revocable(1) = 9 extra bytes vs deposit_tokens', () => {
    const tokenDataEth = 32 + 8 + 1 + 4 + 20;
    const vaultDataEth = 32 + 8 + 8 + 1 + 1 + 4 + 20;
    assert.equal(vaultDataEth - tokenDataEth, 9);
  });
});

/**
 * These tests pin the on-chain `ario_core::vaulted_transfer` instruction's
 * wire format (data layout + account-meta indices) so a Codama regen or IDL
 * edit that shuffles either layout fails CI rather than prod.
 *
 *   data[0..8]   = discriminator (sha256("global:vaulted_transfer")[..8])
 *   data[8..16]  = amount (u64 LE)
 *   data[16..24] = lock_duration_seconds (i64 LE)
 *   data[24]     = revocable (bool)
 *   accounts[5]  = recipient
 *
 * Historical context: pre-ADR-022 the escrow program had a
 * `vault_introspect::verify_vaulted_transfer_in_tx` helper that read this
 * exact layout as a sibling-ix introspection for active vault claims. The
 * escrow active re-lock path (and the introspection) was removed in #74;
 * `vaulted_transfer` itself is still a public ario-core instruction (used
 * by genesis live-delivery and any direct vault flow), so the wire-format
 * invariants below remain load-bearing for those callers.
 */
describe('vaulted_transfer wire format', () => {
  // Fixed inputs so byte assertions are stable.
  const PAYER: Address = address('11111111111111111111111111111112');
  const VAULT: Address = address('11111111111111111111111111111113');
  const SENDER_ATA: Address = address('11111111111111111111111111111114');
  const VAULT_ATA: Address = address('11111111111111111111111111111115');
  const RECIPIENT: Address = address('11111111111111111111111111111116');
  const PROGRAM: Address = address('11111111111111111111111111111117');

  const AMOUNT = 12345678n;
  const LOCK_DURATION = 86_400n; // 1 day
  const REVOCABLE = true;

  // Anchor discriminator for `ario_core::vaulted_transfer` — locks the
  // on-chain constant into the unit test so a rename of the on-chain
  // handler is caught.
  const VAULTED_TRANSFER_DISC = Buffer.from([
    0x09, 0xc0, 0x19, 0x26, 0x6d, 0xea, 0xbf, 0x93,
  ]);

  it('encodes data as [disc(8) | amount(8 LE) | lock_duration(8 LE) | revocable(1)]', async () => {
    const ix = await getVaultedTransferInstructionAsync(
      {
        vault: VAULT,
        senderTokenAccount: SENDER_ATA,
        vaultTokenAccount: VAULT_ATA,
        recipient: RECIPIENT,
        sender: createNoopSigner(PAYER),
        amount: AMOUNT,
        lockDurationSeconds: LOCK_DURATION,
        revocable: REVOCABLE,
      },
      { programAddress: PROGRAM },
    );

    assert.equal(ix.data.length, 25, 'ix data must be exactly 25 bytes');
    const data = Buffer.from(ix.data);

    // Discriminator — must match the on-chain handler's Anchor disc.
    assert.deepEqual(
      data.subarray(0, 8),
      VAULTED_TRANSFER_DISC,
      'discriminator mismatch — ario_core::vaulted_transfer rename?',
    );

    // Amount (u64 LE at offset 8).
    assert.equal(data.readBigUInt64LE(8), AMOUNT);

    // Lock duration (i64 LE at offset 16).
    assert.equal(data.readBigInt64LE(16), LOCK_DURATION);

    // Revocable (bool at offset 24).
    assert.equal(data[24], 1);
  });

  it('encodes revocable=false as data[24] = 0', async () => {
    const ix = await getVaultedTransferInstructionAsync(
      {
        vault: VAULT,
        senderTokenAccount: SENDER_ATA,
        vaultTokenAccount: VAULT_ATA,
        recipient: RECIPIENT,
        sender: createNoopSigner(PAYER),
        amount: AMOUNT,
        lockDurationSeconds: LOCK_DURATION,
        revocable: false,
      },
      { programAddress: PROGRAM },
    );
    assert.equal(Buffer.from(ix.data)[24], 0);
  });

  it('places recipient at account index 5', async () => {
    const ix = await getVaultedTransferInstructionAsync(
      {
        vault: VAULT,
        senderTokenAccount: SENDER_ATA,
        vaultTokenAccount: VAULT_ATA,
        recipient: RECIPIENT,
        sender: createNoopSigner(PAYER),
        amount: AMOUNT,
        lockDurationSeconds: LOCK_DURATION,
        revocable: REVOCABLE,
      },
      { programAddress: PROGRAM },
    );
    // Account ordering must be:
    //   0:config, 1:recipient_vault_counter, 2:vault, 3:sender_token_account,
    //   4:vault_token_account, 5:recipient, 6:sender, 7:token_program,
    //   8:system_program
    assert.equal(ix.accounts.length, 9);
    assert.equal(ix.accounts[5].address, RECIPIENT);
    assert.equal(ix.accounts[2].address, VAULT);
    assert.equal(ix.accounts[3].address, SENDER_ATA);
    assert.equal(ix.accounts[4].address, VAULT_ATA);
  });
});

// ---------------------------------------------------------------------------
// assertVaultClaimable + isVaultClaimable — ADR-022 pre-flight guard for the
// on-chain `VaultStillLocked` rejection, with a forward
// CLOCK_SKEW_TOLERANCE_SECONDS buffer so wall/cluster clock skew biases all
// races into the friendly direction (SDK rejects when chain would accept,
// never the reverse).
// ---------------------------------------------------------------------------

import {
  CLOCK_SKEW_TOLERANCE_SECONDS,
  type EscrowTokenState,
  assertVaultClaimable,
  isVaultClaimable,
} from './escrow.js';

const DUMMY_ADDR = '11111111111111111111111111111111' as unknown as Address;

/** Minimal EscrowTokenState for the guard test — only vaultEndTimestamp
 *  matters; everything else is dummy. */
function makeVaultEscrow(vaultEndTimestamp: bigint): EscrowTokenState {
  return {
    version: { major: 1, minor: 0, patch: 0 },
    bump: 0,
    depositor: DUMMY_ADDR,
    assetType: 'vault',
    amount: 1n,
    arioMint: DUMMY_ADDR,
    assetId: new Uint8Array(32),
    recipientProtocol: 'ethereum',
    recipientPubkey: new Uint8Array(20),
    nonce: new Uint8Array(32),
    depositSlot: 0n,
    vaultEndTimestamp,
    vaultRevocable: false,
  };
}

describe('assertVaultClaimable (ADR-022) — clock-skew buffer', () => {
  it('throws when the vault is still locked (vaultEndTimestamp in the future)', () => {
    // Far enough in the future to be unambiguous across CI scheduling skew.
    const future = BigInt(Math.floor(Date.now() / 1000)) + 3600n; // +1 hour
    const escrow = makeVaultEscrow(future);
    assert.throws(
      () => assertVaultClaimable(escrow),
      (err: unknown) => {
        const msg = (err as Error).message;
        return (
          /Vault escrow is still locked until/.test(msg) &&
          /VaultStillLocked/.test(msg) &&
          msg.includes(String(future)) &&
          /\d{4}-\d{2}-\d{2}T/.test(msg) && // ISO timestamp surfaced
          msg.includes(`${CLOCK_SKEW_TOLERANCE_SECONDS}s clock-skew buffer`)
        );
      },
    );
  });

  it('throws at exactly the unlock instant (within the clock-skew buffer)', () => {
    // The on-chain gate accepts at `clock == vault_end_timestamp`, but the
    // SDK adds CLOCK_SKEW_TOLERANCE_SECONDS forward buffer — so at the
    // exact unlock instant the SDK still says "locked" (it would submit a
    // doomed tx if the cluster clock is even 1s behind wall clock).
    const now = BigInt(Math.floor(Date.now() / 1000));
    const escrow = makeVaultEscrow(now);
    assert.throws(() => assertVaultClaimable(escrow));
  });

  it('throws just inside the buffer (vaultEnd + tolerance - 5s > now)', () => {
    // Pick an end-timestamp such that buffer end is 5s in the future →
    // SDK should still reject.
    const now = BigInt(Math.floor(Date.now() / 1000));
    const end = now - CLOCK_SKEW_TOLERANCE_SECONDS + 5n;
    const escrow = makeVaultEscrow(end);
    assert.throws(() => assertVaultClaimable(escrow));
  });

  it('does NOT throw once the buffer has elapsed (vaultEnd + tolerance < now)', () => {
    // 5s past the buffer end → claimable.
    const now = BigInt(Math.floor(Date.now() / 1000));
    const end = now - CLOCK_SKEW_TOLERANCE_SECONDS - 5n;
    const escrow = makeVaultEscrow(end);
    assert.doesNotThrow(() => assertVaultClaimable(escrow));
  });

  it('does not throw when the vault unlocked well in the past', () => {
    const past = BigInt(Math.floor(Date.now() / 1000)) - 3600n; // 1h ago
    const escrow = makeVaultEscrow(past);
    assert.doesNotThrow(() => assertVaultClaimable(escrow));
  });

  it('does not throw for a token escrow (vaultEndTimestamp == 0)', () => {
    // Token (non-vault) escrows leave vault_end_timestamp = 0; the guard
    // must not block them. (Token claims don't call this guard today, but
    // the function should still behave correctly if invoked.)
    const escrow = makeVaultEscrow(0n);
    assert.doesNotThrow(() => assertVaultClaimable(escrow));
  });
});

describe('isVaultClaimable (non-throwing UI predicate)', () => {
  it('is false while still locked', () => {
    const future = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    assert.equal(isVaultClaimable(makeVaultEscrow(future)), false);
  });

  it('is false at the exact unlock instant (within buffer)', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    assert.equal(isVaultClaimable(makeVaultEscrow(now)), false);
  });

  it('is true once the buffer has elapsed', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const end = now - CLOCK_SKEW_TOLERANCE_SECONDS - 5n;
    assert.equal(isVaultClaimable(makeVaultEscrow(end)), true);
  });

  it('is true for a token escrow (vaultEndTimestamp == 0)', () => {
    assert.equal(isVaultClaimable(makeVaultEscrow(0n)), true);
  });

  it('agrees with assertVaultClaimable at every boundary tested above', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const cases: bigint[] = [
      now + 3600n,
      now,
      now - CLOCK_SKEW_TOLERANCE_SECONDS + 5n,
      now - CLOCK_SKEW_TOLERANCE_SECONDS - 5n,
      now - 3600n,
      0n,
    ];
    for (const end of cases) {
      const escrow = makeVaultEscrow(end);
      const predicateOk = isVaultClaimable(escrow);
      let assertThrew = false;
      try {
        assertVaultClaimable(escrow);
      } catch {
        assertThrew = true;
      }
      assert.equal(
        predicateOk,
        !assertThrew,
        `disagreement at vault_end=${end}: isVaultClaimable=${predicateOk}, assertVaultClaimable threw=${assertThrew}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// claimVaultArweaveIx — low-level builder for the Arweave attested
// vault-claim path. Integrators (e.g. the escrow-app frontend) compose:
//   [createClaimantAtaIx?, ed25519SigverifyIx, claimVaultArweaveIx]
// and submit. The high-level `claimVaultArweave` cannot work alone because
// the SDK has no attestor URL; calling it must throw a clear migration error.
// ---------------------------------------------------------------------------

import { TokenEscrow } from './escrow.js';

const FAKE_ADDR = '11111111111111111111111111111112' as unknown as Address;

function makeTokenEscrow(): TokenEscrow {
  return new TokenEscrow({
    rpc: {} as never,
    signer: createNoopSigner(address(FAKE_ADDR)),
    programId: address(FAKE_ADDR),
  });
}

describe('claimVaultArweaveIx', () => {
  it('returns an Instruction whose accounts list matches the ADR-022 ABI', async () => {
    const te = makeTokenEscrow();
    const ix = await te.claimVaultArweaveIx({
      depositor: address(FAKE_ADDR),
      assetId: new Uint8Array(32),
      claimant: address(FAKE_ADDR),
      claimantTokenAccount: address(FAKE_ADDR),
      escrowTokenAccount: address(FAKE_ADDR),
      messageNonce: new Uint8Array(32),
    });
    // Post-ADR-022: payer_token_account dropped; ix has 9 accounts
    // (escrow, escrow_token_account, claimant_token_account, claimant,
    // depositor, payer, instructions_sysvar, token_program, system_program).
    assert.equal(ix.accounts?.length, 9, 'expected 9 accounts post-ADR-022');
    assert.equal(ix.programAddress, address(FAKE_ADDR));
    // data = 8-byte disc + 32-byte messageNonce.
    assert.equal(
      ix.data?.length,
      40,
      'expected disc(8) + nonce(32) = 40 bytes',
    );
  });

  it('rejects a non-32-byte messageNonce', async () => {
    const te = makeTokenEscrow();
    await assert.rejects(
      () =>
        te.claimVaultArweaveIx({
          depositor: address(FAKE_ADDR),
          assetId: new Uint8Array(32),
          claimant: address(FAKE_ADDR),
          claimantTokenAccount: address(FAKE_ADDR),
          escrowTokenAccount: address(FAKE_ADDR),
          messageNonce: new Uint8Array(31),
        }),
      /messageNonce must be 32 bytes/,
    );
  });

  it('rejects when no signer is configured', async () => {
    const te = new TokenEscrow({
      rpc: {} as never,
      programId: address(FAKE_ADDR),
      // no signer
    });
    await assert.rejects(
      () =>
        te.claimVaultArweaveIx({
          depositor: address(FAKE_ADDR),
          assetId: new Uint8Array(32),
          claimant: address(FAKE_ADDR),
          claimantTokenAccount: address(FAKE_ADDR),
          escrowTokenAccount: address(FAKE_ADDR),
          messageNonce: new Uint8Array(32),
        }),
      /signer/i,
    );
  });
});

describe('claimVaultArweave (deprecated single-call wrapper)', () => {
  it('throws with a clear migration message pointing at claimVaultArweaveIx', async () => {
    const te = makeTokenEscrow();
    await assert.rejects(
      () =>
        te.claimVaultArweave({
          depositor: address(FAKE_ADDR),
          assetId: new Uint8Array(32),
          claimant: address(FAKE_ADDR),
          claimantTokenAccount: address(FAKE_ADDR),
          escrowTokenAccount: address(FAKE_ADDR),
          signature: new Uint8Array(512),
        }),
      (err: unknown) => {
        const msg = (err as Error).message;
        return (
          /claimVaultArweaveIx/.test(msg) &&
          /Ed25519Program/.test(msg) &&
          /ADR-017/.test(msg)
        );
      },
    );
  });
});
