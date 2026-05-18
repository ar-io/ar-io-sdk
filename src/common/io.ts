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
import type { Address, Commitment } from '@solana/kit';

import { SolanaARIOReadable } from '../solana/io-readable.js';
import { SolanaARIOWriteable } from '../solana/io-writeable.js';
import type {
  SolanaRpc,
  SolanaRpcSubscriptions,
  SolanaSigner,
} from '../solana/types.js';
import type { AoARIORead, AoARIOWrite } from '../types/index.js';

/**
 * Configuration for ARIO.init().
 *
 * Program ID overrides (`coreProgramId`, `garProgramId`, `arnsProgramId`,
 * `antProgramId`) are required against any cluster other than mainnet —
 * devnet, localnet, and the Surfpool harness all deploy programs at addresses
 * derived from per-cluster keypair files, not the placeholder constants in
 * `src/solana/constants.ts`. On localnet, source these from
 * `migration/localnet/out/localnet.env`.
 */
export type ARIOConfig = {
  rpc: SolanaRpc;
  /** Required for write operations (needed by kit's sendAndConfirm). */
  rpcSubscriptions?: SolanaRpcSubscriptions;
  commitment?: Commitment;
  signer?: SolanaSigner;
  coreProgramId?: Address;
  garProgramId?: Address;
  arnsProgramId?: Address;
  /**
   * Override the deployed `ario-ant` program id. Required for the
   * ACL-driven `getArNSRecordsForAddress` pipeline on any cluster
   * other than mainnet (devnet, localnet, Surfpool).
   */
  antProgramId?: Address;
};

export const DEFAULT_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

export class ARIO {
  // Overload: with signer -> writeable
  static init(
    config: ARIOConfig & {
      signer: SolanaSigner;
      rpcSubscriptions: SolanaRpcSubscriptions;
    },
  ): AoARIOWrite;
  // Overload: without signer -> readable
  static init(config: ARIOConfig): AoARIORead;
  static init(config: ARIOConfig): AoARIORead | AoARIOWrite {
    if (config.signer) {
      if (!config.rpcSubscriptions) {
        throw new Error(
          'ARIO.init({ signer }) requires rpcSubscriptions for transaction confirmation.',
        );
      }
      return new SolanaARIOWriteable({
        rpc: config.rpc,
        rpcSubscriptions: config.rpcSubscriptions,
        commitment: config.commitment,
        signer: config.signer,
        coreProgramId: config.coreProgramId,
        garProgramId: config.garProgramId,
        arnsProgramId: config.arnsProgramId,
        antProgramId: config.antProgramId,
      }) as unknown as AoARIOWrite;
    }
    return new SolanaARIOReadable({
      rpc: config.rpc,
      commitment: config.commitment,
      coreProgramId: config.coreProgramId,
      garProgramId: config.garProgramId,
      arnsProgramId: config.arnsProgramId,
      antProgramId: config.antProgramId,
    }) as unknown as AoARIORead;
  }
}
