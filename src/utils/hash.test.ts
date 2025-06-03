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
import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

import { hashDataStreamToB64Url } from './hash.js';

describe('hashDataStreamToB64Url', { timeout: 5000 }, () => {
  // Test with Readable stream (Node.js)
  it('should hash a Node.js Readable stream correctly', async () => {
    const testData = 'test data';
    const stream = Readable.from([testData]);

    const result = await hashDataStreamToB64Url(stream);

    // SHA-256 hash of 'test data' encoded as base64url
    const expectedHash = 'kW8AJ6V1B0znKjMXd8NHjWUT94alkb2JLaGld78jNfk';
    assert.equal(result, expectedHash);
  });

  it('should hash a Node.js Readable stream with a different algorithm', async () => {
    const testData = 'test data';
    const stream = Readable.from([testData]);

    const result = await hashDataStreamToB64Url(stream, 'sha512');

    // SHA-512 hash of 'test data' encoded as base64url
    const expectedHash =
      'Dh4h7PEF7IU9JNcohnrXBhPCFmOkaTB0sqNhnBvTnWa1iMM3I7tGbHJCToDjymPCSQeKs0e6uUKFAOfuQwWdDQ';
    assert.equal(result, expectedHash);
  });

  it('should work with empty Readable stream', async () => {
    const stream = Readable.from(['']);

    const result = await hashDataStreamToB64Url(stream);

    // SHA-256 hash of empty string encoded as base64url
    const expectedHash = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU';
    assert.equal(result, expectedHash);
  });

  it('should work with multiple chunks in Readable stream', async () => {
    const chunks = ['chunk1', 'chunk2', 'chunk3'];
    const stream = Readable.from(chunks);

    const result = await hashDataStreamToB64Url(stream);

    // SHA-256 hash of 'chunk1chunk2chunk3' encoded as base64url
    const expectedHash = 'v-CLQeRXfUn7d10dvGnS20KbzsIJ5GNzcM2I8tbJZGk';
    assert.equal(result, expectedHash);
  });

  // Test with Web ReadableStream
  it('should hash a Web ReadableStream correctly', async () => {
    // Create a ReadableStream from a string
    const testData = 'test data';
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(testData);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });

    const result = await hashDataStreamToB64Url(stream);

    // SHA-256 hash of 'test data' encoded as base64url
    const expectedHash = 'kW8AJ6V1B0znKjMXd8NHjWUT94alkb2JLaGld78jNfk';
    assert.equal(result, expectedHash);
  });

  it('should hash a Web ReadableStream with a different algorithm', async () => {
    // Create a ReadableStream from a string
    const testData = 'test data';
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(testData);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });

    const result = await hashDataStreamToB64Url(stream, 'sha512');

    // SHA-512 hash of 'test data' encoded as base64url
    const expectedHash =
      'Dh4h7PEF7IU9JNcohnrXBhPCFmOkaTB0sqNhnBvTnWa1iMM3I7tGbHJCToDjymPCSQeKs0e6uUKFAOfuQwWdDQ';
    assert.equal(result, expectedHash);
  });

  it('should work with empty Web ReadableStream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const result = await hashDataStreamToB64Url(stream);

    // SHA-256 hash of empty string encoded as base64url
    const expectedHash = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU';
    assert.equal(result, expectedHash);
  });

  it('should work with multiple chunks in Web ReadableStream', async () => {
    const encoder = new TextEncoder();
    const chunks = ['chunk1', 'chunk2', 'chunk3'].map((chunk) =>
      encoder.encode(chunk),
    );

    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

    const result = await hashDataStreamToB64Url(stream);

    // SHA-256 hash of 'chunk1chunk2chunk3' encoded as base64url
    const expectedHash = 'v-CLQeRXfUn7d10dvGnS20KbzsIJ5GNzcM2I8tbJZGk';
    assert.equal(result, expectedHash);
  });

  // Test with large data to ensure streaming works correctly
  it('should correctly hash large streams in chunks', async () => {
    // Create a large string (1MB)
    const largeString = 'a'.repeat(1024 * 1024);

    // Test with Node.js Readable
    const nodeStream = Readable.from([largeString]);
    const nodeResult = await hashDataStreamToB64Url(nodeStream);

    // Known hash of 1MB of 'a' characters
    const expectedHash = 'm8GyooiyavclejYneuOBan1PFuicHn530KXEi61is2A';
    assert.equal(nodeResult, expectedHash);

    // Test with Web ReadableStream
    const encoder = new TextEncoder();
    // Create chunks to simulate streaming
    const chunkSize = 64 * 1024; // 64KB chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < largeString.length; i += chunkSize) {
      chunks.push(encoder.encode(largeString.substring(i, i + chunkSize)));
    }

    const webStream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

    const webResult = await hashDataStreamToB64Url(webStream);
    assert.equal(webResult, expectedHash);
  });
});
