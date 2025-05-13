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
import { Readable } from 'node:stream';

import { DataRootProvider, DataVerifier } from '../../../types/wayfinder.js';
import { toB64Url } from '../../../utils/base64.js';

export async function convertBufferToDataRoot({
  buffer,
}: {
  buffer: Buffer;
}): Promise<string> {
  const chunks: Chunk[] = [];
  let cursor = 0;
  let offset = 0;

  while (offset < buffer.byteLength) {
    let chunkSize = Math.min(MAX_CHUNK_SIZE, buffer.byteLength - offset);

    const remainder = buffer.byteLength - offset - chunkSize;
    if (remainder > 0 && remainder < MIN_CHUNK_SIZE) {
      chunkSize = Math.ceil((buffer.byteLength - offset) / 2);
    }

    // subarray does not exist on web Buffer type
    const slice = buffer.subarray(offset, offset + chunkSize);
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

export const convertReadableToDataRoot = async <
  T extends AsyncIterable<Uint8Array>,
>({
  iterable,
}: {
  iterable: T;
}): Promise<string> => {
  const chunks: Chunk[] = [];
  let leftover = new Uint8Array(0);
  let cursor = 0;

  for await (const data of iterable) {
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
    const trustedDataRootPromise = this.trustedDataRootProvider.getDataRoot({
      txId,
    });
    let computedDataRoot: string | undefined;
    if (Buffer.isBuffer(data)) {
      computedDataRoot = await convertBufferToDataRoot({ buffer: data });
    } else if (data instanceof Readable || data instanceof ReadableStream) {
      computedDataRoot = await convertReadableToDataRoot({ iterable: data });
    }
    if (computedDataRoot === undefined) {
      throw new Error('Data root could not be computed');
    }
    const trustedDataRoot = await trustedDataRootPromise;
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
