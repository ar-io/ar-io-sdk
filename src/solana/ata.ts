/**
 * Associated Token Account derivation, kit-native.
 * Mirrors the classic SPL `getAssociatedTokenAddress` function but returns
 * a kit `Address` without the web3.js dependency.
 *
 * TODO(C7): replace with `findAssociatedTokenPda` from `@solana-program/associated-token`
 * once that package is added as a dependency.
 */
import {
  type Address,
  type Instruction,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';

import { SYSTEM_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS } from './instruction.js';

export const ATA_PROGRAM_ADDRESS: Address = address(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

const addressEncoder = getAddressEncoder();

/**
 * Derive the Associated Token Account (ATA) address for a given owner + mint.
 *
 * @param mint — the SPL token mint address
 * @param owner — the owner's wallet address (or a PDA if `allowOwnerOffCurve = true`)
 * @param allowOwnerOffCurve — unused; kit derives regardless of curve. Kept for
 *   parity with the old `@solana/spl-token` signature so call sites don't change.
 */
export async function getAssociatedTokenAddressKit(
  mint: Address,
  owner: Address,
  _allowOwnerOffCurve = false,
): Promise<Address> {
  const [ata] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM_ADDRESS,
    seeds: [
      addressEncoder.encode(owner),
      addressEncoder.encode(TOKEN_PROGRAM_ADDRESS),
      addressEncoder.encode(mint),
    ],
  });
  return ata;
}

/**
 * Build an idempotent CreateAssociatedTokenAccount instruction. Safe to
 * include in any tx — if the ATA already exists, the SPL ATA program
 * silently succeeds.
 *
 * Used to pre-create vault / escrow ATAs in the same tx as the program
 * instruction that consumes them. Anchor's `Account<TokenAccount>` constraint
 * does NOT init the account, so the caller is responsible.
 */
export function buildCreateAtaIdempotentIx(
  payer: Address,
  ata: Address,
  owner: Address,
  mint: Address,
): Instruction {
  return {
    programAddress: ATA_PROGRAM_ADDRESS,
    accounts: [
      // role 3 = writable signer; role 1 = writable; role 0 = readonly
      { address: payer, role: 3 as const },
      { address: ata, role: 1 as const },
      { address: owner, role: 0 as const },
      { address: mint, role: 0 as const },
      { address: SYSTEM_PROGRAM_ADDRESS, role: 0 as const },
      { address: TOKEN_PROGRAM_ADDRESS, role: 0 as const },
    ],
    data: new Uint8Array([1]), // SPL ATA program: 1 = CreateIdempotent
  };
}
