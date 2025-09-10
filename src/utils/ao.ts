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

import { ANTRegistry } from '../common/ant-registry.js';
import { ANTVersions } from '../common/ant-versions.js';
import { defaultArweave } from '../common/arweave.js';
import { ANT, AOProcess, Logger } from '../common/index.js';
import {
  ANT_LUA_ID,
  ANT_REGISTRY_ID,
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
  ProcessId,
  SpawnAntProgressEvent,
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
  tags?: { name: string; value: string }[];
  /**
   * @deprecated Compiled modules are now being used instead of luaCodeTxId
   */
  luaCodeTxId?: string;
  /**
   * @deprecated no longer in use due to compiled modules being preferred
   */
  arweave?: Arweave;
  /**
   * Callback function to be called when signing progress is made
   */
  onSigningProgress?: (
    name: keyof SpawnAntProgressEvent,
    payload: SpawnAntProgressEvent[keyof SpawnAntProgressEvent],
  ) => void;
};

export async function spawnANT({
  signer,
  module,
  ao = connect({
    MODE: 'legacy',
  }),
  scheduler = DEFAULT_SCHEDULER_ID,
  state,
  tags = [],
  antRegistryId = ANT_REGISTRY_ID,
  logger = Logger.default,
  authority = AO_AUTHORITY,
  onSigningProgress = (name, payload) => {
    logger.debug('Signing progress', { name, payload });
  },
}: SpawnANTParams): Promise<ProcessId> {
  if (state) {
    parseSchemaResult(SpawnANTStateSchema, state);
  }

  let version: string | undefined;
  if (module === undefined) {
    const antRegistry = ANTVersions.init({
      process: new AOProcess({
        processId: antRegistryId,
        ao,
        logger,
      }),
    });
    const { moduleId: latestAntModule, version: latestVersion } =
      await antRegistry.getLatestANTVersion();
    logger.debug('Spawning new ANT with latest module from ANT registry', {
      moduleId: latestAntModule,
      version: latestVersion,
      antRegistryId,
    });
    module = latestAntModule;
    version = latestVersion;
  }

  onSigningProgress?.('spawning-ant', {
    moduleId: module,
    antRegistryId,
    version,
    state,
  });

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
      ...tags,
    ],
  });

  /**
   * Note: if we are given a state, ensure the ANT was initialized with it
   * there is a bug in the ANT source where we try to parse the empty default
   * 'Data' string as JSON that causes the Invalid-Boot-Notice error, even though
   * the ANT was initialized with the default state set by the ANT source code.
   *
   * Reference: https://github.com/ar-io/ar-io-ant-process/blob/b89018ffcce079add2e90e7ab82d0bbc9b671346/src/common/main.lua#L355-L358
   */
  if (state !== undefined) {
    let bootRes: MessageResult | undefined;
    let attempts = 0;
    while (attempts < 5 && bootRes === undefined) {
      try {
        // TODO: could add a progress event here to show the boot progress and number of attempts
        if (bootRes === undefined) {
          bootRes = await ao.result({
            process: processId,
            message: processId,
          });
        }

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
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempts ** 2),
        );
      }
    }

    if (
      bootRes === undefined ||
      bootRes.Messages?.some((m) =>
        m?.Tags?.some((t) => t.value === 'Invalid-Boot-Notice'),
      )
    ) {
      if (bootRes === undefined) {
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
  }

  onSigningProgress?.('verifying-state', {
    processId,
    moduleId: module,
    antRegistryId,
  });

  // Note: for hyperbeam caching, due to a SU issue, we need to send a second message to the ANT to cache the state
  // We wait for the first message to be processed before sending the second one to ensure this is the second message
  // We use the resulting state to check the owner of the ANT is set in the registry. Should this be patched on MUs,
  // we can convert to just a simple dry-run to avoid sending/signing another message.
  let owner: WalletAddress | undefined;
  try {
    const processApi = new AOProcess({
      processId,
      ao,
      logger,
    });
    const { id } = await processApi.send({
      tags: [{ name: 'Action', value: 'State' }],
      signer,
    });
    const stateResult = await ao.result({
      process: processId,
      message: id,
    });
    if (stateResult === undefined) {
      throw new Error('Failed to get state result');
    }
    const { Owner } = JSON.parse(stateResult.Messages?.[0]?.Data ?? '{}') as {
      Owner: WalletAddress;
    };
    owner = Owner;
    logger.debug(`Successfully spawned new ANT and validated owner`, {
      processId,
      module,
      owner,
    });
  } catch (error) {
    logger.error('Failed to validate owner of spawned ANT', {
      processId,
      module,
      error,
    });
    throw error;
  }

  /**
   * Now confirm the owner of the ANT is set in the registry
   * This is to ensure the ANT is available via the ANT registry
   * for the owner to find and use the ANT.
   */
  if (owner === undefined) {
    throw new Error(`Spawning ANT (${processId}) failed to set owner`);
  }

  onSigningProgress?.('registering-ant', {
    processId,
    antRegistryId,
    owner,
  });

  // check the ACL for the owner
  const antRegistry = ANTRegistry.init({
    signer,
    processId: antRegistryId,
  });
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      const acl = await antRegistry.accessControlList({ address: owner });
      if (acl === undefined) {
        throw new Error('ACL not found for owner');
      }
      const { Owned } = acl;
      if (!Owned.includes(processId)) {
        throw new Error(
          `Spawned ANT (${processId}) not found in registry for owner ${owner}`,
        );
      }
      return processId;
    } catch (error) {
      logger.debug('Retrying ANT registry access control list fetch', {
        owner,
        antRegistryId,
        attempts,
        error,
      });
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempts ** 2));
    }
  }

  return processId;
}

export async function forkANT({
  signer,
  antProcessId,
  logger = Logger.default,
  ao,
  moduleId,
  antRegistryId = ANT_REGISTRY_ID,
  onSigningProgress = (name, payload) => {
    logger.debug('Forking ANT', { name, payload });
  },
}: {
  signer: AoSigner;
  antProcessId: string;
  moduleId?: string;
  logger?: Logger;
  ao?: AoClient;
  antRegistryId?: string;
  onSigningProgress?: (
    name: keyof SpawnAntProgressEvent,
    payload: SpawnAntProgressEvent[keyof SpawnAntProgressEvent],
  ) => void;
}) {
  // get the state of the current ANT and use it to spawn a new ANT
  const ant = ANT.init({
    process: new AOProcess({
      processId: antProcessId,
      ao,
      logger,
    }),
  });

  const state = await ant.getState();

  if (state === undefined) {
    throw new Error(
      `ANT state (${antProcessId}) is undefined and cannot be upgraded`,
    );
  }

  const forkedProcessId = await spawnANT({
    signer,
    antRegistryId,
    ao,
    logger,
    module: moduleId,
    onSigningProgress,
    state: {
      owner: state.Owner,
      name: state.Name,
      ticker: state.Ticker,
      description: state.Description,
      keywords: state.Keywords,
      controllers: state.Controllers,
      records: state.Records,
      balances: state.Balances,
      logo: state.Logo,
    },
  });

  return forkedProcessId;
}

/**
 * @deprecated
 * Direct Evals are not encouraged when dealing with ANTs.
 * Instead, use spawnANT to fork an ANT to new module source code
 */
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

  logger.warn('Directly running an Eval on a process is not encouraged.');

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
  Messages?: {
    Tags?: { name: string; value: string }[];
    Data?: string;
  }[];
}): string | undefined {
  const errorData = output.Error;

  // Attempt to extract error details from Messages.Tags if Error is undefined
  const error =
    errorData ??
    output.Messages?.[0]?.Tags?.find((tag) => tag.name === 'Error')?.value;

  if (error !== undefined) {
    const errorStackTrace = output.Messages?.[0]?.Data;
    const errorMessage = errorStackTrace ?? error;
    // Regex to match AO error messages like: [string ".src.main"]:5111: Primary name data not found
    // or [string "aos"]:128: some error
    const match = errorMessage?.match(/\[string "(.+)"\]:(\d+):\s*(.*)/);
    if (match) {
      // The first group is the src file, the second is the line number, and the third is the error message
      const [, , lineNumber, errorMessage] = match;
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
