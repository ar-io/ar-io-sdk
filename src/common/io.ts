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
import type { ARIORead, ARIOWrite } from '../types/index.js';

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
  /**
   * Create an ARIO client bound to a Solana RPC transport.
   *
   * The return type is selected by the {@link ARIOConfig} you pass:
   * - **Read-write** — when `signer` (a {@link SolanaSigner}) is provided. A
   *   {@link SolanaRpcSubscriptions} client is then also required so
   *   `@solana/kit`'s `sendAndConfirmTransaction` can await confirmations;
   *   omitting it throws. Returns {@link ARIOWrite}.
   * - **Read-only** — when `signer` is omitted. Returns {@link ARIORead}.
   *
   * Program-id overrides (`coreProgramId` / `garProgramId` / `arnsProgramId` /
   * `antProgramId`) are required on any non-mainnet cluster (devnet, localnet,
   * Surfpool); see {@link ARIOConfig}.
   *
   * @param config - RPC transport, optional signer/subscriptions, and
   *   per-cluster program-id overrides.
   * @returns {@link ARIOWrite} when a signer is supplied, otherwise
   *   {@link ARIORead}.
   * @throws If a signer is supplied without `rpcSubscriptions`.
   */
  // Overload: with signer -> writeable. `rpcSubscriptions` is required so
  // kit's `sendAndConfirmTransaction` can subscribe to the confirmation.
  static init(
    config: ARIOConfig & {
      signer: SolanaSigner;
      rpcSubscriptions: SolanaRpcSubscriptions;
    },
  ): ARIOWrite;
  // Overload: read-only — explicitly excludes `signer` so callers can't
  // pass a write-shaped config and only fail at runtime when
  // `rpcSubscriptions` is also missing.
  static init(config: ARIOConfig & { signer?: never }): ARIORead;
  static init(config: ARIOConfig): ARIORead | ARIOWrite {
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
      }) as unknown as ARIOWrite;
    }
    return new SolanaARIOReadable({
      rpc: config.rpc,
      commitment: config.commitment,
      coreProgramId: config.coreProgramId,
      garProgramId: config.garProgramId,
      arnsProgramId: config.arnsProgramId,
      antProgramId: config.antProgramId,
    }) as unknown as ARIORead;
  }
}
