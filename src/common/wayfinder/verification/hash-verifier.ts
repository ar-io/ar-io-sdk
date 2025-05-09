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
import { Readable } from 'node:stream';

import { DataHashProvider, DataVerifier } from '../../../types/wayfinder.js';
import {
  hashBufferToB64Url,
  hashReadableStreamToB64Url,
  hashReadableToB64Url,
} from '../../../utils/hash.js';

export class HashVerifier implements DataVerifier {
  private readonly trustedHashProvider: DataHashProvider;
  constructor({
    trustedHashProvider,
  }: {
    trustedHashProvider: DataHashProvider;
  }) {
    this.trustedHashProvider = trustedHashProvider;
  }
  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    const { hash } = await this.trustedHashProvider.getHash({ txId });
    let computedHash: string | undefined;
    if (Buffer.isBuffer(data)) {
      computedHash = hashBufferToB64Url(data);
    } else if (data instanceof Readable) {
      computedHash = await hashReadableToB64Url(data);
    } else if (data instanceof ReadableStream) {
      computedHash = await hashReadableStreamToB64Url(data);
    }
    if (computedHash === undefined) {
      throw new Error('Hash could not be computed');
    }
    if (computedHash !== hash) {
      throw new Error('Hash does not match', {
        cause: { computedHash, trustedHash: hash },
      });
    }
  }
}
