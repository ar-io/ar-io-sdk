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
    description: 'Private key to use with the action',
  },
  dev: {
    alias: '--dev',
    description: 'Run against the AR.IO devnet process',
    type: 'boolean',
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
    alias: '-t, --target <target>',
    description: 'The target address to interact with',
  },
  quantity: {
    alias: '-q, --quantity <quantity>',
    description: 'The quantity of IO to interact with',
  },
  disableAutoStake: {
    alias: '--disable-auto-stake',
    description: 'Disallow auto-staking of operator rewards',
    type: 'boolean',
  },
  disableDelegatedStaking: {
    alias: '--disable-delegated-staking',
    description: 'Disallow delegating stake to the gateway',
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
      'The allowed delegates for the gateway. By default this is empty, meaning all are allowed delegate stake',
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
};

export const globalOptions = [
  optionMap.dev,
  optionMap.debug,
  optionMap.processId,
  optionMap.skipConfirmation,
];

export const walletOptions = [
  ...globalOptions,
  optionMap.walletFile,
  // optionMap.mnemonic,
  optionMap.privateKey,
];

export const paginationOptions = [
  ...walletOptions,
  optionMap.cursor,
  optionMap.limit,
  optionMap.sortBy,
  optionMap.sortOrder,
];

export const epochOptions = [
  ...globalOptions,
  optionMap.epochIndex,
  optionMap.timestamp,
];

export const addressOptions = [...walletOptions, optionMap.address];

export const paginationAddressOptions = [
  optionMap.address,
  ...paginationOptions,
];

export const nameOptions = [optionMap.name];

export const initiatorOptions = [optionMap.initiator];
export const initiatorAndNameOptions = [...initiatorOptions, ...nameOptions];

export const getVaultOptions = [...addressOptions, optionMap.vaultId];

export const transferOptions = [
  ...walletOptions,
  optionMap.quantity,
  optionMap.target,
];

export const tokenCostOptions = [
  ...globalOptions,
  optionMap.name,
  optionMap.intent,
  optionMap.type,
  optionMap.years,
  optionMap.quantity,
];

export const arNSAuctionPricesOptions = [
  ...globalOptions,
  optionMap.name,
  optionMap.type,
  optionMap.years,
  optionMap.timestamp,
  optionMap.intervalMs,
];

export const joinNetworkOptions = [
  ...walletOptions,
  optionMap.operatorStake,
  optionMap.disableAutoStake,
  optionMap.disableDelegatedStaking,
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
