import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { address } from '@solana/kit';

import {
  bytesToHexLower,
  canonicalMessage,
  canonicalMessageV2,
} from './canonical-message.js';

describe('canonical message', () => {
  const ant = address('9PnRFwk2Yp7QyU3sQzXwUhJj6tVyM4nN2KqL5fT8RbAW');
  const claimant = address('Hk6RfBp4FpvF2hYBmJ9kqyL5dE3xR8wPzN7sV6cTqL2A');
  const nonce = new Uint8Array([
    0xa3, 0xf1, 0xc8, 0xd9, 0x2e, 0x0b, 0x4f, 0x7a, 0x8e, 0x1d, 0x6c, 0x5b,
    0x4a, 0x39, 0x20, 0x81, 0x7f, 0x6e, 0x5d, 0x4c, 0x3b, 0x2a, 0x19, 0x18,
    0x87, 0x76, 0x65, 0x54, 0x43, 0x32, 0x21, 0x10,
  ]);

  it('matches the design-doc example for solana-mainnet', () => {
    const out = canonicalMessage({
      network: 'solana-mainnet',
      antMint: ant,
      claimant,
      nonce,
    });
    const text = new TextDecoder().decode(out);
    // Must match Rust `canonical_message_matches_design_doc_example` test
    // and docs/ANT_ESCROW_DESIGN.md § Canonical message format.
    assert.equal(
      text,
      'ar.io ant-escrow claim v1\n' +
        'network: solana-mainnet\n' +
        'ant: 9PnRFwk2Yp7QyU3sQzXwUhJj6tVyM4nN2KqL5fT8RbAW\n' +
        'claimant: Hk6RfBp4FpvF2hYBmJ9kqyL5dE3xR8wPzN7sV6cTqL2A\n' +
        'nonce: a3f1c8d92e0b4f7a8e1d6c5b4a3920817f6e5d4c3b2a19188776655443322110',
    );
  });

  it('emits no trailing newline', () => {
    const out = canonicalMessage({
      network: 'solana-mainnet',
      antMint: ant,
      claimant,
      nonce,
    });
    assert.notEqual(out[out.length - 1], 0x0a);
  });

  it('rejects non-32-byte nonce', () => {
    assert.throws(
      () =>
        canonicalMessage({
          network: 'solana-mainnet',
          antMint: ant,
          claimant,
          nonce: new Uint8Array(31),
        }),
      /32 bytes/,
    );
  });

  it('changes when any input changes', () => {
    const base = canonicalMessage({
      network: 'solana-mainnet',
      antMint: ant,
      claimant,
      nonce,
    });
    const otherNetwork = canonicalMessage({
      network: 'solana-devnet',
      antMint: ant,
      claimant,
      nonce,
    });
    assert.notDeepEqual(otherNetwork, base);

    const otherNonce = new Uint8Array(nonce);
    otherNonce[0] ^= 0x01;
    const tweakedNonce = canonicalMessage({
      network: 'solana-mainnet',
      antMint: ant,
      claimant,
      nonce: otherNonce,
    });
    assert.notDeepEqual(tweakedNonce, base);
  });
});

describe('canonical message v2', () => {
  const claimant = address('Hk6RfBp4FpvF2hYBmJ9kqyL5dE3xR8wPzN7sV6cTqL2A');
  const nonce = new Uint8Array([
    0xa3, 0xf1, 0xc8, 0xd9, 0x2e, 0x0b, 0x4f, 0x7a, 0x8e, 0x1d, 0x6c, 0x5b,
    0x4a, 0x39, 0x20, 0x81, 0x7f, 0x6e, 0x5d, 0x4c, 0x3b, 0x2a, 0x19, 0x18,
    0x87, 0x76, 0x65, 0x54, 0x43, 0x32, 0x21, 0x10,
  ]);
  const assetId = new Uint8Array(32).fill(0xab);

  it('produces the expected format for token type', () => {
    const out = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 500_000_000n,
      claimant,
      nonce,
    });
    const text = new TextDecoder().decode(out);
    assert.equal(
      text,
      'ar.io escrow claim v2\n' +
        'network: solana-mainnet\n' +
        'type: token\n' +
        'asset: abababababababababababababababababababababababababababababababab\n' +
        'amount: 500000000\n' +
        'claimant: Hk6RfBp4FpvF2hYBmJ9kqyL5dE3xR8wPzN7sV6cTqL2A\n' +
        'nonce: a3f1c8d92e0b4f7a8e1d6c5b4a3920817f6e5d4c3b2a19188776655443322110',
    );
  });

  it('emits no trailing newline', () => {
    const out = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    assert.notEqual(out[out.length - 1], 0x0a);
  });

  it('rejects non-32-byte assetId', () => {
    assert.throws(
      () =>
        canonicalMessageV2({
          network: 'solana-mainnet',
          assetType: 'token',
          assetId: new Uint8Array(31),
          amount: 100n,
          claimant,
          nonce,
        }),
      /32 bytes/,
    );
  });

  it('rejects non-32-byte nonce', () => {
    assert.throws(
      () =>
        canonicalMessageV2({
          network: 'solana-mainnet',
          assetType: 'token',
          assetId,
          amount: 100n,
          claimant,
          nonce: new Uint8Array(31),
        }),
      /32 bytes/,
    );
  });

  it('changes with asset type', () => {
    const token = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    const vault = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'vault',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    assert.notDeepEqual(token, vault);
  });

  it('changes with asset id', () => {
    const base = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    const other = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId: new Uint8Array(32).fill(0xcd),
      amount: 100n,
      claimant,
      nonce,
    });
    assert.notDeepEqual(base, other);
  });

  it('changes with amount', () => {
    const base = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    const other = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 200n,
      claimant,
      nonce,
    });
    assert.notDeepEqual(base, other);
  });

  it('changes with network', () => {
    const mainnet = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    const devnet = canonicalMessageV2({
      network: 'solana-devnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    assert.notDeepEqual(mainnet, devnet);
  });

  it('changes with nonce', () => {
    const base = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce,
    });
    const otherNonce = new Uint8Array(nonce);
    otherNonce[0] ^= 0x01;
    const other = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId,
      amount: 100n,
      claimant,
      nonce: otherNonce,
    });
    assert.notDeepEqual(base, other);
  });

  it('is deterministic', () => {
    const input = {
      network: 'solana-mainnet' as const,
      assetType: 'token' as const,
      assetId,
      amount: 1_000_000n,
      claimant,
      nonce,
    };
    const a = canonicalMessageV2(input);
    const b = canonicalMessageV2(input);
    assert.deepEqual(a, b);
  });

  it('matches the Rust v2_format_structure test', () => {
    const out = canonicalMessageV2({
      network: 'solana-mainnet',
      assetType: 'token',
      assetId: new Uint8Array(32).fill(0xab),
      amount: 500_000_000n,
      claimant: address('Hk6RfBp4FpvF2hYBmJ9kqyL5dE3xR8wPzN7sV6cTqL2A'),
      nonce: new Uint8Array(32).fill(0xcd),
    });
    const text = new TextDecoder().decode(out);

    assert.ok(text.startsWith('ar.io escrow claim v2\n'));
    assert.ok(text.includes('network: '));
    assert.ok(text.includes('\ntype: token\n'));
    assert.ok(
      text.includes(
        '\nasset: abababababababababababababababababababababababababababababababab\n',
      ),
    );
    assert.ok(text.includes('\namount: 500000000\n'));
    assert.ok(
      text.includes(
        '\nclaimant: Hk6RfBp4FpvF2hYBmJ9kqyL5dE3xR8wPzN7sV6cTqL2A\n',
      ),
    );
    assert.ok(
      text.includes(
        '\nnonce: cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
      ),
    );
    // No trailing newline
    assert.ok(
      text.endsWith(
        'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
      ),
    );
  });
});

describe('bytesToHexLower', () => {
  it('handles empty input', () => {
    assert.equal(bytesToHexLower(new Uint8Array()), '');
  });

  it('emits lowercase pairs per byte', () => {
    assert.equal(
      bytesToHexLower(new Uint8Array([0x00, 0xff, 0xde, 0xad])),
      '00ffdead',
    );
  });

  it('matches the Rust encode_hex_lowercase output for a 32-byte nonce', () => {
    const nonce = new Uint8Array([
      0xa3, 0xf1, 0xc8, 0xd9, 0x2e, 0x0b, 0x4f, 0x7a, 0x8e, 0x1d, 0x6c, 0x5b,
      0x4a, 0x39, 0x20, 0x81, 0x7f, 0x6e, 0x5d, 0x4c, 0x3b, 0x2a, 0x19, 0x18,
      0x87, 0x76, 0x65, 0x54, 0x43, 0x32, 0x21, 0x10,
    ]);
    assert.equal(
      bytesToHexLower(nonce),
      'a3f1c8d92e0b4f7a8e1d6c5b4a3920817f6e5d4c3b2a19188776655443322110',
    );
    assert.equal(bytesToHexLower(nonce).length, 64);
  });
});
