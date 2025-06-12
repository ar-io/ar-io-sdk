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

import { AOProcess, AoMessageResult, spawnANT } from '../node/index.js';
import { mARIOToken } from '../types/token.js';
import { version } from '../version.js';
import {
  setAntBaseNameCLICommand,
  setAntRecordCLICommand,
} from './commands/antCommands.js';
import {
  buyRecordCLICommand,
  extendLeaseCLICommand,
  increaseUndernameLimitCLICommand,
  requestPrimaryNameCLICommand,
  upgradeRecordCLICommand,
} from './commands/arnsPurchaseCommands.js';
import {
  cancelWithdrawal,
  decreaseDelegateStake,
  decreaseOperatorStake,
  delegateStake,
  increaseOperatorStake,
  instantWithdrawal,
  joinNetwork,
  leaveNetwork,
  redelegateStake,
  saveObservations,
  updateGatewaySettings,
} from './commands/gatewayWriteCommands.js';
import {
  getAllGatewayVaults,
  getAllowedDelegates,
  getArNSRecord,
  getArNSReservedName,
  getArNSReturnedName,
  getCostDetails,
  getDelegations,
  getEpoch,
  getGateway,
  getGatewayDelegates,
  getGatewayVaults,
  getPrescribedNames,
  getPrescribedObservers,
  getPrimaryName,
  getTokenCost,
  getVault,
  listAllDelegatesCLICommand,
  listArNSRecords,
  listArNSReservedNames,
  listArNSReturnedNames,
  listGateways,
  resolveArNSName,
} from './commands/readCommands.js';
import {
  createVaultCLICommand,
  extendVaultCLICommand,
  increaseVaultCLICommand,
  revokeVaultCLICommand,
  transferCLICommand,
  vaultedTransferCLICommand,
} from './commands/transfer.js';
import {
  addressAndVaultIdOptions,
  antStateOptions,
  arnsPurchaseOptions,
  buyRecordOptions,
  decreaseDelegateStakeOptions,
  delegateStakeOptions,
  epochOptions,
  getVaultOptions,
  globalOptions,
  joinNetworkOptions,
  operatorStakeOptions,
  optionMap,
  paginationAddressOptions,
  paginationOptions,
  redelegateStakeOptions,
  setAntBaseNameOptions,
  setAntUndernameOptions,
  tokenCostOptions,
  transferOptions,
  updateGatewaySettingsOptions,
  vaultedTransferOptions,
  writeActionOptions,
} from './options.js';
import {
  ANTStateCLIOptions,
  AddressAndNameCLIOptions,
  AddressCLIOptions,
  DecreaseDelegateStakeCLIOptions,
  InitiatorCLIOptions,
  PaginationCLIOptions,
  ProcessIdCLIOptions,
  ProcessIdWriteActionCLIOptions,
} from './types.js';
import {
  applyOptions,
  arioProcessIdFromOptions,
  assertConfirmationPrompt,
  customTagsFromOptions,
  epochInputFromOptions,
  formatARIOWithCommas,
  getANTStateFromOptions,
  getLoggerFromOptions,
  makeCommand,
  paginationParamsFromOptions,
  readANTFromOptions,
  readARIOFromOptions,
  requiredAddressFromOptions,
  requiredAoSignerFromOptions,
  requiredProcessIdFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  writeANTFromOptions,
} from './utils.js';

applyOptions(
  program
    .name('ar.io')
    .version(version)
    .description('AR.IO Network CLI')
    .helpCommand(true),
  globalOptions,
);

// # Getters
makeCommand({
  name: 'info',
  description: 'Get network info',
  action: (options) => readARIOFromOptions(options).getInfo(),
});

makeCommand({
  name: 'token-supply',
  description: 'Get the total token supply',
  action: (options) => readARIOFromOptions(options).getTokenSupply(),
});

makeCommand<AddressCLIOptions>({
  name: 'balance',
  description: 'Get the balance of an address',
  options: [optionMap.address],
  action: (options) =>
    readARIOFromOptions(options)
      .getBalance({ address: requiredAddressFromOptions(options) })
      .then((result) => ({
        address: requiredAddressFromOptions(options),
        mARIOBalance: result,
        message: `Provided address current has a balance of ${formatARIOWithCommas(
          new mARIOToken(result).toARIO(),
        )} ARIO`,
      })),
});

makeCommand({
  name: 'get-registration-fees',
  description: 'Get registration fees',
  action: (options) => readARIOFromOptions(options).getRegistrationFees(),
});

makeCommand({
  name: 'get-demand-factor',
  description: 'Get demand factor',
  action: (options) => readARIOFromOptions(options).getDemandFactor(),
});

makeCommand({
  name: 'get-demand-factor-settings',
  description: 'Get current settings for demand factor',
  action: (options) => readARIOFromOptions(options).getDemandFactorSettings(),
});

makeCommand({
  name: 'get-epoch-settings',
  description: 'Get current settings for epochs',
  action: (options) => readARIOFromOptions(options).getEpochSettings(),
});

makeCommand({
  name: 'get-gateway',
  description: 'Get the gateway of an address',
  options: [optionMap.address],
  action: getGateway,
});

makeCommand({
  name: 'get-gateway-delegates',
  description: 'Get the delegates of a gateway',
  options: paginationAddressOptions,
  action: getGatewayDelegates,
});

makeCommand({
  name: 'get-gateway-vaults',
  description: 'Get the vaults of a gateway',
  options: paginationAddressOptions,
  action: getGatewayVaults,
});

makeCommand({
  name: 'get-delegations',
  description: 'Get all stake delegated to gateways from this address',
  options: [optionMap.address],
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
  options: [optionMap.name],
  action: getArNSRecord,
});

makeCommand({
  name: 'get-arns-reserved-name',
  description: 'Get a reserved ArNS name',
  options: [optionMap.name],
  action: getArNSReservedName,
});

makeCommand({
  name: 'get-arns-returned-name',
  description: 'Get an ArNS returned name by name',
  options: [optionMap.name],
  action: getArNSReturnedName,
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
  action: (options) => readARIOFromOptions(options).getCurrentEpoch(),
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
  action: (o) =>
    readARIOFromOptions(o)
      .getObservations(epochInputFromOptions(o))
      .then(
        (result) => result ?? { message: 'No observations found for epoch' },
      ),
});

makeCommand({
  name: 'get-distributions',
  description: 'Get distributions for an epoch',
  options: epochOptions,
  action: (o) =>
    readARIOFromOptions(o)
      .getDistributions(epochInputFromOptions(o))
      .then(
        (result) => result ?? { message: 'No distributions found for epoch' },
      ),
});

makeCommand({
  name: 'get-eligible-rewards',
  description: 'Get eligible rewards for an epoch',
  options: [...epochOptions, ...paginationOptions],
  action: (o) =>
    readARIOFromOptions(o)
      .getEligibleEpochRewards(
        epochInputFromOptions(o),
        paginationParamsFromOptions(o),
      )
      .then(
        (result) =>
          result ?? { message: 'No eligible distributions found for epoch' },
      ),
});

makeCommand({
  name: 'get-token-cost',
  description: 'Get token cost for an intended action',
  options: tokenCostOptions,
  action: getTokenCost,
});

makeCommand({
  name: 'get-cost-details',
  description: 'Get expanded cost details for an intended action',
  options: tokenCostOptions,
  action: getCostDetails,
});

makeCommand<AddressAndNameCLIOptions>({
  name: 'get-primary-name',
  description: 'Get primary name',
  options: [optionMap.address, optionMap.name],
  action: getPrimaryName,
});

makeCommand<InitiatorCLIOptions>({
  name: 'get-primary-name-request',
  description: 'Get primary name request',
  options: [optionMap.initiator],
  action: (o) =>
    readARIOFromOptions(o)
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

makeCommand<AddressCLIOptions>({
  name: 'get-redelegation-fee',
  description: 'Get redelegation fee',
  options: [optionMap.address],
  action: (options) =>
    readARIOFromOptions(options).getRedelegationFee({
      address: requiredAddressFromOptions(options),
    }),
});

makeCommand({
  name: 'get-vault',
  description: 'Get the vault of provided address and vault ID',
  options: getVaultOptions,
  action: getVault,
});

// # ArNS Resolution
makeCommand({
  name: 'resolve-arns-name',
  description: 'Resolve an ArNS name',
  options: [optionMap.name],
  action: resolveArNSName,
});

// # Paginated handlers
makeCommand({
  name: 'list-gateways',
  description: 'List the gateways of the network',
  options: paginationOptions,
  action: listGateways,
});

makeCommand({
  name: 'list-all-delegates',
  description: 'List all paginated delegates from all gateways',
  options: paginationOptions,
  action: listAllDelegatesCLICommand,
});

makeCommand({
  name: 'list-arns-records',
  description: 'List all ArNS records',
  options: paginationOptions,
  action: listArNSRecords,
});

makeCommand({
  name: 'list-arns-reserved-names',
  description: 'Get all reserved ArNS names',
  options: paginationOptions,
  action: listArNSReservedNames,
});

makeCommand({
  name: 'list-arns-returned-names',
  description: 'Get all ArNS recently returned names',
  options: paginationOptions,
  action: listArNSReturnedNames,
});

makeCommand<PaginationCLIOptions>({
  name: 'list-vaults',
  description: 'Get all wallet vaults',
  options: paginationOptions,
  action: (o) =>
    readARIOFromOptions(o)
      .getVaults(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No vaults found' },
      ),
});

makeCommand<PaginationCLIOptions>({
  name: 'list-primary-name-requests',
  description: 'Get primary name requests',
  options: paginationOptions,
  action: (o) =>
    readARIOFromOptions(o)
      .getPrimaryNameRequests(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No requests found' },
      ),
});

makeCommand<PaginationCLIOptions>({
  name: 'list-primary-names',
  description: 'Get primary names',
  options: paginationOptions,
  action: (o) =>
    readARIOFromOptions(o)
      .getPrimaryNames(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No names found' },
      ),
});

makeCommand({
  name: 'list-balances',
  description: 'List all balances',
  options: paginationOptions,
  action: (o) =>
    readARIOFromOptions(o)
      .getBalances(paginationParamsFromOptions(o))
      .then((result) =>
        result.items.length ? result : { message: 'No balances found' },
      ),
});

makeCommand({
  name: 'list-all-gateway-vaults',
  description: 'List vaults from all gateways',
  options: paginationAddressOptions,
  action: getAllGatewayVaults,
});

// # Actions
makeCommand({
  name: 'transfer',
  description: 'Transfer ARIO to another address',
  options: transferOptions,
  action: transferCLICommand,
});

makeCommand({
  name: 'vaulted-transfer',
  description: 'Transfer ARIO to another address into a locked vault',
  options: vaultedTransferOptions,
  action: vaultedTransferCLICommand,
});

makeCommand({
  name: 'revoke-vault',
  description: 'Revoke a vaulted transfer as the controller',
  options: [...writeActionOptions, optionMap.vaultId, optionMap.recipient],
  action: revokeVaultCLICommand,
});

makeCommand({
  name: 'create-vault',
  description: 'Create a locked vault with balance from the sender',
  options: [...writeActionOptions, optionMap.lockLengthMs, optionMap.quantity],
  action: createVaultCLICommand,
});

makeCommand({
  name: 'extend-vault',
  description: 'Extend the lock length of a vault as the recipient',
  options: [...writeActionOptions, optionMap.vaultId, optionMap.extendLengthMs],
  action: extendVaultCLICommand,
});

makeCommand({
  name: 'increase-vault',
  description: 'Increase the balance of a locked vault as the recipient',
  options: [...writeActionOptions, optionMap.vaultId, optionMap.quantity],
  action: increaseVaultCLICommand,
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
  action: leaveNetwork,
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
  action: saveObservations,
});

makeCommand({
  name: 'increase-operator-stake',
  description: 'Increase operator stake',
  options: operatorStakeOptions,
  action: increaseOperatorStake,
});

makeCommand({
  name: 'decrease-operator-stake',
  description: 'Decrease operator stake',
  options: operatorStakeOptions,
  action: decreaseOperatorStake,
});

makeCommand({
  name: 'instant-withdrawal',
  description:
    'Instantly withdraw stake from an existing gateway withdrawal vault',
  options: addressAndVaultIdOptions,
  action: instantWithdrawal,
});

makeCommand({
  name: 'cancel-withdrawal',
  description: 'Cancel a pending gateway withdrawal vault',
  options: addressAndVaultIdOptions,
  action: cancelWithdrawal,
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
  action: decreaseDelegateStake,
});

makeCommand({
  name: 'redelegate-stake',
  description: 'Redelegate stake to another gateway',
  options: redelegateStakeOptions,
  action: redelegateStake,
});

makeCommand({
  name: 'buy-record',
  description: 'Buy a record',
  options: buyRecordOptions,
  action: buyRecordCLICommand,
});

makeCommand({
  name: 'upgrade-record',
  description: 'Upgrade the lease of a record to a permabuy',
  options: arnsPurchaseOptions,
  action: upgradeRecordCLICommand,
});

makeCommand({
  name: 'extend-lease',
  description: 'Extend the lease of a record',
  options: [...arnsPurchaseOptions, optionMap.years],
  action: extendLeaseCLICommand,
});

makeCommand({
  name: 'increase-undername-limit',
  description: 'Increase the limit of a name',
  options: [...arnsPurchaseOptions, optionMap.increaseCount],
  action: increaseUndernameLimitCLICommand,
});

makeCommand({
  name: 'request-primary-name',
  description: 'Request a primary name',
  options: arnsPurchaseOptions,
  action: requestPrimaryNameCLICommand,
});

// # ANTS

// # Getters
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
  name: 'get-ant-owner',
  description: 'Get the owner of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getOwner();
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

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-logo',
  description: 'Get the logo of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getLogo();
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

// # Spawn
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

// # ANT Paginated Handlers
makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-records',
  description: 'Get the records of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getRecords();
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
  name: 'list-ant-balances',
  description: 'Get the balances of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return readANTFromOptions(options).getBalances();
  },
});

// # Actions
makeCommand<ProcessIdWriteActionCLIOptions & { target?: string }>({
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
      customTagsFromOptions(options),
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
      customTagsFromOptions(options),
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
      customTagsFromOptions(options),
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
      customTagsFromOptions(options),
    );
  },
});

makeCommand({
  name: 'set-ant-record',
  description:
    'Set a record of an ANT process. Deprecated: use set-ant-base-name and set-ant-undername',
  options: setAntUndernameOptions,
  action: setAntRecordCLICommand,
});

makeCommand({
  name: 'set-ant-base-name',
  description: 'Set the base name of an ANT process',
  options: setAntBaseNameOptions,
  action: setAntBaseNameCLICommand,
});

makeCommand({
  name: 'set-ant-undername',
  description: 'Set an undername of an ANT process',
  options: setAntUndernameOptions,
  action: setAntRecordCLICommand,
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
      customTagsFromOptions(options),
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
      customTagsFromOptions(options),
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
      customTagsFromOptions(options),
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
      customTagsFromOptions(options),
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
        txId,
      },
      customTagsFromOptions(options),
    );
  },
});

// # ARIO Actions
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
        arioProcessId: arioProcessIdFromOptions(options),
      },
      customTagsFromOptions(options),
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
        arioProcessId: arioProcessIdFromOptions(options),
        antProcessId: targetProcess,
      },
      customTagsFromOptions(options),
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
        arioProcessId: arioProcessIdFromOptions(options),
      },
      customTagsFromOptions(options),
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
        arioProcessId: arioProcessIdFromOptions(options),
      },
      customTagsFromOptions(options),
    );
  },
});

// # Utilities
makeCommand({
  name: 'write-action',
  description: 'Send a write action to an AO Process',
  options: [...writeActionOptions, optionMap.processId],
  action: async (options) => {
    const process = new AOProcess({
      processId: requiredProcessIdFromOptions(options),
      logger: getLoggerFromOptions(options),
    });
    return process.send<AoMessageResult>({
      tags: customTagsFromOptions(options).tags ?? [],
      signer: requiredAoSignerFromOptions(options),
    });
  },
});

makeCommand({
  name: 'read-action',
  description: 'Send a dry-run read action to an AO Process',
  options: [optionMap.processId, optionMap.tags],
  action: async (options) => {
    const process = new AOProcess({
      processId: requiredProcessIdFromOptions(options),
      logger: getLoggerFromOptions(options),
    });
    return process.read<AoMessageResult>({
      tags: customTagsFromOptions(options).tags ?? [],
    });
  },
});

if (
  process.argv[1].includes('bin/ar.io') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
