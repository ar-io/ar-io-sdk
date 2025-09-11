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
  AoArNSNameParams,
  AoGetVaultParams,
  AoJoinNetworkParams,
  AoTokenCostParams,
  PaginationParams,
} from '../types/io.js';

export type SupportedCLITokenType = 'ethereum' | 'arweave';

export type WalletCLIOptions = {
  walletFile?: string;
  token?: SupportedCLITokenType;
  // mnemonic?: string;
  privateKey?: string;
};

export type GlobalCLIOptions = WalletCLIOptions & {
  devnet: boolean;
  testnet: boolean;
  mainnet: boolean;
  debug: boolean;
  arioProcessId?: string;
  antRegistryProcessId?: string;
  hyperbeamUrl?: string;
  cuUrl?: string;
  paymentUrl?: string;
};

export type WriteActionCLIOptions = GlobalCLIOptions & {
  tags?: string[];
  skipConfirmation?: boolean;
};

export type ProcessIdWriteActionCLIOptions = WriteActionCLIOptions & {
  processId?: string;
};

/**
 * A utility type to transform `number` properties in a type `T` to `string`
 * properties, while preserving arrays, objects, and other types.
 * Additionally, all properties are made optional.
 *
 * This type is intended to represent how `commander` parses CLI options,
 * where all values are strings, and nested objects are recursively processed.
 *
 * @example
 * ```ts
 * export type MyNewCommandOptions = CLIOptionsFromAoParams<MyNewAoMethodParams> & GlobalOptions;
 * ```
 */
export type CLIOptionsFromAoParams<T> = {
  // Iterate over each key in the type `T`.
  [K in keyof T]?: T[K] extends number | undefined // If the property is `number` or `number | undefined`, convert it to `string | undefined`.
    ? string | undefined
    : // If the property is a string-like type (string, boolean, symbol), convert it to `string`.
      T[K] extends string | boolean | symbol
      ? string
      : // If the property is an array, retain the array structure with its element types unchanged.
        T[K] extends ReadonlyArray<infer U>
        ? ReadonlyArray<U>
        : // If the property is an object, recursively apply the transformation to its properties.
          T[K] extends object
          ? CLIOptionsFromAoParams<T[K]>
          : // Otherwise, retain the property's original type.
            T[K];
};

export type CLIReadOptionsFromAoParams<T> = CLIOptionsFromAoParams<T> &
  GlobalCLIOptions;

export type CLIWriteOptionsFromAoParams<T> = WriteActionCLIOptions &
  CLIOptionsFromAoParams<T>;

export type CLIWriteOptionsFromAoAntParams<T> = CLIWriteOptionsFromAoParams<
  T & { processId: string }
>;

export type PaginationCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<PaginationParams>;

export type AddressCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<AoAddressParams>;

export type ProcessIdCLIOptions = GlobalCLIOptions & {
  processId?: string;
};

export type InitiatorCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<{
    initiator: string;
  }>;

export type AddressAndNameCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<{
    address: string;
    name: string;
  }>;

export type EpochCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<{
    epochIndex: number;
    timestamp: number;
  }>;

export type GetTokenCostCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<AoTokenCostParams>;

export type PaginationAddressCLIOptions = AddressCLIOptions &
  PaginationCLIOptions;

export type NameCLIOptions = GlobalCLIOptions &
  CLIOptionsFromAoParams<AoArNSNameParams>;
export type NameWriteCLIOptions = WriteActionCLIOptions & NameCLIOptions;

export type AddressAndVaultIdCLIOptions =
  CLIOptionsFromAoParams<AoGetVaultParams> & GlobalCLIOptions;

export type AddressAndVaultIdCLIWriteOptions = WriteActionCLIOptions &
  AddressAndVaultIdCLIOptions;

export type TransferCLIOptions = WriteActionCLIOptions & {
  quantity?: string;
  target?: string;
};

export type JoinNetworkCLIOptions = WriteActionCLIOptions &
  CLIOptionsFromAoParams<AoJoinNetworkParams>;

export type UpdateGatewaySettingsCLIOptions = Omit<
  JoinNetworkCLIOptions,
  'operatorStake'
>;

export type DelegateStakeCLIOptions = TransferCLIOptions;

export type RedelegateStakeCLIOptions = TransferCLIOptions & {
  source?: string;
  vaultId?: string;
};

export type OperatorStakeCLIOptions = WriteActionCLIOptions & {
  operatorStake?: string;
};

export type DecreaseDelegateStakeCLIOptions = DelegateStakeCLIOptions & {
  instant: boolean;
};

export type ANTStateCLIOptions = WriteActionCLIOptions & {
  target?: string;
  keywords?: string[];
  ticker?: string;
  name?: string;
  description?: string;
  controllers?: string[];
  ttlSeconds?: string;
  logo?: string;
  module?: string;
};

export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };
