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
import { createData } from '@dha-team/arbundles';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import { z } from 'zod';

import { defaultArweave } from '../common/arweave.js';
import { ANTRegistry, AOProcess, Logger } from '../common/index.js';
import {
  ANT_LUA_ID,
  ANT_REGISTRY_ID,
  AOS_MODULE_ID,
  DEFAULT_SCHEDULER_ID,
} from '../constants.js';
import { AoANTRecord } from '../types/ant.js';
import {
  AoClient,
  AoSigner,
  ContractSigner,
  WalletAddress,
} from '../types/index.js';

export async function spawnANT({
  signer,
  module = AOS_MODULE_ID,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect(),
  scheduler = DEFAULT_SCHEDULER_ID,
  state,
  stateContractTxId,
  antRegistryId = ANT_REGISTRY_ID,
  logger = Logger.default,
  arweave = defaultArweave,
}: {
  signer: AoSigner;
  module?: string;
  luaCodeTxId?: string;
  ao?: AoClient;
  scheduler?: string;
  state?: {
    owner: WalletAddress;
    controllers: WalletAddress[];
    name: string;
    ticker: string;
    records: Record<string, AoANTRecord>;
    balances: Record<WalletAddress, number>;
  };
  stateContractTxId?: string;
  antRegistryId?: string;
  logger?: Logger;
  arweave?: Arweave;
}): Promise<string> {
  const registryClient = ANTRegistry.init({
    process: new AOProcess({
      processId: antRegistryId,
      ao,
      logger,
    }),
    signer: signer,
  });
  //TODO: cache locally and only fetch if not cached
  const luaString = (await arweave.transactions.getData(luaCodeTxId, {
    decode: true,
    string: true,
  })) as string;

  const processId = await ao.spawn({
    module,
    scheduler,
    signer,
    tags: [
      {
        name: 'ANT-Registry-Id',
        value: antRegistryId,
      },
      {
        name: 'Source-Code-TX-ID', // utility for understanding what the original source id of the lua code was
        value: luaCodeTxId,
      },
    ],
  });

  const aosClient = new AOProcess({
    processId,
    ao,
    logger,
  });

  const { id: evalId } = await aosClient.send({
    tags: [
      { name: 'Action', value: 'Eval' },
      { name: 'App-Name', value: 'ArNS-ANT' },
      { name: 'Source-Code-TX-ID', value: luaCodeTxId },
    ],
    data: luaString,
    signer,
  });

  logger.info(`Spawned ANT`, {
    processId,
    module,
    scheduler,
    luaCodeTxId,
    evalId,
  });

  if (state) {
    const { id: initializeMsgId } = await aosClient.send({
      tags: [
        { name: 'Action', value: 'Initialize-State' },
        ...(stateContractTxId !== undefined
          ? [{ name: 'State-Contract-TX-ID', value: stateContractTxId }]
          : []),
      ],
      data: JSON.stringify(state),
      signer,
    });
    logger.info(`Initialized ANT`, {
      processId,
      module,
      scheduler,
      initializeMsgId,
    });
  }

  const { id: antRegistrationMsgId } = await registryClient.register({
    processId,
  });

  logger.info(`Registered ANT to ANT Registry`, {
    processId,
    module,
    scheduler,
    antRegistrationMsgId,
    antRegistryId,
  });

  return processId;
}

export async function evolveANT({
  signer,
  processId,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect(),
  logger = Logger.default,
  arweave = defaultArweave,
}: {
  signer: AoSigner;
  processId: string;
  luaCodeTxId?: string;
  ao?: AoClient;
  logger?: Logger;
  arweave?: Arweave;
}): Promise<string> {
  const aosClient = new AOProcess({
    processId,
    ao,
    logger,
  });

  //TODO: cache locally and only fetch if not cached
  const luaString = (await arweave.transactions.getData(luaCodeTxId, {
    decode: true,
    string: true,
  })) as string;

  const { id: evolveMsgId } = await aosClient.send({
    tags: [
      { name: 'Action', value: 'Eval' },
      { name: 'App-Name', value: 'ArNS-ANT' },
      { name: 'Source-Code-TX-ID', value: luaCodeTxId },
    ],
    data: luaString,
    signer,
  });
  logger.info(`Evolved ANT`, {
    processId,
    luaCodeTxId,
    evalMsgId: evolveMsgId,
  });

  return evolveMsgId;
}

export function isAoSigner(value: unknown): value is AoSigner {
  const TagSchema = z.object({
    name: z.string(),
    value: z.union([z.string(), z.number()]),
  });

  const AoSignerSchema = z
    .function()
    .args(
      z.object({
        data: z.union([z.string(), z.instanceof(Buffer)]),
        tags: z.array(TagSchema).optional(),
        target: z.string().optional(),
        anchor: z.string().optional(),
      }),
    )
    .returns(
      z.promise(
        z.object({
          id: z.string(),
          raw: z.instanceof(ArrayBuffer),
        }),
      ),
    );
  try {
    AoSignerSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function createAoSigner(signer: ContractSigner): AoSigner {
  if (isAoSigner(signer)) {
    return signer;
  }

  if (!('publicKey' in signer)) {
    return createDataItemSigner(signer) as AoSigner;
  }

  const aoSigner = async ({ data, tags, target, anchor }) => {
    // ensure appropriate permissions are granted with injected signers.
    if (
      signer.publicKey === undefined &&
      'setPublicKey' in signer &&
      typeof signer.setPublicKey === 'function'
    ) {
      await signer.setPublicKey();
    }
    const dataItem = createData(data, signer, { tags, target, anchor });
    const signedData = dataItem.sign(signer).then(async () => ({
      id: await dataItem.id,
      raw: await dataItem.getRaw(),
    }));
    return signedData;
  };

  return aoSigner;
}
