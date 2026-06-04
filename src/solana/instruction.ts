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
