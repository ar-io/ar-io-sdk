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
import { b64UrlToBuffer } from 'arweave/node/lib/utils.js';
import { JWKInterface } from 'arweave/node/lib/wallet.js';

import { BlockHeight } from '../common.js';
import { ARWEAVE_TX_REGEX } from '../constants.js';

export const validateArweaveId = (id: string): boolean => {
  return ARWEAVE_TX_REGEX.test(id);
};

export function isBlockHeight(height: string | number): height is BlockHeight {
  return height !== undefined && !isNaN(parseInt(height.toString()));
}

export const isJwk = (obj: object): obj is JWKInterface => {
  let valid = true;
  ['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'].map(
    (key) => !(key in obj) && (valid = false),
  );
  const bufferOfN = b64UrlToBuffer(obj['n']);
  if (bufferOfN.length !== 512) {
    valid = false;
  }
  return valid;
};
