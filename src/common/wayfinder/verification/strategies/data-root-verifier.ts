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
import {
  Chunk,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  buildLayers,
  generateLeaves,
} from 'arweave/node/lib/merkle.js';

import {
  DataRootProvider,
  DataStream,
  DataVerificationStrategy,
} from '../../../../types/wayfinder.js';
import { toB64Url } from '../../../../utils/base64.js';
import {
  isAsyncIterable,
  readableStreamToAsyncIterable,
} from '../../../../utils/hash.js';

export const convertDataStreamToDataRoot = async ({
  dataStream,
}: {
  dataStream: DataStream;
}): Promise<string> => {
  const chunks: Chunk[] = [];
  let leftover = new Uint8Array(0);
  let cursor = 0;

  const asyncIterable = isAsyncIterable(dataStream)
    ? dataStream
    : readableStreamToAsyncIterable(dataStream);

  for await (const data of asyncIterable) {
    const inputChunk = new Uint8Array(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    const combined = new Uint8Array(leftover.length + inputChunk.length);
    combined.set(leftover, 0);
    combined.set(inputChunk, leftover.length);

    let startIndex = 0;
    while (combined.length - startIndex >= MAX_CHUNK_SIZE) {
      let chunkSize = MAX_CHUNK_SIZE;
      const remainderAfterThis = combined.length - startIndex - MAX_CHUNK_SIZE;
      if (remainderAfterThis > 0 && remainderAfterThis < MIN_CHUNK_SIZE) {
        chunkSize = Math.ceil((combined.length - startIndex) / 2);
      }

      const chunkData = combined.slice(startIndex, startIndex + chunkSize);
      const dataHash = await Arweave.crypto.hash(chunkData);

      chunks.push({
        dataHash,
        minByteRange: cursor,
        maxByteRange: cursor + chunkSize,
      });

      cursor += chunkSize;
      startIndex += chunkSize;
    }

    leftover = combined.slice(startIndex);
  }

  if (leftover.length > 0) {
    // TODO: ensure a web friendly crypto hash function is used in web
    const dataHash = await Arweave.crypto.hash(leftover);
    chunks.push({
      dataHash,
      minByteRange: cursor,
      maxByteRange: cursor + leftover.length,
    });
  }

  const leaves = await generateLeaves(chunks);
  const root = await buildLayers(leaves);
  return toB64Url(Buffer.from(root.id));
};

export class DataRootVerificationStrategy implements DataVerificationStrategy {
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
    data: DataStream;
    txId: string;
  }): Promise<void> {
    const [computedDataRoot, trustedDataRoot] = await Promise.all([
      convertDataStreamToDataRoot({
        dataStream: data,
      }),
      this.trustedDataRootProvider.getDataRoot({
        txId,
      }),
    ]);
    if (computedDataRoot !== trustedDataRoot) {
      throw new Error('Data root does not match', {
        cause: { computedDataRoot, trustedDataRoot },
      });
    }
  }
}
// some data item options
// compute and verify data root, use offsets from server and verify the signature that the data item at the offset matches the signature
// does not give you assurance of valid bundle, but gives verification that the data item itself is valid
// reading from offsets is the only way for the client to compute and verify the signature
/**
 * - when you get a signature of a data item, you can only verify the owner
 * - you still need to verify it's going back to the bundle, unpack it, and verify the data item exists at the offset
 * - you need to the location of the chunks for the data item, and prove it's in the chunk and then prove the data root of the bundle, then you have fully verified the data verifier
 * - how to prove the data item is on arweave - verify the merkle hash that the chunks for the data item, fit within the expected tree of the parent bundle
 *
 * Composite verifier - you'll want to be very efficient with streams
 * - hash verifier
 * - parent chunks verifier --> for any range of data within a single transaction, tell me that it's correct
 * - signature verifier
 * - offset verifier
 * - data item verifier
 */
// introduce a composite verifier that determines where/how to lookup the hash
