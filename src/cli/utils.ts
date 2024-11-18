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
import { Command, OptionValues, program } from 'commander';
import { readFileSync } from 'fs';

import {
  IO,
  IOReadable,
  IO_DEVNET_PROCESS_ID,
  IO_TESTNET_PROCESS_ID,
  fromB64Url,
  sha256B64Url,
} from '../node/index.js';
import { AddressOptions, GlobalOptions } from './options.js';

function exitWithErrorLog(error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export async function runCommand<O extends OptionValues>(
  command: Command,
  action: (options: O) => Promise<void>,
) {
  const options = command.optsWithGlobals<O>();

  try {
    await action(options);
    process.exit(0);
  } catch (error) {
    exitWithErrorLog(error);
  }
}

function applyOptions(command: Command, options: CommanderOption[]): Command {
  [...options].forEach((option) => {
    command.option(option.alias, option.description, option.default);
  });
  return command;
}

export interface CommanderOption {
  alias: string;
  description: string;
  default?: string | boolean;
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

export function readIOFromOptions(options: GlobalOptions): IOReadable {
  const defaultProcessId = options.dev
    ? IO_DEVNET_PROCESS_ID
    : IO_TESTNET_PROCESS_ID;

  return IO.init({ processId: options.processId ?? defaultProcessId });
}

export function addressFromOptions({
  address,
  privateKey,
  walletFile,
}: AddressOptions): string {
  if (address !== undefined) {
    return address;
  }
  // TODO: Support other wallet types

  if (privateKey !== undefined) {
    const jwk = JSON.parse(privateKey);
    const address = sha256B64Url(fromB64Url(jwk.n));
    return address;
  }
  if (walletFile !== undefined) {
    const jwk = JSON.parse(readFileSync(walletFile, 'utf-8'));
    const address = sha256B64Url(fromB64Url(jwk.n));
    return address;
  }

  throw new Error('No address provided. Use --address or --wallet-file');
}
