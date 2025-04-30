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
import {
  Chunk,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  buildLayers,
  generateLeaves,
} from 'arweave/node/lib/merkle.js';

import { DataRootProvider, DataVerifier } from '../../../types/wayfinder.js';

export async function convertBufferToDataRoot({
  data,
}: {
  data: Buffer;
}): Promise<string> {
  const chunks: Chunk[] = [];
  let cursor = 0;
  let offset = 0;

  while (offset < data.byteLength) {
    let chunkSize = Math.min(MAX_CHUNK_SIZE, data.byteLength - offset);

    const remainder = data.byteLength - offset - chunkSize;
    if (remainder > 0 && remainder < MIN_CHUNK_SIZE) {
      chunkSize = Math.ceil((data.byteLength - offset) / 2);
    }

    // subarray does not exist on web Buffer type
    const slice = data.slice(offset, offset + chunkSize);
    const hash = await crypto.subtle.digest('SHA-256', slice);
    const hashArray = new Uint8Array(hash);

    chunks.push({
      dataHash: hashArray,
      minByteRange: cursor,
      maxByteRange: cursor + chunkSize,
    });

    cursor += chunkSize;
    offset += chunkSize;
  }
  const leaves = await generateLeaves(chunks);
  const result = await buildLayers(leaves);

  return Buffer.from(result.id).toString('base64url');
}

// TODO: convert readable to data root

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
    data: Buffer;
    txId: string;
  }): Promise<void> {
    const dataRoot = await this.trustedDataRootProvider.getDataRoot({ txId });
    const computedDataRoot = await convertBufferToDataRoot({ data });
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
