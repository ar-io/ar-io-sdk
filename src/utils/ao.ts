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
import { ANT, ANTRegistry, AOProcess, IO, Logger } from '../common/index.js';
import {
  ANT_LUA_ID,
  ANT_REGISTRY_ID,
  AOS_MODULE_ID,
  DEFAULT_SCHEDULER_ID,
} from '../constants.js';
import { KVStore, NodeCacheKVStore } from '../lib/node-cache-kv-store.js';
import {
  AoANTRecord,
  AoANTState,
  AoClient,
  AoIORead,
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
    ['Source-Code-TX-ID']: z.string(),
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

export class ArNSResolver {
  private readonly io: AoIORead;
  private readonly logger: Logger;
  private readonly forwardCache: KVStore;
  private readonly reverseCache: KVStore;

  private readonly ao: AoClient;
  constructor({
    io = IO.init(),
    ao = connect(),
    logger = Logger.default,
    forwardCache = new NodeCacheKVStore({
      ttlSeconds: 60 * 5,
    }),
    reverseCache = new NodeCacheKVStore({
      ttlSeconds: 60 * 5,
    }),
  }: {
    io?: AoIORead;
    ao?: AoClient;
    arweave?: Arweave;
    logger?: Logger;
    forwardCache?: KVStore;
    reverseCache?: KVStore;
  }) {
    this.io = io;
    this.logger = logger;
    this.ao = ao;
    this.forwardCache = forwardCache;
    this.reverseCache = reverseCache;
  }

  async resolveArNSName({ name }: { name: string }): Promise<
    | {
        name: string;
        transactionId: string;
        ttlSeconds: number;
        processId: string;
      }
    | undefined
  > {
    // split name based on underscore, last element is the apex name
    const nameParts = name.split('_');
    const apexName = nameParts[nameParts.length - 1];
    const undername = nameParts.slice(0, -1).join('_') || '@';

    // get the process id
    const record = await this.io.getArNSRecord({ name: apexName });

    if (!record) {
      return undefined;
    }

    const ant = ANT.init({
      process: new AOProcess({
        processId: record.processId,
        ao: this.ao,
        logger: this.logger,
      }),
    });

    const undernameRecord = await ant.getRecord({ undername });

    if (!undernameRecord) {
      return undefined;
    }

    // confirm transaction id is not empty
    if (
      !undernameRecord.transactionId ||
      undernameRecord.transactionId === '' ||
      undernameRecord.transactionId === undefined
    ) {
      return undefined;
    }

    // update forward cache, do not update the reverse cache to avoid resetting the TTL and preventing names from being removed
    this.forwardCache.set(name, undernameRecord.transactionId);

    return {
      name,
      transactionId: undernameRecord.transactionId,
      ttlSeconds: undernameRecord.ttlSeconds,
      processId: record.processId,
    };
  }

  async lookupAssociatedArNSNames({
    txId,
  }: {
    txId: string;
  }): Promise<string[]> {
    // get the associated names from the reverse cache
    const cachedNames = this.reverseCache.get(txId);
    if (cachedNames !== undefined) {
      this.logger.debug(`Found cached names for txId: ${txId}`, {
        cachedNames,
      });
      return cachedNames.split(',');
    }

    const associatedNames: string[] = [];
    let cursor: string | undefined = undefined;
    do {
      this.logger.debug(`Fetching ArNS records for txId: ${txId}`, {
        cursor,
      });
      const { items: arnsRecords, nextCursor } = await this.io.getArNSRecords({
        cursor,
        limit: 1000,
      });

      for (const arnsRecord of arnsRecords) {
        const ant = ANT.init({
          process: new AOProcess({
            processId: arnsRecord.processId,
            ao: this.ao,
            logger: this.logger,
          }),
        });
        const antRecords = await ant.getRecords().catch((e) => {
          this.logger.error(`Error getting records for ${arnsRecord.name}`, {
            error: e,
            processId: arnsRecord.processId,
          });
          return {};
        });
        // we can hydrate both caches here since we have the process id and undername while we are here
        for (const [key, value] of Object.entries(antRecords)) {
          const cacheKey =
            key === '@' ? arnsRecord.name : `${arnsRecord.name}_${key}`;
          this.forwardCache.set(cacheKey, value.transactionId);
          if (value.transactionId === txId) {
            this.logger.debug(`Found associated name: ${key}`, {
              cacheKey,
              txId,
            });
            associatedNames.push(key);
          }
        }
      }
      cursor = nextCursor;
    } while (cursor !== undefined);

    // update our reverse cache with the associated names
    this.reverseCache.set(txId, associatedNames.join(','));

    this.logger.debug(
      `Found ${associatedNames.length} associated names for txId: ${txId}`,
      {
        associatedNames,
      },
    );

    return associatedNames;
  }
}
