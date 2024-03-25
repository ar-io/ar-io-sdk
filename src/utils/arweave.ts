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
import { DataItem, Transaction } from 'arbundles';
import { Tag } from 'warp-contracts/web';

import { BlockHeight } from '../common.js';
import { ARWEAVE_TX_REGEX } from '../constants.js';

export const validateArweaveId = (id: string): boolean => {
  return ARWEAVE_TX_REGEX.test(id);
};

export function isBlockHeight(height: string | number): height is BlockHeight {
  return height !== undefined && !isNaN(parseInt(height.toString()));
}

export const dummyTransaction: Transaction = new Transaction({
  attributes: {
    format: 2,
    id: 'dummy',
    last_tx: 'dummy',
    owner: 'dummy',
    tags: [],
    target: 'dummy',
    quantity: 'dummy',
    data: Buffer.from('dummy'),
    reward: 'dummy',
    signature: 'dummy',
    data_size: 'dummy',
    data_root: 'dummy',
  }, // deps unnecesaary for testing and type checking
  deps: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
});

export const dummyDataItem: DataItem = new DataItem(Buffer.from('dummy'));

export const isTransaction = (tx: object): tx is Transaction => {
  try {
    const testTxKeys = Object.keys(dummyTransaction);
    const txKeys = Object.keys(tx);
    return txKeys.every((key) => testTxKeys.includes(key));
  } catch (error: unknown) {
    return false;
  }
};

export const isDataItem = (item: object): item is DataItem => {
  try {
    const testItemKeys = Object.keys(dummyDataItem);
    const itemKeys = Object.keys(item);
    return itemKeys.every((key) => testItemKeys.includes(key));
  } catch (error) {
    return false;
  }
};

export function tagsToObject(tags: Tag[]): {
  [x: string]: string;
} {
  return tags.reduce((decodedTags: { [x: string]: string }, tag) => {
    const key = tag.get('name', { decode: true, string: true });
    const value = tag.get('value', { decode: true, string: true });
    decodedTags[key] = value;
    return decodedTags;
  }, {});
}
