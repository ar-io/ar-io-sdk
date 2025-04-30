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
import { DataHashProvider, DataVerifier } from '../../../types/wayfinder.js';

const arioGatewayHeaders = {
  digest: 'x-ar-io-digest',
  verified: 'x-ar-io-verified',
  txId: 'x-arns-resolved-tx-id',
  processId: 'x-arns-resolved-process-id',
};

export class TrustedGatewaysHashProvider implements DataHashProvider {
  private trustedGateways: URL[];

  constructor({ trustedGateways }: { trustedGateways: URL[] }) {
    this.trustedGateways = trustedGateways;
  }

  async getHash({ txId }: { txId: string }): Promise<string> {
    // get the hash from every gateway, and ensure they all match
    const hashSet = new Set();
    const hashResults: { gateway: string; txIdHash: string }[] = [];
    const hashes = await Promise.all(
      this.trustedGateways.map(async (gateway): Promise<string> => {
        const response = await fetch(`${gateway.toString()}${txId}`, {
          method: 'HEAD',
          redirect: 'follow',
        });

        if (!response.ok) {
          throw new Error('TxId is not trusted');
        }

        const txIdHash = response.headers.get(arioGatewayHeaders.digest);

        if (txIdHash === null || txIdHash === undefined) {
          throw new Error(
            `TxId hash not found for gateway ${gateway.hostname}`,
          );
        }

        hashResults.push({
          gateway: gateway.hostname,
          txIdHash,
        });

        return txIdHash;
      }),
    );

    for (const hash of hashes) {
      hashSet.add(hash);
    }

    if (hashSet.size > 1) {
      throw new Error(
        `Failed to get consistent hash from all trusted gateways. ${JSON.stringify(
          hashResults,
        )}`,
      );
    }
    return hashResults[0].txIdHash;
  }
}

/**
 * A lightweight data verifier that computes a digest of the provided data and compares it to a provided hash.
 *
 * This does not include any merkle tree verification or data root comparison.
 */
export class DigestVerifier implements DataVerifier {
  async verifyData({
    data,
    hash,
  }: {
    data: Buffer;
    hash: string;
  }): Promise<void> {
    // use the same algo to compute the digest of the data
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const computedHash = Buffer.from(hashBuffer).toString('base64url');
    if (computedHash !== hash) {
      throw new Error('Hash does not match', {
        cause: { computedHash, trustedHash: hash },
      });
    }
  }
}
