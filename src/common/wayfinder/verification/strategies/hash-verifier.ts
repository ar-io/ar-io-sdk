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
  DataHashProvider,
  DataStream,
  DataVerificationStrategy,
} from '../../../../types/wayfinder.js';
import { hashDataStreamToB64Url } from '../../../../utils/hash.js';

export class HashVerificationStrategy implements DataVerificationStrategy {
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
    data: DataStream;
    txId: string;
  }): Promise<void> {
    // kick off the hash computation, but don't wait for it until we compute our own hash
    const [computedHash, fetchedHash] = await Promise.all([
      hashDataStreamToB64Url(data),
      this.trustedHashProvider.getHash({ txId }),
    ]);
    // await on the hash promise and compare to get a little concurrency when computing hashes over larger data
    if (computedHash === undefined) {
      throw new Error('Hash could not be computed');
    }
    if (computedHash !== fetchedHash.hash) {
      throw new Error('Hash does not match', {
        cause: { computedHash, trustedHash: fetchedHash },
      });
    }
  }
}
