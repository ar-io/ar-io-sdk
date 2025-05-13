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
  DataRootProvider,
} from '../../../types/wayfinder.js';
import { GatewaysProvider } from '../gateways.js';

const arioGatewayHeaders = {
  digest: 'x-ar-io-digest',
  verified: 'x-ar-io-verified',
  txId: 'x-arns-resolved-tx-id',
  processId: 'x-arns-resolved-process-id',
};

export class TrustedGatewaysHashProvider
  implements DataHashProvider, DataRootProvider
{
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
  }): Promise<{ hash: string; algorithm: 'sha256' }> {
    // get the hash from every gateway, and ensure they all match
    const hashSet = new Set();
    const hashResults: { gateway: string; txIdHash: string }[] = [];
    const gateways = await this.gatewaysProvider.getGateways();
    const hashes = await Promise.all(
      gateways.map(async (gateway: URL): Promise<string | undefined> => {
        const response = await fetch(`${gateway.toString()}${txId}`, {
          method: 'HEAD',
          redirect: 'follow',
        });

        if (!response.ok) {
          // skip this gateway
          return undefined;
        }

        const txIdHash = response.headers.get(arioGatewayHeaders.digest);

        if (txIdHash === null || txIdHash === undefined) {
          // skip this gateway
          return undefined;
        }

        hashResults.push({
          gateway: gateway.hostname,
          txIdHash,
        });

        return txIdHash;
      }),
    );

    for (const hash of hashes) {
      if (hash !== undefined) {
        hashSet.add(hash);
      }
    }

    if (hashSet.size === 0) {
      throw new Error(`No trusted gateways found for txId ${txId}`);
    }

    if (hashSet.size > 1) {
      throw new Error(
        `Failed to get consistent hash from all trusted gateways. ${JSON.stringify(
          hashResults,
        )}`,
      );
    }
    return { hash: hashResults[0].txIdHash, algorithm: 'sha256' };
  }

  /**
   * Get the data root for a given txId from all trusted gateways and ensure they all match.
   * @param txId - The txId to get the data root for.
   * @returns The data root for the given txId.
   */
  async getDataRoot({ txId }: { txId: string }): Promise<string> {
    const dataRootSet = new Set();
    const dataRootResults: { gateway: string; dataRoot: string }[] = [];
    const gateways = await this.gatewaysProvider.getGateways();
    const dataRoots = await Promise.all(
      gateways.map(async (gateway): Promise<string | undefined> => {
        const response = await fetch(
          `${gateway.toString()}tx/${txId}/data_root`,
        );
        if (!response.ok) {
          // skip this gateway
          return undefined;
        }
        const dataRoot = await response.text();
        dataRootResults.push({
          gateway: gateway.hostname,
          dataRoot,
        });
        return dataRoot;
      }),
    );

    for (const dataRoot of dataRoots) {
      if (dataRoot !== undefined) {
        dataRootSet.add(dataRoot);
      }
    }

    if (dataRootSet.size > 1) {
      throw new Error(
        `Failed to get consistent data root from all trusted gateways. ${JSON.stringify(
          dataRootResults,
        )}`,
      );
    }

    return dataRootSet.values().next().value as string;
  }
}

// client could check hashes of data items, match expected hash
// if the gateway has the hash and they've verified it, you can trust the data item and offset
// you would be only trusting the gateway that it is a valid bundle
// you can request the offset from the gateway to verify the id
