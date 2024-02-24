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
  ARNS_DEVNET_REGISTRY_TX,
  ARNS_TESTNET_REGISTRY_TX,
} from '../constants.js';
import { ArIOContract, ContractCache } from '../types/index.js';
import { ArNSRemoteCache } from './index.js';

export class ArIO {
  protected cache: ContractCache = new ArNSRemoteCache({});

  public testnet: ArIOContract = this.cache.setContractTxId(
    ARNS_TESTNET_REGISTRY_TX,
  );
  public devnet: ArIOContract = this.cache.setContractTxId(
    ARNS_DEVNET_REGISTRY_TX,
  );

  constructor({ remoteCacheUrl }: { remoteCacheUrl?: string }) {
    this.cache = new ArNSRemoteCache({ url: remoteCacheUrl });
    this.testnet = this.cache.setContractTxId(ARNS_TESTNET_REGISTRY_TX);
    this.devnet = this.cache.setContractTxId(ARNS_DEVNET_REGISTRY_TX);
  }
}
