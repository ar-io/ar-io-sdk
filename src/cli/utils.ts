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
  EpochInput,
  IO,
  IOToken,
  IO_DEVNET_PROCESS_ID,
  IO_TESTNET_PROCESS_ID,
  Logger,
  PaginationParams,
  fromB64Url,
  sha256B64Url,
} from '../node/index.js';
import {
  AddressOptions,
  EpochOptions,
  GlobalOptions,
  InitiatorAndNameOptions,
  InitiatorOptions,
  JsonSerializable,
  NameOptions,
  PaginationOptions,
  WalletOptions,
} from './types.js';

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

export function formatIOWithCommas(value: IOToken): string {
  const [integerPart, decimalPart] = value.toString().split('.');
  const integerWithCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart === undefined) {
    return integerWithCommas;
  }
  return integerWithCommas + '.' + decimalPart;
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

const defaultCliPaginationLimit = 10; // more friendly UX than 100
export function paginationParamsFromOptions(
  options: PaginationOptions,
  // TODO: Use a type for sortBy and we could assert against arrays of the fields we want sort by
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): PaginationParams & { sortBy: any } {
  const { cursor, limit, sortBy, sortOrder } = options;
  if (sortOrder !== undefined && !['asc', 'desc'].includes(sortOrder)) {
    throw new Error(
      `Invalid sort order: ${sortOrder}, must be "asc" or "desc"`,
    );
  }

  const numberLimit = limit !== undefined ? +limit : defaultCliPaginationLimit;
  if (isNaN(numberLimit) || numberLimit <= 0) {
    throw new Error(`Invalid limit: ${numberLimit}, must be a positive number`);
  }
  return {
    cursor,
    limit: numberLimit,
    sortBy,
    sortOrder,
  };
}

export function epochInputFromOptions(options: EpochOptions): EpochInput {
  if (options.epochIndex !== undefined) {
    return { epochIndex: +options.epochIndex };
  }
  if (options.timestamp !== undefined) {
    return { timestamp: +options.timestamp };
  }
  return undefined;
}

export function requiredInitiatorFromOptions(
  options: InitiatorOptions,
): string {
  if (options.initiator !== undefined) {
    return options.initiator;
  }
  return requiredAddressFromOptions(options);
}

export function primaryNameRequestParamsFromOptions(
  options: InitiatorAndNameOptions,
): { initiator: string } | { name: string } {
  if (options.initiator !== undefined) {
    return { initiator: options.initiator };
  }
  if (options.name !== undefined) {
    return { name: options.name };
  }

  throw new Error('No initiator or name provided');
}
