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

import { spawnANT } from '../node/index.js';
import { mIOToken } from '../types/token.js';
import { version } from '../version.js';
import { delegateStake } from './commands/delegateStake.js';
import { joinNetwork } from './commands/joinNetwork.js';
import {
  getAllowedDelegates,
  getArNSAuction,
  getArNSAuctionPrices,
  getArNSRecord,
  getArNSReservedName,
  getDelegations,
  getEpoch,
  getGateway,
  getGatewayDelegates,
  getPrescribedNames,
  getPrescribedObservers,
  getPrimaryName,
  getTokenCost,
  listArNSAuctions,
  listArNSRecords,
  listArNSReservedNames,
  listGateways,
} from './commands/readCommands.js';
import { transfer } from './commands/transfer.js';
import { updateGatewaySettings } from './commands/updateGatewaySettings.js';
import {
  addressAndVaultIdOptions,
  addressOptions,
  antStateOptions,
  arNSAuctionPricesOptions,
  buyRecordOptions,
  decreaseDelegateStakeOptions,
  delegateStakeOptions,
  epochOptions,
  getVaultOptions,
  initiatorOptions,
  joinNetworkOptions,
  nameOptions,
  nameWriteOptions,
  operatorStakeOptions,
  optionMap,
  paginationAddressOptions,
  paginationOptions,
  redelegateStakeOptions,
  tokenCostOptions,
  transferOptions,
  updateGatewaySettingsOptions,
  writeActionOptions,
} from './options.js';
import {
  ANTStateCLIOptions,
  AddressAndNameCLIOptions,
  AddressAndVaultIdCLIOptions,
  AddressCLIOptions,
  BuyRecordCLIOptions,
  DecreaseDelegateStakeCLIOptions,
  ExtendLeaseCLIOptions,
  GetVaultCLIOptions,
  IncreaseUndernameLimitCLIOptions,
  InitiatorCLIOptions,
  NameWriteCLIOptions,
  OperatorStakeCLIOptions,
  PaginationAddressCLIOptions,
  PaginationCLIOptions,
  ProcessIdCLIOptions,
  ProcessIdWriteActionCLIOptions,
  RedelegateStakeCLIOptions,
  SubmitAuctionBidCLIOptions,
  UpgradeRecordCLIOptions,
  WriteActionCLIOptions,
} from './types.js';
import {
  assertConfirmationPrompt,
  epochInputFromOptions,
  formatIOWithCommas,
  getANTStateFromOptions,
  getLoggerFromOptions,
  ioProcessIdFromOptions,
  makeCommand,
  paginationParamsFromOptions,
  positiveIntegerFromOptions,
  readANTFromOptions,
  readIOFromOptions,
  recordTypeFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredAoSignerFromOptions,
  requiredMIOFromOptions,
  requiredPositiveIntegerFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  requiredVaultIdFromOptions,
  writeANTFromOptions,
  writeActionTagsFromOptions,
  writeIOFromOptions,
} from './utils.js';

makeCommand({
  name: 'ar.io', // TODO: can it be ar.io?
  description: 'AR.IO Network CLI',
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

makeCommand({
  name: 'get-gateway',
  description: 'Get the gateway of an address',
  options: addressOptions,
  action: getGateway,
});

makeCommand({
  name: 'list-gateways',
  description: 'List the gateways of the network',
  options: paginationOptions,
  action: listGateways,
});

makeCommand({
  name: 'get-gateway-delegates',
  description: 'Get the delegates of a gateway',
  options: paginationAddressOptions,
  action: getGatewayDelegates,
});

makeCommand({
  name: 'get-delegations',
  description: 'Get all stake delegated to gateways from this address',
  options: addressOptions,
  action: getDelegations,
});

makeCommand({
  name: 'get-allowed-delegates',
  description: 'Get the allow list of a gateway delegate',
  options: paginationAddressOptions,
  action: getAllowedDelegates,
});

makeCommand({
  name: 'get-arns-record',
  description: 'Get an ArNS record by name',
  options: nameOptions,
  action: getArNSRecord,
});

makeCommand({
  name: 'list-arns-records',
  description: 'List all ArNS records',
  options: paginationOptions,
  action: listArNSRecords,
});

makeCommand({
  name: 'get-arns-reserved-name',
  description: 'Get a reserved ArNS name',
  options: nameOptions,
  action: getArNSReservedName,
});

makeCommand({
  name: 'list-arns-reserved-names',
  description: 'Get all reserved ArNS names',
  options: paginationOptions,
  action: listArNSReservedNames,
});

makeCommand({
  name: 'get-arns-auction',
  description: 'Get an ArNS auction by name',
  options: nameOptions,
  action: getArNSAuction,
});

makeCommand({
  name: 'list-arns-auctions',
  description: 'Get all ArNS auctions',
  options: paginationOptions,
  action: listArNSAuctions,
});

makeCommand({
  name: 'get-arns-auction-prices',
  description: 'Get ArNS auction prices',
  options: arNSAuctionPricesOptions,
  action: getArNSAuctionPrices,
});

makeCommand({
  name: 'get-epoch',
  description: 'Get epoch data',
  options: epochOptions,
  action: getEpoch,
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
  action: getPrescribedObservers,
});

makeCommand({
  name: 'get-prescribed-names',
  description: 'Get prescribed names for an epoch',
  options: epochOptions,
  action: getPrescribedNames,
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
  action: getTokenCost,
});

makeCommand<PaginationCLIOptions>({
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

// TODO: Could assert valid arweave addresses at CLI level

makeCommand<InitiatorCLIOptions>({
  name: 'get-primary-name-request',
  description: 'Get primary name request',
  options: initiatorOptions,
  action: (o) =>
    readIOFromOptions(o)
      .getPrimaryNameRequest({
        initiator: requiredStringFromOptions(o, 'initiator'),
      })
      .then(
        (result) =>
          result ?? {
            message: `No primary name request found`,
          },
      ),
});

makeCommand<PaginationCLIOptions>({
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

makeCommand<AddressAndNameCLIOptions>({
  name: 'get-primary-name',
  description: 'Get primary name',
  options: [...addressOptions, optionMap.name],
  action: getPrimaryName,
});

makeCommand<PaginationCLIOptions>({
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

makeCommand<AddressCLIOptions>({
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

makeCommand<AddressCLIOptions>({
  name: 'get-redelegation-fee',
  description: 'Get redelegation fee',
  options: addressOptions,
  action: (options) =>
    readIOFromOptions(options).getRedelegationFee({
      address: requiredAddressFromOptions(options),
    }),
});

makeCommand<GetVaultCLIOptions>({
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

makeCommand<PaginationAddressCLIOptions>({
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

makeCommand<WriteActionCLIOptions>({
  name: 'leave-network',
  description: 'Leave a gateway from the AR.IO network',
  // TODO: Add a confirmation prompt? Could get settings, display, then confirm prompt
  action: async (options) => {
    await assertConfirmationPrompt(
      'Are you sure you want to leave the AR.IO network?',
      options,
    );
    return writeIOFromOptions(options).leaveNetwork();
  },
});

makeCommand({
  name: 'update-gateway-settings',
  description: 'Update AR.IO gateway settings',
  options: updateGatewaySettingsOptions,
  action: updateGatewaySettings,
});

makeCommand({
  name: 'save-observations',
  description: 'Save observations',
  options: [
    optionMap.failedGateways,
    optionMap.transactionId,
    ...writeActionOptions,
  ],
  action: (options) =>
    writeIOFromOptions(options).saveObservations({
      failedGateways: requiredStringArrayFromOptions(options, 'failedGateways'),
      reportTxId: requiredStringFromOptions(options, 'transactionId'),
    }),
});

makeCommand<OperatorStakeCLIOptions>({
  name: 'increase-operator-stake',
  description: 'Increase operator stake',
  options: operatorStakeOptions,
  action: (options) =>
    // TODO: Can assert balance is sufficient
    writeIOFromOptions(options).increaseOperatorStake({
      increaseQty: requiredMIOFromOptions(options, 'operatorStake'),
    }),
});

makeCommand<OperatorStakeCLIOptions>({
  name: 'decrease-operator-stake',
  description: 'Decrease operator stake',
  options: operatorStakeOptions,
  action: (options) =>
    // TODO: Can assert stake is sufficient for action, and new target stake meets contract minimum
    writeIOFromOptions(options).decreaseOperatorStake({
      decreaseQty: requiredMIOFromOptions(options, 'operatorStake'),
    }),
});

makeCommand<AddressAndVaultIdCLIOptions & WriteActionCLIOptions>({
  name: 'instant-withdrawal',
  description: 'Instantly withdraw stake from a vault',
  options: addressAndVaultIdOptions,
  action: (options) => {
    // TODO: Could assert vault exists with stake
    return writeIOFromOptions(options).instantWithdrawal(
      {
        gatewayAddress: requiredAddressFromOptions(options),
        vaultId: requiredVaultIdFromOptions(options),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<AddressAndVaultIdCLIOptions & WriteActionCLIOptions>({
  name: 'cancel-withdrawal',
  description: 'Cancel a pending withdrawal',
  options: addressAndVaultIdOptions,
  action: async (options) => {
    const gatewayAddress = requiredAddressFromOptions(options);
    const vaultId = requiredVaultIdFromOptions(options);

    // TODO: Could assert withdrawal exists
    await assertConfirmationPrompt(
      `Are you sure you want to cancel the pending withdrawal of stake from vault ${vaultId} on gateway ${gatewayAddress}?`,
      options,
    );

    return writeIOFromOptions(options).cancelWithdrawal(
      {
        gatewayAddress,
        vaultId,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand({
  name: 'delegate-stake',
  description: 'Delegate stake to a gateway',
  options: delegateStakeOptions,
  action: delegateStake,
});

makeCommand<DecreaseDelegateStakeCLIOptions>({
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

    await assertConfirmationPrompt(
      `Are you sure you'd like to decrease delegated stake of ${formatIOWithCommas(ioQuantity)} IO on gateway ${target}?`,
      options,
    );

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

makeCommand<RedelegateStakeCLIOptions>({
  name: 'redelegate-stake',
  description: 'Redelegate stake to another gateway',
  options: redelegateStakeOptions,
  action: async (options) => {
    const io = writeIOFromOptions(options);
    const params = redelegateParamsFromOptions(options);

    // TODO: Could assert target gateway exists
    // TODO: Could do assertion on source has enough stake to redelegate
    // TODO: Could do assertions on source/target min delegate stakes are met

    await assertConfirmationPrompt(
      `Are you sure you'd like to redelegate stake of ${formatIOWithCommas(params.stakeQty.toIO())} IO from ${params.source} to ${params.target}?`,
      options,
    );

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

makeCommand<BuyRecordCLIOptions>({
  name: 'buy-record',
  description: 'Buy a record',
  options: buyRecordOptions,
  action: async (options) => {
    const io = writeIOFromOptions(options);
    const name = requiredStringFromOptions(options, 'name');
    const type = recordTypeFromOptions(options);
    const years = positiveIntegerFromOptions(options, 'years');

    // TODO: Assert balance is sufficient for action
    // TODO: Assert record is not already owned

    const processId = options.processId;
    if (processId === undefined) {
      // TODO: Spawn ANT process, register it to ANT registry, get process ID
      throw new Error('Process ID must be provided for buy-record');
    }

    await assertConfirmationPrompt(
      `Are you sure you want to ${type} the record ${name}?`,
      options,
    );

    return io.buyRecord({
      name: requiredStringFromOptions(options, 'name'),
      processId,
      type,
      years,
    });
  },
});

makeCommand<UpgradeRecordCLIOptions>({
  name: 'upgrade-record',
  description: 'Upgrade the lease of a record to a permabuy',
  options: [...nameOptions, ...writeActionOptions],
  // TODO: could assert record is leased by sender, assert balance is sufficient
  action: async (options) => {
    const name = requiredStringFromOptions(options, 'name');
    await assertConfirmationPrompt(
      `Are you sure you want to upgrade the lease of ${name} to a permabuy?`,
      options,
    );
    return writeIOFromOptions(options).upgradeRecord({
      name,
    });
  },
});

makeCommand<ExtendLeaseCLIOptions>({
  name: 'extend-lease',
  description: 'Extend the lease of a record',
  options: [...writeActionOptions, optionMap.name, optionMap.years],
  action: async (options) => {
    const name = requiredStringFromOptions(options, 'name');
    const years = requiredPositiveIntegerFromOptions(options, 'years');

    await assertConfirmationPrompt(
      `Are you sure you want to extend the lease of ${name} by ${years}?`,
      options,
    );

    return writeIOFromOptions(options).extendLease(
      {
        name,
        years,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<IncreaseUndernameLimitCLIOptions>({
  name: 'increase-undername-limit',
  description: 'Increase the limit of a name',
  options: [...writeActionOptions, optionMap.name, optionMap.increaseCount],
  action: async (options) => {
    const name = requiredStringFromOptions(options, 'name');
    const increaseCount = requiredPositiveIntegerFromOptions(
      options,
      'increaseCount',
    );

    await assertConfirmationPrompt(
      `Are you sure you want to increase the undername limit of ${name} by ${increaseCount}?`,
      options,
    );

    return writeIOFromOptions(options).increaseUndernameLimit(
      {
        name,
        increaseCount,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

// @deprecated -- submit auction bid will be removed for recently released names
makeCommand<SubmitAuctionBidCLIOptions>({
  name: 'submit-auction-bid',
  description: 'Submit a bid to an auction',
  options: [
    ...writeActionOptions,
    optionMap.name,
    optionMap.quantity,
    optionMap.type,
    optionMap.years,
  ],
  action: (options) => {
    // TODO: Assert auction exists
    // TODO: Assert balance is sufficient for action

    if (options.processId === undefined) {
      // TODO: Spawn ANT process, register it to ANT registry, get process ID
      throw new Error('--process-id is required');
    }

    return writeIOFromOptions(options).submitAuctionBid({
      name: requiredStringFromOptions(options, 'name'),
      processId: options.processId,
      type: recordTypeFromOptions(options),
      quantity: requiredMIOFromOptions(options, 'quantity').valueOf(),
      // TODO: Assert if 'lease' type, years is required
      years: positiveIntegerFromOptions(options, 'years'),
    });
  },
});

makeCommand<NameWriteCLIOptions>({
  name: 'request-primary-name',
  description: 'Request a primary name',
  options: nameWriteOptions,
  action: async (options) => {
    // TODO: Assert balance is sufficient for action?
    // TODO: Assert name requested is not already owned
    // TODO: More assertions?
    const name = requiredStringFromOptions(options, 'name');

    await assertConfirmationPrompt(
      `Are you sure you want to request the primary name ${name}?`,
      options,
    );

    return writeIOFromOptions(options).requestPrimaryName({
      name,
    });
  },
});

makeCommand<ANTStateCLIOptions>({
  name: 'spawn-ant',
  description: 'Spawn an ANT process',
  options: antStateOptions,
  action: async (options) => {
    const state = getANTStateFromOptions(options);
    const antProcessId = await spawnANT({
      state,
      signer: requiredAoSignerFromOptions(options),
      logger: getLoggerFromOptions(options),
    });

    return {
      processId: antProcessId,
      state,
      message: `Spawned ANT process with process ID ${antProcessId}`,
    };
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-state',
  description: 'Get the state of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getState();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-info',
  description: 'Get the info of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getInfo();
  },
});

makeCommand<
  ProcessIdCLIOptions & {
    undername?: string;
  }
>({
  name: 'get-ant-record',
  description: 'Get a record of an ANT process',
  options: [optionMap.processId, optionMap.undername],
  action: async (options) => {
    return (
      (await readANTFromOptions(options).getRecord({
        undername: requiredStringFromOptions(options, 'undername'),
      })) ?? { message: 'No record found' }
    );
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-records',
  description: 'Get the records of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getRecords();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-owner',
  description: 'Get the owner of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getOwner();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-controllers',
  description: 'List the controllers of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getControllers();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-name',
  description: 'Get the name of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getName();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-ticker',
  description: 'Get the ticker of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getTicker();
  },
});

makeCommand<ProcessIdCLIOptions & { address?: string }>({
  name: 'get-ant-balance',
  description: 'Get the balance of an ANT process',
  options: [optionMap.processId, optionMap.address],
  action: async (options) => {
    return readANTFromOptions(options).getBalance({
      address: requiredAddressFromOptions(options),
    });
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-balances',
  description: 'Get the balances of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getBalances();
  },
});

makeCommand<
  ProcessIdWriteActionCLIOptions & {
    target?: string;
  }
>({
  name: 'transfer-ant-ownership',
  description: 'Transfer ownership of an ANT process',
  options: [optionMap.processId, optionMap.target, ...writeActionOptions],
  action: async (options) => {
    const target = requiredStringFromOptions(options, 'target');
    await assertConfirmationPrompt(
      `Are you sure you want to transfer ANT ownership to ${target}?`,
      options,
    );
    return writeANTFromOptions(options).transfer(
      {
        target,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { controller?: string }>({
  name: 'add-ant-controller',
  description: 'Add a controller to an ANT process',
  options: [optionMap.processId, optionMap.controller, ...writeActionOptions],
  action: async (options) => {
    const controller = requiredStringFromOptions(options, 'controller');
    await assertConfirmationPrompt(
      `Are you sure you want to add ${controller} as a controller?`,
      options,
    );
    return writeANTFromOptions(options).addController(
      {
        controller: requiredStringFromOptions(options, 'controller'),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdCLIOptions & { controller?: string }>({
  name: 'remove-ant-controller',
  description: 'Remove a controller from an ANT process',
  options: [optionMap.processId, optionMap.controller, ...writeActionOptions],
  action: async (options) => {
    return writeANTFromOptions(options).removeController(
      {
        controller: requiredStringFromOptions(options, 'controller'),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<
  ProcessIdWriteActionCLIOptions & {
    undername?: string;
    transactionId?: string;
    ttlSeconds?: number;
  }
>({
  name: 'set-ant-record',
  description: 'Set a record of an ANT process',
  options: [
    optionMap.processId,
    optionMap.undername,
    optionMap.transactionId,
    optionMap.ttlSeconds,
    ...writeActionOptions,
  ],
  action: async (options) => {
    const ttlSeconds = options.ttlSeconds ?? 3600;
    const undername = requiredStringFromOptions(options, 'undername');
    const transactionId = requiredStringFromOptions(options, 'transactionId');

    await assertConfirmationPrompt(
      `Are you sure you want to set this record?\n${JSON.stringify(
        { undername, transactionId, ttlSeconds },
        null,
        2,
      )}`,
      options,
    );

    return writeANTFromOptions(options).setRecord(
      {
        undername,
        transactionId,
        ttlSeconds,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { undername?: string }>({
  name: 'remove-ant-record',
  description: 'Remove a record from an ANT process',
  options: [optionMap.processId, optionMap.undername, ...writeActionOptions],
  action: async (options) => {
    const undername = requiredStringFromOptions(options, 'undername');

    await assertConfirmationPrompt(
      `Are you sure you want to remove the record with undername ${undername}?`,
      options,
    );

    return writeANTFromOptions(options).removeRecord(
      {
        undername,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { ticker?: string }>({
  name: 'set-ant-ticker',
  description: 'Set the ticker of an ANT process',
  options: [optionMap.processId, optionMap.ticker, ...writeActionOptions],
  action: async (options) => {
    const ticker = requiredStringFromOptions(options, 'ticker');

    await assertConfirmationPrompt(
      `Are you sure you want to set the ticker to ${ticker}?`,
      options,
    );

    return writeANTFromOptions(options).setTicker(
      {
        ticker,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { name?: string }>({
  name: 'set-ant-name',
  description: 'Set the name of an ANT process',
  options: [optionMap.processId, optionMap.name, ...writeActionOptions],
  action: async (options) => {
    const name = requiredStringFromOptions(options, 'name');

    await assertConfirmationPrompt(
      `Are you sure you want to set the name to ${requiredStringFromOptions(
        options,
        'name',
      )}?`,
      options,
    );

    return writeANTFromOptions(options).setName(
      {
        name,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { description?: string }>({
  name: 'set-ant-description',
  description: 'Set the description of an ANT process',
  options: [optionMap.processId, optionMap.description, ...writeActionOptions],
  action: async (options) => {
    const description = requiredStringFromOptions(options, 'description');

    await assertConfirmationPrompt(
      `Are you sure you want to set the ANT description to ${description}?`,
      options,
    );

    return writeANTFromOptions(options).setDescription(
      {
        description,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { keywords?: string[] }>({
  name: 'set-ant-keywords',
  description: 'Set the keywords of an ANT process',
  options: [optionMap.processId, optionMap.keywords, ...writeActionOptions],
  action: async (options) => {
    const keywords = requiredStringArrayFromOptions(options, 'keywords');

    await assertConfirmationPrompt(
      `Are you sure you want to set the ANT keywords to ${keywords}?`,
      options,
    );
    return writeANTFromOptions(options).setKeywords(
      {
        keywords,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdWriteActionCLIOptions & { transactionId?: string }>({
  name: 'set-ant-logo',
  description: 'Set the logo of an ANT process',
  options: [
    optionMap.processId,
    optionMap.transactionId,
    ...writeActionOptions,
  ],
  action: async (options) => {
    const txId = requiredStringFromOptions(options, 'transactionId');

    await assertConfirmationPrompt(
      `Are you sure you want to set the ANT logo to target Arweave TxID ${txId}?`,
      options,
    );
    return writeANTFromOptions(options).setLogo(
      {
        // TODO: Could take a logo file, upload it to Arweave, get transaction ID
        txId,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<
  ProcessIdWriteActionCLIOptions & {
    name?: string;
  }
>({
  name: 'release-name',
  description: 'Release the name of an ANT process',
  options: [optionMap.processId, optionMap.name, ...writeActionOptions],
  action: async (options) => {
    const name = requiredStringFromOptions(options, 'name');

    await assertConfirmationPrompt(
      `Are you sure you want to release the name ${name} back to the protocol?`,
      options,
    );

    return writeANTFromOptions(options).releaseName(
      {
        name,
        ioProcessId: ioProcessIdFromOptions(options),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<
  ProcessIdWriteActionCLIOptions & {
    name?: string;
    target?: string;
  }
>({
  name: 'reassign-name',
  description: 'Reassign the name of an ANT process to another ANT process',
  options: [
    optionMap.processId,
    optionMap.name,
    optionMap.target,
    ...writeActionOptions,
  ],
  action: async (options) => {
    const targetProcess = requiredStringFromOptions(options, 'target');
    const name = requiredStringFromOptions(options, 'name');

    await assertConfirmationPrompt(
      `Are you sure you want to reassign the name ${name} to ANT process ${targetProcess}?`,
      options,
    );

    return writeANTFromOptions(options).reassignName(
      {
        name,
        ioProcessId: ioProcessIdFromOptions(options),
        antProcessId: targetProcess,
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<
  ProcessIdWriteActionCLIOptions & {
    name?: string;
    target?: string;
  }
>({
  name: 'approve-primary-name-request',
  description: 'Approve a primary name request',
  options: [
    optionMap.processId,
    optionMap.name,
    optionMap.address,
    ...writeActionOptions,
  ],
  action: async (options) => {
    const address = requiredAddressFromOptions(options);
    const name = requiredStringFromOptions(options, 'name');

    await assertConfirmationPrompt(
      `Are you sure you want to approve the primary name request ${name} to ${address}?`,
      options,
    );

    return writeANTFromOptions(options).approvePrimaryNameRequest(
      {
        name,
        address,
        ioProcessId: ioProcessIdFromOptions(options),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<
  ProcessIdWriteActionCLIOptions & {
    names?: string[];
  }
>({
  name: 'remove-primary-names',
  description: 'Remove primary names',
  options: [optionMap.processId, optionMap.names, ...writeActionOptions],
  action: async (options) => {
    const names = requiredStringArrayFromOptions(options, 'names');
    await assertConfirmationPrompt(
      `Are you sure you want to remove the primary names ${names}?`,
      options,
    );

    return writeANTFromOptions(options).removePrimaryNames(
      {
        names,
        ioProcessId: ioProcessIdFromOptions(options),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

if (
  process.argv[1].includes('bin/ar.io') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
