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

import { mIOToken } from '../types/token.js';
import { version } from '../version.js';
import { joinNetwork } from './commands/joinNetwork.js';
import { transfer } from './commands/transfer.js';
import {
  addressOptions,
  getVaultOptions,
  globalOptions,
  joinNetworkOptions,
  nameOptions,
  paginationAddressOptions,
  paginationOptions,
  transferOptions,
} from './options.js';
import {
  AddressOptions,
  GetVaultOptions,
  GlobalOptions,
  NameOptions,
  PaginationAddressOptions,
  PaginationOptions,
} from './types.js';
import {
  formatIOWithCommas,
  makeCommand,
  paginationParamsFromOptions,
  readIOFromOptions,
  requiredAddressFromOptions,
  requiredNameFromOptions,
  runCommand,
} from './utils.js';

makeCommand({
  name: 'ar.io', // TODO: can it be ar.io?
  description: 'AR.IO Network CLI',
  options: globalOptions,
})
  .version(version)
  .helpCommand(true);

makeCommand({
  name: 'info',
  description: 'Get network info',
  options: [],
}).action(async (_, command) => {
  await runCommand<GlobalOptions>(command, async (options) => {
    return readIOFromOptions(options).getInfo();
  });
});

makeCommand({
  name: 'token-supply',
  description: 'Get the total token supply',
  options: [],
}).action(async (_, command) => {
  await runCommand<GlobalOptions>(command, async (options) => {
    return readIOFromOptions(options).getTokenSupply();
  });
});

makeCommand({
  name: 'get-vault',
  description: 'Get the vault of provided address and vault ID',
  options: getVaultOptions,
}).action(async (_, command) => {
  await runCommand<GetVaultOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const vaultId = options.vaultId;
    if (vaultId === undefined) {
      throw new Error('--vault-id is required');
    }
    const io = readIOFromOptions(options);
    const result = await io.getVault({ address, vaultId });
    return (
      result ?? {
        message: `No vault found for address ${address} and vault ID ${vaultId}`,
      }
    );
  });
});

makeCommand({
  name: 'get-gateway',
  description: 'Get the gateway of an address',
  options: addressOptions,
}).action(async (_, command) => {
  await runCommand<AddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getGateway({ address });
    return (
      result ?? {
        message: `No gateway found for address ${address}`,
      }
    );
  });
});

makeCommand({
  name: 'get-gateways',
  description: 'Get the gateways of the network',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getGateways({
      ...paginationParamsFromOptions(options),
    });

    return result.items.length
      ? result.items
      : { message: 'No gateways found' };
  });
});

makeCommand({
  name: 'get-gateway-delegates',
  description: 'Get the delegates of a gateway',
  options: paginationAddressOptions,
}).action(async (_, command) => {
  await runCommand<PaginationAddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getGatewayDelegates({
      address,
      ...paginationParamsFromOptions(options),
    });

    return result.items?.length
      ? result.items
      : {
          message: `No delegates found for gateway ${address}`,
        };
  });
});

makeCommand({
  name: 'get-delegations',
  description: 'Get all stake delegated to gateways from this address',
  options: addressOptions,
}).action(async (_, command) => {
  await runCommand<AddressOptions & PaginationOptions>(
    command,
    async (options) => {
      const address = requiredAddressFromOptions(options);
      const result = await readIOFromOptions(options).getDelegations({
        address,
        ...paginationParamsFromOptions(options),
      });

      return result.items?.length
        ? result.items
        : {
            message: `No delegations found for address ${address}`,
          };
    },
  );
});

makeCommand({
  name: 'get-arns-record',
  description: '',
  options: nameOptions,
}).action(async (_, command) => {
  await runCommand<NameOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getArNSRecord({
      name: requiredNameFromOptions(options),
    });
    return result ?? { message: `No record found for name ${options.name}` };
  });
});

makeCommand({
  name: 'list-arns-records',
  description: 'List all ArNS records',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getArNSRecords({
      ...paginationParamsFromOptions(options),
    });
    return result.items;
  });
});

makeCommand({
  name: 'balance',
  description: 'Get the balance of an address',
  options: addressOptions,
}).action(async (_, command) => {
  await runCommand<AddressOptions>(command, async (options) => {
    const io = readIOFromOptions(options);
    const address = requiredAddressFromOptions(options);
    const result = await io.getBalance({ address });
    return {
      address: address,
      mIOBalance: result,
      message: `Provided address current has a balance of ${formatIOWithCommas(new mIOToken(result).toIO())} IO`,
    };
  });
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
