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
import { AoANTVersionsRead, AoANTVersionsWrite } from '../types/ant.js';
import { AoMessageResult, WithSigner, WriteOptions } from '../types/common.js';
import {
  ProcessConfiguration,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types/io.js';
import { AoSigner } from '../types/token.js';
import { createAoSigner } from '../utils/ao.js';
import { pruneTags } from '../utils/arweave.js';
import { AOProcess } from './contracts/ao-process.js';
import { InvalidContractConfigurationError } from './error.js';

type ANTVersionsNoSigner = ProcessConfiguration;
type ANTVersionsWithSigner = WithSigner<ProcessConfiguration>;
type ANTVersionsConfig = ANTVersionsNoSigner | ANTVersionsWithSigner;

export class ANTVersions {
  // by default give read
  static init(): AoANTVersionsRead;

  // no signer give read
  static init(config: ANTVersionsNoSigner): AoANTVersionsRead;

  // with signer give write
  static init(config: ANTVersionsWithSigner): AoANTVersionsWrite;

  static init(
    config?: ANTVersionsConfig,
  ): AoANTVersionsRead | AoANTVersionsWrite {
    if (config !== undefined && 'signer' in config) {
      return new ANTVersionsWritable(config);
    }
    return new ANTVersionsReadable(config);
  }
}

export class ANTVersionsReadable implements AoANTVersionsRead {
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
  async getANTVersions(): Promise<
    Record<string, { moduleId: string; luaSourceId?: string; notes: string }>
  > {
    const res = await this.process.read<
      Record<string, { moduleId: string; luaSourceId?: string; notes: string }>
    >({
      tags: [{ name: 'Action', value: 'Get-Versions' }],
    });
    return Object.fromEntries(
      Object.entries(res).sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  async getLatestANTVersion(): Promise<{
    version: string;
    moduleId: string;
    luaSourceId?: string;
    notes?: string;
  }> {
    const versions = await this.getANTVersions();
    const lastestVersion = Object.entries(versions).at(-1);
    if (!lastestVersion) throw new Error('No version found');
    return {
      version: lastestVersion[0],
      ...lastestVersion[1],
    };
  }
}

export class ANTVersionsWritable
  extends ANTVersionsReadable
  implements AoANTVersionsWrite
{
  private signer: AoSigner;

  constructor({ signer, ...config }: WithSigner<ProcessConfiguration>) {
    super(config);
    this.signer = createAoSigner(signer);
  }
  async addVersion(
    params: {
      version: string;
      moduleId: string;
      luaSourceId?: string;
      notes?: string;
    },
    options?: WriteOptions,
  ): Promise<AoMessageResult> {
    const { version, moduleId, luaSourceId, notes } = params;
    return this.process.send({
      tags: pruneTags([
        { name: 'Action', value: 'Add-Version' },
        { name: 'Version', value: version },
        { name: 'Module-Id', value: moduleId },
        { name: 'Lua-Source-Id', value: luaSourceId },
        { name: 'Notes', value: notes },
        ...(options?.tags ?? []),
      ]),
      signer: this.signer,
    });
  }
}
