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
  AoAddressParams,
  AoArNSAuctionPricesParams,
  AoGetArNSNameParams,
  AoGetVaultParams,
  AoJoinNetworkParams,
  AoTokenCostParams,
  PaginationParams,
} from '../types/io.js';

export type GlobalOptions = {
  dev: boolean;
  debug: boolean;
  processId?: string;
};

export type WalletOptions = GlobalOptions & {
  walletFile?: string;
  // mnemonic?: string;
  privateKey?: string;
};

export type WriteActionOptions = WalletOptions & {
  tags?: string[];
  skipConfirmation?: boolean;
};

/**
 * Type helper to turn a set of parameters that have `number` types
 * into `string` types and makes all parameters optional.
 *
 * Intended to be used to represent how `commander` parsed out CLI options.
 * @example
 * ```ts
 * export type MyNewCommandOptions = CLIOptionsFromAoParams<MyNewAoMethodParams> & GlobalOptions;
 * ```
 */
export type CLIOptionsFromAoParams<T> = Partial<{
  [K in keyof T]: T[K] extends number ? string : T[K];
}>;

export type PaginationOptions = GlobalOptions &
  CLIOptionsFromAoParams<PaginationParams>;

export type AddressOptions = WalletOptions &
  CLIOptionsFromAoParams<AoAddressParams>;

export type InitiatorOptions = AddressOptions &
  CLIOptionsFromAoParams<{
    initiator: string;
  }>;

export type AddressAndNameOptions = WalletOptions &
  CLIOptionsFromAoParams<{
    address: string;
    name: string;
  }>;

export type EpochOptions = GlobalOptions &
  CLIOptionsFromAoParams<{
    epochIndex: number;
    timestamp: number;
  }>;

export type GetTokenCostOptions = GlobalOptions &
  CLIOptionsFromAoParams<AoTokenCostParams>;

export type AuctionPricesOptions = GlobalOptions &
  CLIOptionsFromAoParams<AoArNSAuctionPricesParams>;

export type PaginationAddressOptions = AddressOptions & PaginationOptions;

export type NameOptions = GlobalOptions &
  CLIOptionsFromAoParams<AoGetArNSNameParams>;

export type AddressAndVaultIdOptions =
  CLIOptionsFromAoParams<AoGetVaultParams> & WalletOptions;

export type GetVaultOptions = AddressAndVaultIdOptions;

export type VaultIdOptions = {
  vaultId?: string;
};

export type TransferOptions = WriteActionOptions & {
  quantity?: string;
  target?: string;
};

export type DelegateStakeOptions = TransferOptions;

export type RedelegateStakeOptions = TransferOptions & {
  source?: string;
  vaultId?: string;
};

export type OperatorStakeOptions = WriteActionOptions & {
  operatorStake?: string;
};

export type DecreaseDelegateStakeOptions = DelegateStakeOptions & {
  instant: boolean;
};

export type JoinNetworkOptions = WriteActionOptions &
  CLIOptionsFromAoParams<AoJoinNetworkParams>;

export type UpdateGatewaySettingsOptions = Omit<
  JoinNetworkOptions,
  'operatorStake'
>;

export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };
