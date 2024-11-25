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

import {
  AoJoinNetworkParams,
  ArweaveSigner,
  IOToken,
  mIOToken,
} from '../../node/index.js';
import { WalletOptions } from '../options.js';
import {
  CLIOptionsFromAoParams,
  formatIOWithCommas,
  jwkToAddress,
  requiredJwkFromOptions,
  writeIOFromOptions,
} from '../utils.js';

type JoinNetworkOptions = WalletOptions &
  Partial<
    CLIOptionsFromAoParams<
      Omit<AoJoinNetworkParams, 'allowDelegatedStaking' | 'autoStake'>
    >
  > & {
    disableDelegatedStaking?: boolean;
    disableAutoStake?: boolean;
    skipConfirmation?: boolean;
  };

export async function joinNetwork(options: JoinNetworkOptions) {
  const jwk = requiredJwkFromOptions(options);
  const address = jwkToAddress(jwk);
  const io = writeIOFromOptions(options, new ArweaveSigner(jwk));

  const {
    disableDelegatedStaking,
    disableAutoStake,
    delegateRewardShareRatio,
    fqdn,
    label,
    minDelegatedStake,
    note,
    observerAddress,
    port,
    properties,
    operatorStake,
    allowedDelegates,
  } = options;

  if (label === undefined) {
    throw new Error(
      'Label is required. Please provide a --label for your node.',
    );
  }
  if (fqdn === undefined) {
    throw new Error('FQDN is required. Please provide a --fqdn for your node.');
  }
  if (operatorStake === undefined) {
    throw new Error(
      'Operator stake is required. Please provide a --operator-stake denominated in IO for your node.',
    );
  }

  const ioQuantity = new IOToken(+operatorStake);
  const mIOOperatorStake = ioQuantity.toMIO().valueOf();

  const settings = {
    observerAddress,
    operatorStake: mIOOperatorStake,
    allowDelegatedStaking:
      disableDelegatedStaking === undefined
        ? undefined
        : !disableDelegatedStaking,
    autoStake: disableAutoStake === undefined ? undefined : !disableAutoStake,
    delegateRewardShareRatio:
      delegateRewardShareRatio !== undefined
        ? +delegateRewardShareRatio
        : undefined,
    allowedDelegates,
    fqdn,
    label,
    minDelegatedStake:
      minDelegatedStake !== undefined ? +minDelegatedStake : undefined,
    note,
    port: port !== undefined ? +port : undefined,
    properties,
  };

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

  const result = await io.joinNetwork(settings);

  const output = {
    joinNetworkResult: result,
    joinedAddress: address,
    message: `Congratulations!\nYou have successfully joined the AR.IO network  (;`,
  };

  return output;
}
