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

import { mARIOToken } from '../../node/index.js';
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
  formatARIOWithCommas,
  gatewaySettingsFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredMIOFromOptions as requiredMARIOFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  stringifyJsonForCLIDisplay,
  writeARIOFromOptions,
  writeActionTagsFromOptions,
} from '../utils.js';

export async function joinNetwork(options: JoinNetworkCLIOptions) {
  const { ario, signerAddress } = writeARIOFromOptions(options);

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
    const settings = await ario.getGatewayRegistrySettings();
    if (settings.operators.minStake > mARIOQuantity.valueOf()) {
      throw new Error(
        `The minimum operator stake is ${formatARIOWithCommas(
          new mARIOToken(settings.operators.minStake).toARIO(),
        )} ARIO. Please provide a higher stake.`,
      );
    }
    await assertEnoughBalance(ario, signerAddress, mARIOQuantity.toARIO());

    await assertConfirmationPrompt(
      `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${formatARIOWithCommas(mARIOQuantity.toARIO())} ARIO to join the AR.IO network\nAre you sure?\n`,
      options,
    );
  }

  const result = await ario.joinNetwork(
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
  const { ario, signerAddress } = writeARIOFromOptions(options);
  const gatewaySettings = gatewaySettingsFromOptions(options);

  if (Object.keys(gatewaySettings).length === 0) {
    // TODO: The contract accepts empty Update-Gateway-Settings actions, but we'll throw in the CLI for now
    throw new Error('No gateway settings provided');
  }

  await assertConfirmationPrompt(
    `Gateway Settings:\n\n${stringifyJsonForCLIDisplay(gatewaySettings)}\n\nYou are about to update your gateway settings to the above\nAre you sure?\n`,
    options,
  );

  const result = await ario.updateGatewaySettings(
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
  const { ario, signerAddress } = writeARIOFromOptions(options);

  if (!options.skipConfirmation) {
    const gateway = await ario.getGateway({ address: signerAddress });
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

  return writeARIOFromOptions(options).ario.leaveNetwork(
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

  return writeARIOFromOptions(o).ario.saveObservations(
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
    `You are about to increase your operator stake by ${formatARIOWithCommas(
      increaseQty.toARIO(),
    )} ARIO\nAre you sure?`,
    o,
  );

  return (
    writeARIOFromOptions(o).ario.increaseOperatorStake({
      increaseQty,
    }),
    writeActionTagsFromOptions(o)
  );
}

export async function decreaseOperatorStake(o: OperatorStakeCLIOptions) {
  const decreaseQty = requiredMARIOFromOptions(o, 'operatorStake');

  // TODO: Can assert stake is sufficient for action, and new target stake meets contract minimum

  await assertConfirmationPrompt(
    `You are about to decrease your operator stake by ${formatARIOWithCommas(
      decreaseQty.toARIO(),
    )} ARIO\nAre you sure?`,
    o,
  );

  return writeARIOFromOptions(o).ario.decreaseOperatorStake(
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

  return writeARIOFromOptions(o).ario.instantWithdrawal(
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

  return writeARIOFromOptions(o).ario.cancelWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    writeActionTagsFromOptions(o),
  );
}

export async function delegateStake(options: TransferCLIOptions) {
  const { ario, signerAddress } = writeARIOFromOptions(options);

  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const mARIOQuantity = arioQuantity.toMARIO();

  if (!options.skipConfirmation) {
    const balance = await ario.getBalance({ address: signerAddress });

    if (balance < mARIOQuantity.valueOf()) {
      throw new Error(
        `Insufficient ARIO balance for delegating stake. Balance available: ${new mARIOToken(balance).toARIO()} ARIO`,
      );
    }

    const targetGateway = await ario.getGateway({ address: target });
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
      message: `Target Gateway:\n${JSON.stringify(targetGateway, null, 2)}\n\nAre you sure you want to delegate ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}?`,
    });

    if (!confirm) {
      return { message: 'Delegate stake aborted by user' };
    }
  }

  const result = await ario.delegateStake(
    {
      target,
      stakeQty: arioQuantity.toMARIO(),
    },
    writeActionTagsFromOptions(options),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully delegated ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}`,
  };

  return output;
}

export async function decreaseDelegateStake(
  options: DecreaseDelegateStakeCLIOptions,
) {
  const ario = writeARIOFromOptions(options).ario;
  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const instant = options.instant ?? false;

  // TODO: Could assert sender is a delegate with enough stake to decrease
  // TODO: Could assert new target stake meets contract and target gateway minimums
  // TODO: Could present confirmation prompt with any fee for instant withdrawal (50% of the stake is put back into protocol??)

  await assertConfirmationPrompt(
    `Are you sure you'd like to decrease delegated stake of ${formatARIOWithCommas(arioQuantity)} ARIO on gateway ${target}?`,
    options,
  );

  const result = await ario.decreaseDelegateStake({
    target,
    decreaseQty: arioQuantity.toMARIO(),
    instant,
  });

  const output = {
    targetGateway: target,
    decreaseDelegateStakeResult: result,
    message: `Successfully decreased delegated stake of ${formatARIOWithCommas(
      arioQuantity,
    )} ARIO to ${target}`,
  };

  return output;
}

export async function redelegateStake(options: RedelegateStakeCLIOptions) {
  const ario = writeARIOFromOptions(options).ario;
  const params = redelegateParamsFromOptions(options);

  // TODO: Could assert target gateway exists
  // TODO: Could do assertion on source has enough stake to redelegate
  // TODO: Could do assertions on source/target min delegate stakes are met

  await assertConfirmationPrompt(
    `Are you sure you'd like to redelegate stake of ${formatARIOWithCommas(params.stakeQty.toARIO())} ARIO from ${params.source} to ${params.target}?`,
    options,
  );

  const result = await ario.redelegateStake(params);

  const output = {
    sourceGateway: params.source,
    targetGateway: params.target,
    redelegateStakeResult: result,
    message: `Successfully re-delegated stake of ${formatARIOWithCommas(
      params.stakeQty.toARIO(),
    )} ARIO from ${params.source} to ${params.target}`,
  };

  return output;
}
