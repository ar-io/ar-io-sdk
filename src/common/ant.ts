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

import type {
  SolanaRpc,
  SolanaRpcSubscriptions,
  SolanaSigner,
} from '../solana/types.js';
import type { AoANTRead, AoANTWrite } from '../types/ant.js';

/**
 * Configuration for `ANT.init` (Solana-only).
 *
 * `processId` is the MPL Core asset pubkey (base58) for the ANT.
 *
 * `antProgramId` overrides the deployed `ario-ant` program id. Required on any
 * cluster other than mainnet (devnet, localnet, Surfpool). If omitted, the
 * SDK reads the `ANT Program` entry from the asset's Attributes plugin
 * (BYO-ANT) and falls back to the canonical default. Callers who already know
 * the program (e.g. immediately after `ANT.spawn`) can pass it explicitly to
 * skip the lookup.
 */
export type ANTConfig = {
  processId: string;
  rpc: SolanaRpc;
  /** Required for write operations (needed by kit's sendAndConfirm). */
  rpcSubscriptions?: SolanaRpcSubscriptions;
  commitment?: Commitment;
  signer?: SolanaSigner;
  antProgramId?: Address;
};

export class ANT {
  // Overload: with signer -> writeable
  static init(
    config: ANTConfig & {
      signer: SolanaSigner;
      rpcSubscriptions: SolanaRpcSubscriptions;
    },
  ): Promise<AoANTWrite>;
  // Overload: without signer -> readable
  static init(config: ANTConfig): Promise<AoANTRead>;
  static init(config: ANTConfig): Promise<AoANTRead | AoANTWrite> {
    return (async () => {
      const { SolanaANTReadable } = await import('../solana/ant-readable.js');
      const { SolanaANTWriteable } = await import('../solana/ant-writeable.js');
      // ADR-016 / BD-100: when no explicit `antProgramId` is passed,
      // resolve it from the asset's `ANT Program` Attributes-plugin entry.
      // Without this auto-detection, third-party (BYO-ANT) assets would
      // silently mis-derive PDAs through the canonical default.
      let antProgramId = config.antProgramId;
      if (!antProgramId) {
        const { fetchAntProgramFromAsset } = await import(
          '../solana/mpl-core.js'
        );
        const { ARIO_ANT_PROGRAM_ID } = await import('../solana/constants.js');
        const { address } = await import('@solana/kit');
        const detected = await fetchAntProgramFromAsset(
          config.rpc,
          address(config.processId),
          { commitment: config.commitment ?? 'confirmed' },
        );
        antProgramId = detected ?? ARIO_ANT_PROGRAM_ID;
      }
      if (config.signer) {
        if (!config.rpcSubscriptions) {
          throw new Error(
            'ANT.init({ signer }) requires rpcSubscriptions for transaction confirmation.',
          );
        }
        return new SolanaANTWriteable({
          rpc: config.rpc,
          rpcSubscriptions: config.rpcSubscriptions,
          processId: config.processId,
          signer: config.signer,
          commitment: config.commitment,
          antProgramId,
        }) as unknown as AoANTWrite;
      }
      return new SolanaANTReadable({
        rpc: config.rpc,
        processId: config.processId,
        commitment: config.commitment,
        antProgramId,
      }) as unknown as AoANTRead;
    })();
  }

  /**
   * Spawn a new ANT — mints an MPL Core asset and initializes the
   * `ario-ant` PDAs in a single transaction. Returns
   * `{ processId, mint, signature }`.
   */
  static async spawn(
    params: import('../solana/spawn-ant.js').SpawnSolanaANTParams,
  ): Promise<import('../solana/spawn-ant.js').SpawnSolanaANTResult> {
    const { spawnSolanaANT } = await import('../solana/spawn-ant.js');
    return spawnSolanaANT(params);
  }
}
