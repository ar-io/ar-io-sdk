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
import { TransferCLIOptions } from '../types.js';
import {
  assertEnoughBalance,
  confirmationPrompt,
  formatARIOWithCommas,
  requiredTargetAndQuantityFromOptions,
  writeARIOFromOptions,
  writeActionTagsFromOptions,
} from '../utils.js';

export async function transfer(options: TransferCLIOptions) {
  const { target, arioQuantity } =
    requiredTargetAndQuantityFromOptions(options);
  const { ario, signerAddress } = writeARIOFromOptions(options);

  if (!options.skipConfirmation) {
    await assertEnoughBalance(ario, signerAddress, arioQuantity);

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
    writeActionTagsFromOptions(options),
  );

  const output = {
    senderAddress: signerAddress,
    transferResult: result,
    message: `Successfully transferred ${formatARIOWithCommas(arioQuantity)} ARIO to ${target}`,
  };

  return output;
}
