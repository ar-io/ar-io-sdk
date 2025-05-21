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
import { ArconnectSigner, DataItem, createData } from '@dha-team/arbundles';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import { z } from 'zod';

import { defaultArweave } from '../common/arweave.js';
import { AOProcess, Logger } from '../common/index.js';
import {
  ANT_LUA_ID,
  ANT_REGISTRY_ID,
  AOS_MODULE_ID,
  AO_AUTHORITY,
  DEFAULT_SCHEDULER_ID,
} from '../constants.js';
import { SpawnANTState, SpawnANTStateSchema } from '../types/ant.js';
import {
  AoClient,
  AoEpochData,
  AoEpochDistributed,
  AoSigner,
  ContractSigner,
  MessageResult,
  WalletAddress,
} from '../types/index.js';
import { parseSchemaResult } from './schema.js';

export type SpawnANTParams = {
  signer: AoSigner;
  module?: string;
  ao?: AoClient;
  scheduler?: string;
  state?: SpawnANTState;
  stateContractTxId?: string;
  antRegistryId?: string;
  logger?: Logger;
  authority?: string;
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
  ao = connect({
    MODE: 'legacy',
  }),
  scheduler = DEFAULT_SCHEDULER_ID,
  state,
  antRegistryId = ANT_REGISTRY_ID,
  logger = Logger.default,
  authority = AO_AUTHORITY,
}: SpawnANTParams): Promise<string> {
  // TODO: use On-Boot data handler for bootstrapping state instead of initialize-state
  if (state) {
    parseSchemaResult(SpawnANTStateSchema, state);
  }
  const processId = await ao.spawn({
    module,
    scheduler,
    signer,
    data: state ? JSON.stringify(state) : undefined,
    tags: [
      // Required for AOS to initialize the authorities table
      {
        name: 'Authority',
        value: authority,
      },
      {
        name: 'ANT-Registry-Id',
        value: antRegistryId,
      },
    ],
  });

  let bootRes: MessageResult | undefined;
  let attempts = 0;
  while (attempts < 5 && bootRes === undefined) {
    try {
      bootRes = await ao.result({
        process: processId,
        message: processId,
      });
      break;
    } catch (error) {
      logger.debug('Retrying ANT boot result fetch', {
        processId,
        module,
        scheduler,
        attempts,
        error,
      });
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempts ** 2));
    }
  }

  if (
    bootRes === undefined ||
    bootRes.Messages?.some((m) =>
      m?.Tags?.some((t) => t.value === 'Invalid-Boot-Notice'),
    )
  ) {
    if (bootRes === undefined) {
      // …
      throw new Error('Failed to get boot result');
    }
    const bootError = errorMessageFromOutput(bootRes);
    logger.error('ANT failed to boot correctly', {
      processId,
      module,
      scheduler,
      bootRes,
      bootError,
    });

    throw new Error(`ANT failed to boot correctly: ${bootError}`);
  }

  logger.debug(`Spawned ANT`, {
    processId,
    module,
    scheduler,
  });

  return processId;
}

export async function evolveANT({
  signer,
  processId,
  luaCodeTxId = ANT_LUA_ID,
  ao = connect({
    MODE: 'legacy',
  }),
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
  // We do not use arweave to get the data because it may throw on l2 tx data
  const {
    api: { host, port, protocol },
  } = arweave.getConfig();

  const luaString = await fetch(
    `${protocol}://${host}:${port}/${luaCodeTxId}`,
  ).then((res) => res.text());

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
    if (signer instanceof ArconnectSigner) {
      // Sign using Arconnect signDataItem API
      const signedDataItem = await signer['signer'].signDataItem({
        data,
        tags,
        target,
        anchor,
      });
      const dataItem = new DataItem(Buffer.from(signedDataItem));
      return {
        id: await dataItem.id,
        raw: await dataItem.getRaw(),
      };
    }

    const dataItem = createData(data, signer, { tags, target, anchor });
    const signedData = dataItem.sign(signer).then(async () => ({
      id: await dataItem.id,
      raw: await dataItem.getRaw(),
    }));
    return signedData;
  };

  // eslint-disable-next-line
  // @ts-ignore Buffer vs ArrayBuffer type mismatch
  return aoSigner;
}

export const defaultTargetManifestId =
  '-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI';

export const defaultANTLogoId = 'Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A';

export function initANTStateForAddress({
  owner,
  targetId,
  ttlSeconds = 3600,
  keywords = [],
  controllers = [],
  description = '',
  ticker = 'aos',
  name = 'ANT',
  logo = defaultANTLogoId,
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
    logo,
  };
}

/**
 * Uses zod schema to parse the epoch data
 */
export function parseAoEpochData(
  value: unknown,
): AoEpochData<AoEpochDistributed> {
  const epochDataSchema = z.object({
    startTimestamp: z.number(),
    startHeight: z.number(),
    distributions: z.any(), // TODO: add full distributed object type
    endTimestamp: z.number(),
    prescribedObservers: z.any(),
    prescribedNames: z.array(z.string()),
    observations: z.any(),
    epochIndex: z.number(),
  });
  return epochDataSchema.parse(value) as AoEpochData<AoEpochDistributed>;
}

export function errorMessageFromOutput(output: {
  Error?: string;
  Messages?: { Tags?: { name: string; value: string }[] }[];
}): string | undefined {
  const errorData = output.Error;

  // Attempt to extract error details from Messages.Tags if Error is undefined
  const error =
    errorData ??
    output.Messages?.[0]?.Tags?.find((tag) => tag.name === 'Error')?.value;

  if (error !== undefined) {
    // Consolidated regex to match and extract line number and AO error message or Error Tags
    const match = error.match(/\[string "aos"]:(\d+):\s*(.+)/);
    if (match) {
      const [, lineNumber, errorMessage] = match;
      const cleanError = removeUnicodeFromError(errorMessage);
      return `${cleanError.trim()} (line ${lineNumber.trim()})`.trim();
    }
    // With no match, just remove unicode
    return removeUnicodeFromError(error);
  }

  return undefined;
}

export function removeUnicodeFromError(error: string): string {
  //The regular expression /[\u001b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g is designed to match ANSI escape codes used for terminal formatting. These are sequences that begin with \u001b (ESC character) and are often followed by [ and control codes.
  const ESC = String.fromCharCode(27); // Represents '\u001b' or '\x1b'
  return error
    .replace(
      new RegExp(
        `${ESC}[\\[\\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
        'g',
      ),
      '',
    )
    .trim();
}
