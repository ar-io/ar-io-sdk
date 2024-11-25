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
  epochOptions,
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
  EpochOptions,
  GetVaultOptions,
  GlobalOptions,
  NameOptions,
  PaginationAddressOptions,
  PaginationOptions,
} from './types.js';
import {
  epochInputFromOptions,
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
  name: 'get-gateway-delegate-allow-list',
  description: 'Get the allow list of a gateway delegate',
  options: paginationAddressOptions,
}).action(async (_, command) => {
  await runCommand<PaginationAddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getAllowedDelegates({
      address,
      ...paginationParamsFromOptions(options),
    });

    return result.items?.length
      ? result.items
      : {
          message: `No allow list found for gateway delegate ${address}`,
        };
  });
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

// getArNSReservedNames(
makeCommand({
  name: 'get-arns-reserved-names',
  description: 'Get all reserved ArNS names',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getArNSReservedNames({
      ...paginationParamsFromOptions(options),
    });
    return result.items;
  });
});

makeCommand({
  name: 'get-arns-reserved-name',
  description: 'Get a reserved ArNS name',
  options: nameOptions,
}).action(async (_, command) => {
  await runCommand<NameOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getArNSReservedName({
      name: requiredNameFromOptions(options),
    });
    return (
      result ?? { message: `No reserved name found for name ${options.name}` }
    );
  });
});

makeCommand({
  name: 'get-arns-auctions',
  description: 'Get all ArNS auctions',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getArNSAuctions({
      ...paginationParamsFromOptions(options),
    });
    return result.items;
  });
});

makeCommand({
  name: 'get-arns-auction',
  description: 'Get an ArNS auction by name',
  options: nameOptions,
}).action(async (_, command) => {
  await runCommand<NameOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getArNSAuction({
      name: requiredNameFromOptions(options),
    });
    return result ?? { message: `No auction found for name ${options.name}` };
  });
});

// makeCommand({
//   name: 'get-arns-auction-prices',
//   description: 'Get ArNS auction prices',
//   options: paginationOptions, // TODO: AoArNSAuctionPricesParams
// }).action(async (_, command) => {
//   await runCommand<PaginationOptions>(command, async (options) => {
//     const result = await readIOFromOptions(options).getArNSAuctionPrices({
//       ...paginationParamsFromOptions(options),
//     });
//     return result.items;
//   });
// });

makeCommand({
  name: 'get-epoch',
  description: 'Get epoch data',
  options: epochOptions,
}).action(async (_, command) => {
  await runCommand<EpochOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getEpoch(
      epochInputFromOptions(options),
    );
    return result ?? { message: `No epoch found for provided input` };
  });
});

makeCommand({
  name: 'get-current-epoch',
  description: 'Get current epoch data',
  options: [],
}).action(async (_, command) => {
  await runCommand<GlobalOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getCurrentEpoch();
    return result;
  });
});

makeCommand({
  name: 'get-prescribed-observers',
  description: 'Get prescribed observers for an epoch',
  options: epochOptions,
}).action(async (_, command) => {
  await runCommand<EpochOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getPrescribedObservers(
      epochInputFromOptions(options),
    );

    return result.length ? result : { message: `No observers found for epoch` };
  });
});

makeCommand({
  name: 'get-prescribed-names',
  description: 'Get prescribed names for an epoch',
  options: epochOptions,
}).action(async (_, command) => {
  await runCommand<EpochOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getPrescribedNames(
      epochInputFromOptions(options),
    );
    return result.length ? result : { message: `No names found for epoch` };
  });
});

makeCommand({
  name: 'get-observations',
  description: 'Get observations for an epoch',
  options: epochOptions,
}).action(async (_, command) => {
  await runCommand<EpochOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getObservations(
      epochInputFromOptions(options),
    );
    return result;
  });
});

makeCommand({
  name: 'get-distributions',
  description: 'Get distributions for an epoch',
  options: epochOptions,
}).action(async (_, command) => {
  await runCommand<EpochOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getDistributions(
      epochInputFromOptions(options),
    );
    return result;
  });
});

// TODO: get token cost options
// makeCommand({
//   name: 'get-token-cost',
//   description: 'Get token cost',
//   options: [],
// }).action(async (_, command) => {
//   await runCommand<GlobalOptions>(command, async (options) => {
//     const result = await readIOFromOptions(options).getTokenCost();
//     return result;
//   });
// });

makeCommand({
  name: 'get-registration-fees',
  description: 'Get registration fees',
  options: [],
}).action(async (_, command) => {
  await runCommand<GlobalOptions>(command, async (options) => {
    return readIOFromOptions(options).getRegistrationFees();
  });
});

makeCommand({
  name: 'get-demand-factor',
  description: 'Get demand factor',
  options: [],
}).action(async (_, command) => {
  await runCommand<GlobalOptions>(command, async (options) => {
    return readIOFromOptions(options).getDemandFactor();
  });
});

makeCommand({
  name: 'list-vaults',
  description: 'Get all wallet vaults',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getVaults({
      ...paginationParamsFromOptions(options),
    });
    return result.items.length ? result.items : { message: 'No vaults found' };
  });
});

makeCommand({
  name: 'get-vault',
  description: 'Get a vault',
  options: getVaultOptions,
}).action(async (_, command) => {
  await runCommand<GetVaultOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const vaultId = options.vaultId;
    if (vaultId === undefined) {
      throw new Error('--vault-id is required');
    }
    const result = await readIOFromOptions(options).getVault({
      address,
      vaultId,
    });
    return (
      result ?? {
        message: `No vault found for address ${address} and vault ID ${vaultId}`,
      }
    );
  });
});

// TODO: initiator and name params
// makeCommand({
//   name: 'get-primary-name-request',
//   description: 'Get primary name request',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).getPrimaryNameRequest({
//       address,
//     });
//     return (
//       result ?? {
//         message: `No primary name request found for address ${address}`,
//       }
//     );
//   });
// });

makeCommand({
  name: 'get-primary-name-requests',
  description: 'Get primary name requests',
  options: paginationAddressOptions, // todo; add initiator
}).action(async (_, command) => {
  await runCommand<PaginationAddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getPrimaryNameRequests({
      initiator: address,
      ...paginationParamsFromOptions(options),
    });
    return result.items.length
      ? result.items
      : { message: 'No requests found' };
  });
});

makeCommand({
  name: 'get-primary-name',
  description: 'Get primary name',
  options: addressOptions, // todo: or name
}).action(async (_, command) => {
  await runCommand<AddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getPrimaryName({
      address,
    });
    return (
      result ?? { message: `No primary name found for address ${address}` }
    );
  });
});

makeCommand({
  name: 'get-primary-names',
  description: 'Get primary names',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getPrimaryNames({
      ...paginationParamsFromOptions(options),
    });
    return result.items;
  });
});

makeCommand({
  name: 'get-redelegation-fee',
  description: 'Get redelegation fee',
  options: addressOptions,
}).action(async (_, command) => {
  await runCommand<AddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getRedelegationFee({
      address,
    });
    return result;
  });
});

// makeCommand({
//   name: 'delegate-stake',
//   description: 'Delegate stake to a gateway',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).delegateStake({ address });
//     return result;
//   });
// });

// makeCommand({
//   name: 'increase-operator-stake',
//   description: 'Increase the stake of an operator',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).increaseOperatorStake({
//       address,
//     });
//     return result;
//   });
// });

// makeCommand({
//   name: 'decrease-operator-stake',
//   description: 'Decrease the stake of an operator',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).decreaseOperatorStake({
//       address,
//     });
//     return result;
//   });
// });

// makeCommand({
//   name: 'withdraw-stake',
//   description: 'Withdraw stake from a gateway',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).withdrawStake({ address });
//     return result;
//   });
// });

// makeCommand({
//   name: 'update-gateway-settings',
//   description: 'Update the settings of a gateway',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).updateGatewaySettings({
//       address,
//     });
//     return result;
//   });
// });

// makeCommand({
//   name: 'redelegate-stake',
//   description: 'Redelegate stake to another gateway',
//   options: addressOptions,
// }).action(async (_, command) => {
//   await runCommand<AddressOptions>(command, async (options) => {
//     const address = requiredAddressFromOptions(options);
//     const result = await readIOFromOptions(options).redelegateStake({
//       address,
//     });
//     return result;
//   });
// });

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
  name: 'list-balances',
  description: 'List all balances',
  options: paginationOptions,
}).action(async (_, command) => {
  await runCommand<PaginationOptions>(command, async (options) => {
    const result = await readIOFromOptions(options).getBalances({
      ...paginationParamsFromOptions(options),
    });
    return result.items;
  });
});

makeCommand({
  name: 'get-gateway-vaults',
  description: 'Get the vaults of a gateway',
  options: paginationAddressOptions,
}).action(async (_, command) => {
  await runCommand<PaginationAddressOptions>(command, async (options) => {
    const address = requiredAddressFromOptions(options);
    const result = await readIOFromOptions(options).getGatewayVaults({
      address,
      ...paginationParamsFromOptions(options),
    });

    return result.items?.length
      ? result.items
      : {
          message: `No vaults found for gateway ${address}`,
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
