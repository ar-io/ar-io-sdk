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

import { mARIOToken } from '../types/token.js';
import { version } from '../version.js';
import {
  setAntBaseNameCLICommand,
  setAntRecordCLICommand,
  setAntUndernameCLICommand,
  transferRecordOwnershipCLICommand,
} from './commands/antCommands.js';
import {
  buyRecordCLICommand,
  extendLeaseCLICommand,
  increaseUndernameLimitCLICommand,
  requestPrimaryNameCLICommand,
  setPrimaryNameCLICommand,
  syncAttributesCLICommand,
  upgradeRecordCLICommand,
} from './commands/arnsPurchaseCommands.js';
import {
  escrowCancelCLICommand,
  escrowClaimArweaveCLICommand,
  escrowClaimEthereumCLICommand,
  escrowDepositCLICommand,
  escrowStatusCLICommand,
  escrowUpdateRecipientCLICommand,
} from './commands/escrowCommands.js';
import {
  cancelWithdrawal,
  claimWithdrawal,
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
  closeDrainedWithdrawalCLICommand,
  closeEmptyDelegationCLICommand,
  closeExpiredRequestCLICommand,
  closeObservationCLICommand,
  finalizeGoneCLICommand,
  pruneExpiredNamesCLICommand,
  pruneExpiredReservationCLICommand,
  pruneGatewayCLICommand,
  pruneNameToReturnedCLICommand,
  pruneReturnedNamesCLICommand,
  releaseVaultCLICommand,
} from './commands/pruneCommands.js';
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
  getWithdrawals,
  listAllDelegatesCLICommand,
  listAntsForAddress,
  listArNSRecords,
  listArNSRecordsForAddress,
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
  transferRecordOwnershipOptions,
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
  assertConfirmationPrompt,
  customTagsFromOptions,
  epochInputFromOptions,
  formatARIOWithCommas,
  makeCommand,
  paginationParamsFromOptions,
  readANTFromOptions,
  readARIOFromOptions,
  requiredAddressFromOptions,
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
  name: 'list-arns-names-for-address',
  description: 'List all ArNS names for an address',
  options: [...paginationOptions, optionMap.address],
  action: listArNSRecordsForAddress,
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

makeCommand({
  name: 'get-withdrawals',
  description:
    'Get all pending stake withdrawals (operator + delegate) owned by an address (Solana-only)',
  options: paginationAddressOptions,
  action: getWithdrawals,
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
  name: 'claim-withdrawal',
  description:
    'Claim tokens from a matured withdrawal vault (after the lock period has elapsed)',
  options: [...writeActionOptions, optionMap.vaultId],
  action: claimWithdrawal,
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
  name: 'buy-name',
  description: 'Buy a name (alias for buy-record)',
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
  name: 'sync-attributes',
  description:
    'Sync the on-chain ANT Attributes plugin (ArNS Name / Type / Undername Limit) ' +
    'with the current ArnsRecord. Solana-only; permissionless reconciliation. ' +
    'Use after a buy/reassign where the buyer was not the ANT NFT holder.',
  options: arnsPurchaseOptions,
  action: syncAttributesCLICommand,
});

makeCommand({
  name: 'request-primary-name',
  description: 'Request a primary name',
  options: arnsPurchaseOptions,
  action: requestPrimaryNameCLICommand,
});

makeCommand<AddressAndNameCLIOptions>({
  name: 'set-primary-name',
  description: 'Set an ArNS name you own as your primary name',
  options: arnsPurchaseOptions,
  action: setPrimaryNameCLICommand,
});

// # Prune / cleanup (Solana-only — permissionless crank surface)
makeCommand({
  name: 'prune-expired-names',
  description:
    'Batch-prune expired ArnsRecord PDAs (Solana-only). Discovers eligible records ' +
    'via getExpiredArnsRecords if --arns-records is omitted.',
  options: [...writeActionOptions, optionMap.max, optionMap.arnsRecords],
  action: pruneExpiredNamesCLICommand,
});

makeCommand({
  name: 'prune-name-to-returned',
  description:
    'Convert a single expired-but-not-yet-returned lease into a ReturnedName ' +
    '(starts the Dutch auction). Solana-only.',
  options: [...writeActionOptions, optionMap.name],
  action: pruneNameToReturnedCLICommand,
});

makeCommand({
  name: 'prune-returned-names',
  description:
    'Batch-prune expired ReturnedName PDAs (Solana-only). Discovers via ' +
    'getExpiredReturnedNames if --returned-names is omitted.',
  options: [...writeActionOptions, optionMap.max, optionMap.returnedNames],
  action: pruneReturnedNamesCLICommand,
});

makeCommand({
  name: 'prune-expired-reservation',
  description: 'Close an expired ReservedName PDA (Solana-only).',
  options: [...writeActionOptions, optionMap.name],
  action: pruneExpiredReservationCLICommand,
});

makeCommand({
  name: 'prune-gateway',
  description:
    'Slash + remove a deficient gateway (≥30 consecutive failures). Solana-only.',
  options: [...writeActionOptions, optionMap.gateway],
  action: pruneGatewayCLICommand,
});

makeCommand({
  name: 'finalize-gone',
  description:
    'GC a Leaving/Gone gateway whose leave window has fully elapsed. Solana-only.',
  options: [...writeActionOptions, optionMap.gateway],
  action: finalizeGoneCLICommand,
});

makeCommand({
  name: 'close-observation',
  description:
    'Reclaim rent from an Observation PDA whose epoch has been distributed. Solana-only.',
  options: [...writeActionOptions, optionMap.epochIndex, optionMap.observer],
  action: closeObservationCLICommand,
});

makeCommand({
  name: 'close-empty-delegation',
  description:
    'Close an empty Delegation PDA (amount == 0). Rent refunds to the original delegator. Solana-only.',
  options: [...writeActionOptions, optionMap.gateway, optionMap.delegator],
  action: closeEmptyDelegationCLICommand,
});

makeCommand({
  name: 'close-drained-withdrawal',
  description:
    'Close a drained Withdrawal PDA (amount == 0). Rent refunds to the original owner. Solana-only.',
  options: [...writeActionOptions, optionMap.owner, optionMap.withdrawalId],
  action: closeDrainedWithdrawalCLICommand,
});

makeCommand({
  name: 'release-vault',
  description:
    'Release tokens from an expired vault back to the owner (Solana-only). ' +
    'NOT permissionless — must be called from the vault owner wallet.',
  options: [...writeActionOptions, optionMap.vaultId, optionMap.owner],
  action: releaseVaultCLICommand,
});

makeCommand({
  name: 'close-expired-request',
  description: 'Close an expired PrimaryNameRequest PDA. Solana-only.',
  options: [...writeActionOptions, optionMap.initiator],
  action: closeExpiredRequestCLICommand,
});

// # ANT Registry
makeCommand({
  name: 'get-ants-for-address',
  description:
    'Get the list of ANTs owned by an address according to the ANT registry',
  options: [optionMap.address],
  action: listAntsForAddress,
});

// # ANTS

// # Getters
makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-state',
  description: 'Get the state of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getState();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-info',
  description: 'Get the info of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getInfo();
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
      (await (
        await readANTFromOptions(options)
      ).getRecord({
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
    return (await readANTFromOptions(options)).getOwner();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-name',
  description: 'Get the name of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getName();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-ticker',
  description: 'Get the ticker of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getTicker();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'get-ant-logo',
  description: 'Get the logo of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getLogo();
  },
});

makeCommand<ProcessIdCLIOptions & { address?: string }>({
  name: 'get-ant-balance',
  description: 'Get the balance of an ANT process',
  options: [optionMap.processId, optionMap.address],
  action: async (options) => {
    return (await readANTFromOptions(options)).getBalance({
      address: requiredAddressFromOptions(options),
    });
  },
});

// # Spawn
makeCommand<ANTStateCLIOptions>({
  name: 'spawn-ant',
  description: 'Spawn an ANT (mints a new MPL Core asset + ario-ant PDAs)',
  options: antStateOptions,
  action: async (options) => {
    // The signer's pubkey IS the ANT owner on Solana — no separate
    // `--address` flag is needed. Build the InitializeAntParams payload
    // from CLI flags.
    const { spawnSolanaANTFromOptions } = await import('./utils.js');
    const result = await spawnSolanaANTFromOptions(options);
    return {
      processId: result.processId,
      signature: result.signature,
      message: `Spawned ANT (mint=${result.processId})`,
    };
  },
});

// # ANT Paginated Handlers
makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-records',
  description: 'Get the records of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getRecords();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-controllers',
  description: 'List the controllers of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getControllers();
  },
});

makeCommand<ProcessIdCLIOptions>({
  name: 'list-ant-balances',
  description: 'Get the balances of an ANT process',
  options: [optionMap.processId],
  action: async (options) => {
    return (await readANTFromOptions(options)).getBalances();
  },
});

// # Actions
makeCommand<
  ProcessIdWriteActionCLIOptions & {
    target?: string;
  }
>({
  name: 'transfer-ant-ownership',
  description:
    'Transfer ownership of an ANT process. Ex-controllers are always cleared (Solana ACL semantics — see ANTWrite.transfer JSDoc).',
  options: [optionMap.processId, optionMap.target, ...writeActionOptions],
  action: async (options) => {
    const target = requiredStringFromOptions(options, 'target');
    await assertConfirmationPrompt(
      `Are you sure you want to transfer ANT ownership to ${target}? Existing controllers will be removed.`,
      options,
    );
    return (await writeANTFromOptions(options)).transfer(
      { target },
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
    return (await writeANTFromOptions(options)).addController(
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
    return (await writeANTFromOptions(options)).removeController(
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

    return (await writeANTFromOptions(options)).removeRecord(
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
  action: setAntUndernameCLICommand,
});

makeCommand({
  name: 'transfer-record',
  description:
    'Transfer ownership of a specific record (undername) to another address',
  options: transferRecordOwnershipOptions,
  action: transferRecordOwnershipCLICommand,
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

    return (await writeANTFromOptions(options)).setTicker(
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

    return (await writeANTFromOptions(options)).setName(
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

    return (await writeANTFromOptions(options)).setDescription(
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
    return (await writeANTFromOptions(options)).setKeywords(
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
    return (await writeANTFromOptions(options)).setLogo(
      {
        txId,
      },
      customTagsFromOptions(options),
    );
  },
});

// =========================================
// ANT Escrow commands (`ario-ant-escrow` program — Solana-only)
// =========================================

// `optionMap.rpcUrl`, `walletFile`, and `privateKey` are already in
// `globalOptions` and are merged in by `makeCommand` for every command — re-listing
// them here would re-register the flags and crash Commander with
// "due to conflicting flag '--rpc-url'" at CLI startup.
const escrowCommonOptions = [optionMap.escrowProgramId, optionMap.ant];

makeCommand({
  name: 'escrow-status',
  description:
    'Read the on-chain EscrowAnt PDA for an ANT mint (no signer needed).',
  options: [optionMap.escrowProgramId, optionMap.ant],
  action: escrowStatusCLICommand,
});

makeCommand({
  name: 'escrow-deposit',
  description:
    'Lock an ANT into the trustless escrow program. Use --recipient-arweave <jwk> or --recipient-ethereum <0x...>.',
  options: [
    ...escrowCommonOptions,
    optionMap.recipientArweave,
    optionMap.recipientEthereum,
  ],
  action: escrowDepositCLICommand,
});

makeCommand({
  name: 'escrow-cancel',
  description:
    'Pull an escrowed ANT back to the depositor. Closes the escrow PDA and refunds rent.',
  options: escrowCommonOptions,
  action: escrowCancelCLICommand,
});

makeCommand({
  name: 'escrow-update-recipient',
  description:
    'Re-target an active escrow at a different Arweave/Ethereum identity. Rotates the on-chain nonce.',
  options: [
    ...escrowCommonOptions,
    optionMap.newRecipientArweave,
    optionMap.newRecipientEthereum,
  ],
  action: escrowUpdateRecipientCLICommand,
});

makeCommand({
  name: 'escrow-claim-arweave',
  description:
    'Submit an Arweave RSA-PSS-4096 signature to release the ANT. Anyone can submit; only the named claimant receives.',
  options: [
    ...escrowCommonOptions,
    optionMap.signatureFile,
    optionMap.saltLen,
    optionMap.claimant,
  ],
  action: escrowClaimArweaveCLICommand,
});

makeCommand({
  name: 'escrow-claim-ethereum',
  description:
    'Submit an Ethereum ECDSA personal_sign signature (65 bytes r||s||v) to release the ANT.',
  options: [
    ...escrowCommonOptions,
    optionMap.signatureFile,
    optionMap.claimant,
  ],
  action: escrowClaimEthereumCLICommand,
});

if (
  process.argv[1].includes('bin/ar.io') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
