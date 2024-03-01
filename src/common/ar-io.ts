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
import { ArIOContract, ArNSNameData, Gateway } from '../types/index.js';
import { ArNSRemoteCache } from './index.js';

export type CacheConfiguration = {
  remoteCacheUrl?: string;
  contractTxId?: string;
};
export type ArIOConfiguration = {
  cacheConfig?: CacheConfiguration;
};

export class ArIO implements ArIOContract {
  protected cache: ArIOContract;

  constructor({ cacheConfig }: ArIOConfiguration = {}) {
    this.cache = new ArNSRemoteCache({
      contractTxId: cacheConfig?.contractTxId,
      url: cacheConfig?.remoteCacheUrl,
    });
  }
  // implement ArIOContract interface

  async getArNSRecord({ domain }: { domain: string }): Promise<ArNSNameData> {
    return this.cache.getArNSRecord({ domain });
  }
  async getArNSRecords(): Promise<Record<string, ArNSNameData>> {
    return this.cache.getArNSRecords();
  }
  async getBalance({ address }: { address: string }): Promise<number> {
    return this.cache.getBalance({ address });
  }
  async getBalances(): Promise<Record<string, number>> {
    return this.cache.getBalances();
  }
  async getGateway({ address }: { address: string }): Promise<Gateway> {
    return this.cache.getGateway({ address });
  }
  async getGateways(): Promise<Record<string, Gateway>> {
    return this.cache.getGateways();
  }
}
