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
import { readFileSync } from 'fs';

import { EthereumSigner } from '@dha-team/arbundles';
import { connect } from '@permaweb/aoconnect';
import {
  type KeyPairSigner,
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from '@solana/kit';
import { JWKInterface } from 'arweave/node/lib/wallet.js';
import bs58 from 'bs58';
import { Command, OptionValues, program } from 'commander';
import prompts from 'prompts';

import {
  ANT,
  ANTRegistry,
  ANT_REGISTRY_ID,
  ANT_REGISTRY_TESTNET_ID,
  AOProcess,
  ARIO,
  ARIOToken,
  ARIO_DEVNET_PROCESS_ID,
  ARIO_MAINNET_PROCESS_ID,
  ARIO_TESTNET_PROCESS_ID,
  AoANTRead,
  AoANTRegistryRead,
  AoANTWrite,
  AoARIORead,
  AoARIOWrite,
  AoGetCostDetailsParams,
  AoRedelegateStakeParams,
  AoSigner,
  AoUpdateGatewaySettingsParams,
  ArweaveSigner,
  ContractSigner,
  EpochInput,
  FundFrom,
  Logger,
  PaginationParams,
  SortBy,
  SpawnANTState,
  WriteOptions,
  createAoSigner,
  fromB64Url,
  fundFromOptions,
  initANTStateForAddress,
  isValidFundFrom,
  isValidIntent,
  mARIOToken,
  sha256B64Url,
  validIntents,
} from '../node/index.js';
import { globalOptions } from './options.js';
import {
  ANTStateCLIOptions,
  AddressCLIOptions,
  EpochCLIOptions,
  GetTokenCostCLIOptions,
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

export const defaultTtlSecondsCLI = 3600;

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

export function arioProcessIdFromOptions({
  arioProcessId,
  devnet,
  testnet,
}: GlobalCLIOptions): string {
  if (arioProcessId !== undefined) {
    return arioProcessId;
  }
  if (devnet) {
    return ARIO_DEVNET_PROCESS_ID;
  }
  if (testnet) {
    return ARIO_TESTNET_PROCESS_ID;
  }

  return ARIO_MAINNET_PROCESS_ID;
}

export function antRegistryIdFromOptions({
  antRegistryProcessId,
  testnet,
}: GlobalCLIOptions): string {
  if (antRegistryProcessId !== undefined) {
    return antRegistryProcessId;
  }
  if (testnet) {
    return ANT_REGISTRY_TESTNET_ID;
  }
  return ANT_REGISTRY_ID;
}

function walletFromOptions({
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
  const jwk = walletFromOptions(options);
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
    processId: arioProcessIdFromOptions(options),
    ao: connect({
      MODE: 'legacy',
      CU_URL: options.cuUrl,
    }),
  });
}

export function readARIOFromOptions(options: GlobalCLIOptions): AoARIORead {
  setLoggerIfDebug(options);

  if (options.ao) {
    return ARIO.init({
      hyperbeamUrl: options.hyperbeamUrl,
      process: aoProcessFromOptions({
        cuUrl: 'http://localhost:6363',
        ...options,
      }),
      paymentUrl: options.paymentUrl,
    });
  }

  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  return ARIO.init({
    backend: 'solana',
    rpc: createSolanaRpc(rpcUrl),
    ...(options.coreProgramId
      ? { coreProgramId: address(options.coreProgramId) }
      : {}),
    ...(options.garProgramId
      ? { garProgramId: address(options.garProgramId) }
      : {}),
    ...(options.arnsProgramId
      ? { arnsProgramId: address(options.arnsProgramId) }
      : {}),
  });
}

export async function readANTRegistryFromOptions(
  options: ProcessIdCLIOptions,
): Promise<AoANTRegistryRead> {
  setLoggerIfDebug(options);

  if (options.ao) {
    return ANTRegistry.init({
      process: aoProcessFromOptions(options),
      hyperbeamUrl: options.hyperbeamUrl,
    });
  }

  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  return ANTRegistry.init({
    backend: 'solana',
    rpc: createSolanaRpc(rpcUrl),
    ...(options.antProgramId
      ? { antProgramId: address(options.antProgramId) }
      : {}),
  });
}

export function contractSignerFromOptions(
  options: WalletCLIOptions,
): { signer: ContractSigner; signerAddress: string } | undefined {
  const wallet = walletFromOptions(options);

  if (wallet === undefined) {
    return undefined;
  }
  const token = options.token ?? 'arweave';

  if (token === 'ethereum') {
    const signer = new EthereumSigner(wallet as unknown as string);
    // For EthereumSigner, we need to convert the JWK to a string
    return { signer, signerAddress: signer.publicKey.toString('hex') };
  }

  // TODO: Support other wallet types
  const signer = new ArweaveSigner(wallet);
  return { signer, signerAddress: jwkToAddress(wallet) };
}

export function requiredContractSignerFromOptions(options: WalletCLIOptions): {
  signer: ContractSigner;
  signerAddress: string;
} {
  const contractSigner = contractSignerFromOptions(options);
  if (contractSigner === undefined) {
    throw new Error(
      'No signer provided for signing!\nPlease provide a stringified JWK or Ethereum private key with `--private-key` or the file path of an arweave.jwk.json or eth.private.key.txt file with `--wallet-file`',
    );
  }
  return contractSigner;
}

export function requiredAoSignerFromOptions(
  options: WalletCLIOptions,
): AoSigner {
  return createAoSigner(requiredContractSignerFromOptions(options).signer);
}

/** Derive a WS URL from an HTTP/HTTPS RPC URL by swapping the scheme. */
function wsUrlFromRpcUrl(rpcUrl: string): string {
  // Surfpool and `solana-test-validator` follow Solana's well-known localhost
  // convention: HTTP RPC on 8899 and WebSocket on 8900 (a separate port).
  // Public RPCs (mainnet/devnet/testnet) put both on the same port (443/443),
  // so a naive `http→ws` swap works there but breaks against any local
  // validator. Bump the port iff we recognise the localhost+8899 pair.
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch {
    return rpcUrl.replace(/^http/, 'ws');
  }
  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '0.0.0.0';
  if (isLocalhost && url.port === '8899') {
    url.port = '8900';
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString().replace(/\/$/, '');
}

/**
 * Load a Solana KeyPairSigner from --private-key (base58) or --wallet-file
 * (JSON array of bytes). Throws with a helpful message if neither is set.
 */
async function loadSolanaSignerFromOptions(options: {
  privateKey?: string;
  walletFile?: string;
}): Promise<KeyPairSigner> {
  let secretKey: Uint8Array;
  if (options.privateKey) {
    secretKey = bs58.decode(options.privateKey);
  } else if (options.walletFile) {
    const raw = readFileSync(options.walletFile, 'utf-8');
    secretKey = new Uint8Array(JSON.parse(raw));
  } else {
    throw new Error(
      'Solana write operations require a signer.\n' +
        'Provide a Solana keypair with --wallet-file <path-to-keypair.json> ' +
        'or --private-key <base58-encoded-key>',
    );
  }
  return createKeyPairSignerFromBytes(secretKey);
}

export async function writeARIOFromOptions(options: GlobalCLIOptions): Promise<{
  ario: AoARIOWrite;
  signerAddress: string;
}> {
  setLoggerIfDebug(options);

  if (options.ao) {
    const { signer, signerAddress } =
      requiredContractSignerFromOptions(options);
    return {
      ario: ARIO.init({
        process: aoProcessFromOptions(options),
        signer,
        paymentUrl: options.paymentUrl,
        hyperbeamUrl: options.hyperbeamUrl,
      }),
      signerAddress,
    };
  }

  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  const signer = await loadSolanaSignerFromOptions(options);

  return {
    ario: ARIO.init({
      backend: 'solana',
      rpc: createSolanaRpc(rpcUrl),
      rpcSubscriptions: createSolanaRpcSubscriptions(wsUrlFromRpcUrl(rpcUrl)),
      signer,
      // Forward program-id overrides to mirror `readARIOFromOptions` so
      // localnet / devnet writes target the deployed program IDs instead of
      // silently falling back to the SDK's mainnet defaults.
      ...(options.coreProgramId
        ? { coreProgramId: address(options.coreProgramId) }
        : {}),
      ...(options.garProgramId
        ? { garProgramId: address(options.garProgramId) }
        : {}),
      ...(options.arnsProgramId
        ? { arnsProgramId: address(options.arnsProgramId) }
        : {}),
    }),
    signerAddress: signer.address as string,
  };
}

export function formatARIOWithCommas(value: ARIOToken): string {
  const [integerPart, decimalPart] = value.toString().split('.');
  const integerWithCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart === undefined) {
    return integerWithCommas;
  }
  return integerWithCommas + '.' + decimalPart;
}

export function formatMARIOToARIOWithCommas(value: mARIOToken): string {
  return formatARIOWithCommas(value.toARIO());
}

/** helper to get address from --address option first, then check wallet options  */
export function addressFromOptions<O extends AddressCLIOptions>(
  options: O,
): string | undefined {
  if (options.address !== undefined) {
    return options.address;
  }
  const signer = contractSignerFromOptions(options);
  if (signer !== undefined) {
    return signer.signerAddress;
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
export function paginationParamsFromOptions<O extends PaginationCLIOptions, R>(
  options: O,
  // TODO: Use a type for sortBy and we could assert against arrays of the fields we want sort by
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): PaginationParams<R> {
  const { cursor, limit, sortBy, sortOrder, filters } = options;
  if (sortOrder !== undefined && !['asc', 'desc'].includes(sortOrder)) {
    throw new Error(
      `Invalid sort order: ${sortOrder}, must be "asc" or "desc"`,
    );
  }

  const numberLimit = limit !== undefined ? +limit : defaultCliPaginationLimit;
  if (isNaN(numberLimit) || numberLimit <= 0) {
    throw new Error(`Invalid limit: ${numberLimit}, must be a positive number`);
  }

  const filtersObject: Record<string, string[]> = {};

  if (filters !== undefined) {
    if (typeof filters !== 'object') {
      throw new Error('Filters must be an object');
    }

    if (Array.isArray(filters)) {
      // every odd value is a key, every even value is a value for that key
      for (let i = 0; i < filters.length; i += 2) {
        // convert any strings that are numbers to numbers and any 'true'/'false' to booleans
        const value = filters[i + 1].split(',').map((v) => {
          const num = +v;
          if (!isNaN(num)) return num;
          if (v === 'true') return true;
          if (v === 'false') return false;
          return v;
        });
        filtersObject[filters[i]] = value;
      }
    }
  }

  return {
    cursor,
    limit: numberLimit,
    sortBy: sortBy as SortBy<R>,
    sortOrder,
    filters: filtersObject as Record<keyof R, string | string[]>,
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

export function customTagsFromOptions<O extends WriteActionCLIOptions>(
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

export function servicesFromOptions(services?: string) {
  if (services === undefined || services === null || services === '') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(services);

    // Validate structure
    if (!parsed.bundlers || !Array.isArray(parsed.bundlers)) {
      throw new Error('Services must have a "bundlers" array');
    }

    if (parsed.bundlers.length > 20) {
      throw new Error('Maximum 20 bundlers allowed');
    }

    // Validate each bundler
    for (const bundler of parsed.bundlers) {
      if (!bundler.fqdn || typeof bundler.fqdn !== 'string') {
        throw new Error('Each bundler must have a valid "fqdn" string');
      }
      if (
        typeof bundler.port !== 'number' ||
        bundler.port < 0 ||
        bundler.port > 65535
      ) {
        throw new Error('Each bundler must have a valid "port" (0-65535)');
      }
      if (bundler.protocol !== 'https') {
        throw new Error('Each bundler protocol must be "https"');
      }
      if (!bundler.path || typeof bundler.path !== 'string') {
        throw new Error('Each bundler must have a valid "path" string');
      }
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid services JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function gatewaySettingsFromOptions(
  options: UpdateGatewaySettingsCLIOptions,
): AoUpdateGatewaySettingsParams {
  const {
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
    services,
  } = options;
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
    services: servicesFromOptions(services as string | undefined),
  };
}

export function requiredTargetAndQuantityFromOptions(
  options: TransferCLIOptions,
): { target: string; arioQuantity: ARIOToken } {
  if (options.target === undefined) {
    throw new Error('No target provided. Use --target');
  }
  if (options.quantity === undefined) {
    throw new Error('No quantity provided. Use --quantity');
  }
  return {
    target: options.target,
    arioQuantity: new ARIOToken(+options.quantity),
  };
}

export function redelegateParamsFromOptions(
  options: RedelegateStakeCLIOptions,
): AoRedelegateStakeParams & { stakeQty: mARIOToken } {
  const { target, arioQuantity: aRIOQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const source = options.source;
  if (source === undefined) {
    throw new Error('No source provided. Use --source');
  }

  return {
    target,
    source,
    vaultId: options.vaultId,
    stakeQty: aRIOQuantity.toMARIO(),
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

export function requiredMARIOFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): mARIOToken {
  if (options[key] === undefined) {
    throw new Error(`No ${key} provided. Use --${key} denominated in ARIO`);
  }
  return new ARIOToken(+options[key]).toMARIO();
}

export async function assertEnoughBalanceForArNSPurchase({
  ario,
  address,
  costDetailsParams,
}: {
  ario: AoARIORead;
  address: string;
  costDetailsParams: AoGetCostDetailsParams;
}) {
  if (costDetailsParams.fundFrom === 'turbo') {
    // TODO: Get turbo balance and assert it is enough -- retain paid-by from balance result and pass to CLI logic
    return;
  }

  const costDetails = await ario.getCostDetails(costDetailsParams);
  if (costDetails.fundingPlan) {
    if (costDetails.fundingPlan.shortfall > 0) {
      throw new Error(
        `Insufficient balance for action. Shortfall: ${formatMARIOToARIOWithCommas(
          new mARIOToken(costDetails.fundingPlan.shortfall),
        )}\n${JSON.stringify(costDetails, null, 2)}`,
      );
    }
  } else {
    await assertEnoughMARIOBalance({
      ario,
      address,
      mARIOQuantity: costDetails.tokenCost,
    });
  }
}

export async function assertEnoughMARIOBalance({
  address,
  ario,
  mARIOQuantity,
}: {
  ario: AoARIORead;
  address: string;
  mARIOQuantity: mARIOToken | number;
}) {
  if (typeof mARIOQuantity === 'number') {
    mARIOQuantity = new mARIOToken(mARIOQuantity);
  }
  const balance = await ario.getBalance({ address });

  if (balance < mARIOQuantity.valueOf()) {
    throw new Error(
      `Insufficient ARIO balance for action. Balance available: ${formatMARIOToARIOWithCommas(
        new mARIOToken(balance),
      )} ARIO`,
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
      MODE: 'legacy',
      CU_URL: options.cuUrl,
    }),
  });
}

export async function readANTFromOptions(
  options: ProcessIdCLIOptions,
): Promise<AoANTRead> {
  if (options.ao) {
    return ANT.init({
      process: ANTProcessFromOptions(options),
      hyperbeamUrl: options.hyperbeamUrl,
    });
  }

  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  return ANT.init({
    backend: 'solana',
    processId: requiredProcessIdFromOptions(options),
    rpc: createSolanaRpc(rpcUrl),
    ...(options.antProgramId
      ? { antProgramId: address(options.antProgramId) }
      : {}),
  });
}

export async function writeANTFromOptions(
  options: ProcessIdCLIOptions,
  signer?: ContractSigner,
): Promise<AoANTWrite> {
  if (options.ao) {
    signer ??= requiredContractSignerFromOptions(options).signer;
    return ANT.init({
      process: ANTProcessFromOptions(options),
      signer,
      hyperbeamUrl: options.hyperbeamUrl,
    });
  }

  const rpcUrl = options.rpcUrl ?? 'https://api.mainnet-beta.solana.com';
  const kitSigner = await loadSolanaSignerFromOptions(options);

  return ANT.init({
    backend: 'solana',
    processId: requiredProcessIdFromOptions(options),
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrlFromRpcUrl(rpcUrl)),
    signer: kitSigner,
    ...(options.antProgramId
      ? { antProgramId: address(options.antProgramId) }
      : {}),
  });
}

export function booleanFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): boolean {
  return !!options[key];
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

export function stringArrayFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): string[] | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`--${key} must be an array`);
  }
  return value;
}

export function requiredStringArrayFromOptions<O extends GlobalCLIOptions>(
  options: O,
  key: string,
): string[] {
  const value = stringArrayFromOptions(options, key);
  if (value === undefined) {
    throw new Error(`--${key} is required`);
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
    logo: options.logo,
    ttlSeconds:
      options.ttlSeconds !== undefined
        ? +options.ttlSeconds
        : defaultTtlSecondsCLI,
  });
}

/**
 * Spawn a fresh ANT on Solana from CLI options.
 *
 * Resolves the signer the same way `writeARIOFromOptions` does (KeyPairSigner
 * from `--wallet-file` or `--private-key`), then bundles MPL Core `CreateV1` +
 * `ario_ant::initialize` into a single transaction. The signer's address
 * becomes the ANT owner on chain — no separate `--address` is required.
 *
 * Maps the CLI's AO-shaped options (`--name`, `--ticker`, `--description`,
 * `--keywords`, `--logo`, `--target` for the @ record tx id) onto the Solana
 * `InitializeAntParams` payload. AO-only state fields like `controllers` and
 * `balances` are intentionally dropped — they don't exist on Solana.
 */
export async function spawnSolanaANTFromOptions(
  options: ANTStateCLIOptions,
): Promise<import('../solana/spawn-ant.js').SpawnSolanaANTResult> {
  setLoggerIfDebug(options as any);

  const { spawnSolanaANT } = await import('../solana/spawn-ant.js');

  const rpcUrl =
    (options as any).rpcUrl ?? 'https://api.mainnet-beta.solana.com';

  const kitSigner = await loadSolanaSignerFromOptions(options as any);

  const name =
    options.name ?? `ANT-${(kitSigner.address as string).slice(0, 8)}`;

  // ANT NFT metadata URI — required so the asset renders correctly in
  // marketplaces. Caller must upload a JSON metadata file (build via
  // `buildAntMetadata` from `@ar.io/sdk/solana`, host on Arweave via Turbo
  // or any other gateway) and pass the resulting URI here.
  const metadataUri = (options as any).metadataUri;
  if (!metadataUri || typeof metadataUri !== 'string') {
    throw new Error(
      'spawn-ant: --metadata-uri is required.\n\n' +
        'Build the JSON metadata with `buildAntMetadata` from `@ar.io/sdk/solana`,\n' +
        'upload it to Arweave (free for files under 100 KiB via @ardrive/turbo-sdk\n' +
        'with a `HexSolanaSigner`), then pass the resulting URI:\n' +
        '  --metadata-uri "ar://<txid>"            (canonical AR.IO scheme)\n' +
        '  --metadata-uri "https://<gateway>/raw/<txid>"   (immediate render)\n\n' +
        'See sdk/scripts/devnet-validation/populate-ant.ts for an end-to-end example.',
    );
  }

  return spawnSolanaANT({
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrlFromRpcUrl(rpcUrl)),
    signer: kitSigner,
    state: {
      name,
      uri: metadataUri,
      ticker: options.ticker,
      description: options.description,
      keywords: options.keywords,
      logo: options.logo,
      // `--target` is the AO convention for the @ record's tx id (see
      // initANTStateForAddress). Reuse it on Solana so the CLI surface stays
      // identical between backends.
      transactionId: (options as any).target,
    },
    ...((options as any).antProgramId
      ? { antProgramId: address((options as any).antProgramId) }
      : {}),
  });
}

export function getTokenCostParamsFromOptions(o: GetTokenCostCLIOptions) {
  o.intent ??= 'Buy-Name';
  o.type ??= 'lease';
  o.years ??= '1';

  if (!isValidIntent(o.intent)) {
    throw new Error(
      `Invalid intent. Valid intents are: ${validIntents.join(', ')}`,
    );
  }

  if (o.type !== 'lease' && o.type !== 'permabuy') {
    throw new Error(`Invalid type. Valid types are: lease, permabuy`);
  }

  return {
    type: o.type,
    quantity: o.quantity !== undefined ? +o.quantity : undefined,
    years: +o.years,
    intent: o.intent,
    name: requiredStringFromOptions(o, 'name'),
    fromAddress: addressFromOptions(o),
  };
}

export function fundFromFromOptions<
  O extends {
    fundFrom?: string;
  },
>(o: O): FundFrom {
  if (o.fundFrom !== undefined) {
    if (!isValidFundFrom(o.fundFrom)) {
      throw new Error(
        `Invalid fund from: ${o.fundFrom}. Please use one of ${fundFromOptions.join(', ')}`,
      );
    }
  }
  return o.fundFrom ?? 'balance';
}

export function referrerFromOptions<
  O extends {
    referrer?: string;
  },
>(o: O): string | undefined {
  return o.referrer;
}

/** Parse `--withdrawal-id` from CLI options into a bigint. */
export function withdrawalIdFromOptions<
  O extends {
    withdrawalId?: string;
  },
>(o: O): bigint | undefined {
  if (o.withdrawalId === undefined) return undefined;
  try {
    return BigInt(o.withdrawalId);
  } catch {
    throw new Error(
      `Invalid --withdrawal-id: '${o.withdrawalId}' is not a valid u64 integer`,
    );
  }
}

/**
 * Parse `--funding-plan-json` into a `FundingSourceSpec[]`. Validates each
 * entry's `kind` against the on-chain enum and parses `amount` as a bigint.
 * Each Delegation/OperatorStake entry MAY carry a `gateway` field (base58
 * Solana address) — required when the plan spans multiple gateways.
 *
 * Format examples:
 *   '[{"kind":"balance","amount":"100"},{"kind":"withdrawal","amount":"500"}]'
 *   '[{"kind":"delegation","amount":"100","gateway":"Gw1..."},{"kind":"delegation","amount":"50","gateway":"Gw2..."}]'
 *
 * Returns undefined when the flag isn't set; throws Error on malformed JSON
 * or unknown kinds.
 */
export function fundingPlanFromOptions<
  O extends {
    fundingPlanJson?: string;
  },
>(o: O): { kind: string; amount: bigint; gateway?: string }[] | undefined {
  if (!o.fundingPlanJson) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(o.fundingPlanJson);
  } catch (err) {
    throw new Error(`--funding-plan-json is not valid JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('--funding-plan-json must be a JSON array');
  }
  const validKinds = new Set([
    'balance',
    'delegation',
    'operatorStake',
    'withdrawal',
  ]);
  return parsed.map((entry, idx) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as { kind?: unknown }).kind !== 'string' ||
      typeof (entry as { amount?: unknown }).amount !== 'string'
    ) {
      throw new Error(
        `--funding-plan-json[${idx}] must be { kind: string, amount: string, gateway?: string }`,
      );
    }
    const e = entry as { kind: string; amount: string; gateway?: unknown };
    if (!validKinds.has(e.kind)) {
      throw new Error(
        `--funding-plan-json[${idx}].kind must be one of ${[...validKinds].join(', ')} (got '${e.kind}')`,
      );
    }
    let amount: bigint;
    try {
      amount = BigInt(e.amount);
    } catch {
      throw new Error(
        `--funding-plan-json[${idx}].amount '${e.amount}' is not a valid u64`,
      );
    }
    if (amount <= 0n) {
      throw new Error(
        `--funding-plan-json[${idx}].amount must be > 0 (got ${e.amount})`,
      );
    }
    const out: { kind: string; amount: bigint; gateway?: string } = {
      kind: e.kind,
      amount,
    };
    if (e.gateway !== undefined) {
      if (typeof e.gateway !== 'string') {
        throw new Error(
          `--funding-plan-json[${idx}].gateway must be a base58 Solana address`,
        );
      }
      if (e.kind !== 'delegation' && e.kind !== 'operatorStake') {
        throw new Error(
          `--funding-plan-json[${idx}].gateway is only valid for kind 'delegation' or 'operatorStake' (got '${e.kind}')`,
        );
      }
      out.gateway = e.gateway;
    }
    return out;
  });
}

export function assertLockLengthInRange(
  lockLengthMs: number,
  assertMin = true, // extend-vault has no min lock length
) {
  const minLockLengthMs = 1209600000; // 14 days
  const maxLockLengthMs = 378432000000; // ~12 years

  if (lockLengthMs > maxLockLengthMs) {
    throw new Error(
      `Lock length must be at most 12 years (378432000000 ms). Provided lock length: ${lockLengthMs} ms`,
    );
  }
  if (!assertMin) {
    return;
  }

  if (lockLengthMs < minLockLengthMs) {
    throw new Error(
      `Lock length must be at least 14 days (1209600000 ms). Provided lock length: ${lockLengthMs} ms`,
    );
  }
}

export function antRecordMetadataFromOptions<
  O extends {
    owner?: string;
    displayName?: string;
    logo?: string;
    description?: string;
    keywords?: string[];
  },
>(
  options: O,
): {
  owner?: string;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
} {
  return {
    ...(options.owner != null &&
      options.owner !== '' && { owner: options.owner }),
    ...(options.displayName != null &&
      options.displayName !== '' && { displayName: options.displayName }),
    ...(options.logo != null && options.logo !== '' && { logo: options.logo }),
    ...(options.description != null &&
      options.description !== '' && { description: options.description }),
    ...(options.keywords != null &&
      options.keywords.length > 0 && { keywords: options.keywords }),
  };
}
