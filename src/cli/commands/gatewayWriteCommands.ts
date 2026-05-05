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
import type { AoStakeDelegation } from '../../types/io.js';
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
  assertEnoughMARIOBalance,
  customTagsFromOptions,
  formatARIOWithCommas,
  gatewaySettingsFromOptions,
  redelegateParamsFromOptions,
  requiredAddressFromOptions,
  requiredMARIOFromOptions,
  requiredStringArrayFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  stringifyJsonForCLIDisplay,
  writeARIOFromOptions,
} from '../utils.js';

export async function joinNetwork(options: JoinNetworkCLIOptions) {
  const { ario, signerAddress } = await writeARIOFromOptions(options);

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
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity,
    });

    await assertConfirmationPrompt(
      `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${formatARIOWithCommas(mARIOQuantity.toARIO())} ARIO to join the AR.IO network\nAre you sure?\n`,
      options,
    );
  }

  const result = await ario.joinNetwork(
    settings,
    customTagsFromOptions(options),
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
  const { ario, signerAddress } = await writeARIOFromOptions(options);
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
    customTagsFromOptions(options),
  );

  const output = {
    updateGatewaySettingsResult: result,
    updatedGatewayAddress: signerAddress,
    message: `Gateway settings updated successfully`,
  };

  return output;
}

export async function leaveNetwork(options: WriteActionCLIOptions) {
  const { ario, signerAddress } = await writeARIOFromOptions(options);

  if (!options.skipConfirmation) {
    const gateway = await ario.getGateway({ address: signerAddress });

    await assertConfirmationPrompt(
      'Gateway Details:\n\n' +
        stringifyJsonForCLIDisplay(gateway) +
        '\n\n' +
        'Are you sure you want to leave the AR.IO network?',
      options,
    );
  }

  return (await writeARIOFromOptions(options)).ario.leaveNetwork(
    customTagsFromOptions(options),
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

  return (await writeARIOFromOptions(o)).ario.saveObservations(
    {
      failedGateways: requiredStringArrayFromOptions(o, 'failedGateways'),
      reportTxId: requiredStringFromOptions(o, 'transactionId'),
    },
    customTagsFromOptions(o),
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

  return (await writeARIOFromOptions(o)).ario.increaseOperatorStake(
    {
      increaseQty,
    },
    customTagsFromOptions(o),
  );
}

export async function decreaseOperatorStake(o: OperatorStakeCLIOptions) {
  const { ario, signerAddress } = await writeARIOFromOptions(o);
  const decreaseQty = requiredMARIOFromOptions(o, 'operatorStake');

  if (!o.skipConfirmation) {
    const gateway = await ario.getGateway({ address: signerAddress });
    if (gateway === undefined) {
      throw new Error(
        `No gateway found for address ${signerAddress}. You must be a gateway operator to decrease stake.`,
      );
    }

    const settings = await ario.getGatewayRegistrySettings();
    const currentStake = gateway.operatorStake;
    const remaining = currentStake - decreaseQty.valueOf();

    if (remaining < 0) {
      throw new Error(
        `Insufficient operator stake. Current: ${formatARIOWithCommas(new mARIOToken(currentStake).toARIO())} ARIO, requested decrease: ${formatARIOWithCommas(decreaseQty.toARIO())} ARIO`,
      );
    }

    if (remaining > 0 && remaining < settings.operators.minStake) {
      throw new Error(
        `Remaining stake (${formatARIOWithCommas(new mARIOToken(remaining).toARIO())} ARIO) would be below minimum (${formatARIOWithCommas(new mARIOToken(settings.operators.minStake).toARIO())} ARIO). Decrease to exactly 0 (after calling leave-network) or keep above the minimum.`,
      );
    }
  }

  await assertConfirmationPrompt(
    `You are about to decrease your operator stake by ${formatARIOWithCommas(
      decreaseQty.toARIO(),
    )} ARIO\nAre you sure?`,
    o,
  );

  return ario.decreaseOperatorStake(
    {
      decreaseQty,
    },
    customTagsFromOptions(o),
  );
}

export async function instantWithdrawal(o: AddressAndVaultIdCLIWriteOptions) {
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const gatewayAddress = requiredAddressFromOptions(o);

  await assertConfirmationPrompt(
    `You are about to instantly withdraw from vault ${vaultId} for with gateway address ${gatewayAddress}\nAre you sure?`,
    o,
  );

  return (await writeARIOFromOptions(o)).ario.instantWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    customTagsFromOptions(o),
  );
}

export async function cancelWithdrawal(o: AddressAndVaultIdCLIWriteOptions) {
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const gatewayAddress = requiredAddressFromOptions(o);

  await assertConfirmationPrompt(
    `You are about to cancel the pending withdrawal from vault ${vaultId} for with gateway address ${gatewayAddress}\nAre you sure?`,
    o,
  );

  return (await writeARIOFromOptions(o)).ario.cancelWithdrawal(
    {
      vaultId,
      gatewayAddress,
    },
    customTagsFromOptions(o),
  );
}

export async function delegateStake(options: TransferCLIOptions) {
  const { ario, signerAddress } = await writeARIOFromOptions(options);

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

    // Check allowlist if gateway restricts delegation. `allowDelegatedStaking`
    // is `boolean | 'allowlist'`; the SDK maps `allowlist_enabled = true` on
    // Solana to the `'allowlist'` variant (see deserialize.ts).
    //
    // `getGatewayDelegateAllowList` returns `PaginationResult<WalletAddress>`,
    // so we walk pages by cursor — the previous shape (plain `string[]`) was
    // never the actual return type and made the membership check dead code.
    //
    // Note: the on-chain delegate handler also lets you bypass the allowlist
    // if you already have stake > 0 with this gateway (delegate.rs). We
    // can't easily check that client-side, so this preflight surfaces the
    // most common case (new-delegator-not-on-list) but falls through any
    // unexpected error to let the on-chain check arbitrate.
    if (targetGateway.settings.allowDelegatedStaking === 'allowlist') {
      try {
        let cursor: string | undefined;
        let onAllowlist = false;
        let allowlistHasEntries = false;
        do {
          const page = await ario.getGatewayDelegateAllowList({
            address: target,
            limit: 1_000,
            cursor,
          });
          if (page.items.length > 0) allowlistHasEntries = true;
          if (page.items.includes(signerAddress)) {
            onAllowlist = true;
            break;
          }
          cursor = page.nextCursor;
        } while (cursor);

        if (allowlistHasEntries && !onAllowlist) {
          throw new Error(
            `You (${signerAddress}) are not on the delegation allowlist for gateway ${target}.`,
          );
        }
      } catch (e: unknown) {
        // Re-throw our own "not on allowlist" error; swallow anything else
        // so the on-chain check can produce the canonical failure.
        if (
          e instanceof Error &&
          e.message.includes('not on the delegation allowlist')
        ) {
          throw e;
        }
      }
    }

    // Validate minimum delegation amount
    const settings = await ario.getGatewayRegistrySettings();
    const contractMinDelegation = settings.delegates.minStake;
    const gatewayMinDelegation =
      targetGateway.settings.minDelegatedStake ?? contractMinDelegation;
    const effectiveMin = Math.max(contractMinDelegation, gatewayMinDelegation);

    if (mARIOQuantity.valueOf() < effectiveMin) {
      throw new Error(
        `Delegation amount (${formatARIOWithCommas(arioQuantity)} ARIO) is below minimum (${formatARIOWithCommas(new mARIOToken(effectiveMin).toARIO())} ARIO).`,
      );
    }

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
    customTagsFromOptions(options),
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
  const ario = await (await writeARIOFromOptions(options)).ario;
  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const instant = options.instant ?? false;

  if (!options.skipConfirmation) {
    // Verify the target gateway exists and look up delegation
    const signerAddr = (await writeARIOFromOptions(options)).signerAddress;
    const targetGateway = await ario.getGateway({ address: target });
    if (targetGateway === undefined) {
      throw new Error(`Gateway not found: ${target}`);
    }

    // Find delegation to this gateway
    const delegations = await ario.getDelegations({ address: signerAddr });
    const delegation = delegations.items.find(
      (d) => d.gatewayAddress === target && d.type === 'stake',
    ) as AoStakeDelegation | undefined;
    if (!delegation) {
      throw new Error(
        `No active delegation found for you on gateway ${target}.`,
      );
    }
    if (arioQuantity.toMARIO().valueOf() > delegation.balance) {
      throw new Error(
        `Cannot decrease by ${formatARIOWithCommas(arioQuantity)} ARIO — you only have ${formatARIOWithCommas(new mARIOToken(delegation.balance).toARIO())} ARIO delegated.`,
      );
    }

    const remaining = delegation.balance - arioQuantity.toMARIO().valueOf();
    if (remaining > 0) {
      const registrySettings = await ario.getGatewayRegistrySettings();
      const contractMin = registrySettings.delegates.minStake;
      if (remaining < contractMin) {
        throw new Error(
          `Remaining delegation (${formatARIOWithCommas(new mARIOToken(remaining).toARIO())} ARIO) would be below minimum (${formatARIOWithCommas(new mARIOToken(contractMin).toARIO())} ARIO). Decrease to exactly 0 or keep above the minimum.`,
        );
      }
    }
  }

  if (instant) {
    await assertConfirmationPrompt(
      `WARNING: Instant withdrawal incurs a penalty.\nAre you sure you'd like to instantly decrease delegated stake of ${formatARIOWithCommas(arioQuantity)} ARIO on gateway ${target}?`,
      options,
    );
  } else {
    await assertConfirmationPrompt(
      `Are you sure you'd like to decrease delegated stake of ${formatARIOWithCommas(arioQuantity)} ARIO on gateway ${target}?`,
      options,
    );
  }

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
  const ario = await (await writeARIOFromOptions(options)).ario;
  const params = redelegateParamsFromOptions(options);

  if (!options.skipConfirmation) {
    const targetGateway = await ario.getGateway({ address: params.target });
    if (targetGateway === undefined) {
      throw new Error(`Target gateway not found: ${params.target}`);
    }
    if (targetGateway.settings.allowDelegatedStaking === false) {
      throw new Error(
        `Target gateway ${params.target} does not allow delegated staking.`,
      );
    }

    const sourceGateway = await ario.getGateway({ address: params.source });
    if (sourceGateway === undefined) {
      throw new Error(`Source gateway not found: ${params.source}`);
    }

    const signerAddr = (await writeARIOFromOptions(options)).signerAddress;
    const delegations = await ario.getDelegations({ address: signerAddr });
    const delegation = delegations.items.find(
      (d) => d.gatewayAddress === params.source && d.type === 'stake',
    ) as AoStakeDelegation | undefined;
    if (!delegation || delegation.balance < params.stakeQty.valueOf()) {
      const available = delegation?.balance ?? 0;
      throw new Error(
        `Insufficient delegated stake on source gateway ${params.source}. Available: ${formatARIOWithCommas(new mARIOToken(available).toARIO())} ARIO, requested: ${formatARIOWithCommas(params.stakeQty.toARIO())} ARIO`,
      );
    }
  }

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
