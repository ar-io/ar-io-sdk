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

import {
  ArweaveSigner,
  createAoSigner,
  initANTStateForAddress,
  spawnANT,
} from '../node/index.js';
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
  AddressAndNameCLIOptions,
  AddressAndVaultIdCLIOptions,
  AddressCLIOptions,
  BuyRecordCLIOptions,
  DecreaseDelegateStakeCLIOptions,
  ExtendLeaseCLIOptions,
  GetVaultCLIOptions,
  GlobalCLIOptions,
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
  epochInputFromOptions,
  formatIOWithCommas,
  getLoggerFromOptions,
  ioProcessIdFromOptions,
  jwkToAddress,
  makeCommand,
  paginationParamsFromOptions,
  readANTFromOptions,
  readIOFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredIncreaseCountFromOptions,
  requiredJwkFromOptions,
  requiredMIOQuantityFromOptions,
  requiredNameFromOptions,
  requiredOperatorStakeFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  requiredVaultIdFromOptions,
  requiredYearsFromOptions,
  typeFromOptions,
  writeANTFromOptions,
  writeActionTagsFromOptions,
  writeIOFromOptions,
  yearsFromOptions,
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

makeCommand({
  name: 'leave-network',
  description: 'Leave a gateway from the AR.IO network',
  // TODO: Add a confirmation prompt? Could get settings, display, then confirm prompt
  action: (options) => writeIOFromOptions(options).leaveNetwork(),
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
      increaseQty: requiredOperatorStakeFromOptions(options).toMIO(),
    }),
});

makeCommand<OperatorStakeCLIOptions>({
  name: 'decrease-operator-stake',
  description: 'Decrease operator stake',
  options: operatorStakeOptions,
  action: (options) =>
    // TODO: Can assert stake is sufficient for action, and new target stake meets contract minimum
    writeIOFromOptions(options).decreaseOperatorStake({
      decreaseQty: requiredOperatorStakeFromOptions(options).toMIO(),
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
  action: (options) => {
    // TODO: Could assert withdrawal exists

    return writeIOFromOptions(options).cancelWithdrawal(
      {
        gatewayAddress: requiredAddressFromOptions(options),
        vaultId: requiredVaultIdFromOptions(options),
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

    // TODO: Assert balance is sufficient for action
    // TODO: Assert record is not already owned

    const processId = options.processId;
    if (processId === undefined) {
      // TODO: Spawn ANT process, register it to ANT registry, get process ID
      throw new Error('Process ID must be provided for buy-record');
    }

    return io.buyRecord({
      name: requiredNameFromOptions(options),
      processId,
      type: typeFromOptions(options),
      years: yearsFromOptions(options),
    });
  },
});

makeCommand<UpgradeRecordCLIOptions>({
  name: 'upgrade-record',
  description: 'Upgrade the lease of a record to a permabuy',
  options: [...nameOptions, ...writeActionOptions],
  // TODO: assert record is leased by sender, assert balance is sufficient
  action: (options) =>
    writeIOFromOptions(options).upgradeRecord({
      name: requiredNameFromOptions(options),
    }),
});

makeCommand<ExtendLeaseCLIOptions>({
  name: 'extend-lease',
  description: 'Extend the lease of a record',
  options: [...writeActionOptions, optionMap.name, optionMap.years],
  action: (options) =>
    writeIOFromOptions(options).extendLease(
      {
        name: requiredNameFromOptions(options),
        years: requiredYearsFromOptions(options),
      },
      writeActionTagsFromOptions(options),
    ),
});

makeCommand<IncreaseUndernameLimitCLIOptions>({
  name: 'increase-undername-limit',
  description: 'Increase the limit of a name',
  options: [...writeActionOptions, optionMap.name, optionMap.increaseCount],
  action: (options) =>
    writeIOFromOptions(options).increaseUndernameLimit(
      {
        name: requiredNameFromOptions(options),
        increaseCount: requiredIncreaseCountFromOptions(options),
      },
      writeActionTagsFromOptions(options),
    ),
});

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
      name: requiredNameFromOptions(options),
      processId: options.processId,
      type: typeFromOptions(options),
      quantity: requiredMIOQuantityFromOptions(options).valueOf(),
      // TODO: Assert if 'lease' type, years is required
      years: yearsFromOptions(options),
    });
  },
});

makeCommand<NameWriteCLIOptions>({
  name: 'request-primary-name',
  description: 'Request a primary name',
  options: nameWriteOptions,
  action: (options) =>
    // TODO: Assert balance is sufficient for action?
    // TODO: Assert name requested is not already owned
    // TODO: More assertions?
    writeIOFromOptions(options).requestPrimaryName({
      name: requiredNameFromOptions(options),
    }),
});

makeCommand<
  GlobalCLIOptions & {
    target?: string;
  }
>({
  name: 'spawn-ant',
  description: 'Spawn an ANT process',
  options: [...writeActionOptions, optionMap.target],
  action: async (options) => {
    const jwk = requiredJwkFromOptions(options);
    const address = jwkToAddress(jwk);
    const signer = createAoSigner(new ArweaveSigner(jwk));
    const target = options.target;

    // TODO: pass state from any provided ANT state options

    const state = initANTStateForAddress(address, target);
    const antProcessId = await spawnANT({
      state,
      signer,
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
    if (options.undername === undefined) {
      throw new Error('--undername is required');
    }
    return (
      (await readANTFromOptions(options).getRecord({
        undername: options.undername,
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
    return writeANTFromOptions(options).transfer(
      {
        target: requiredStringFromOptions(options, 'target'),
      },
      writeActionTagsFromOptions(options),
    );
  },
});

makeCommand<ProcessIdCLIOptions & { controller?: string }>({
  name: 'add-ant-controller',
  description: 'Add a controller to an ANT process',
  options: [optionMap.processId, optionMap.controller, ...writeActionOptions],
  action: async (options) => {
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
    options.ttlSeconds ??= 3600;
    return writeANTFromOptions(options).setRecord(
      {
        undername: requiredStringFromOptions(options, 'undername'),
        transactionId: requiredStringFromOptions(options, 'transactionId'),
        ttlSeconds: options.ttlSeconds,
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
    return writeANTFromOptions(options).removeRecord(
      {
        undername: requiredStringFromOptions(options, 'undername'),
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
    return writeANTFromOptions(options).setTicker(
      {
        ticker: requiredStringFromOptions(options, 'ticker'),
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
    return writeANTFromOptions(options).setName(
      {
        name: requiredStringFromOptions(options, 'name'),
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
    return writeANTFromOptions(options).setDescription(
      {
        description: requiredStringFromOptions(options, 'description'),
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
    return writeANTFromOptions(options).setKeywords(
      {
        keywords: requiredStringArrayFromOptions(options, 'keywords'),
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
    return writeANTFromOptions(options).setLogo(
      {
        // TODO: Could take a logo file, upload it to Arweave, get transaction ID
        txId: requiredStringFromOptions(options, 'transactionId'),
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
    return writeANTFromOptions(options).releaseName(
      {
        name: requiredStringFromOptions(options, 'name'),
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
    return writeANTFromOptions(options).reassignName(
      {
        name: requiredStringFromOptions(options, 'name'),
        ioProcessId: ioProcessIdFromOptions(options),
        antProcessId: requiredStringFromOptions(options, 'target'),
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
    optionMap.target,
    ...writeActionOptions,
  ],
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
    return writeANTFromOptions(options).removePrimaryNames(
      {
        names: requiredStringArrayFromOptions(options, 'names'),
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
