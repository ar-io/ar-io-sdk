#!/usr/bin/env node

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
// eslint-disable-next-line header/header -- This is a CLI file
import { program } from 'commander';

import { version } from '../version.js';
import { balance } from './commands/balance.js';
import { joinNetwork } from './commands/joinNetwork.js';
import { transfer } from './commands/transfer.js';
import {
  balanceOptions,
  globalOptions,
  joinNetworkOptions,
  transferOptions,
} from './options.js';
import { makeCommand, runCommand } from './utils.js';

makeCommand({
  name: 'ar.io', // TODO: can it be ar.io?
  description: 'AR.IO Network CLI',
  options: globalOptions,
})
  .version(version)
  .helpCommand(true);

makeCommand({
  name: 'balance',
  description: 'Get the balance of an address',
  options: balanceOptions,
}).action(async (_, command) => {
  await runCommand(command, balance);
});

makeCommand({
  name: 'join-network',
  description: 'Join the AR.IO network',
  options: joinNetworkOptions,
}).action(async (_, command) => {
  await runCommand(command, joinNetwork);
});

// delegate-stake

// increase-operator-stake

// decrease-operator-stake

// withdraw-stake

// update-gateway-settings

// transfer
makeCommand({
  name: 'transfer',
  description: 'Transfer IO to another address',
  options: transferOptions,
}).action(async (_, command) => {
  await runCommand(command, transfer);
});

// redelegate-stake

if (
  process.argv[1].includes('bin/ar.io') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
