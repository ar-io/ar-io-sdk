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
import { defaultArweave } from '../common/arweave.js';
import { AOProcess } from '../common/index.js';
import {
  ANT_LUA_ID,
  AOS_MODULE_ID,
  DEFAULT_SCHEDULER_ID,
} from '../constants.js';
import { ANTState } from '../contract-state.js';
import { ContractSigner } from '../types.js';

/**
 *
 * @param param0 spawn and message args
 * @param connectionConfig
 * @returns @type {Promise<string>} processId
 */
export async function spawnANT(
  {
    module = AOS_MODULE_ID,
    luaCodeTxId = ANT_LUA_ID,
    scheduler = DEFAULT_SCHEDULER_ID,
    signer,
    state,
  }: {
    module: string;
    luaCodeTxId: string;
    aoClient: AOProcess;
    scheduler: string;
    signer: ContractSigner;
    state?: ANTState;
  },
  connectionConfig?: {
    CU_URL: string;
    MU_URL: string;
    GATEWAY_URL: string;
    GRAPHQL_URL: string;
  },
): Promise<string> {
  const aoClient = new AOProcess({
    processId: ''.padEnd(43, '0'),
    connectionConfig,
  });
  const luaString = (await defaultArweave.transactions.getData(luaCodeTxId, {
    decode: true,
    string: true,
  })) as string;

  const processId = await aoClient.spawn({
    module,
    scheduler,
    signer,
  });

  const aosClient = new AOProcess({
    processId,
    connectionConfig,
  });

  await aosClient.send({
    tags: [{ name: 'Action', value: 'Eval' }],
    data: luaString,
    signer,
  });

  if (state) {
    await aosClient.send({
      tags: [{ name: 'Action', value: 'Initialize-State' }],
      data: JSON.stringify(state),
      signer,
    });
  }

  return processId;
}
