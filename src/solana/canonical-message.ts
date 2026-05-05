/**
 * Canonical claim-message helper for `ario-ant-escrow`.
 *
 * Produces the EXACT bytes a recipient signs to release an escrowed
 * ANT. Output MUST be byte-identical to the Rust implementation in
 * `contracts/programs/ario-ant-escrow/src/canonical.rs::build_canonical_message`.
 * Cross-language equivalence is asserted by `canonical-message.test.ts`
 * which spawns the Rust `canonical` example binary and diffs the bytes.
 *
 * Format (UTF-8, line-feed separated, no trailing newline):
 *
 * ```text
 * ar.io ant-escrow claim v1
 * network: <network>
 * ant: <ant_mint_base58>
 * claimant: <claimant_solana_pubkey_base58>
 * nonce: <nonce_hex_lowercase>
 * ```
 *
 * Wallets sign these bytes directly:
 * - Arweave: `wallet.signMessage(bytes)` → 512-byte RSA-PSS sig
 * - Ethereum: `wallet.signMessage(bytes)` → 65-byte ECDSA + EIP-191 sig
 *   (the wallet applies the EIP-191 prefix; on-chain code re-applies it).
 */

import type { Address } from '@solana/kit';

/** Network bound into the canonical message at compile-time on the Rust
 * side. Frontend / SDK callers pass it explicitly so a single SDK build
 * works against either deployment. */
export type EscrowNetwork = 'solana-mainnet' | 'solana-devnet';

export interface CanonicalMessageInput {
  /** Must match the program's compile-time network string. */
  network: EscrowNetwork;
  /** ANT mint pubkey — matches `escrow.ant_mint`. */
  antMint: Address;
  /** Solana pubkey that will receive the ANT on claim. Bound into the
   *  signature so front-runners can't redirect. */
  claimant: Address;
  /** 32-byte anti-replay nonce — read from the EscrowAnt account. */
  nonce: Uint8Array;
}

/** Header literal — must match Rust `CANONICAL_HEADER`. */
const CANONICAL_HEADER = 'ar.io ant-escrow claim v1';

/**
 * Build the canonical claim message bytes. UTF-8 encoded, no trailing
 * newline, exactly the format shown in the docstring.
 *
 * @throws if `nonce` isn't exactly 32 bytes — guards against accidentally
 * passing a hex string or a different-sized buffer.
 */
export function canonicalMessage(input: CanonicalMessageInput): Uint8Array {
  if (input.nonce.length !== 32) {
    throw new Error(
      `canonicalMessage: nonce must be 32 bytes, got ${input.nonce.length}`,
    );
  }

  const text =
    `${CANONICAL_HEADER}\n` +
    `network: ${input.network}\n` +
    `ant: ${input.antMint}\n` +
    `claimant: ${input.claimant}\n` +
    `nonce: ${bytesToHexLower(input.nonce)}`;

  return new TextEncoder().encode(text);
}

// =========================================
// v2 — token/vault escrow canonical message
// =========================================

export interface CanonicalMessageV2Input {
  /** Must match the program's compile-time network string. */
  network: EscrowNetwork;
  /** `'token'` for liquid ARIO, `'vault'` for time-locked positions. */
  assetType: 'token' | 'vault';
  /** 32-byte client-supplied unique identifier for the escrowed asset. */
  assetId: Uint8Array;
  /** Amount of ARIO (mARIO) held in escrow. */
  amount: bigint;
  /** Solana pubkey that will receive the tokens on claim. */
  claimant: Address;
  /** 32-byte anti-replay nonce — read from the EscrowToken account. */
  nonce: Uint8Array;
}

/** Header literal — must match Rust `CANONICAL_HEADER_V2`. */
const CANONICAL_HEADER_V2 = 'ar.io escrow claim v2';

/**
 * Build the v2 canonical claim message bytes for token/vault escrows.
 * UTF-8 encoded, no trailing newline.
 *
 * Format:
 * ```text
 * ar.io escrow claim v2
 * network: <network>
 * type: <token|vault>
 * asset: <asset_id_hex_lowercase_64chars>
 * amount: <u64_decimal>
 * claimant: <base58>
 * nonce: <hex_lowercase_64chars>
 * ```
 *
 * @throws if `assetId` or `nonce` aren't exactly 32 bytes.
 */
export function canonicalMessageV2(input: CanonicalMessageV2Input): Uint8Array {
  if (input.assetId.length !== 32) {
    throw new Error(
      `canonicalMessageV2: assetId must be 32 bytes, got ${input.assetId.length}`,
    );
  }
  if (input.nonce.length !== 32) {
    throw new Error(
      `canonicalMessageV2: nonce must be 32 bytes, got ${input.nonce.length}`,
    );
  }

  const text =
    `${CANONICAL_HEADER_V2}\n` +
    `network: ${input.network}\n` +
    `type: ${input.assetType}\n` +
    `asset: ${bytesToHexLower(input.assetId)}\n` +
    `amount: ${input.amount.toString()}\n` +
    `claimant: ${input.claimant}\n` +
    `nonce: ${bytesToHexLower(input.nonce)}`;

  return new TextEncoder().encode(text);
}

// =========================================
// Shared utilities
// =========================================

/** Lowercase-hex encoding. Matches Rust `encode_hex_lowercase`. */
export function bytesToHexLower(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += (b >>> 4).toString(16);
    s += (b & 0x0f).toString(16);
  }
  return s;
}
