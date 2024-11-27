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

import { mIOToken } from '../../types/token.js';
import { TransferCLIOptions } from '../types.js';
import {
  formatIOWithCommas,
  jwkToAddress,
  requiredJwkFromOptions,
  requiredTargetAndQuantityFromOptions,
  writeActionTagsFromOptions,
  writeIOFromOptions,
} from '../utils.js';

export async function transfer(options: TransferCLIOptions) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options);

  const { target, ioQuantity } = requiredTargetAndQuantityFromOptions(options);

  if (!options.skipConfirmation) {
    const balance = await io.getBalance({ address });

    if (balance < +ioQuantity.toMIO()) {
      throw new Error(
        `Insufficient IO balance for transfer. Balance available: ${new mIOToken(balance).toIO()} IO`,
      );
    }

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to transfer ${formatIOWithCommas(ioQuantity)} IO to ${target}?`,
    });

    if (!confirm) {
      return { message: 'Transfer aborted' };
    }
  }

  const result = await io.transfer(
    {
      target,
      qty: ioQuantity.toMIO().valueOf(),
    },
    writeActionTagsFromOptions(options),
  );

  const output = {
    senderAddress: address,
    transferResult: result,
    message: `Successfully transferred ${formatIOWithCommas(ioQuantity)} IO to ${target}`,
  };

  return output;
}
