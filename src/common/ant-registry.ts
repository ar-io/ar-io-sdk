/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { ANT_REGISTRY_ID } from '../constants.js';
import {
  AoANTRegistryRead,
  AoANTRegistryWrite,
  AoMessageResult,
  AoSigner,
  OptionalSigner,
  ProcessConfiguration,
  WithSigner,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types.js';
import { createAoSigner } from '../utils/ao.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';

export class ANTRegistry {
  static init(): AoANTRegistryRead;
  static init(
    config: Required<ProcessConfiguration> & { signer?: undefined },
  ): AoANTRegistryRead;
  static init({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>>): AoANTRegistryRead;
  static init(
    config?: OptionalSigner<ProcessConfiguration>,
  ): AoANTRegistryRead | AoANTRegistryWrite {
    if (config && config.signer) {
      const { signer, ...rest } = config;
      return new AoANTRegistryWriteable({
        ...rest,
        signer,
      });
    }
    return new AoANTRegistryReadable(config);
  }
}

export class AoANTRegistryReadable implements AoANTRegistryRead {
  protected process: AOProcess;

  constructor(config?: ProcessConfiguration) {
    if (
      config &&
      (isProcessIdConfiguration(config) || isProcessConfiguration(config))
    ) {
      if (isProcessConfiguration(config)) {
        this.process = config.process;
      } else if (isProcessIdConfiguration(config)) {
        this.process = new AOProcess({
          processId: config.processId,
        });
      } else {
        throw new InvalidContractConfigurationError();
      }
    } else {
      this.process = new AOProcess({
        processId: ANT_REGISTRY_ID,
      });
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
