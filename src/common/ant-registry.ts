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

type ANTRegistryNoSigner = ProcessConfiguration;
type ANTRegistryWithSigner = WithSigner<ProcessConfiguration>;
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

  constructor(config?: ProcessConfiguration) {
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
  }

  // Should we rename this to "getANTsByAddress"? seems more clear, though not same as handler name
  async accessControlList({
    address,
  }: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }> {
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

  constructor({ signer, ...config }: WithSigner<ProcessConfiguration>) {
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
