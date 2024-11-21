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
import { ArweaveSigner } from '@dha-team/arbundles/node';
import prompts from 'prompts';

import { WalletOptions } from '../options.js';
import {
  jwkToAddress,
  requiredJwkFromOptions,
  writeIOFromOptions,
} from '../utils.js';

export type JoinNetworkOptions = WalletOptions & {
  quantity: number | undefined;
  disableAutoStake: boolean;
  disableDelegatedStaking: boolean;
  minDelegatedStake: number | undefined;
  delegateRewardShareRatio: number | undefined;
  label: string | undefined;
  note: string | undefined;
  properties: string | undefined;
  observer: string | undefined;
  fqdn: string | undefined;
  port: number | undefined;
  protocol: string | undefined;
  allowedDelegates: string[] | undefined;
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
    observer,
    port,
    properties,
    quantity,
    allowedDelegates,
  } = options;
  const minOperatorStake = 50_000_000_000; // 50,000 IO
  const operatorStake = quantity ?? minOperatorStake;

  if (label === undefined) {
    throw new Error(
      'Label is required. Please provide a --label for your node.',
    );
  }
  if (fqdn === undefined) {
    throw new Error('FQDN is required. Please provide a --fqdn for your node.');
  }

  const settings = {
    observerAddress: observer,
    operatorStake,
    allowDelegatedStaking:
      disableDelegatedStaking === undefined
        ? undefined
        : !disableDelegatedStaking,
    autoStake: disableAutoStake === undefined ? undefined : !disableAutoStake,
    delegateRewardShareRatio,
    allowedDelegates,
    fqdn,
    label,
    minDelegatedStake,
    note,
    port,
    properties,
  };

  if (!options.skipConfirmation) {
    const balance = await io.getBalance({ address });

    if (balance < operatorStake) {
      throw new Error(
        `Insufficient balance. Required: ${operatorStake} mIO, available: ${balance} mIO`,
      );
    }

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Gateway Settings:\n\n${JSON.stringify(settings, null, 2)}\n\nYou are about to stake ${operatorStake} IO to join the AR.IO network\nAre you sure?\n`,
      initial: true,
    });

    if (!confirm) {
      console.log('Aborted join-network command by user');
      return;
    }
  }

  const result = await io.joinNetwork(settings);

  const output = {
    joinNetworkResult: result,
    address,
    message: `Congratulations!\nYou have successfully joined the AR.IO network  (;`,
  };

  console.log(JSON.stringify(output, null, 2));
}
