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
  ArconnectSigner,
  ArweaveSigner,
  EthereumSigner,
  InjectedEthereumSigner,
  Signer,
} from '@dha-team/arbundles';
import {
  dryrun,
  message,
  monitor,
  result,
  results,
  spawn,
  unmonitor,
} from '@permaweb/aoconnect';
import Arweave from 'arweave';

import { AoSigner } from './token.js';

export type BlockHeight = number;
export type SortKey = string;
export type Timestamp = number;
export type WalletAddress = string;
export type TransactionId = string;
export type ProcessId = string;
export type OptionalArweave<T = NonNullable<unknown>> = {
  arweave?: Arweave;
} & T;
export type OptionalPaymentUrl<T = NonNullable<unknown>> = {
  paymentUrl?: string;
} & T;
// TODO: TurboArNSSigner could be simply `Signer` but we need to implement each message signing method for signing headers.
export type TurboArNSSigner =
  | EthereumSigner
  | InjectedEthereumSigner
  | ArweaveSigner
  | ArconnectSigner
  | Window['arweaveWallet'];
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

export type WriteOptions<K extends string = string, T = unknown> = {
  tags?: { name: string; value: string }[];
  // generic type that can be used to pass any payload to the onSigningProgress callback
  onSigningProgress?: (name: K, payload: T) => void;
};

export type WriteParameters<Input> = WithSigner<
  Required<ReadParameters<Input>>
>;

export type AoMessageResult<
  T = Record<string, string | number | boolean | null>,
> = {
  id: string;
  result?: T;
};

export type AoPrimaryNameRequest = {
  name: string;
  initiator: WalletAddress;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
};

export type AoPrimaryName = {
  owner: WalletAddress;
  processId: ProcessId;
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

export type SpawnAntProgressEvent = {
  'spawning-ant': {
    moduleId: string;
    antRegistryId: string;
  };
  'registering-ant': {
    antRegistryId: string;
    processId: ProcessId;
    owner: WalletAddress;
  };
  'verifying-state': {
    processId: ProcessId;
    moduleId: string;
    antRegistryId: string;
  };
};

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

/** utility type to ensure WriteOptions are appended to each parameter set */
export type AoWriteAction<P, R = AoMessageResult> = (
  params: P,
  options?: WriteOptions,
) => Promise<R>;

// the following are from @permaweb/aoconnect which does not export these types directly
export type DryRunResult = {
  Output: any;
  Messages: any[];
  Spawns: any[];
  Error?: any;
};
export type MessageResult = {
  Output: any;
  Messages: any[];
  Spawns: any[];
  Error?: any;
};
