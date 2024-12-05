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
import { connect } from '@permaweb/aoconnect';
import { JWKInterface } from 'arweave/node/lib/wallet.js';
import { Command, OptionValues, program } from 'commander';
import { readFileSync } from 'fs';
import prompts from 'prompts';

import {
  ANT,
  AOProcess,
  AoANTRead,
  AoANTWrite,
  AoIORead,
  AoIOWrite,
  AoRedelegateStakeParams,
  AoSigner,
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
  SpawnANTState,
  WriteOptions,
  createAoSigner,
  fromB64Url,
  initANTStateForAddress,
  mIOToken,
  sha256B64Url,
} from '../node/index.js';
import { globalOptions } from './options.js';
import {
  ANTStateCLIOptions,
  AddressCLIOptions,
  EpochCLIOptions,
  GlobalCLIOptions,
  InitiatorCLIOptions,
  JsonSerializable,
  PaginationCLIOptions,
  ProcessIdCLIOptions,
  RedelegateStakeCLIOptions,
  TransferCLIOptions,
  UpdateGatewaySettingsCLIOptions,
  WalletCLIOptions,
  WriteActionCLIOptions,
} from './types.js';

export function stringifyJsonForCLIDisplay(
  json: JsonSerializable | unknown,
): string {
  return JSON.stringify(json, null, 2);
}

function logCommandOutput(output: JsonSerializable) {
  console.log(stringifyJsonForCLIDisplay(output));
}

function exitWithErrorLog(error: unknown, debug = false) {
  let errorLog: string;
  if (error instanceof Error) {
    errorLog = error.message;
    if (debug && error.stack !== undefined) {
      errorLog = error.stack;
    }
  } else {
    errorLog = stringifyJsonForCLIDisplay(error);
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

export function applyOptions(
  command: Command,
  options: CommanderOption[],
): Command {
  [...options].forEach((option) => {
    command.option(option.alias, option.description, option.default);
  });
  return command;
}

export function makeCommand<O extends OptionValues = GlobalCLIOptions>({
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
  const appliedCommand = applyOptions(command, [...options, ...globalOptions]);
  if (action !== undefined) {
    appliedCommand.action(() => runCommand<O>(appliedCommand, action));
  }
  return appliedCommand;
}

export function ioProcessIdFromOptions({
  ioProcessId,
  dev,
}: GlobalCLIOptions): string {
  return ioProcessId !== undefined
    ? ioProcessId
    : dev
      ? IO_DEVNET_PROCESS_ID
      : IO_TESTNET_PROCESS_ID;
}

function jwkFromOptions({
  privateKey,
  walletFile,
}: WalletCLIOptions): JWKInterface | undefined {
  if (privateKey !== undefined) {
    return JSON.parse(privateKey);
  }
  if (walletFile !== undefined) {
    return JSON.parse(readFileSync(walletFile, 'utf-8'));
  }
  return undefined;
}

export function requiredJwkFromOptions(
  options: WalletCLIOptions,
): JWKInterface {
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

function setLoggerIfDebug(options: GlobalCLIOptions) {
  if (options.debug) {
    Logger.default.setLogLevel('debug');
  }
}

export function getLoggerFromOptions(options: GlobalCLIOptions): Logger {
  setLoggerIfDebug(options);
  return Logger.default;
}

function aoProcessFromOptions(options: GlobalCLIOptions): AOProcess {
  return new AOProcess({
    processId: ioProcessIdFromOptions(options),
    ao: connect({
      CU_URL: options.cuUrl,
    }),
  });
}

export function readIOFromOptions(options: GlobalCLIOptions): AoIORead {
  setLoggerIfDebug(options);

  return IO.init({
    process: aoProcessFromOptions(options),
  });
}

export function requiredContractSignerFromOptions(options: WalletCLIOptions): {
  signer: ContractSigner;
  signerAddress: string;
} {
  // TODO: Support other wallet types
  const jwk = requiredJwkFromOptions(options);
  const signer = new ArweaveSigner(jwk);
  return { signer, signerAddress: jwkToAddress(jwk) };
}

export function requiredAoSignerFromOptions(
  options: WalletCLIOptions,
): AoSigner {
  return createAoSigner(requiredContractSignerFromOptions(options).signer);
}

export function writeIOFromOptions(options: GlobalCLIOptions): {
  io: AoIOWrite;
  signerAddress: string;
} {
  const { signer, signerAddress } = requiredContractSignerFromOptions(options);
  setLoggerIfDebug(options);

  return {
    io: IO.init({
      process: aoProcessFromOptions(options),
      signer,
    }),
    signerAddress,
  };
}

export function formatIOWithCommas(value: IOToken): string {
  const [integerPart, decimalPart] = value.toString().split('.');
  const integerWithCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart === undefined) {
    return integerWithCommas;
  }
  return integerWithCommas + '.' + decimalPart;
}

/** helper to get address from --address option first, then check wallet options  */
export function addressFromOptions<O extends AddressCLIOptions>(
  options: O,
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

export function requiredAddressFromOptions<O extends AddressCLIOptions>(
  options: O,
): string {
  const address = addressFromOptions(options);
  if (address !== undefined) {
    return address;
  }
  throw new Error('No address provided. Use --address or --wallet-file');
}

const defaultCliPaginationLimit = 10; // more friendly UX than 100
export function paginationParamsFromOptions<O extends PaginationCLIOptions>(
  options: O,
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

export function epochInputFromOptions(options: EpochCLIOptions): EpochInput {
  if (options.epochIndex !== undefined) {
    return { epochIndex: +options.epochIndex };
  }
  if (options.timestamp !== undefined) {
    return { timestamp: +options.timestamp };
  }
  return undefined;
}

export function requiredInitiatorFromOptions(
  options: InitiatorCLIOptions,
): string {
  if (options.initiator !== undefined) {
    return options.initiator;
  }
  return requiredAddressFromOptions(options);
}

export function writeActionTagsFromOptions<O extends WriteActionCLIOptions>(
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
  allowDelegatedStaking,
  autoStake,
  delegateRewardShareRatio,
  fqdn,
  label,
  minDelegatedStake,
  note,
  observerAddress,
  port,
  properties,
  allowedDelegates,
}: UpdateGatewaySettingsCLIOptions): AoUpdateGatewaySettingsParams {
  return {
    observerAddress,
    allowDelegatedStaking,
    autoStake,
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
  options: TransferCLIOptions,
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
  options: RedelegateStakeCLIOptions,
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

export function recordTypeFromOptions<O extends { type?: string }>(
  options: O,
): 'lease' | 'permabuy' {
  options.type ??= 'lease';
  if (options.type !== 'lease' && options.type !== 'permabuy') {
    throw new Error(`Invalid type. Valid types are: lease, permabuy`);
  }
  return options.type;
}

export function requiredMIOFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): mIOToken {
  if (options[key] === undefined) {
    throw new Error(`No ${key} provided. Use --${key} denominated in IO`);
  }
  return new IOToken(+options[key]).toMIO();
}

export async function assertEnoughBalance(
  io: AoIORead,
  address: string,
  ioQuantity: IOToken,
) {
  const balance = await io.getBalance({ address });

  if (balance < ioQuantity.toMIO().valueOf()) {
    throw new Error(
      `Insufficient IO balance for action. Balance available: ${new mIOToken(balance).toIO()} IO`,
    );
  }
}

export async function confirmationPrompt(message: string): Promise<boolean> {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message,
  });
  return confirm;
}

export async function assertConfirmationPrompt<
  O extends { skipConfirmation?: boolean },
>(message: string, options: O): Promise<boolean> {
  if (options.skipConfirmation) {
    return true;
  }
  return confirmationPrompt(message);
}

export function requiredProcessIdFromOptions<O extends ProcessIdCLIOptions>(
  o: O,
): string {
  if (o.processId === undefined) {
    throw new Error('--process-id is required');
  }
  return o.processId;
}

function ANTProcessFromOptions(options: ProcessIdCLIOptions): AOProcess {
  return new AOProcess({
    processId: requiredProcessIdFromOptions(options),
    ao: connect({
      CU_URL: options.cuUrl,
    }),
  });
}

export function readANTFromOptions(options: ProcessIdCLIOptions): AoANTRead {
  return ANT.init({
    process: ANTProcessFromOptions(options),
  });
}

export function writeANTFromOptions(
  options: ProcessIdCLIOptions,
  signer?: ContractSigner,
): AoANTWrite {
  signer ??= requiredContractSignerFromOptions(options).signer;
  return ANT.init({
    process: ANTProcessFromOptions(options),
    signer,
  });
}

export function requiredStringFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): string {
  const value = options[key];
  if (value === undefined) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

export function requiredStringArrayFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): string[] {
  const value = options[key];
  if (value === undefined) {
    throw new Error(`--${key} is required`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`--${key} must be an array`);
  }
  return value;
}

export function positiveIntegerFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): number | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }
  const numberValue = +value;
  if (isNaN(numberValue) || numberValue <= 0) {
    throw new Error(`Invalid ${key}: ${value}, must be a positive number`);
  }
  return numberValue;
}

export function requiredPositiveIntegerFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): number {
  const value = positiveIntegerFromOptions(options, key);
  if (value === undefined) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

export function getANTStateFromOptions(
  options: ANTStateCLIOptions,
): SpawnANTState {
  return initANTStateForAddress({
    owner: requiredAddressFromOptions(options),
    targetId: options.target,
    controllers: options.controllers,
    description: options.description,
    ticker: options.ticker,
    name: options.name,
    keywords: options.keywords,
    ttlSeconds: options.ttlSeconds !== undefined ? +options.ttlSeconds : 0,
  });
}
