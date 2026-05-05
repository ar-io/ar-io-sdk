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
import { ANT_REGISTRY_ID } from '../constants.js';
import {
  AoANTRegistryRead,
  AoANTRegistryWrite,
} from '../types/ant-registry.js';
import {
  AoMessageResult,
  AoSigner,
  ProcessConfiguration,
  WithSigner,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types/index.js';
import { createAoSigner } from '../utils/ao.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';
import { ILogger, Logger } from './logger.js';

type ANTRegistryProcessConfig = Required<ProcessConfiguration> & {
  strict?: boolean;
  hyperbeamUrl?: string;
  logger?: ILogger;
};

type ANTRegistryNoSigner = ANTRegistryProcessConfig;
type ANTRegistryWithSigner = WithSigner<ANTRegistryProcessConfig>;
type ANTRegistryConfig = ANTRegistryNoSigner | ANTRegistryWithSigner;

/**
 * Solana-backend config for the ANT Registry.
 *
 * Reads the per-user paginated ACL on-chain (ADR-012): a head `AclConfig`
 * PDA + N `AclPage` PDAs holding `(asset, role)` tuples for ANTs the user
 * owns or controls. Pass a `signer` to opt into the writeable variant,
 * which adds the preflight resolvers used by the contract-required ACL
 * accounts (`add_controller`, `remove_controller`, `transfer`) plus the
 * spawn / ex-controller workflow helpers and the standalone heal-flow
 * instruction builders. See
 * `sdk/src/solana/ant-registry-{readable,writeable}.ts` for the
 * implementations.
 */
export type SolanaANTRegistryReadConfig = {
  backend: 'solana';
  rpc: import('../solana/types.js').SolanaRpc;
  commitment?: import('@solana/kit').Commitment;
  logger?: ILogger;
  /**
   * Override the ario-ant program ID. Required against any cluster other
   * than mainnet — devnet, localnet, and the Surfpool harness all deploy
   * programs at addresses derived from per-cluster keypair files. Source
   * from `migration/localnet/out/localnet.env` (`ARIO_ANT_PROGRAM_ID`) on
   * localnet.
   */
  antProgramId?: import('@solana/kit').Address;
};

export type SolanaANTRegistryWriteConfig = SolanaANTRegistryReadConfig & {
  /**
   * Solana signer used as the rent payer on `register_acl_config` /
   * `add_acl_page` and as the authoriser for any bundled write tx.
   */
  signer: import('@solana/kit').TransactionSigner;
};

/**
 * @deprecated Prefer `SolanaANTRegistryReadConfig` /
 * `SolanaANTRegistryWriteConfig`. Kept as an alias for back-compat.
 */
export type SolanaANTRegistryConfig = SolanaANTRegistryReadConfig;

export class ANTRegistry {
  // Solana backend, writeable — async to mirror ANT.init / ARIO.init and
  // avoid `import.meta.url` in CJS output.
  static init(
    config: SolanaANTRegistryWriteConfig,
  ): Promise<AoANTRegistryWrite>;

  // Solana backend, read-only.
  static init(config: SolanaANTRegistryReadConfig): Promise<AoANTRegistryRead>;

  // by default give read (AO)
  static init(): AoANTRegistryRead;

  // no signer give read (AO)
  static init(config: ANTRegistryNoSigner): AoANTRegistryRead;

  // with signer give write (AO)
  static init(config: ANTRegistryWithSigner): AoANTRegistryWrite;

  static init(
    config?:
      | ANTRegistryConfig
      | SolanaANTRegistryReadConfig
      | SolanaANTRegistryWriteConfig,
  ):
    | AoANTRegistryRead
    | AoANTRegistryWrite
    | Promise<AoANTRegistryRead | AoANTRegistryWrite> {
    if (config && 'backend' in config && config.backend === 'solana') {
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

    const aoConfig = config as ANTRegistryConfig | undefined;
    if (aoConfig !== undefined && 'signer' in aoConfig) {
      return new AoANTRegistryWriteable(aoConfig);
    }
    return new AoANTRegistryReadable(aoConfig);
  }
}

export class AoANTRegistryReadable implements AoANTRegistryRead {
  protected process: AOProcess;
  private hyperbeamUrl: string | undefined;
  private checkHyperBeamPromise: Promise<boolean> | undefined;
  private logger: ILogger;

  constructor(
    config?: ANTRegistryProcessConfig & {
      logger?: ILogger;
    },
  ) {
    this.logger = config?.logger ?? Logger.default;

    if (config === undefined || Object.keys(config).length === 0) {
      this.process = new AOProcess({
        processId: ANT_REGISTRY_ID,
      });
    } else if (isProcessConfiguration(config)) {
      this.process = config.process;
    } else if (isProcessIdConfiguration(config)) {
      this.process = new AOProcess({
        processId: config.processId,
      });
    } else {
      throw new InvalidContractConfigurationError();
    }

    if (config?.hyperbeamUrl !== undefined) {
      this.hyperbeamUrl = new URL(config.hyperbeamUrl).toString();
      this.checkHyperBeamPromise = this.checkHyperBeamCompatibility();
    }
  }

  /**
   * Check if the process is HyperBeam compatible. If so, we'll use the HyperBeam node to fetch the state.
   *
   * @returns {Promise<boolean>} True if the process is HyperBeam compatible, false otherwise.
   */
  private async checkHyperBeamCompatibility(): Promise<boolean> {
    if (this.hyperbeamUrl === undefined) {
      return Promise.resolve(false);
    }
    if (this.checkHyperBeamPromise !== undefined) {
      return this.checkHyperBeamPromise;
    }
    this.logger.debug('Checking HyperBeam compatibility');
    this.checkHyperBeamPromise = fetch(
      // use /now to force a refresh of the cache state, then compute when calling it for keys
      `${this.hyperbeamUrl.toString()}${this.process.processId}~process@1.0/now/cache/acl`,
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      },
    )
      .then((res) => {
        if (res.ok) {
          this.logger.debug('HyperBeam compatible');
          return true;
        }
        this.logger.debug('HyperBeam not compatible');
        return false;
      })
      .catch((error) => {
        this.logger.debug('Failed to check HyperBeam compatibility', {
          cause: error,
        });
        return false;
      });

    return this.checkHyperBeamPromise;
  }

  // Should we rename this to "getANTsByAddress"? seems more clear, though not same as handler name
  async accessControlList({
    address,
  }: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }> {
    if (await this.checkHyperBeamCompatibility()) {
      let retries = 0;
      while (retries < 3) {
        try {
          this.logger.debug(
            'Fetching ant registry acl for address from hyperbeam',
            address,
          );
          const res = await fetch(
            `${this.hyperbeamUrl?.toString()}${this.process.processId}~process@1.0/compute/cache/acl/${address}/serialize~json@1.0`,
          );

          if (res.status !== 200) {
            this.logger.debug(
              'Failed to fetch ant registry acl for address from hyperbeam',
              address,
              res.status,
              res.statusText,
            );
            throw new Error(
              `Failed to fetch ant registry acl for address ${address}: ${res?.statusText ?? 'Unknown error'}`,
            );
          }
          this.logger.debug(
            'Fetched ant registry acl for address from hyperbeam',
            address,
          );
          const json = (await res.json()) as {
            Owned: string[];
            Controlled: string[];
          };
          return {
            Owned: json.Owned,
            Controlled: json.Controlled,
          };
        } catch (_error) {
          retries++;
          this.logger.debug(
            'Failed to fetch ant registry acl for address from hyperbeam',
            address,
            retries,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retries ** 2),
          );
        }
      }
    }

    this.logger.debug(
      'Fetching ant registry acl for address from process',
      address,
    );
    return this.process.read({
      tags: [
        { name: 'Action', value: 'Access-Control-List' },
        { name: 'Address', value: address },
      ],
    });
  }

  /*
   * This is the same as accessControlList, but with a cleaner DX to make it clearer
   * that we're fetching the list of ANTs owned or controlled by an address.
   */
  async getAntsForAddress({
    address,
  }: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }> {
    return this.accessControlList({ address });
  }
}

export class AoANTRegistryWriteable
  extends AoANTRegistryReadable
  implements AoANTRegistryWrite
{
  private signer: AoSigner;

  constructor({ signer, ...config }: WithSigner<ANTRegistryProcessConfig>) {
    super(config);
    this.signer = createAoSigner(signer);
  }

  async register({
    processId,
  }: {
    processId: string;
  }): Promise<AoMessageResult> {
    return this.process.send({
      tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: processId },
      ],
      signer: this.signer,
    });
  }
}
