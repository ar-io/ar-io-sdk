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
import { balanceOptions, globalOptions } from './options.js';
import { makeCommand, runCommand } from './utils.js';

makeCommand({
  name: 'ar-io', // TODO: can it be ar.io?
  description: 'AR.IO Network CLI',
  options: globalOptions,
})
  .version(version)
  .helpCommand(true);

//  ar-io delegate-stake --wallet BAD_BOY_NO_ALLOW_WALLET --gateway permagate.io --stakeQty 1500 --unit IO

// balance --address <address> or --wallet-file <wallet-file>
makeCommand({
  name: 'balance',
  description: 'Get the balance of an address',
  options: balanceOptions,
}).action(async (_, command) => {
  await runCommand(command, balance);
});

// join-network

// delegate-stake

// withdraw-stake

if (
  process.argv[1].includes('bin/turbo') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
