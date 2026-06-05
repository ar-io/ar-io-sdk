/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * CLI commands for `ario-ant-escrow` — trustless multi-protocol ANT custody.
 *
 * Each command instantiates an {@link ANTEscrow} with options-driven RPC +
 * signer wiring (mirrors the rest of the Solana CLI surface — see
 * `arnsPurchaseCommands.ts`). All read commands work without a signer; all
 * write commands require `--wallet-file` or `--private-key`.
 *
 * Recipient pubkey loading:
 * - Arweave: `--recipient-arweave <jwk-file>` reads the JWK JSON, decodes
 *   the base64url `n` field to 512 raw bytes (RSA-4096 modulus).
 * - Ethereum: `--recipient-ethereum 0x...` parses the 20-byte hex address.
 */

import { readFileSync } from 'node:fs';

import {
  type Address,
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpcSubscriptions,
} from '@solana/kit';
import bs58 from 'bs58';

import { ARIO_ANT_ESCROW_PROGRAM_ID } from '../../solana/constants.js';
import { ANTEscrow, type EscrowProtocol } from '../../solana/escrow.js';
import {
  createCircuitBreakerRpc,
  defaultFallbackUrl,
} from '../../solana/rpc-circuit-breaker.js';
import type { JsonSerializable } from '../types.js';

// =========================================
// Shared option types
// =========================================

interface EscrowGlobalOptions {
  rpcUrl?: string;
  walletFile?: string;
  privateKey?: string;
  escrowProgramId?: string;
}

interface AntMintOptions extends EscrowGlobalOptions {
  ant?: string;
}

interface DepositOptions extends AntMintOptions {
  recipientArweave?: string;
  recipientEthereum?: string;
}

interface UpdateRecipientOptions extends AntMintOptions {
  newRecipientArweave?: string;
  newRecipientEthereum?: string;
}

interface ClaimArweaveOptions extends AntMintOptions {
  signatureFile?: string;
  saltLen?: string;
  claimant?: string;
}

interface ClaimEthereumOptions extends AntMintOptions {
  signatureFile?: string;
  claimant?: string;
}

// =========================================
// Wiring helpers
// =========================================

function wsUrlFromRpcUrl(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, 'ws');
}

function escrowProgramIdFrom(options: EscrowGlobalOptions): Address {
  return options.escrowProgramId
    ? address(options.escrowProgramId)
    : ARIO_ANT_ESCROW_PROGRAM_ID;
}

async function readEscrowReader(
  options: EscrowGlobalOptions,
): Promise<ANTEscrow> {
  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  return ANTEscrow.init({
    rpc: createCircuitBreakerRpc({
      primaryUrl: rpcUrl,
      fallbackUrl: defaultFallbackUrl(rpcUrl),
    }),
    programId: escrowProgramIdFrom(options),
  });
}

async function writeEscrowFromOptions(
  options: EscrowGlobalOptions,
): Promise<ANTEscrow> {
  let secretKey: Uint8Array;
  if (options.privateKey) {
    secretKey = bs58.decode(options.privateKey);
  } else if (options.walletFile) {
    const raw = readFileSync(options.walletFile, 'utf-8');
    secretKey = new Uint8Array(JSON.parse(raw));
  } else {
    throw new Error(
      'escrow write operations require a signer. Provide --wallet-file <path> or --private-key <base58>',
    );
  }
  const signer = await createKeyPairSignerFromBytes(secretKey);
  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  return ANTEscrow.init({
    rpc: createCircuitBreakerRpc({
      primaryUrl: rpcUrl,
      fallbackUrl: defaultFallbackUrl(rpcUrl),
    }),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrlFromRpcUrl(rpcUrl)),
    signer,
    programId: escrowProgramIdFrom(options),
  });
}

// =========================================
// Recipient pubkey parsing
// =========================================

function base64UrlDecode(s: string): Uint8Array {
  // Convert base64url → base64, then decode.
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Load an Arweave RSA-4096 modulus from a JWK file (`.json` with `n` field). */
function loadArweaveModulusFromJwk(filePath: string): Uint8Array {
  const raw = readFileSync(filePath, 'utf-8');
  const jwk = JSON.parse(raw) as { n?: string; kty?: string };
  if (jwk.kty !== 'RSA' || !jwk.n) {
    throw new Error(`Not a valid Arweave RSA JWK (missing kty=RSA or n field)`);
  }
  const modulus = base64UrlDecode(jwk.n);
  if (modulus.length !== 512) {
    throw new Error(
      `Arweave modulus must be 512 bytes (4096-bit RSA); got ${modulus.length}`,
    );
  }
  return modulus;
}

/** Parse an Ethereum address (`0xabc...`) into 20 raw bytes. */
function parseEthereumAddress(hex: string): Uint8Array {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleaned.length !== 40 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
    throw new Error(
      `Ethereum address must be 0x-prefixed 40-char hex; got "${hex}"`,
    );
  }
  return Uint8Array.from(Buffer.from(cleaned, 'hex'));
}

function recipientFromDepositOptions(o: DepositOptions): {
  protocol: EscrowProtocol;
  publicKey: Uint8Array;
} {
  if (o.recipientArweave && o.recipientEthereum) {
    throw new Error(
      '--recipient-arweave and --recipient-ethereum are mutually exclusive',
    );
  }
  if (o.recipientArweave) {
    return {
      protocol: 'arweave',
      publicKey: loadArweaveModulusFromJwk(o.recipientArweave),
    };
  }
  if (o.recipientEthereum) {
    return {
      protocol: 'ethereum',
      publicKey: parseEthereumAddress(o.recipientEthereum),
    };
  }
  throw new Error(
    'one of --recipient-arweave or --recipient-ethereum is required',
  );
}

function recipientFromUpdateOptions(o: UpdateRecipientOptions): {
  protocol: EscrowProtocol;
  publicKey: Uint8Array;
} {
  return recipientFromDepositOptions({
    recipientArweave: o.newRecipientArweave,
    recipientEthereum: o.newRecipientEthereum,
  } as DepositOptions);
}

function antFromOptions(o: AntMintOptions): Address {
  if (!o.ant) throw new Error('--ant <mint> is required');
  return address(o.ant);
}

// =========================================
// CLI handlers
// =========================================

/** `ar.io escrow status --ant <mint>` */
export async function escrowStatusCLICommand(
  o: AntMintOptions,
): Promise<JsonSerializable> {
  const escrow = await readEscrowReader(o);
  const ant = antFromOptions(o);
  const state = await escrow.get(ant);
  if (!state) {
    return { active: false, antMint: ant };
  }
  return {
    active: true,
    antMint: state.antMint,
    depositor: state.depositor,
    recipientProtocol: state.recipientProtocol,
    recipientPubkeyHex: Buffer.from(state.recipientPubkey).toString('hex'),
    nonceHex: Buffer.from(state.nonce).toString('hex'),
    depositSlot: state.depositSlot.toString(),
    version: state.version,
  };
}

/** `ar.io escrow deposit --ant <mint> --recipient-{arweave|ethereum} ...` */
export async function escrowDepositCLICommand(
  o: DepositOptions,
): Promise<JsonSerializable> {
  const recipient = recipientFromDepositOptions(o);
  const escrow = await writeEscrowFromOptions(o);
  const sig = await escrow.deposit({ antMint: antFromOptions(o), recipient });
  return { signature: sig };
}

/** `ar.io escrow cancel --ant <mint>` */
export async function escrowCancelCLICommand(
  o: AntMintOptions,
): Promise<JsonSerializable> {
  const escrow = await writeEscrowFromOptions(o);
  const sig = await escrow.cancel({ antMint: antFromOptions(o) });
  return { signature: sig };
}

/** `ar.io escrow update-recipient --ant <mint> --new-recipient-{arweave|ethereum} ...` */
export async function escrowUpdateRecipientCLICommand(
  o: UpdateRecipientOptions,
): Promise<JsonSerializable> {
  const newRecipient = recipientFromUpdateOptions(o);
  const escrow = await writeEscrowFromOptions(o);
  const sig = await escrow.updateRecipient({
    antMint: antFromOptions(o),
    newRecipient,
  });
  return { signature: sig };
}

/** `ar.io escrow claim-arweave --ant <mint> --signature-file <bin> --claimant <pubkey> [--salt-len 32]` */
export async function escrowClaimArweaveCLICommand(
  o: ClaimArweaveOptions,
): Promise<JsonSerializable> {
  if (!o.signatureFile) throw new Error('--signature-file <path> is required');
  if (!o.claimant) throw new Error('--claimant <pubkey> is required');
  const sigBytes = new Uint8Array(readFileSync(o.signatureFile));
  if (sigBytes.length !== 512) {
    throw new Error(`signature file must be 512 bytes; got ${sigBytes.length}`);
  }
  // RSA-PSS salt length: 0 is a valid value, so only reject NaN / negative /
  // non-integer. An unset flag defaults to 32 (a full SHA-256 digest).
  const saltLen = o.saltLen ? Number.parseInt(o.saltLen, 10) : 32;
  if (!Number.isInteger(saltLen) || saltLen < 0) {
    throw new Error(
      `--salt-len must be a non-negative integer (got '${o.saltLen}')`,
    );
  }
  const escrow = await writeEscrowFromOptions(o);
  const sig = await escrow.claimArweave({
    antMint: antFromOptions(o),
    claimant: address(o.claimant),
    signature: sigBytes,
    saltLen,
  });
  return { signature: sig };
}

/** `ar.io escrow claim-ethereum --ant <mint> --signature-file <bin> --claimant <pubkey>` */
export async function escrowClaimEthereumCLICommand(
  o: ClaimEthereumOptions,
): Promise<JsonSerializable> {
  if (!o.signatureFile) throw new Error('--signature-file <path> is required');
  if (!o.claimant) throw new Error('--claimant <pubkey> is required');
  const sigBytes = new Uint8Array(readFileSync(o.signatureFile));
  if (sigBytes.length !== 65) {
    throw new Error(
      `signature file must be 65 bytes (r||s||v); got ${sigBytes.length}`,
    );
  }
  const escrow = await writeEscrowFromOptions(o);
  const sig = await escrow.claimEthereum({
    antMint: antFromOptions(o),
    claimant: address(o.claimant),
    signature: sigBytes,
  });
  return { signature: sig };
}
