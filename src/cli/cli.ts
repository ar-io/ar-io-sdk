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

import { intentsUsingYears, isValidIntent, validIntents } from '../types/io.js';
import { mIOToken } from '../types/token.js';
import { version } from '../version.js';
import { delegateStake } from './commands/delegateStake.js';
import { joinNetwork } from './commands/joinNetwork.js';
import { transfer } from './commands/transfer.js';
import { updateGatewaySettings } from './commands/updateGatewaySettings.js';
import {
  addressAndVaultIdOptions,
  addressOptions,
  arNSAuctionPricesOptions,
  decreaseDelegateStakeOptions,
  delegateStakeOptions,
  epochOptions,
  getVaultOptions,
  globalOptions,
  initiatorOptions,
  joinNetworkOptions,
  nameOptions,
  operatorStakeOptions,
  optionMap,
  paginationAddressOptions,
  paginationOptions,
  redelegateStakeOptions,
  tokenCostOptions,
  transferOptions,
  updateGatewaySettingsOptions,
  walletOptions,
} from './options.js';
import {
  AddressAndNameOptions,
  AddressAndVaultIdOptions,
  AddressOptions,
  AuctionPricesOptions,
  DecreaseDelegateStakeOptions,
  EpochOptions,
  GetTokenCostOptions,
  GetVaultOptions,
  InitiatorOptions,
  NameOptions,
  OperatorStakeOptions,
  PaginationAddressOptions,
  PaginationOptions,
  RedelegateStakeOptions,
  WalletOptions,
} from './types.js';
import {
  addressFromOptions,
  epochInputFromOptions,
  formatIOWithCommas,
  makeCommand,
  paginationParamsFromOptions,
  readIOFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredInitiatorFromOptions,
  requiredNameFromOptions,
  requiredOperatorStakeFromOptions,
  requiredTargetAndQuantityFromOptions,
  requiredVaultIdFromOptions,
  runCommand,
  writeIOFromOptions,
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
  action: (options) => readIOFromOptions(options).getInfo(),
});

makeCommand({
  name: 'token-supply',
  description: 'Get the total token supply',
  action: (options) => readIOFromOptions(options).getTokenSupply(),
});

makeCommand({
  name: 'get-registration-fees',
  description: 'Get registration fees',
  action: (options) => readIOFromOptions(options).getRegistrationFees(),
});

makeCommand({
  name: 'get-demand-factor',
  description: 'Get demand factor',
  action: (options) => readIOFromOptions(options).getDemandFactor(),
});

makeCommand<AddressOptions>({
  name: 'get-gateway',
  description: 'Get the gateway of an address',
  options: addressOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getGateway({ address: requiredAddressFromOptions(o) })
      .then(
        (r) =>
          r ?? {
            message: `No gateway found`,
          },
      ),
});

makeCommand<PaginationOptions>({
  name: 'list-gateways',
  description: 'List the gateways of the network',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getGateways(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No gateways found' },
      ),
});

makeCommand<PaginationAddressOptions>({
  name: 'get-gateway-delegates',
  description: 'Get the delegates of a gateway',
  options: paginationAddressOptions,
  action: async (o) => {
    const address = requiredAddressFromOptions(o);
    const result = await readIOFromOptions(o).getGatewayDelegates({
      address,
      ...paginationParamsFromOptions(o),
    });

    return result.items?.length
      ? result
      : {
          message: `No delegates found for gateway ${address}`,
        };
  },
});

makeCommand<PaginationAddressOptions>({
  name: 'get-delegations',
  description: 'Get all stake delegated to gateways from this address',
  options: addressOptions,
  action: async (o) => {
    const address = requiredAddressFromOptions(o);
    const result = await readIOFromOptions(o).getDelegations({
      address,
      ...paginationParamsFromOptions(o),
    });

    return result.items?.length
      ? result
      : {
          message: `No delegations found for address ${address}`,
        };
  },
});

makeCommand<PaginationAddressOptions>({
  name: 'get-allowed-delegates',
  description: 'Get the allow list of a gateway delegate',
  options: paginationAddressOptions,
  action: async (o) => {
    const address = requiredAddressFromOptions(o);
    const result = await readIOFromOptions(o).getAllowedDelegates({
      address,
      ...paginationParamsFromOptions(o),
    });

    return result.items?.length
      ? result
      : {
          message: `No allow list found for gateway delegate ${address}`,
        };
  },
});

makeCommand<NameOptions>({
  name: 'get-arns-record',
  description: 'Get an ArNS record by name',
  options: nameOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getArNSRecord({ name: requiredNameFromOptions(o) })
      .then(
        (result) => result ?? { message: `No record found for provided name` },
      ),
});

makeCommand<PaginationOptions>({
  name: 'list-arns-records',
  description: 'List all ArNS records',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getArNSRecords(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No records found' },
      ),
});

makeCommand<NameOptions>({
  name: 'get-arns-reserved-name',
  description: 'Get a reserved ArNS name',
  options: nameOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getArNSReservedName({ name: requiredNameFromOptions(o) })
      .then(
        (result) =>
          result ?? { message: `No reserved name found for provided name` },
      ),
});

makeCommand({
  name: 'list-arns-reserved-names',
  description: 'Get all reserved ArNS names',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getArNSReservedNames(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No reserved names found' },
      ),
});

makeCommand({
  name: 'get-arns-auction',
  description: 'Get an ArNS auction by name',
  options: nameOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getArNSAuction({ name: requiredNameFromOptions(o) })
      .then(
        (result) => result ?? { message: `No auction found for provided name` },
      ),
});

makeCommand({
  name: 'list-arns-auctions',
  description: 'Get all ArNS auctions',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getArNSAuctions(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No auctions found' },
      ),
});

makeCommand<AuctionPricesOptions>({
  name: 'get-arns-auction-prices',
  description: 'Get ArNS auction prices',
  options: arNSAuctionPricesOptions,
  action: async (options) => {
    options.type ??= 'lease';
    if (options.type !== 'lease' && options.type !== 'permabuy') {
      throw new Error(`Invalid type. Valid types are: lease, permabuy`);
    }

    const result = await readIOFromOptions(options).getArNSAuctionPrices({
      name: requiredNameFromOptions(options),
      type: options.type,
      intervalMs:
        options.intervalMs !== undefined ? +options.intervalMs : undefined,
      timestamp:
        options.timestamp !== undefined ? +options.timestamp : undefined,
      years: options.years !== undefined ? +options.years : undefined,
    });
    return result ?? { message: `No auction prices found` };
  },
});

makeCommand<EpochOptions>({
  name: 'get-epoch',
  description: 'Get epoch data',
  options: epochOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getEpoch(epochInputFromOptions(o))
      .then(
        (result) => result ?? { message: `No epoch found for provided input` },
      ),
});

makeCommand({
  name: 'get-current-epoch',
  description: 'Get current epoch data',
  action: (options) => readIOFromOptions(options).getCurrentEpoch(),
});

makeCommand({
  name: 'get-prescribed-observers',
  description: 'Get prescribed observers for an epoch',
  options: epochOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getPrescribedObservers(epochInputFromOptions(o))
      .then((result) =>
        result.length ? result : { message: `No observers found for epoch` },
      ),
});

makeCommand({
  name: 'get-prescribed-names',
  description: 'Get prescribed names for an epoch',
  options: epochOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getPrescribedNames(epochInputFromOptions(o))
      .then((result) =>
        result.length ? result : { message: `No names found for epoch` },
      ),
});

makeCommand({
  name: 'get-observations',
  description: 'Get observations for an epoch',
  options: epochOptions,
  action: (o) => readIOFromOptions(o).getObservations(epochInputFromOptions(o)),
});

makeCommand({
  name: 'get-distributions',
  description: 'Get distributions for an epoch',
  options: epochOptions,
  action: (o) =>
    readIOFromOptions(o).getDistributions(epochInputFromOptions(o)),
});

makeCommand({
  name: 'get-token-cost',
  description: 'Get token cost',
  options: tokenCostOptions,
}).action(async (_, command) => {
  await runCommand<GetTokenCostOptions>(command, async (options) => {
    options.intent ??= 'Buy-Record';
    options.type ??= 'lease';

    if (!isValidIntent(options.intent)) {
      throw new Error(
        `Invalid intent. Valid intents are: ${validIntents.join(', ')}`,
      );
    }

    if (options.type !== 'lease' && options.type !== 'permabuy') {
      throw new Error(`Invalid type. Valid types are: lease, permabuy`);
    }

    if (
      options.type === 'lease' &&
      intentsUsingYears.includes(options.intent) &&
      options.years === undefined
    ) {
      throw new Error('Years is required for lease type');
    }

    const tokenCost = await readIOFromOptions(options).getTokenCost({
      type: options.type,
      quantity: options.quantity !== undefined ? +options.quantity : undefined,
      years: options.years !== undefined ? +options.years : undefined,
      intent: options.intent,
      name: requiredNameFromOptions(options),
    });

    const output = {
      mIOTokenCost: tokenCost,
      message: `The cost of the provided action is ${formatIOWithCommas(
        new mIOToken(tokenCost).toIO(),
      )} IO`,
    };
    return output;
  });
});

makeCommand<PaginationOptions>({
  name: 'list-vaults',
  description: 'Get all wallet vaults',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getVaults(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No vaults found' },
      ),
});

makeCommand<InitiatorOptions>({
  name: 'get-primary-name-request',
  description: 'Get primary name request',
  options: initiatorOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getPrimaryNameRequest({
        initiator: requiredInitiatorFromOptions(o),
      })
      .then(
        (result) =>
          result ?? {
            message: `No primary name request found`,
          },
      ),
});

makeCommand<PaginationOptions>({
  name: 'list-primary-name-requests',
  description: 'Get primary name requests',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getPrimaryNameRequests(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No requests found' },
      ),
});

makeCommand<AddressAndNameOptions>({
  name: 'get-primary-name',
  description: 'Get primary name',
  options: [...addressOptions, optionMap.name],
  action: async (o) => {
    const address = addressFromOptions(o);
    const name = o.name;

    const params =
      name !== undefined
        ? { name }
        : address !== undefined
          ? { address }
          : undefined;
    if (params === undefined) {
      throw new Error('Either --address or --name is required');
    }

    const result = await readIOFromOptions(o).getPrimaryName(params);
    return (
      result ?? {
        message: `No primary name found`,
      }
    );
  },
});

makeCommand<PaginationOptions>({
  name: 'list-primary-names',
  description: 'Get primary names',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getPrimaryNames(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No names found' },
      ),
});

makeCommand<AddressOptions>({
  name: 'balance',
  description: 'Get the balance of an address',
  options: addressOptions,
  action: (options) =>
    readIOFromOptions(options)
      .getBalance({ address: requiredAddressFromOptions(options) })
      .then((result) => ({
        address: requiredAddressFromOptions(options),
        mIOBalance: result,
        message: `Provided address current has a balance of ${formatIOWithCommas(
          new mIOToken(result).toIO(),
        )} IO`,
      })),
});

makeCommand({
  name: 'list-balances',
  description: 'List all balances',
  options: paginationOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getBalances(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No balances found' },
      ),
});

makeCommand<AddressOptions>({
  name: 'get-redelegation-fee',
  description: 'Get redelegation fee',
  options: addressOptions,
  action: (options) =>
    readIOFromOptions(options).getRedelegationFee({
      address: requiredAddressFromOptions(options),
    }),
});

makeCommand<GetVaultOptions>({
  name: 'get-vault',
  description: 'Get the vault of provided address and vault ID',
  options: getVaultOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getVault({
        address: requiredAddressFromOptions(o),
        vaultId: requiredVaultIdFromOptions(o),
      })
      .then(
        (r) =>
          r ?? {
            message: `No vault found for provided address and vault ID`,
          },
      ),
});

makeCommand<PaginationAddressOptions>({
  name: 'get-gateway-vaults',
  description: 'Get the vaults of a gateway',
  options: paginationAddressOptions,
  action: async (o) => {
    const address = requiredAddressFromOptions(o);
    const result = await readIOFromOptions(o).getGatewayVaults({
      address,
      ...paginationParamsFromOptions(o),
    });

    return result.items?.length
      ? result
      : {
          message: `No vaults found for gateway ${address}`,
        };
  },
});

makeCommand({
  name: 'transfer',
  description: 'Transfer IO to another address',
  options: transferOptions,
  action: transfer,
});

makeCommand({
  name: 'join-network',
  description: 'Join a gateway to the AR.IO network',
  options: joinNetworkOptions,
  action: joinNetwork,
});

makeCommand<WalletOptions>({
  name: 'leave-network',
  description: 'Leave a gateway from the AR.IO network',
  options: walletOptions,
  // TODO: Add a confirmation prompt? Could get settings, display, then confirm prompt
  action: (options) => writeIOFromOptions(options).leaveNetwork(),
});

makeCommand({
  name: 'update-gateway-settings',
  description: 'Update AR.IO gateway settings',
  options: updateGatewaySettingsOptions,
  action: updateGatewaySettings,
});

// save-observations

makeCommand<OperatorStakeOptions>({
  name: 'increase-operator-stake',
  description: 'Increase operator stake',
  options: operatorStakeOptions,
  action: (options) =>
    // TODO: Can assert balance is sufficient
    writeIOFromOptions(options).increaseOperatorStake({
      increaseQty: requiredOperatorStakeFromOptions(options).toMIO(),
    }),
});

makeCommand<OperatorStakeOptions>({
  name: 'decrease-operator-stake',
  description: 'Decrease operator stake',
  options: operatorStakeOptions,
  action: (options) =>
    // TODO: Can assert stake is sufficient for action, and new target stake meets contract minimum
    writeIOFromOptions(options).decreaseOperatorStake({
      decreaseQty: requiredOperatorStakeFromOptions(options).toMIO(),
    }),
});

makeCommand<AddressAndVaultIdOptions>({
  name: 'instant-withdrawal',
  description: 'Instantly withdraw stake from a vault',
  options: addressAndVaultIdOptions,
  action: (options) =>
    // TODO: Could assert vault exists with stake
    writeIOFromOptions(options).instantWithdrawal({
      gatewayAddress: addressFromOptions(options),
      vaultId: requiredVaultIdFromOptions(options),
    }),
});

makeCommand<AddressAndVaultIdOptions>({
  name: 'cancel-withdrawal',
  description: 'Cancel a pending withdrawal',
  options: addressAndVaultIdOptions,
  action: (options) => {
    const io = writeIOFromOptions(options);
    const address = addressFromOptions(options);

    // TODO: Could assert withdrawal exists

    return io.cancelWithdrawal({
      gatewayAddress: address,
      vaultId: requiredVaultIdFromOptions(options),
    });
  },
});

makeCommand({
  name: 'delegate-stake',
  description: 'Delegate stake to a gateway',
  options: delegateStakeOptions,
  action: delegateStake,
});

makeCommand<DecreaseDelegateStakeOptions>({
  name: 'decrease-delegate-stake',
  description: 'Decrease delegated stake',
  options: decreaseDelegateStakeOptions,
  action: async (options) => {
    const io = writeIOFromOptions(options);
    const { target, ioQuantity } =
      requiredTargetAndQuantityFromOptions(options);
    const instant = options.instant ?? false;

    // TODO: Could assert sender is a delegate with enough stake to decrease
    // TODO: Could assert new target stake meets contract and target gateway minimums
    // TODO: Could present confirmation prompt with any fee for instant withdrawal (50% of the stake is put back into protocol??)

    const result = await io.decreaseDelegateStake({
      target,
      decreaseQty: ioQuantity.toMIO(),
      instant,
    });

    const output = {
      targetGateway: target,
      decreaseDelegateStakeResult: result,
      message: `Successfully decreased delegated stake of ${formatIOWithCommas(
        ioQuantity,
      )} IO to ${target}`,
    };

    return output;
  },
});

// redelegate-stake
makeCommand<RedelegateStakeOptions>({
  name: 'redelegate-stake',
  description: 'Redelegate stake to another gateway',
  options: redelegateStakeOptions,
  action: async (options) => {
    const io = writeIOFromOptions(options);
    const params = redelegateParamsFromOptions(options);

    // TODO: Could assert target gateway exists
    // TODO: Could do assertion on source has enough stake to redelegate
    // TODO: Could do assertions on source/target min delegate stakes are met

    const result = await io.redelegateStake(params);

    const output = {
      sourceGateway: params.source,
      targetGateway: params.target,
      redelegateStakeResult: result,
      message: `Successfully re-delegated stake of ${formatIOWithCommas(
        params.stakeQty.toIO(),
      )} IO from ${params.source} to ${params.target}`,
    };

    return output;
  },
});

// buy-record

// upgrade-record

// extend-lease

// increase-undername-limit

// submit-auction-bid

// request-primary-name

if (
  process.argv[1].includes('bin/ar.io') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
