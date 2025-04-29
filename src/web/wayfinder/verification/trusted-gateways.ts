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
import { DataVerifier } from '../../../types/index.js';

const toB64Url = (buffer: ArrayBuffer) => {
  // Convert string to base64url using native browser btoa() and URL-safe character replacements
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

export class WebDigestVerifier implements DataVerifier {
  async verifyData({
    data,
    hash,
  }: {
    data: Buffer;
    hash: string;
  }): Promise<void> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const computedHash = toB64Url(hashBuffer);
    if (computedHash !== hash) {
      throw new Error('Hash does not match', {
        cause: { computedHash, providedHash: hash },
      });
    }
  }
}
