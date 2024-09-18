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
import { z } from 'zod';

import { defaultArweave } from '../common/arweave.js';
import { ANTRegistry, AOProcess, Logger } from '../common/index.js';
import {
  ANT_LUA_ID,
  ANT_REGISTRY_ID,
  AOS_MODULE_ID,
  DEFAULT_SCHEDULER_ID,
} from '../constants.js';
import {
  AoANTRecord,
  AoANTState,
  AoClient,
  AoSigner,
  ContractSigner,
  WalletAddress,
} from '../types.js';

export async function spawnANT({
  signer,
  module = AOS_MODULE_ID,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect(),
  scheduler = DEFAULT_SCHEDULER_ID,
  state,
  stateContractTxId,
  antRegistryId = ANT_REGISTRY_ID,
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
}): Promise<string> {
  const registryClient = ANTRegistry.init({
    process: new AOProcess({
      processId: antRegistryId,
      ao,
    }),
    signer: signer,
  });
  //TODO: cache locally and only fetch if not cached
  const luaString = (await defaultArweave.transactions.getData(luaCodeTxId, {
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
    ],
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

  await registryClient.register({ processId });

  return processId;
}

export async function evolveANT({
  signer,
  processId,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect(),
}: {
  signer: AoSigner;
  processId: string;
  luaCodeTxId?: string;
  ao?: AoClient;
}): Promise<string> {
  const aosClient = new AOProcess({
    processId,
    ao,
  });

  //TODO: cache locally and only fetch if not cached
  const luaString = (await defaultArweave.transactions.getData(luaCodeTxId, {
    decode: true,
    string: true,
  })) as string;

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

// using passThrough to require the minimum fields and allow others (eg TotalSupply, Logo, etc)
export const AntStateSchema = z
  .object({
    Name: z.string(),
    Ticker: z.string(),
    Owner: z.string(),
    Controllers: z.array(z.string()),
    Records: z.record(
      z.string(),
      z
        .object({
          transactionId: z.string(),
          ttlSeconds: z.number(),
        })
        .passthrough(),
    ),
    Balances: z.record(z.string(), z.number()),
  })
  .passthrough();

/**
 * @param state
 * @returns {boolean}
 * @throws {z.ZodError} if the state object does not match the expected schema
 */
export function isAoANTState(
  state: object,
  logger: Logger = Logger.default,
): state is AoANTState {
  try {
    AntStateSchema.parse(state);
    return true;
  } catch (error) {
    // this allows us to see the path of the error in the object as well as the expected schema on invalid fields
    logger.error(error.issues);
    return false;
  }
}
