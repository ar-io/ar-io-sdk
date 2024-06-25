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
import {
  AoANTState,
  AoArNSNameData,
  ProcessConfiguration,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../io.js';
import { ProcessId, WalletAddress } from '../types.js';
import { AOProcess, InvalidContractConfigurationError } from './index.js';

export type ResolvedAoArNSNameData = AoArNSNameData & { state: AoANTState };
export interface IOResolver {
  getACL(address: string): Promise<Record<string, ResolvedAoArNSNameData>>;
  getRecord(name: string): Promise<ResolvedAoArNSNameData>;
  getRecords(): Promise<Record<string, ResolvedAoArNSNameData>>;
  getProcess(
    processId: string,
  ): Promise<Record<string, ResolvedAoArNSNameData>>;
  getProcesses(
    address: string,
  ): Promise<Record<string, ResolvedAoArNSNameData>>;
}
export class ArNSResolver implements IOResolver {
  private process: AOProcess;
  constructor(config: Required<ProcessConfiguration>) {
    if (isProcessConfiguration(config)) {
      this.process = config.process;
    } else if (isProcessIdConfiguration(config)) {
      this.process = new AOProcess({
        processId: config.processId,
      });
    } else {
      throw new InvalidContractConfigurationError();
    }
  }

  async getACL(
    address: WalletAddress,
  ): Promise<Record<string, ResolvedAoArNSNameData>> {
    const tags = [
      { name: 'Action', value: 'ACL' },
      { name: 'Address', value: address },
    ];
    const res = await this.process.read<Record<string, ResolvedAoArNSNameData>>(
      {
        tags,
      },
    );
    return res;
  }

  async getRecord(name: string): Promise<ResolvedAoArNSNameData> {
    const tags = [
      { name: 'Action', value: 'Record' },
      { name: 'Name', value: name },
    ];
    const res = await this.process.read<ResolvedAoArNSNameData>({
      tags,
    });
    return res;
  }

  async getRecords(): Promise<Record<string, ResolvedAoArNSNameData>> {
    const tags = [{ name: 'Action', value: 'Records' }];
    const res = await this.process.read<Record<string, ResolvedAoArNSNameData>>(
      {
        tags,
      },
    );
    return res;
  }

  async getProcess(
    processId: string,
  ): Promise<Record<string, ResolvedAoArNSNameData>> {
    const tags = [
      { name: 'Action', value: 'Process' },
      { name: 'ProcessId', value: processId },
    ];
    const res = await this.process.read<Record<string, ResolvedAoArNSNameData>>(
      {
        tags,
      },
    );
    return res;
  }

  async getProcesses(): Promise<Record<string, ResolvedAoArNSNameData>> {
    const tags = [{ name: 'Action', value: 'Processes' }];
    const res = await this.process.read<
      Record<ProcessId, ResolvedAoArNSNameData>
    >({
      tags,
    });
    return res;
  }
}
