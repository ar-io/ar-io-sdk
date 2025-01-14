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
  AoEpochData,
  AoSigner,
  ContractSigner,
  WalletAddress,
} from '../types/index.js';

export type SpawnANTState = {
  owner: WalletAddress;
  controllers: WalletAddress[];
  name: string;
  description: string;
  keywords: string[];
  ticker: string;
  records: Record<string, AoANTRecord>;
  balances: Record<WalletAddress, number>;
};

export type SpawnANTParams = {
  signer: AoSigner;
  module?: string;
  ao?: AoClient;
  scheduler?: string;
  state?: SpawnANTState;
  stateContractTxId?: string;
  antRegistryId?: string;
  logger?: Logger;
  /**
   * @deprecated Compiled modules are now being used instead of luaCodeTxId
   */
  luaCodeTxId?: string;
  /**
   * @deprecated no longer in use due to compiled modules being preferred
   */
  arweave?: Arweave;
};

export async function spawnANT({
  signer,
  module = AOS_MODULE_ID,
  ao = connect(),
  scheduler = DEFAULT_SCHEDULER_ID,
  state,
  stateContractTxId,
  antRegistryId = ANT_REGISTRY_ID,
  logger = Logger.default,
}: SpawnANTParams): Promise<string> {
  // TODO: use On-Boot data handler for bootstrapping state instead of initialize-state
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
    logger,
  });

  logger.debug(`Spawned ANT`, {
    processId,
    module,
    scheduler,
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
    logger.debug(`Initialized ANT`, {
      processId,
      module,
      scheduler,
      initializeMsgId,
    });
  }
  // This could be done by the ANT in On-Boot to self-register with its tagged ANT registry
  const registryClient = ANTRegistry.init({
    process: new AOProcess({
      processId: antRegistryId,
      ao,
      logger,
    }),
    signer: signer,
  });
  const { id: antRegistrationMsgId } = await registryClient.register({
    processId,
  });

  logger.debug(`Registered ANT to ANT Registry`, {
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
  logger.debug(`Evolved ANT`, {
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

export const defaultTargetManifestId =
  '-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI';

export function initANTStateForAddress({
  owner,
  targetId,
  ttlSeconds = 3600,
  keywords = [],
  controllers = [],
  description = '',
  ticker = 'aos',
  name = 'ANT',
}: Partial<SpawnANTState> & {
  targetId?: string;
  ttlSeconds?: number;
  owner: WalletAddress;
}): SpawnANTState {
  return {
    ticker,
    name,
    description,
    keywords,
    owner,
    controllers: [owner, ...controllers],
    balances: { [owner]: 1 },
    records: {
      ['@']: {
        transactionId: targetId ?? defaultTargetManifestId.toString(),
        ttlSeconds,
      },
    },
  };
}

/**
 * Uses zod schema to parse the epoch data
 */
export function parseAoEpochData(value: unknown): AoEpochData {
  const epochDataSchema = z.object({
    startTimestamp: z.number(),
    startHeight: z.number(),
    distributions: z.any(),
    endTimestamp: z.number(),
    prescribedObservers: z.any(),
    prescribedNames: z.array(z.string()),
    observations: z.any(),
    distributionTimestamp: z.number(),
    epochIndex: z.number(),
  });
  return epochDataSchema.parse(value) as AoEpochData;
}
