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
import {
  AoCreateVaultParams,
  AoExtendVaultParams,
  AoIncreaseVaultParams,
  AoRevokeVaultParams,
  AoVaultedTransferParams,
} from '../../types/io.js';
import {
  CLIWriteOptionsFromAoParams,
  JsonSerializable,
  TransferCLIOptions,
} from '../types.js';
import {
  assertEnoughMARIOBalance,
  assertLockLengthInRange,
  confirmationPrompt,
  customTagsFromOptions,
  formatARIOWithCommas,
  formatMARIOToARIOWithCommas,
  requiredMARIOFromOptions,
  requiredPositiveIntegerFromOptions,
  requiredStringFromOptions,
  requiredTargetAndQuantityFromOptions,
  writeARIOFromOptions,
} from '../utils.js';

export async function transferCLICommand(options: TransferCLIOptions) {
  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const { ario, signerAddress } = writeARIOFromOptions(options);

  if (!options.skipConfirmation) {
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity: arioQuantity.toMARIO(),
    });

    const confirm = await confirmationPrompt(
      `Are you sure you want to transfer ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}?`,
    );
    if (!confirm) {
      return { message: 'Transfer aborted by user' };
    }
  }

  const result = await ario.transfer(
    {
      target,
      qty: arioQuantity.toMARIO().valueOf(),
    },
    customTagsFromOptions(options),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully transferred ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}`,
  };

  return output;
}

export async function vaultedTransferCLICommand(
  o: CLIWriteOptionsFromAoParams<AoVaultedTransferParams>,
): Promise<JsonSerializable> {
  const mARIOQuantity = requiredMARIOFromOptions(o, 'quantity');
  const recipient = requiredStringFromOptions(o, 'recipient');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const lockLengthMs = requiredPositiveIntegerFromOptions(o, 'lockLengthMs');
  assertLockLengthInRange(lockLengthMs);

  if (!o.skipConfirmation) {
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity,
    });

    const confirm = await confirmationPrompt(
      `Are you sure you want transfer ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO to ${recipient}, locked in a ${o.revokable ? '' : 'non-'}revokable vault for ${lockLengthMs}ms?`,
    );
    if (!confirm) {
      return { message: 'Transfer aborted by user' };
    }
  }

  const result = await ario.vaultedTransfer(
    {
      recipient,
      quantity: mARIOQuantity,
      lockLengthMs,
      revokable: o.revokable,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully vaulted transferred ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO to ${recipient}`,
  };

  return output;
}

export async function revokeVaultCLICommand(
  o: CLIWriteOptionsFromAoParams<AoRevokeVaultParams>,
): Promise<JsonSerializable> {
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const recipient = requiredStringFromOptions(o, 'recipient');

  if (!o.skipConfirmation) {
    const vault = await ario.getVault({ vaultId, address: recipient });
    if (!vault) {
      throw new Error(
        `Vault for recipient '${recipient}' with vault id '${vaultId}' not found`,
      );
    }

    const confirm = await confirmationPrompt(
      `Are you sure you want to revoke vault with id ${vaultId} from ${recipient}?`,
    );
    if (!confirm) {
      return { message: 'Revoke aborted by user' };
    }
  }

  const result = await ario.revokeVault(
    {
      vaultId,
      recipient,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully revoked vault with id ${vaultId}`,
  };

  return output;
}

export async function createVaultCLICommand(
  o: CLIWriteOptionsFromAoParams<AoCreateVaultParams>,
): Promise<JsonSerializable> {
  const mARIOQuantity = requiredMARIOFromOptions(o, 'quantity');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const lockLengthMs = requiredPositiveIntegerFromOptions(o, 'lockLengthMs');
  assertLockLengthInRange(lockLengthMs);

  if (!o.skipConfirmation) {
    await assertEnoughMARIOBalance({
      ario,
      address: signerAddress,
      mARIOQuantity,
    });

    const confirm = await confirmationPrompt(
      `Are you sure you want to create a vault with ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO, locked for ${lockLengthMs}ms?`,
    );
    if (!confirm) {
      return { message: 'Vault creation aborted by user' };
    }
  }

  const result = await ario.createVault(
    {
      quantity: mARIOQuantity,
      lockLengthMs,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully created vault with ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO`,
  };

  return output;
}

export async function extendVaultCLICommand(
  o: CLIWriteOptionsFromAoParams<AoExtendVaultParams>,
) {
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const vaultId = requiredStringFromOptions(o, 'vaultId');
  const extendLengthMs = requiredPositiveIntegerFromOptions(
    o,
    'extendLengthMs',
  );
  assertLockLengthInRange(extendLengthMs, false);

  if (!o.skipConfirmation) {
    const vault = await ario.getVault({ vaultId, address: signerAddress });
    if (!vault) {
      throw new Error(
        `Vault for signer '${signerAddress}' with vault id '${vaultId}' not found`,
      );
    }

    const confirm = await confirmationPrompt(
      `Are you sure you want to extend vault with id ${vaultId} for ${extendLengthMs}ms?`,
    );
    if (!confirm) {
      return { message: 'Vault extension aborted by user' };
    }
  }

  const result = await ario.extendVault(
    {
      vaultId,
      extendLengthMs,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully extended vault with id ${vaultId}`,
  };

  return output;
}

export async function increaseVaultCLICommand(
  o: CLIWriteOptionsFromAoParams<AoIncreaseVaultParams>,
) {
  const mARIOQuantity = requiredMARIOFromOptions(o, 'quantity');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const vaultId = requiredStringFromOptions(o, 'vaultId');

  if (!o.skipConfirmation) {
    const vault = await ario.getVault({ vaultId, address: signerAddress });
    if (!vault) {
      throw new Error(
        `Vault for signer '${signerAddress}' with vault id '${vaultId}' not found`,
      );
    }

    const confirm = await confirmationPrompt(
      `Are you sure you want to increase vault with id ${vaultId} by ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO?`,
    );
    if (!confirm) {
      return { message: 'Vault increase aborted by user' };
    }
  }

  const result = await ario.increaseVault(
    {
      vaultId,
      quantity: mARIOQuantity,
    },
    customTagsFromOptions(o),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully increased vault with id ${vaultId} by ${formatMARIOToARIOWithCommas(mARIOQuantity)} ARIO`,
  };

  return output;
}
