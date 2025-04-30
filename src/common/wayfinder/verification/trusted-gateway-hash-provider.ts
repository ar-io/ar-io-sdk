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
import { DataHashProvider } from '../../../types/wayfinder.js';
import { GatewaysProvider } from '../gateways.js';

const arioGatewayHeaders = {
  digest: 'x-ar-io-digest',
  verified: 'x-ar-io-verified',
  txId: 'x-arns-resolved-tx-id',
  processId: 'x-arns-resolved-process-id',
};

export class TrustedGatewaysDigestProvider implements DataHashProvider {
  hashType: 'digest';
  private gatewaysProvider: GatewaysProvider;

  constructor({ gatewaysProvider }: { gatewaysProvider: GatewaysProvider }) {
    this.gatewaysProvider = gatewaysProvider;
  }

  /**
   * Gets the digest for a given txId from all trusted gateways and ensures they all match.
   * @param txId - The txId to get the digest for.
   * @returns The digest for the given txId.
   */
  async getHash({
    txId,
  }: {
    txId: string;
  }): Promise<{ hash: string; hashType: 'digest' | 'data-root' }> {
    // get the hash from every gateway, and ensure they all match
    const hashSet = new Set();
    const hashResults: { gateway: string; txIdHash: string }[] = [];
    const gateways = await this.gatewaysProvider.getGateways();
    const hashes = await Promise.all(
      gateways.map(async (gateway: URL): Promise<string> => {
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
    return { hash: hashResults[0].txIdHash, hashType: 'digest' };
  }
}

export class TrustedGatewaysDataRootProvider implements DataHashProvider {
  hashType: 'data-root';
  private gatewaysProvider: GatewaysProvider;

  constructor({ gatewaysProvider }: { gatewaysProvider: GatewaysProvider }) {
    this.gatewaysProvider = gatewaysProvider;
  }

  /**
   * Get the data root for a given txId from all trusted gateways and ensure they all match.
   * @param txId - The txId to get the data root for.
   * @returns The data root for the given txId.
   */
  async getHash({
    txId,
  }: {
    txId: string;
  }): Promise<{ hash: string; hashType: 'digest' | 'data-root' }> {
    const dataRootSet = new Set();
    const dataRootResults: { gateway: string; dataRoot: string }[] = [];
    const gateways = await this.gatewaysProvider.getGateways();
    const dataRoots = await Promise.all(
      gateways.map(async (gateway): Promise<string> => {
        const response = await fetch(`${gateway.toString()}tx/${txId}`);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch data root from gateway ${gateway.hostname}`,
          );
        }
        for (const [key, value] of response.headers.entries()) {
          console.log(`${key}: ${value}`);
        }
        const data = (await response.json()) as { data_root: string };
        dataRootResults.push({
          gateway: gateway.hostname,
          dataRoot: data.data_root,
        });
        return data.data_root;
      }),
    );

    for (const dataRoot of dataRoots) {
      dataRootSet.add(dataRoot);
    }

    if (dataRootSet.size > 1) {
      throw new Error(
        `Failed to get consistent data root from all trusted gateways. ${JSON.stringify(
          dataRootResults,
        )}`,
      );
    }

    return { hash: dataRootResults[0].dataRoot, hashType: 'data-root' };
  }
}
