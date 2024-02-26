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
import { ArIOContract } from '../types/index.js';
import { ArNSRemoteCache } from './index.js';

export class ArIO {
  public testnet: ArIOContract;
  public devnet: ArIOContract;

  constructor({ remoteCacheUrl }: { remoteCacheUrl?: string }) {
    this.testnet = new ArNSRemoteCache({
      contractTxId: ARNS_TESTNET_REGISTRY_TX,
      url: remoteCacheUrl,
    });
    this.devnet = new ArNSRemoteCache({
      contractTxId: ARNS_DEVNET_REGISTRY_TX,
      url: remoteCacheUrl,
    });
  }
}
