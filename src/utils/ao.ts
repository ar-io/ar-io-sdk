/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { connect } from '@permaweb/aoconnect';

import { defaultArweave } from '../common/arweave.js';
import { ANT, AOProcess } from '../common/index.js';
import {
  ANT_LUA_ID,
  AOS_MODULE_ID,
  DEFAULT_SCHEDULER_ID,
} from '../constants.js';
import { ANTState } from '../contract-state.js';
import { AoClient, ContractSigner } from '../types.js';

export async function spawnANT({
  signer,
  module = AOS_MODULE_ID,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect(),
  scheduler = DEFAULT_SCHEDULER_ID,
  state,
  stateContractTxId,
}: {
  signer: ContractSigner;
  module?: string;
  luaCodeTxId?: string;
  ao?: AoClient;
  scheduler?: string;
  state?: ANTState;
  stateContractTxId?: string;
}): Promise<string> {
  //TODO: cache locally and only fetch if not cached
  const luaString = (await defaultArweave.transactions.getData(luaCodeTxId, {
    decode: true,
    string: true,
  })) as string;

  const processId = await ao.spawn({
    module,
    scheduler,
    signer: await AOProcess.createAoSigner(signer),
  });

  const aosClient = new AOProcess({
    processId,
    ao,
  });

  await aosClient.send({
    tags: [
      { name: 'Action', value: 'Eval' },
      { name: 'App-Name', value: 'ArNS-ANT' },
      { name: 'Source-Code-TX-ID', value: luaCodeTxId },
    ],
    data: luaString,
    signer,
  });

  if (state) {
    await aosClient.send({
      tags: [
        { name: 'Action', value: 'Initialize-State' },
        ...(stateContractTxId !== undefined
          ? [{ name: 'State-Contract-TX-ID', value: stateContractTxId }]
          : []),
      ],
      data: JSON.stringify(state),
      signer,
    });
  }

  return processId;
}

export async function evolveANT({
  signer,
  processId,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect(),
}: {
  signer: ContractSigner;
  processId: string;
  luaCodeTxId?: string;
  ao?: AoClient;
}): Promise<string> {
  const aosClient = new AOProcess({
    processId,
    ao,
  });

  const ant = ANT.init({
    process: aosClient,
  });

  const info = await ant.getInfo();

  const shouldCallEvalTwice = info['Source-Code-TX-ID'] === undefined;

  if (info['Source-Code-TX-ID'] == luaCodeTxId) {
    throw new Error('ANT is already evolved to this source code');
  }

  //TODO: cache locally and only fetch if not cached
  const luaString = (await defaultArweave.transactions.getData(luaCodeTxId, {
    decode: true,
    string: true,
  })) as string;

  /**
   *  we call eval twice to ensure the Source code tx id is set in the process.
   * ANTs that do not have the prepended evolve handler will not do it immediately until eval is called again.
   * if source code tx id is present, then we assume the prepended handler is added.
   */

  if (shouldCallEvalTwice) {
    await aosClient.send({
      tags: [
        { name: 'Action', value: 'Eval' },
        { name: 'App-Name', value: 'ArNS-ANT' },
        { name: 'Source-Code-TX-ID', value: luaCodeTxId },
      ],
      data: luaString,
      signer,
    });
  }

  const { id } = await aosClient.send({
    tags: [
      { name: 'Action', value: 'Eval' },
      { name: 'App-Name', value: 'ArNS-ANT' },
      { name: 'Source-Code-TX-ID', value: luaCodeTxId },
    ],
    data: luaString,
    signer,
  });

  return id;
}
