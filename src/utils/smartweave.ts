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
import Arweave from 'arweave';
import { EvaluationManifest } from 'warp-contracts/web';

import { SortKey } from '../common.js';
import { SORT_KEY_REGEX } from '../constants.js';
import { tagsToObject } from './arweave.js';

export function isSortKey(sortKey: string): sortKey is SortKey {
  return SmartWeaveSortKey.validate(sortKey);
}

export class SmartWeaveSortKey {
  private _sortKey: string;
  constructor(sortKey: string) {
    if (!SmartWeaveSortKey.validate(sortKey)) {
      throw new Error(`Invalid sort key: ${sortKey}`);
    }

    this._sortKey = sortKey;
  }

  static validate(sortKey: string): boolean {
    return SORT_KEY_REGEX.test(sortKey);
  }

  toString(): string {
    return this._sortKey;
  }

  parts(): string[] {
    return this._sortKey.split(',');
  }
  blockHeight(): number {
    return parseInt(this.parts()[0]);
  }
  timestamp(): number {
    return parseInt(this.parts()[1]);
  }
  hash(): string {
    return this.parts()[2];
  }
}

export async function getContractManifest({
  arweave,
  contractTxId,
}: {
  arweave: Arweave;
  contractTxId: string;
}): Promise<EvaluationManifest> {
  const { tags: encodedTags } = await arweave.transactions.get(contractTxId);
  const decodedTags = tagsToObject(encodedTags);
  const contractManifestString = decodedTags['Contract-Manifest'] ?? '{}';
  // TODO throw if manifest is missing
  const contractManifest = JSON.parse(contractManifestString);
  return contractManifest;
}
