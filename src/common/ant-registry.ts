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
import type { Address, Commitment, TransactionSigner } from '@solana/kit';

import type { SolanaRpc } from '../solana/types.js';
import type {
  AoANTRegistryRead,
  AoANTRegistryWrite,
} from '../types/ant-registry.js';
import type { ILogger } from './logger.js';

/**
 * Read-only config for `ANTRegistry.init`.
 *
 * Reads the per-user paginated ACL on-chain (ADR-012): a head `AclConfig`
 * PDA + N `AclPage` PDAs holding `(asset, role)` tuples for ANTs the user
 * owns or controls. See `src/solana/ant-registry-readable.ts`.
 */
export type ANTRegistryReadConfig = {
  rpc: SolanaRpc;
  commitment?: Commitment;
  logger?: ILogger;
  /**
   * Override the ario-ant program ID. Required against any cluster other
   * than mainnet — devnet, localnet, and the Surfpool harness all deploy
   * programs at addresses derived from per-cluster keypair files. Source
   * from `migration/localnet/out/localnet.env` (`ARIO_ANT_PROGRAM_ID`) on
   * localnet.
   */
  antProgramId?: Address;
};

/**
 * Writeable config — adds a signer used as rent payer on
 * `register_acl_config` / `add_acl_page` and as the authoriser on any
 * bundled write tx. See `src/solana/ant-registry-writeable.ts` for the
 * preflight resolvers used by `add_controller`, `remove_controller`,
 * `transfer`, and the spawn / ex-controller workflow helpers.
 */
export type ANTRegistryWriteConfig = ANTRegistryReadConfig & {
  signer: TransactionSigner;
};

export class ANTRegistry {
  // Writeable — async to avoid `import.meta.url` in CJS output.
  static init(config: ANTRegistryWriteConfig): Promise<AoANTRegistryWrite>;
  // Read-only
  static init(config: ANTRegistryReadConfig): Promise<AoANTRegistryRead>;
  static init(
    config: ANTRegistryReadConfig | ANTRegistryWriteConfig,
  ): Promise<AoANTRegistryRead | AoANTRegistryWrite> {
    return (async () => {
      if ('signer' in config) {
        const { SolanaANTRegistryWriteable } = await import(
          '../solana/ant-registry-writeable.js'
        );
        return new SolanaANTRegistryWriteable({
          rpc: config.rpc,
          signer: config.signer,
          commitment: config.commitment,
          logger: config.logger,
          antProgramId: config.antProgramId,
        }) as AoANTRegistryWrite;
      }
      const { SolanaANTRegistryReadable } = await import(
        '../solana/ant-registry-readable.js'
      );
      return new SolanaANTRegistryReadable({
        rpc: config.rpc,
        commitment: config.commitment,
        logger: config.logger,
        antProgramId: config.antProgramId,
      }) as AoANTRegistryRead;
    })();
  }
}
