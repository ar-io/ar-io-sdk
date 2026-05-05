/**
 * Common Solana program/sysvar addresses used by the SDK.
 *
 * All AR.IO and Metaplex Core instructions are now built via Codama-generated
 * builders under `./generated/<program>/instructions/*`. This module only
 * re-exports the AR.IO program IDs and a few sysvar/system constants that
 * the rest of the SDK still references by name.
 */
import { type Address, address } from '@solana/kit';

import {
  ARIO_ANT_PROGRAM_ID,
  ARIO_ARNS_PROGRAM_ID,
  ARIO_CORE_PROGRAM_ID,
  ARIO_GAR_PROGRAM_ID,
} from './constants.js';

/**
 * System program (11111111111111111111111111111111).
 * Kit-native equivalent of web3.js's `SystemProgram.programId`.
 */
export const SYSTEM_PROGRAM_ADDRESS: Address = address(
  '11111111111111111111111111111111',
);

/**
 * SPL Token program address.
 */
export const TOKEN_PROGRAM_ADDRESS: Address = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

/**
 * Rent sysvar address.
 */
export const SYSVAR_RENT_ADDRESS: Address = address(
  'SysvarRent111111111111111111111111111111111',
);

export {
  ARIO_CORE_PROGRAM_ID,
  ARIO_GAR_PROGRAM_ID,
  ARIO_ARNS_PROGRAM_ID,
  ARIO_ANT_PROGRAM_ID,
};
