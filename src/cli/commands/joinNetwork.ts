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
import { ArweaveSigner, mIOToken } from '../../node/index.js';
import { JoinNetworkCLIOptions } from '../types.js';
import {
  assertEnoughBalance,
  confirmationPrompt,
  formatIOWithCommas,
  gatewaySettingsFromOptions,
  jwkToAddress,
  requiredJwkFromOptions,
  requiredMIOFromOptions as requiredMARIOFromOptions,
  writeActionTagsFromOptions,
  writeIOFromOptions,
} from '../utils.js';

export async function joinNetwork(options: JoinNetworkCLIOptions) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options, new ArweaveSigner(jwk));

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
    await assertEnoughBalance(io, address, mARIOQuantity.toIO());

    const confirm = await confirmationPrompt(
      `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${formatIOWithCommas(mARIOQuantity.toIO())} IO to join the AR.IO network\nAre you sure?\n`,
    );

    if (!confirm) {
      return { message: 'Aborted join-network command by user' };
    }
  }

  const result = await io.joinNetwork(
    settings,
    writeActionTagsFromOptions(options),
  );

  const output = {
    joinNetworkResult: result,
    joinedAddress: address,
    message: `Congratulations! You have successfully joined the AR.IO network  (;`,
  };

  return output;
}
