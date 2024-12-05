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
import prompts from 'prompts';

import { mIOToken } from '../../node/index.js';
import {
  AddressAndVaultIdCLIWriteOptions,
  DecreaseDelegateStakeCLIOptions,
  JoinNetworkCLIOptions,
  OperatorStakeCLIOptions,
  RedelegateStakeCLIOptions,
  TransferCLIOptions,
  UpdateGatewaySettingsCLIOptions,
  WriteActionCLIOptions,
} from '../types.js';
import {
  assertConfirmationPrompt,
  assertEnoughBalance,
  formatIOWithCommas,
  gatewaySettingsFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredMIOFromOptions as requiredMARIOFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  stringifyJsonForCLIDisplay,
  writeActionTagsFromOptions,
  writeIOFromOptions,
} from '../utils.js';

export async function joinNetwork(options: JoinNetworkCLIOptions) {
  const { io, signerAddress } = writeIOFromOptions(options);

  const mARIOQuantity = requiredMARIOFromOptions(options, 'operatorStake');

  const settings = {
    ...gatewaySettingsFromOptions(options),
    operatorStake: mARIOQuantity.valueOf(),
  };

  if (settings.label === undefined) {
    throw new Error(
      'Label is required. Please provide a --label for your node.',
    );
  }
  if (settings.fqdn === undefined) {
    throw new Error('FQDN is required. Please provide a --fqdn for your node.');
  }

  if (!options.skipConfirmation) {
    const settings = await io.getGatewayRegistrySettings();
    if (settings.operators.minStake > mARIOQuantity.valueOf()) {
      throw new Error(
        `The minimum operator stake is ${formatIOWithCommas(
          new mIOToken(settings.operators.minStake).toIO(),
        )} IO. Please provide a higher stake.`,
      );
    }
    await assertEnoughBalance(io, signerAddress, mARIOQuantity.toIO());

    await assertConfirmationPrompt(
      `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${formatIOWithCommas(mARIOQuantity.toIO())} IO to join the AR.IO network\nAre you sure?\n`,
      options,
    );
  }

  const result = await io.joinNetwork(
    settings,
    writeActionTagsFromOptions(options),
  );

  const output = {
    joinNetworkResult: result,
    joinedAddress: signerAddress,
    message: `Congratulations! You have successfully joined the AR.IO network  (;`,
  };

  return output;
}

export async function updateGatewaySettings(
  options: UpdateGatewaySettingsCLIOptions,
) {
  const { io, signerAddress } = writeIOFromOptions(options);
  const gatewaySettings = gatewaySettingsFromOptions(options);

  if (Object.keys(gatewaySettings).length === 0) {
    // TODO: The contract accepts empty Update-Gateway-Settings actions, but we'll throw in the CLI for now
    throw new Error('No gateway settings provided');
  }

  await assertConfirmationPrompt(
    `Gateway Settings:\n\n${stringifyJsonForCLIDisplay(gatewaySettings)}\n\nYou are about to update your gateway settings to the above\nAre you sure?\n`,
    options,
  );

  const result = await io.updateGatewaySettings(
    gatewaySettings,
    writeActionTagsFromOptions(options),
  );

  const output = {
    updateGatewaySettingsResult: result,
    updatedGatewayAddress: signerAddress,
    message: `Gateway settings updated successfully`,
  };

  return output;
}

export async function leaveNetwork(options: WriteActionCLIOptions) {
  const { io, signerAddress } = writeIOFromOptions(options);

  if (!options.skipConfirmation) {
    const gateway = await io.getGateway({ address: signerAddress });
    if (!gateway) {
      throw new Error(`Gateway not found for address: ${signerAddress}`);
    }

    await assertConfirmationPrompt(
      'Gateway Details:\n\n' +
        stringifyJsonForCLIDisplay(gateway) +
        '\n\n' +
        'Are you sure you want to leave the AR.IO network?',
      options,
    );
  }

  return writeIOFromOptions(options).io.leaveNetwork(
    writeActionTagsFromOptions(options),
  );
}

export async function saveObservations(
  o: WriteActionCLIOptions & {
    failedGateways?: string[];
    transactionId?: string;
  },
) {
  const failedGateways = requiredStringArrayFromOptions(o, 'failedGateways');
  const reportTxId = requiredStringFromOptions(o, 'transactionId');

  await assertConfirmationPrompt(
    `You are about to save the following failed gateways to the AR.IO network:\n\n${failedGateways.join(
      '\n',
    )}\n\nTransaction ID: ${reportTxId}\n\nAre you sure?`,
    o,
  );

  return writeIOFromOptions(o).io.saveObservations(
    {
      failedGateways: requiredStringArrayFromOptions(o, 'failedGateways'),
      reportTxId: requiredStringFromOptions(o, 'transactionId'),
    },
    writeActionTagsFromOptions(o),
  );
}

export async function increaseOperatorStake(o: OperatorStakeCLIOptions) {
  const increaseQty = requiredMARIOFromOptions(o, 'operatorStake');

  await assertConfirmationPrompt(
    `You are about to increase your operator stake by ${formatIOWithCommas(
      increaseQty.toIO(),
    )} IO\nAre you sure?`,
    o,
  );

  return (
    writeIOFromOptions(o).io.increaseOperatorStake({
      increaseQty,
    }),
    writeActionTagsFromOptions(o)
  );
}

export async function decreaseOperatorStake(o: OperatorStakeCLIOptions) {
  const decreaseQty = requiredMARIOFromOptions(o, 'operatorStake');

  // TODO: Can assert stake is sufficient for action, and new target stake meets contract minimum

  await assertConfirmationPrompt(
    `You are about to decrease your operator stake by ${formatIOWithCommas(
      decreaseQty.toIO(),
    )} IO\nAre you sure?`,
    o,
  );

  return writeIOFromOptions(o).io.decreaseOperatorStake(
    {
      decreaseQty,
    },
    writeActionTagsFromOptions(o),
  );
}

export async function instantWithdrawal(o: AddressAndVaultIdCLIWriteOptions) {
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const gatewayAddress = requiredAddressFromOptions(o);

  await assertConfirmationPrompt(
    `You are about to instantly withdraw from vault ${vaultId} for with gateway address ${gatewayAddress}\nAre you sure?`,
    o,
  );

  return writeIOFromOptions(o).io.instantWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    writeActionTagsFromOptions(o),
  );
}

export async function cancelWithdrawal(o: AddressAndVaultIdCLIWriteOptions) {
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const gatewayAddress = requiredAddressFromOptions(o);

  await assertConfirmationPrompt(
    `You are about to cancel the pending withdrawal from vault ${vaultId} for with gateway address ${gatewayAddress}\nAre you sure?`,
    o,
  );

  return writeIOFromOptions(o).io.cancelWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    writeActionTagsFromOptions(o),
  );
}

export async function delegateStake(options: TransferCLIOptions) {
  const { io, signerAddress } = writeIOFromOptions(options);

  const { target, ioQuantity } = requiredTargetAndQuantityFromOptions(options);
  const mIOQuantity = ioQuantity.toMIO();

  if (!options.skipConfirmation) {
    const balance = await io.getBalance({ address: signerAddress });

    if (balance < mIOQuantity.valueOf()) {
      throw new Error(
        `Insufficient IO balance for delegating stake. Balance available: ${new mIOToken(balance).toIO()} IO`,
      );
    }

    const targetGateway = await io.getGateway({ address: target });
    if (targetGateway === undefined) {
      throw new Error(`Gateway not found for address: ${target}`);
    }
    if (targetGateway.settings.allowDelegatedStaking === false) {
      throw new Error(`Gateway does not allow delegated staking: ${target}`);
    }

    // TODO: could get allow list and assert doesn't exist or user is on it

    // TODO: could read from contract to get current delegated stake if there is none, get contract minimum delegated stake. Then see if the new stake value will satisfy minimum delegated stake for both the target gateway settings min delegate stake and contract min delegated amounts

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Target Gateway:\n${JSON.stringify(targetGateway, null, 2)}\n\nAre you sure you want to delegate ${formatIOWithCommas(ioQuantity)} IO to ${target}?`,
    });

    if (!confirm) {
      return { message: 'Delegate stake aborted by user' };
    }
  }

  const result = await io.delegateStake(
    {
      target,
      stakeQty: ioQuantity.toMIO(),
    },
    writeActionTagsFromOptions(options),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully delegated ${formatIOWithCommas(ioQuantity)} IO to ${target}`,
  };

  return output;
}

export async function decreaseDelegateStake(
  options: DecreaseDelegateStakeCLIOptions,
) {
  const io = writeIOFromOptions(options).io;
  const { target, ioQuantity } = requiredTargetAndQuantityFromOptions(options);
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
}

export async function redelegateStake(options: RedelegateStakeCLIOptions) {
  const io = writeIOFromOptions(options).io;
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
}
