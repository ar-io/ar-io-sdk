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
import { Signer } from '@dha-team/arbundles';
import {
  dryrun,
  message,
  monitor,
  result,
  results,
  spawn,
  unmonitor,
} from '@permaweb/aoconnect';

import { AoSigner } from './token.js';

export type BlockHeight = number;
export type SortKey = string;
export type Timestamp = number;
export type WalletAddress = string;
export type TransactionId = string;
export type ProcessId = string;

// TODO: append this with other configuration options (e.g. local vs. remote evaluation)
export type ContractSigner = Signer | Window['arweaveWallet'] | AoSigner;
export type WithSigner<T = NonNullable<unknown>> = {
  signer: ContractSigner;
} & T; // TODO: optionally allow JWK in place of signer
export type OptionalSigner<T = NonNullable<unknown>> = {
  signer?: ContractSigner | undefined;
} & T;

export type ReadParameters<Input> = {
  functionName: string;
  inputs?: Input;
};

export type WriteOptions = {
  tags?: { name: string; value: string }[];
};

export type WriteParameters<Input> = WithSigner<
  Required<ReadParameters<Input>>
>;

export type AoMessageResult = { id: string };

export type AoPrimaryNameRequest = {
  name: string;
  initiator: WalletAddress;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
};

export type AoPrimaryName = {
  owner: WalletAddress;
  name: string;
  startTimestamp: Timestamp;
};

/**
 * Users are allowed one free redelegation every seven epochs. Each additional
 * redelegation increases the fee by 10%, capping at a 60% redelegation fee
 */
export type AoRedelegationFeeInfo = {
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

export interface AoClient {
  result: typeof result;
  results: typeof results;
  message: typeof message;
  spawn: typeof spawn;
  monitor: typeof monitor;
  unmonitor: typeof unmonitor;
  dryrun: typeof dryrun;
}

export interface AOContract {
  read<K>({
    tags,
    retries,
  }: {
    tags?: { name: string; value: string }[];
    retries?: number;
  }): Promise<K>;
  send<K>({
    tags,
    data,
    signer,
  }: {
    tags: { name: string; value: string }[];
    data: string | undefined;
    signer: AoSigner;
  }): Promise<{ id: string; result?: K }>;
}
