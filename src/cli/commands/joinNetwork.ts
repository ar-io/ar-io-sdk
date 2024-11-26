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

import { ArweaveSigner, IOToken, mIOToken } from '../../node/index.js';
import { JoinNetworkOptions } from '../types.js';
import {
  formatIOWithCommas,
  gatewaySettingsFromOptions,
  jwkToAddress,
  requiredJwkFromOptions,
  writeIOFromOptions,
  writeOptionsFromOptions,
} from '../utils.js';

export async function joinNetwork(options: JoinNetworkOptions) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options, new ArweaveSigner(jwk));

  if (options.operatorStake === undefined) {
    throw new Error(
      'Operator stake is required. Please provide a --operator-stake denominated in IO for your node.',
    );
  }

  const ioQuantity = new IOToken(+options.operatorStake);
  const mIOOperatorStake = ioQuantity.toMIO().valueOf();

  const settings = {
    ...gatewaySettingsFromOptions(options),
    operatorStake: mIOOperatorStake,
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
    const balance = await io.getBalance({ address });

    // TODO: Could get current minimum stake and assert from contract

    if (balance < mIOOperatorStake) {
      throw new Error(
        `Insufficient balance. Required: ${formatIOWithCommas(ioQuantity)} IO, available: ${formatIOWithCommas(new mIOToken(balance).toIO())} IO`,
      );
    }

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${formatIOWithCommas(ioQuantity)} IO to join the AR.IO network\nAre you sure?\n`,
      initial: true,
    });

    if (!confirm) {
      return { message: 'Aborted join-network command by user' };
    }
  }

  const result = await io.joinNetwork(
    settings,
    writeOptionsFromOptions(options),
  );

  const output = {
    joinNetworkResult: result,
    joinedAddress: address,
    message: `Congratulations!\nYou have successfully joined the AR.IO network  (;`,
  };

  return output;
}
