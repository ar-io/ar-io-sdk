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
export interface B64uTag {
  name: string;
  value: string;
}

// yoinked from https://github.com/ar-io/ar-io-node/blob/6c29438d85b9853497af5a2501875f390d5ef54e/src/types.d.ts#L626
export interface MatchableItem {
  id?: string;
  signature?: string | null;
  owner?: string;
  owner_address?: string;
  target?: string;
  quantity?: string;
  tags: B64uTag[];
  height?: number;
  txs?: string[];
  reward_addr?: string;
  parent_id?: string | null;
}

export type ANS104Filter = {
  never?: boolean;
  always?: boolean;
  attributes?: MatchableItem;
  tags?: B64uTag[];
  and?: ANS104Filter[];
  or?: ANS104Filter[];
  not?: ANS104Filter[];
};

// determines which TXs and data items (in the case of nested bundles) are unbundled
export type ANS104UnbundleFilter = ANS104Filter;

// determines which data items within a bundle get indexed.
export type ANS104IndexFilter = ANS104Filter;

export type ArIOGatewayObserverInfo = {
  wallet: string;
  processId: string;
};

export type ArIOGatewayInfo = {
  wallet: string;
  processId: string;
  ans104UnbundleFilter: ANS104UnbundleFilter;
  ans104IndexFilter: ANS104IndexFilter;
  supportedManifestVersions: string[];
  release: string;
};

export type ArIOGatewayHealthCheck = {
  uptime: number;
  message: string;
  date: string;
};

export type ArIOGatewayObserverArNSDomainAssessment = {
  assessedAt: number;
  expectedId: string | null;
  resolvedId: string | null;
  expectedDataHash: string | null;
  resolvedDataHash: string | null;
  failureReason: string;
  pass: boolean;
};
export type ArIOGatewayObserverGatewayAssessment = {
  ownershipAssessment: {
    expectedWallets: string[];
    observedWallet: string | null;
    failureReason: string;
    pass: boolean;
  };
  arnsAssessments: Record<string, ArIOGatewayObserverArNSDomainAssessment>;
  pass: boolean;
};

export type ArIOGatewayCurrentObserverReports = {
  formatVersion: number;
  observerAddress: string;
  epochIndex: number;
  epochStartTimestamp: number;
  epochStartHeight: number;
  epochEndTimestamp: number;
  generatedAt: number;
  gatewayAssessments: Record<string, ArIOGatewayObserverGatewayAssessment>;
};

export type ArIOGatewayArNSDomainResolution = {
  txId: string;
  ttlSeconds: number;
  processId: string;
  resolvedAt: number;
};

export interface ArIOGateway {
  healthCheck: () => Promise<ArIOGatewayHealthCheck>;
  info: () => Promise<ArIOGatewayInfo>;
  observerInfo: () => Promise<ArIOGatewayObserverInfo>;
  currentObserverReports: () => Promise<ArIOGatewayCurrentObserverReports>;
  resolveArNSDomain: (
    arnsDomain: string,
  ) => Promise<ArIOGatewayArNSDomainResolution>;
  /**
   * Future considerations:
   * graphql: (query: string) => Promise<any>;
   * getTx: (txId: string) => Promise<any>;
   * getData: (txId: string) => Promise<any>;
   *
   * admin, farcaster
   */
}
