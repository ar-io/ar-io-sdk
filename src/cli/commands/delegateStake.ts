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
import { TransferOptions } from '../types.js';
import {
  formatIOWithCommas,
  jwkToAddress,
  requiredJwkFromOptions,
  requiredTargetAndQuantityFromOptions,
  writeIOFromOptions,
  writeOptionsFromOptions,
} from '../utils.js';

export async function delegateStake(options: TransferOptions) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options);

  const { target, ioQuantity } = requiredTargetAndQuantityFromOptions(options);
  const mIOQuantity = ioQuantity.toMIO();

  if (!options.skipConfirmation) {
    const balance = await io.getBalance({ address });

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
    writeOptionsFromOptions(options),
  );

  const output = {
    senderAddress: address,
    transferResult: result,
    message: `Successfully delegated ${formatIOWithCommas(ioQuantity)} IO to ${target}`,
  };

  return output;
}
