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

type ANTRegistryConfigOptionalStrict = Required<ProcessConfiguration> & {
  strict?: boolean;
  hyperbeamUrl?: string;
};

type ANTRegistryNoSigner = ANTRegistryConfigOptionalStrict;
type ANTRegistryWithSigner = WithSigner<ANTRegistryConfigOptionalStrict>;
type ANTRegistryConfig = ANTRegistryNoSigner | ANTRegistryWithSigner;

export class ANTRegistry {
  // by default give read
  static init(): AoANTRegistryRead;

  // no signer give read
  static init(config: ANTRegistryNoSigner): AoANTRegistryRead;

  // with signer give write
  static init(config: ANTRegistryWithSigner): AoANTRegistryWrite;

  static init(
    config?: ANTRegistryConfig,
  ): AoANTRegistryRead | AoANTRegistryWrite {
    if (config !== undefined && 'signer' in config) {
      return new AoANTRegistryWriteable(config);
    }
    return new AoANTRegistryReadable(config);
  }
}

export class AoANTRegistryReadable implements AoANTRegistryRead {
  protected process: AOProcess;
  private hyperbeamUrl: string | undefined;
  private checkHyperBeamPromise: Promise<boolean> | undefined;

  constructor(config?: ANTRegistryConfigOptionalStrict) {
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
    console.debug('Checking HyperBeam compatibility');
    this.checkHyperBeamPromise = fetch(
      `${this.hyperbeamUrl.toString()}${this.process.processId}~process@1.0/now/cache/acl`,
      {
        method: 'HEAD',
      },
    ).then((res) => {
      if (res.ok) {
        console.debug('HyperBeam compatible');
        return true;
      }
      console.debug('HyperBeam not compatible');
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
          console.debug(
            'Fetching ant registry acl for address from hyperbeam',
            address,
          );
          const res = await fetch(
            `${this.hyperbeamUrl?.toString()}${this.process.processId}~process@1.0/now/cache/acl/${address}/serialize~json@1.0`,
          );

          if (res.status !== 200) {
            console.debug(
              'Failed to fetch ant registry acl for address from hyperbeam',
              address,
              res.status,
              res.statusText,
            );
            throw new Error(
              `Failed to fetch ant registry acl for address ${address}: ${res?.statusText ?? 'Unknown error'}`,
            );
          }
          console.debug(
            'Fetched ant registry acl for address from hyperbeam',
            address,
          );
          const json = (await res.json()) as {
            owned: string[];
            controlled: string[];
          };
          return {
            Owned: json.owned,
            Controlled: json.controlled,
          } as {
            Owned: string[];
            Controlled: string[];
          };
        } catch (error) {
          retries++;
          console.debug(
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

    console.debug(
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
}

export class AoANTRegistryWriteable
  extends AoANTRegistryReadable
  implements AoANTRegistryWrite
{
  private signer: AoSigner;

  constructor({
    signer,
    ...config
  }: WithSigner<ANTRegistryConfigOptionalStrict>) {
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
