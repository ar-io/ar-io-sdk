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
import { createHash } from 'crypto';
import { Readable } from 'stream';

import { toB64Url } from './base64.js';

export const hashReadableToB64Url = (
  stream: Readable,
  algorithm = 'sha256',
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(toB64Url(hash.digest())));
    stream.on('error', (err) => reject(err));
  });
};

export const hashReadableStreamToB64Url = (
  stream: ReadableStream,
  algorithm = 'sha256',
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const reader = stream.getReader();
    const read = async () => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          resolve(toB64Url(hash.digest()));
        } else {
          hash.update(value);
          read();
        }
      } catch (err) {
        reject(err);
      }
    };
    read().catch(reject);
  });
};

export const hashBufferToB64Url = (
  buffer: Buffer,
  algorithm = 'sha256',
): string => {
  return toB64Url(createHash(algorithm).update(buffer).digest());
};
