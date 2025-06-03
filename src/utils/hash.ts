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
import { createHash } from 'crypto';

import { DataStream } from '../types/wayfinder.js';
import { toB64Url } from './base64.js';

export const isAsyncIterable = <T = unknown>(x: any): x is AsyncIterable<T> => {
  return x && typeof x[Symbol.asyncIterator] === 'function';
};

export const isReadableStream = <T = unknown>(
  x: any,
): x is ReadableStream<T> => {
  return x && typeof x.getReader === 'function';
};

// convert ReadableStream to async iterable
export const readableStreamToAsyncIterable = (
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> => ({
  async *[Symbol.asyncIterator]() {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value !== undefined) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  },
});

export const hashDataStreamToB64Url = async (
  stream: DataStream,
  algorithm = 'sha256',
): Promise<string> => {
  const asyncIterable = isAsyncIterable(stream)
    ? stream
    : readableStreamToAsyncIterable(stream);

  const hash = createHash(algorithm);
  for await (const chunk of asyncIterable) {
    hash.update(chunk);
  }
  return toB64Url(hash.digest());
};

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
