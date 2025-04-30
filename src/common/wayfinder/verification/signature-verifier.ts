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
import { DataItem } from '@dha-team/arbundles';

import { DataVerifier } from '../../../types/wayfinder.js';

export class DataItemVerifier implements DataVerifier {
  async verifyData({
    data,
    txId,
  }: {
    data: Buffer;
    txId: string;
  }): Promise<void> {
    const isDataItem = await DataItem.isDataItem(data);
    if (isDataItem) {
      const dataItem = new DataItem(data);
      const verified = await DataItem.verify(data);
      if (!verified) {
        throw new Error('Data item is not valid');
      }
      if (dataItem.id !== txId) {
        throw new Error('Data item ID does not match transaction ID');
      }
    } else {
      // its an L1, so we need to verify the signature
      throw new Error('Data item is not a data item');
    }
  }
}
