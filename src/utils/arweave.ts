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
import Arweave from 'arweave';

import { ARWEAVE_TX_REGEX } from '../constants.js';
import { BlockHeight, Timestamp } from '../types/common.js';

export const validateArweaveId = (id: string): boolean => {
  return ARWEAVE_TX_REGEX.test(id);
};

export function isBlockHeight(height: string | number): height is BlockHeight {
  return height !== undefined && !isNaN(parseInt(height.toString()));
}

export const pruneTags = (
  tags: { name: string; value: string | undefined }[],
): { name: string; value: string }[] => {
  return tags.filter(
    (tag: {
      name: string;
      value: string | undefined;
    }): tag is { name: string; value: string } => tag.value !== undefined,
  );
};

export const getCurrentBlockUnixTimestamp = async (
  arweave: Arweave,
): Promise<Timestamp> => {
  return await arweave.blocks
    .getCurrent()
    .then((block) => {
      return block.timestamp * 1000;
    })
    .catch(() => {
      return Date.now(); // fallback to current time
    });
};
