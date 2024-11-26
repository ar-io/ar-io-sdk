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
  AoRedelegateStakeParams,
  AoUpdateGatewaySettingsParams,
  ArweaveSigner,
  ContractSigner,
  EpochInput,
  IO,
  IOToken,
  IO_DEVNET_PROCESS_ID,
  IO_TESTNET_PROCESS_ID,
  Logger,
  PaginationParams,
  WriteOptions,
  fromB64Url,
  mIOToken,
  sha256B64Url,
} from '../node/index.js';
import {
  AddressOptions,
  EpochOptions,
  GlobalOptions,
  InitiatorOptions,
  JsonSerializable,
  NameOptions,
  OperatorStakeOptions,
  PaginationOptions,
  RedelegateStakeOptions,
  TransferOptions,
  UpdateGatewaySettingsOptions,
  VaultIdOptions,
  WalletOptions,
  WriteActionOptions,
} from './types.js';

function logCommandOutput(output: JsonSerializable) {
  console.log(JSON.stringify(output, null, 2));
}

function exitWithErrorLog(error: unknown, debug = false) {
  let errorLog: string;
  if (error instanceof Error) {
    errorLog = error.message;
    if (debug && error.stack !== undefined) {
      errorLog = error.stack;
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
    exitWithErrorLog(error, options.debug);
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

export function makeCommand<O extends OptionValues = GlobalOptions>({
  description,
  name,
  options = [],
  action,
}: {
  name: string;
  description: string;
  action?: (options: O) => Promise<JsonSerializable>;
  options?: CommanderOption[];
}): Command {
  const command = program.command(name).description(description);
  const appliedCommand = applyOptions(command, options);
  if (action !== undefined) {
    appliedCommand.action(() => runCommand<O>(appliedCommand, action));
  }
  return appliedCommand;
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

export function addressFromOptions(
  options: AddressOptions,
): string | undefined {
  if (options.address !== undefined) {
    return options.address;
  }
  // TODO: Support other wallet types
  const jwk = jwkFromOptions(options);
  if (jwk !== undefined) {
    return jwkToAddress(jwk);
  }
  return undefined;
}

export function requiredAddressFromOptions(options: AddressOptions): string {
  const address = addressFromOptions(options);
  if (address !== undefined) {
    return address;
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

export function requiredVaultIdFromOptions(options: VaultIdOptions): string {
  if (options.vaultId !== undefined) {
    return options.vaultId;
  }
  throw new Error('--vault-id is required');
}

export function writeOptionsFromOptions<O extends WriteActionOptions>(
  options: O,
): WriteOptions {
  if (options.tags === undefined) {
    return {};
  }
  if (!Array.isArray(options.tags)) {
    throw new Error('Tags must be an array');
  }
  if (options.tags.length === 0) {
    return {};
  }
  if (options.tags.length % 2 !== 0) {
    throw new Error('Tags must be an array of key-value pairs');
  }
  const tags: { name: string; value: string }[] = [];
  for (let i = 0; i < options.tags.length; i += 2) {
    tags.push({
      name: options.tags[i],
      value: options.tags[i + 1],
    });
  }

  return {
    tags,
  };
}

export function gatewaySettingsFromOptions({
  disableDelegatedStaking,
  disableAutoStake,
  delegateRewardShareRatio,
  fqdn,
  label,
  minDelegatedStake,
  note,
  observerAddress,
  port,
  properties,
  allowedDelegates,
}: UpdateGatewaySettingsOptions): AoUpdateGatewaySettingsParams {
  return {
    observerAddress,
    allowDelegatedStaking:
      disableDelegatedStaking === undefined
        ? undefined
        : !disableDelegatedStaking,
    autoStake: disableAutoStake === undefined ? undefined : !disableAutoStake,
    delegateRewardShareRatio:
      delegateRewardShareRatio !== undefined
        ? +delegateRewardShareRatio
        : undefined,
    allowedDelegates,
    fqdn,
    label,
    minDelegatedStake:
      minDelegatedStake !== undefined ? +minDelegatedStake : undefined,
    note,
    port: port !== undefined ? +port : undefined,
    properties,
  };
}

export function requiredTargetAndQuantityFromOptions(
  options: TransferOptions,
): { target: string; ioQuantity: IOToken } {
  if (options.target === undefined) {
    throw new Error('No target provided. Use --target');
  }
  if (options.quantity === undefined) {
    throw new Error('No quantity provided. Use --quantity');
  }
  return {
    target: options.target,
    ioQuantity: new IOToken(+options.quantity),
  };
}

export function redelegateParamsFromOptions(
  options: RedelegateStakeOptions,
): AoRedelegateStakeParams & { stakeQty: mIOToken } {
  const { target, ioQuantity } = requiredTargetAndQuantityFromOptions(options);
  const source = options.source;
  if (source === undefined) {
    throw new Error('No source provided. Use --source');
  }

  return {
    target,
    source,
    vaultId: options.vaultId,
    stakeQty: ioQuantity.toMIO(),
  };
}

export function requiredOperatorStakeFromOptions(
  options: OperatorStakeOptions,
): IOToken {
  if (options.operatorStake === undefined) {
    throw new Error(
      'Operator stake is required. Please provide an --operator-stake denominated in IO',
    );
  }
  return new IOToken(+options.operatorStake);
}
