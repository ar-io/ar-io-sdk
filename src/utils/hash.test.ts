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

import {
  hashBufferToB64Url,
  hashReadableStreamToB64Url,
  hashReadableToB64Url,
} from './hash.js';

describe('hashReadableToB64Url', () => {
  it('should hash a readable stream correctly', async () => {
    const testData = 'test data';
    const stream = Readable.from([testData]);

    const result = await hashReadableToB64Url(stream);

    // SHA-256 hash of 'test data' encoded as base64url
    const expectedHash = 'kW8AJ6V1B0znKjMXd8NHjWUT94alkb2JLaGld78jNfk';
    assert.equal(result, expectedHash);
  });

  it('should hash a readable stream with a different algorithm', async () => {
    const testData = 'test data';
    const stream = Readable.from([testData]);

    const result = await hashReadableToB64Url(stream, 'sha512');

    // SHA-512 hash of 'test data' encoded as base64url
    const expectedHash =
      'Dh4h7PEF7IU9JNcohnrXBhPCFmOkaTB0sqNhnBvTnWa1iMM3I7tGbHJCToDjymPCSQeKs0e6uUKFAOfuQwWdDQ';
    assert.equal(result, expectedHash);
  });

  it('should work with empty data', async () => {
    const stream = Readable.from(['']);

    const result = await hashReadableToB64Url(stream);

    // SHA-256 hash of empty string encoded as base64url
    const expectedHash = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU';
    assert.equal(result, expectedHash);
  });

  it('should work with multiple chunks', async () => {
    const chunks = ['chunk1', 'chunk2', 'chunk3'];
    const stream = Readable.from(chunks);

    const result = await hashReadableToB64Url(stream);

    // SHA-256 hash of 'chunk1chunk2chunk3' encoded as base64url
    const expectedHash = 'v-CLQeRXfUn7d10dvGnS20KbzsIJ5GNzcM2I8tbJZGk';
    assert.equal(result, expectedHash);
  });
});

describe('hashBufferToB64Url', () => {
  it('should hash a buffer correctly', () => {
    const buffer = Buffer.from('test data');

    const result = hashBufferToB64Url(buffer);

    // SHA-256 hash of 'test data' encoded as base64url
    const expectedHash = 'kW8AJ6V1B0znKjMXd8NHjWUT94alkb2JLaGld78jNfk';
    assert.equal(result, expectedHash);
  });

  it('should hash a buffer with a different algorithm', () => {
    const buffer = Buffer.from('test data');

    const result = hashBufferToB64Url(buffer, 'sha512');

    // SHA-512 hash of 'test data' encoded as base64url
    const expectedHash =
      'Dh4h7PEF7IU9JNcohnrXBhPCFmOkaTB0sqNhnBvTnWa1iMM3I7tGbHJCToDjymPCSQeKs0e6uUKFAOfuQwWdDQ';
    assert.equal(result, expectedHash);
  });

  it('should work with empty buffer', () => {
    const buffer = Buffer.from('');

    const result = hashBufferToB64Url(buffer);

    // SHA-256 hash of empty string encoded as base64url
    const expectedHash = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU';
    assert.equal(result, expectedHash);
  });
});

describe('hashReadableStreamToB64Url', () => {
  it('should hash a ReadableStream correctly', async () => {
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

    const result = await hashReadableStreamToB64Url(stream);

    // SHA-256 hash of 'test data' encoded as base64url
    const expectedHash = 'kW8AJ6V1B0znKjMXd8NHjWUT94alkb2JLaGld78jNfk';
    assert.equal(result, expectedHash);
  });

  it('should hash a ReadableStream with a different algorithm', async () => {
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

    const result = await hashReadableStreamToB64Url(stream, 'sha512');

    // SHA-512 hash of 'test data' encoded as base64url
    const expectedHash =
      'Dh4h7PEF7IU9JNcohnrXBhPCFmOkaTB0sqNhnBvTnWa1iMM3I7tGbHJCToDjymPCSQeKs0e6uUKFAOfuQwWdDQ';
    assert.equal(result, expectedHash);
  });

  it('should work with empty ReadableStream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const result = await hashReadableStreamToB64Url(stream);

    // SHA-256 hash of empty string encoded as base64url
    const expectedHash = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU';
    assert.equal(result, expectedHash);
  });

  it('should work with multiple chunks in ReadableStream', async () => {
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

    const result = await hashReadableStreamToB64Url(stream);

    // SHA-256 hash of 'chunk1chunk2chunk3' encoded as base64url
    const expectedHash = 'v-CLQeRXfUn7d10dvGnS20KbzsIJ5GNzcM2I8tbJZGk';
    assert.equal(result, expectedHash);
  });
});
