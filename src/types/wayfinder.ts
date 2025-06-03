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
export interface RoutingStrategy {
  // TODO: support providing path and subdomain, so our HEAD checks when selecting a gateway are more accurate
  selectGateway: ({ gateways }: { gateways: URL[] }) => Promise<URL>;
}

export interface GatewaysProvider {
  getGateways: () => Promise<URL[]>;
}

export type DataStream = AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>;
export interface DataVerificationStrategy {
  /**
   * Verifies the provided data for a given txId
   *
   * Depending on the implementation, the hash can be the computed data root of a transaction, the digest of the data, or some other hash of the data.
   *
   * The interface is intended to be vague in order to support various degrees of verification.
   *
   * @param data - The data to verify
   * @param txId - The txId of the data
   * @returns the hash of the data
   */
  verifyData: ({
    data,
    txId,
  }: {
    data: DataStream;
    txId: string;
  }) => Promise<void>;
}

export interface DataHashProvider {
  /**
   * Returns a hash for the provided txId using the specified algorithm.
   *
   * @param txId - The txId of the data
   * @returns the hash of the data
   */
  getHash: ({
    txId,
  }: {
    txId: string;
  }) => Promise<{ hash: string; algorithm: 'sha256' }>;
}

export interface DataRootProvider {
  /**
   * Returns the data root for the provided txId
   *
   * @param txId - The txId of the data
   * @returns the data root of the data
   */
  getDataRoot: ({ txId }: { txId: string }) => Promise<string>;
}
// TODO: add an offset provider that returns offsets for data items so we can use them to verify the signatures of a data item within a bundle
