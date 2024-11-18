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
    alias: '-d, --dev',
    description: 'Run against the dev-net process',
    default: false,
  },
  processId: {
    alias: '--process-id <processId>',
    description: 'The process ID to interact with',
  },
  retries: {
    alias: '-r, --retries <retries>',
    description: 'The number of times to retry the interaction',
  },
  tags: {
    alias: '-t, --tags <tags>',
    description: 'The tags to use for the interaction',
  },
  address: {
    alias: '-a, --address <address>',
    description: 'The address to interact with',
  },
};

export const globalOptions = [optionMap.dev, optionMap.processId];

export const walletOptions = [
  ...globalOptions,
  optionMap.walletFile,
  // optionMap.mnemonic,
  optionMap.privateKey,
];

export const balanceOptions = [...walletOptions, optionMap.address];

// Option Types
export type GlobalOptions = {
  dev: boolean;
  processId: string | undefined;
  gateway: string | undefined;
};

export type WalletOptions = GlobalOptions & {
  walletFile: string | undefined;
  mnemonic: string | undefined;
  privateKey: string | undefined;
};

export type AddressOptions = WalletOptions & {
  address: string | undefined;
};

export type BalanceOptions = AddressOptions;
