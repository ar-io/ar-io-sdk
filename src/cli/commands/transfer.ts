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

import { IOToken, mIOToken } from '../../types/token.js';
import { WalletOptions } from '../options.js';
import {
  formatIOWithCommas,
  jwkToAddress,
  requiredJwkFromOptions,
  writeIOFromOptions,
} from '../utils.js';

export type TransferOptions = WalletOptions & {
  quantity: number | undefined;
  target: string | undefined;
};

export async function transfer(options: TransferOptions) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options);

  const { target, quantity } = options;
  if (target === undefined) {
    throw new Error('Target address is required');
  }
  if (quantity === undefined) {
    throw new Error('Quantity is required');
  }

  const ioQuantity = new IOToken(+quantity);

  if (!options.skipConfirmation) {
    const balance = await io.getBalance({ address });

    if (balance < quantity) {
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
      console.log('Aborted transfer command by user');
      return;
    }
  }

  const result = await io.transfer({
    target,
    qty: ioQuantity.toMIO().valueOf(),
  });

  const output = {
    address: address,
    transferResult: result,
    message: `Successfully transferred ${formatIOWithCommas(ioQuantity)} IO to ${target}`,
  };

  console.log(JSON.stringify(output, null, 2));
}
