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
import { mIOToken } from '../../node/index.js';
import {
  AddressAndVaultIdCLIWriteOptions,
  JoinNetworkCLIOptions,
  OperatorStakeCLIOptions,
  UpdateGatewaySettingsCLIOptions,
  WriteActionCLIOptions,
} from '../types.js';
import {
  assertConfirmationPrompt,
  assertEnoughBalance,
  formatIOWithCommas,
  gatewaySettingsFromOptions,
  requiredAddressFromOptions,
  requiredMIOFromOptions as requiredMARIOFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
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
