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
import { ArNSPurchaseParams, BuyRecordParams } from './io.js';

export type BlockHeight = number;
export type SortKey = string;
export type Timestamp = number;
export type WalletAddress = string;
export type TransactionId = string;
export type ProcessId = string;

export type ReadParameters<Input> = {
  functionName: string;
  inputs?: Input;
};

export type WriteOptions<K extends string = string, T = unknown> = {
  tags?: { name: string; value: string }[];
  // generic type that can be used to pass any payload to the onSigningProgress callback
  onSigningProgress?: (name: K, payload: T) => void;
};

/**
 * Result envelope shared with the legacy AO message-pump shape. Solana
 * transactions surface their signature via `id` and may include a typed
 * `result` payload for handlers that return structured data.
 */
export type MessageResult<
  T = Record<string, string | number | boolean | null>,
> = {
  id: string;
  result?: T;
};

export type PrimaryNameRequest = {
  name: string;
  initiator: WalletAddress;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
};

export type CreatePrimaryNameRequest = {
  request: Omit<PrimaryNameRequest, 'initiator'> & {
    initiator: WalletAddress;
  };
  newPrimaryName: PrimaryName;
  baseNameOwner: WalletAddress;
  fundingPlan: Record<string, unknown>;
  fundingResult: Record<string, unknown>;
  demandFactor: Record<string, unknown>;
};

export type PrimaryName = {
  owner: WalletAddress;
  processId: ProcessId;
  name: string;
  startTimestamp: Timestamp;
};

/**
 * Users are allowed one free redelegation every seven epochs. Each additional
 * redelegation increases the fee by 10%, capping at a 60% redelegation fee
 */
export type RedelegationFeeInfo = {
  /** Percentage of redelegated stake that will be returned to the protocol on redelegation */
  redelegationFeeRate: number;
  /** Timestamp when the redelegation fee will reset to zero */
  feeResetTimestamp: number;
};

// Utility type to require at least one of the fields
export type AtLeastOne<
  T,
  U = { [K in keyof T]-?: Record<K, T[K]> },
> = Partial<T> & U[keyof U];

export interface HTTPClient {
  get<I, K>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
    params,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
    params?: object | I;
  }): Promise<K>;
}

export type SpawnAntProgressEvent = {
  'spawning-ant': {
    moduleId: string;
    antRegistryId: string;
    version: string | undefined;
    state: unknown;
  };
  'verifying-state': {
    processId: ProcessId;
    moduleId: string;
    antRegistryId: string;
  };
  'registering-ant': {
    antRegistryId: string;
    processId: ProcessId;
    owner: WalletAddress;
  };
};

export type UpgradeAntProgressEvent = SpawnAntProgressEvent & {
  'checking-version': {
    antProcessId: string;
    antRegistryId: string;
  };
  'fetching-affiliated-names': {
    arioProcessId: string;
    antProcessId: string;
  };
  'reassigning-name': {
    name: string;
    arioProcessId: string;
    antProcessId: string;
  };
  'validating-names': {
    arioProcessId: string;
    antProcessId: string;
    names: string[];
  };
  'failed-to-reassign-name': {
    name: string;
    arioProcessId: string;
    antProcessId: string;
    error?: Error;
  };
  'successfully-reassigned-name': {
    name: string;
    arioProcessId: string;
    antProcessId: string;
  };
};

export type BuyArNSNameProgressEvents = SpawnAntProgressEvent & {
  'buying-name': BuyRecordParams;
};

export type SetPrimaryNameProgressEvents = {
  'requesting-primary-name': ArNSPurchaseParams;
  'request-already-exists': {
    name: string;
    initiator: WalletAddress;
  };
  'approving-request': {
    request: PrimaryNameRequest;
    name: string;
    processId: ProcessId;
  };
};

/** utility type to ensure WriteOptions are appended to each parameter set */
export type WriteAction<
  P,
  R = MessageResult,
  K extends string = string,
  L = unknown,
> = (params: P, options?: WriteOptions<K, L>) => Promise<R>;

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };
