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

import { ArweaveSigner } from '../../node/index.js';
import { UpdateGatewaySettingsOptions } from '../types.js';
import {
  gatewaySettingsFromOptions,
  jwkToAddress,
  requiredJwkFromOptions,
  writeIOFromOptions,
  writeOptionsFromOptions,
} from '../utils.js';

export async function updateGatewaySettings(
  options: UpdateGatewaySettingsOptions,
) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options, new ArweaveSigner(jwk));
  const gatewaySettings = gatewaySettingsFromOptions(options);

  if (Object.keys(gatewaySettings).length === 0) {
    // TODO: The contract accepts empty Update-Gateway-Settings actions, but we'll throw in the CLI for now
    throw new Error('No gateway settings provided');
  }

  if (!options.skipConfirmation) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Gateway Settings:\n\n${JSON.stringify(gatewaySettings, null, 2)}\n\nYou are about to update your gateway settings to the above\nAre you sure?\n`,
      initial: true,
    });

    if (!confirm) {
      return { message: 'Aborted update-gateway-settings command by user' };
    }
  }

  const result = await io.updateGatewaySettings(
    gatewaySettings,
    writeOptionsFromOptions(options),
  );

  const output = {
    updateGatewaySettingsResult: result,
    updatedGatewayAddress: address,
    message: `Gateway settings updated successfully`,
  };

  return output;
}
