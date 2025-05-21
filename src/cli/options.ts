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

export const optionMap = {
  walletFile: {
    alias: '-w, --wallet-file <walletFilePath>',
    description: 'The file path to the wallet to use for the interaction',
  },
  // mnemonic: {
  //   alias: '-m, --mnemonic <phrase>',
  //   description: 'Mnemonic to use with the action',
  // },
  privateKey: {
    alias: '--private-key <key>',
    description: 'Stringified private key to use with the action',
  },
  mainnet: {
    alias: '--mainnet',
    description: 'Run against the AR.IO mainnet process',
    type: 'boolean',
  },
  testnet: {
    alias: '--testnet',
    description: 'Run against the AR.IO testnet process',
    type: 'boolean',
  },
  devnet: {
    alias: '--dev, --devnet',
    description: 'Run against the AR.IO devnet process',
    type: 'boolean',
  },
  arioProcessId: {
    alias: '--ario-process-id <arioProcessId>',
    description: 'Run against a custom AR.IO process id',
  },
  cuUrl: {
    alias: '--cu-url <cuUrl>',
    description: 'The URL for a custom compute unit',
  },
  paymentUrl: {
    alias: '--payment-url <paymentUrl>',
    description: 'The URL for a custom turbo payment service',
  },
  processId: {
    alias: '--process-id <processId>',
    description: 'The process ID to interact with',
  },
  debug: {
    alias: '--debug',
    description: 'Enable debug log output',
    type: 'boolean',
  },
  address: {
    alias: '-a, --address <address>',
    description: 'The address to interact with',
  },
  target: {
    alias: '--target <target>',
    description: 'The target address to interact with',
  },
  source: {
    alias: '--source <source>',
    description: 'The source address to interact with',
  },
  quantity: {
    alias: '-q, --quantity <quantity>',
    description: 'The quantity of ARIO to interact with',
  },
  autoStake: {
    alias: '--auto-stake',
    description: 'Enable auto-staking of operator rewards',
    type: 'boolean',
  },
  allowDelegatedStaking: {
    alias: '--allow-delegated-staking',
    description: 'Allow delegating stake to the gateway',
    type: 'boolean',
  },
  minDelegatedStake: {
    alias: '--min-delegated-stake <minDelegatedStake>',
    description: 'The minimum delegated stake allowed',
  },
  delegateRewardShareRatio: {
    alias: '--delegate-reward-share-ratio <delegateRewardShareRatio>',
    description: 'The percentage of rewards to share with delegates',
  },
  label: {
    alias: '--label <label>',
    description: 'The label for the gateway',
  },
  note: {
    alias: '--note <note>',
    description: 'The note for the gateway',
  },
  properties: {
    alias: '--properties <properties>',
    description: 'The properties for the gateway',
  },
  observerAddress: {
    alias: '--observer-address <observerAddress>',
    description: 'The observer wallet address for the gateway',
  },
  fqdn: {
    alias: '--fqdn <fqdn>',
    description: 'The fully qualified domain name for the gateway',
  },
  port: {
    alias: '--port <port>',
    description: 'The port for the gateway',
  },
  protocol: {
    alias: '--protocol <protocol>',
    description: 'The protocol for the gateway',
  },
  allowedDelegates: {
    alias: '--allowed-delegates <allowedDelegates...>',
    description:
      'The allowed delegates for the gateway. By default this is empty, meaning all are allowed delegate stake unless delegating is explicitly disallowed by the gateway',
    type: 'array',
  },
  skipConfirmation: {
    alias: '--skip-confirmation',
    description: 'Skip confirmation prompts',
    type: 'boolean',
  },
  vaultId: {
    alias: '--vault-id <vaultId>',
    description: 'The vault ID to interact with',
  },
  operatorStake: {
    alias: '--operator-stake <operatorStake>',
    description: 'The operator stake to interact with',
  },
  name: {
    alias: '--name <name>',
    description: 'The ArNS name to interact with',
  },
  epochIndex: {
    alias: '--epoch-index <epochIndex>',
    description: 'The epoch index to interact with',
  },
  timestamp: {
    alias: '--timestamp <timestamp>',
    description: 'The timestamp to interact with',
  },
  initiator: {
    alias: '--initiator <initiator>',
    description: 'The initiator of the action',
  },
  intent: {
    alias: '--intent <intent>',
    description: 'The intent for the cost details action',
  },
  type: {
    alias: '--type <type>',
    description:
      'The type for the cost details action. Either "lease" or "permabuy"',
  },
  years: {
    alias: '--years <years>',
    description: 'The number of years for the cost details action',
  },
  intervalMs: {
    alias: '--interval-ms <intervalMs>',
    description: 'The interval in milliseconds for the action',
  },
  cursor: {
    alias: '--cursor <cursor>',
    description: 'The cursor for pagination',
  },
  limit: {
    alias: '--limit <limit>',
    description: 'The limit for pagination',
  },
  sortBy: {
    alias: '--sort-by <sortBy>',
    description: 'The field to sort by',
  },
  sortOrder: {
    alias: '--sort-order <sortOrder>',
    description: 'The order to sort by, either "asc" or "desc"',
  },
  tags: {
    description:
      'An array of additional tags for the write action, in "--tags name1 value1 name2 value2" format',
    alias: '--tags <tags...>',
    type: 'array',
  },
  instant: {
    alias: '--instant',
    description: 'Use the instant transaction method',
    type: 'boolean',
  },
  increaseCount: {
    alias: '--increase-count <increaseCount>',
    description: 'Amount to increase the undername count of the record by',
  },
  undername: {
    alias: '--undername <undername>',
    description: 'The undername to interact with',
  },
  controller: {
    alias: '--controller <controller>',
    description: 'The controller to interact with',
  },
  controllers: {
    alias: '--controllers <controllers...>',
    description: 'The controller to interact with',
    type: 'array',
  },
  transactionId: {
    alias: '--transaction-id <transactionId>',
    description: 'The transaction ID to interact with',
  },
  ttlSeconds: {
    alias: '--ttl-seconds <ttlSeconds>',
    description: 'The TTL in seconds for the record',
  },
  ticker: {
    alias: '--ticker <ticker>',
    description: 'The ticker for the ANT',
  },
  description: {
    alias: '--description <description>',
    description: 'The description for the ANT',
  },
  keywords: {
    alias: '--keywords <keywords...>',
    description: 'The keywords for the ANT',
    type: 'array',
  },
  names: {
    alias: '--names <names...>',
    description: 'The names to interact with',
    type: 'array',
  },
  failedGateways: {
    alias: '--failed-gateways <failedGateways...>',
    description: 'Include failed gateways in the list',
    type: 'array',
  },
  fundFrom: {
    alias: '--fund-from <fundFrom>',
    description:
      'Where to fund the action from. e.g. "balance", "stakes", or "any',
  },
  revokable: {
    alias: '--revokable',
    description:
      'Whether the vaulted transfer is revokable by the sender. Defaults to false',
    type: 'boolean',
  },
  lockLengthMs: {
    alias: '--lock-length-ms <lockLengthMs>',
    description: 'The length of time in milliseconds to lock the vault for',
  },
  extendLengthMs: {
    alias: '--extend-length-ms <extendLengthMs>',
    description: 'The length of time in milliseconds to extend the vault for',
  },
  recipient: {
    alias: '--recipient <recipient>',
    description: 'The recipient to interact with',
  },
  logo: {
    alias: '--logo <logo>',
    description: 'The ANT logo',
  },
  token: {
    alias: '-t, --token <type>',
    description: 'Crypto token type for wallet or action',
    default: 'arweave',
  },
  paidBy: {
    alias: '--paid-by <paidBy...>',
    description: 'Addresses to pay for the interaction',
    type: 'array',
  },
};

export const walletOptions = [
  optionMap.walletFile,
  optionMap.token,
  // optionMap.mnemonic,
  optionMap.privateKey,
];

export const globalOptions = [
  ...walletOptions,
  optionMap.devnet,
  optionMap.testnet,
  optionMap.mainnet,
  optionMap.debug,
  optionMap.arioProcessId,
  optionMap.cuUrl,
];

export const writeActionOptions = [optionMap.skipConfirmation, optionMap.tags];

export const arnsPurchaseOptions = [
  ...writeActionOptions,
  optionMap.name,
  optionMap.fundFrom,
  optionMap.paidBy,
  optionMap.paymentUrl,
];

export const epochOptions = [optionMap.epochIndex, optionMap.timestamp];

export const addressAndVaultIdOptions = [optionMap.address, optionMap.vaultId];

export const nameWriteOptions = [...writeActionOptions, optionMap.name];

export const paginationOptions = [
  optionMap.cursor,
  optionMap.limit,
  optionMap.sortBy,
  optionMap.sortOrder,
];

export const paginationAddressOptions = [
  optionMap.address,
  ...paginationOptions,
];

export const getVaultOptions = addressAndVaultIdOptions;

export const tokenCostOptions = [
  optionMap.name,
  optionMap.intent,
  optionMap.type,
  optionMap.years,
  optionMap.quantity,
  optionMap.address,
  optionMap.fundFrom,
  optionMap.paymentUrl,
];

export const transferOptions = [
  ...writeActionOptions,
  optionMap.quantity,
  optionMap.target,
];

export const vaultedTransferOptions = [
  ...writeActionOptions,
  optionMap.quantity,
  optionMap.recipient,
  optionMap.lockLengthMs,
  optionMap.revokable,
];

export const operatorStakeOptions = [
  ...writeActionOptions,
  optionMap.operatorStake,
];

export const redelegateStakeOptions = [...transferOptions, optionMap.source];

export const delegateStakeOptions = transferOptions;

export const decreaseDelegateStakeOptions = [
  ...delegateStakeOptions,
  optionMap.instant,
];

export const updateGatewaySettingsOptions = [
  ...writeActionOptions,
  optionMap.autoStake,
  optionMap.allowDelegatedStaking,
  optionMap.allowedDelegates,
  optionMap.minDelegatedStake,
  optionMap.delegateRewardShareRatio,
  optionMap.label,
  optionMap.note,
  optionMap.properties,
  optionMap.observerAddress,
  optionMap.fqdn,
  optionMap.port,
  optionMap.protocol,
];

export const joinNetworkOptions = [
  ...updateGatewaySettingsOptions,
  optionMap.operatorStake,
];

export const buyRecordOptions = [
  ...arnsPurchaseOptions,
  optionMap.quantity,
  optionMap.type,
  optionMap.years,
  optionMap.processId,
];

export const antStateOptions = [
  ...writeActionOptions,
  optionMap.target,
  optionMap.keywords,
  optionMap.ticker,
  optionMap.name,
  optionMap.description,
  optionMap.controllers,
  optionMap.ttlSeconds,
  optionMap.logo,
];

export const setAntBaseNameOptions = [
  optionMap.processId,
  optionMap.transactionId,
  optionMap.ttlSeconds,
  ...writeActionOptions,
];

export const setAntUndernameOptions = [
  ...setAntBaseNameOptions,
  optionMap.undername,
];
