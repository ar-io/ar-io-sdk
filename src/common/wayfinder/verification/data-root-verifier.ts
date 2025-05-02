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

import { DataRootProvider, DataVerifier } from '../../../types/wayfinder.js';
import {
  hashBufferToB64Url,
  hashReadableStreamToB64Url,
  hashReadableToB64Url,
} from '../../../utils/hash.js';

export class DataRootVerifier implements DataVerifier {
  private readonly trustedDataRootProvider: DataRootProvider;
  constructor({
    trustedDataRootProvider,
  }: {
    trustedDataRootProvider: DataRootProvider;
  }) {
    this.trustedDataRootProvider = trustedDataRootProvider;
  }
  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    const dataRoot = await this.trustedDataRootProvider.getDataRoot({ txId });
    // handle if buffer or readable or readable stream
    let computedDataRoot: string | undefined;
    if (Buffer.isBuffer(data)) {
      computedDataRoot = hashBufferToB64Url(data);
    } else if (data instanceof Readable) {
      computedDataRoot = await hashReadableToB64Url(data);
    } else if (data instanceof ReadableStream) {
      computedDataRoot = await hashReadableStreamToB64Url(data);
    }
    if (computedDataRoot === undefined) {
      throw new Error('Data root could not be computed');
    }
    if (computedDataRoot !== dataRoot) {
      throw new Error('Data root does not match', {
        cause: { computedDataRoot, trustedDataRoot: dataRoot },
      });
    }
  }
}

// some data item options
// compute and verify data root, use offsets from server and verify the signature that the data item at the offset matches the signature
// does not give you assurance of valid bundle, but gives verification that the data item itself is valid
// reading from offsets is the only way for the client to compute and verify the signature

// introduce a composite verifier that determines where/how to lookup the hash
