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
import { JWKInterface } from 'arweave/node/lib/wallet.js';
import { Command, OptionValues, program } from 'commander';
import { readFileSync } from 'fs';

import {
  AoIORead,
  AoIOWrite,
  ArweaveSigner,
  ContractSigner,
  IO,
  IOToken,
  IO_DEVNET_PROCESS_ID,
  IO_TESTNET_PROCESS_ID,
  Logger,
  fromB64Url,
  sha256B64Url,
} from '../node/index.js';
import {
  AddressOptions,
  GlobalOptions,
  NameOptions,
  WalletOptions,
} from './options.js';

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

type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };

function logCommandOutput(output: JsonSerializable) {
  console.log(JSON.stringify(output, null, 2));
}

function exitWithErrorLog(error: unknown, debug = false) {
  let errorLog: string;
  if (error instanceof Error) {
    errorLog = error.message;
    if (debug) {
      errorLog += '\n' + JSON.stringify(error.stack, null, 2);
    }
  } else {
    errorLog = JSON.stringify(error, null, 2);
  }
  console.error(errorLog);
  process.exit(1);
}

export async function runCommand<O extends OptionValues>(
  command: Command,
  action: (options: O) => Promise<JsonSerializable>,
) {
  const options = command.optsWithGlobals<O>();

  try {
    const output = await action(options);
    logCommandOutput(output);
    process.exit(0);
  } catch (error) {
    exitWithErrorLog(error);
  }
}

export interface CommanderOption {
  alias: string;
  description: string;
  default?: string | boolean;
}

function applyOptions(command: Command, options: CommanderOption[]): Command {
  [...options].forEach((option) => {
    command.option(option.alias, option.description, option.default);
  });
  return command;
}

export function makeCommand({
  description,
  name,
  options,
}: {
  name: string;
  description: string;
  options: CommanderOption[];
}): Command {
  const command = program.command(name).description(description);
  return applyOptions(command, options);
}

function processIdFromOptions({ processId, dev }: GlobalOptions): string {
  return processId !== undefined
    ? processId
    : dev
      ? IO_DEVNET_PROCESS_ID
      : IO_TESTNET_PROCESS_ID;
}

function jwkFromOptions({
  privateKey,
  walletFile,
}: WalletOptions): JWKInterface | undefined {
  if (privateKey !== undefined) {
    return JSON.parse(privateKey);
  }
  if (walletFile !== undefined) {
    return JSON.parse(readFileSync(walletFile, 'utf-8'));
  }
  return undefined;
}

export function requiredJwkFromOptions(options: WalletOptions): JWKInterface {
  const jwk = jwkFromOptions(options);
  if (jwk === undefined) {
    throw new Error(
      'No JWK provided for signing!\nPlease provide a stringified JWK with `--private-key` or the file path of a jwk.json file with `--wallet-file`',
    );
  }
  return jwk;
}

export function jwkToAddress(jwk: JWKInterface): string {
  return sha256B64Url(fromB64Url(jwk.n));
}

function setLoggerIfDebug(options: GlobalOptions) {
  if (options.debug) {
    Logger.default.setLogLevel('debug');
  }
}

export function readIOFromOptions(options: GlobalOptions): AoIORead {
  setLoggerIfDebug(options);

  return IO.init({
    processId: processIdFromOptions(options),
  });
}

export function writeIOFromOptions(
  options: WalletOptions,
  signer?: ContractSigner,
): AoIOWrite {
  signer ??= new ArweaveSigner(requiredJwkFromOptions(options));
  setLoggerIfDebug(options);

  return IO.init({
    processId: processIdFromOptions(options),
    signer,
  });
}

export function requiredAddressFromOptions(options: AddressOptions): string {
  if (options.address !== undefined) {
    return options.address;
  }
  // TODO: Support other wallet types
  const jwk = jwkFromOptions(options);
  if (jwk !== undefined) {
    return jwkToAddress(jwk);
  }

  throw new Error('No address provided. Use --address or --wallet-file');
}

export function requiredNameFromOptions(options: NameOptions): string {
  if (options.name !== undefined) {
    return options.name;
  }
  // TODO: Could optimistically check for names from address or wallet if provided?
  throw new Error('No name provided. Use `--name "my-name"`');
}

export function formatIOWithCommas(value: IOToken): string {
  const [integerPart, decimalPart] = value.toString().split('.');
  const integerWithCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart === undefined) {
    return integerWithCommas;
  }
  return integerWithCommas + '.' + decimalPart;
}
