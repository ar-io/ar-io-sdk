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
import {
  AoANTSetBaseNameRecordParams,
  AoANTSetUndernameRecordParams,
} from '../../types/ant.js';
import { CLIWriteOptionsFromAoAntParams, JsonSerializable } from '../types.js';
import {
  antRecordMetadataFromOptions,
  arioProcessIdFromOptions,
  assertConfirmationPrompt,
  booleanFromOptions,
  customTagsFromOptions,
  defaultTtlSecondsCLI,
  readARIOFromOptions,
  requiredStringFromOptions,
  stringArrayFromOptions,
  writeANTFromOptions,
} from '../utils.js';

function targetProtocolFromOptions(o: Record<string, unknown>): number {
  const raw = o.targetProtocol as string | undefined;
  if (!raw || raw === 'arweave') return 0;
  if (raw === 'ipfs') return 1;
  throw new Error(
    `Invalid --target-protocol "${raw}". Must be "arweave" or "ipfs".`,
  );
}

/** @deprecated -- use set-ant-base-name and set-ant-undername */
export async function setAntRecordCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetUndernameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const undername = requiredStringFromOptions(o, 'undername');
  const transactionId = requiredStringFromOptions(o, 'transactionId');
  const targetProtocol = targetProtocolFromOptions(o);

  const writeAnt = await writeANTFromOptions(o);
  const recordParams = {
    undername,
    transactionId,
    ttlSeconds,
    targetProtocol,
    ...antRecordMetadataFromOptions(o),
  };

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this record on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        recordParams,
        null,
        2,
      )}`,
      o,
    );
  }

  return (await writeANTFromOptions(o)).setRecord(
    recordParams,
    customTagsFromOptions(o),
  );
}

export async function setAntBaseNameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetBaseNameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const transactionId = requiredStringFromOptions(o, 'transactionId');
  const targetProtocol = targetProtocolFromOptions(o);

  const params = {
    transactionId,
    ttlSeconds,
    targetProtocol,
    ...antRecordMetadataFromOptions(o),
  };

  const writeAnt = await writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this base name on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        params,
        null,
        2,
      )}`,
      o,
    );
  }

  return (await writeANTFromOptions(o)).setBaseNameRecord(
    params,
    customTagsFromOptions(o),
  );
}

export async function setAntUndernameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetUndernameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const undername = requiredStringFromOptions(o, 'undername');
  const transactionId = requiredStringFromOptions(o, 'transactionId');
  const targetProtocol = targetProtocolFromOptions(o);

  const params = {
    undername,
    transactionId,
    ttlSeconds,
    targetProtocol,
    ...antRecordMetadataFromOptions(o),
  };

  const writeAnt = await writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this undername on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        params,
        null,
        2,
      )}`,
      o,
    );
  }

  return (await writeANTFromOptions(o)).setUndernameRecord(
    params,
    customTagsFromOptions(o),
  );
}

export async function transferRecordOwnershipCLICommand(
  o: CLIWriteOptionsFromAoAntParams<{ undername: string; recipient: string }>,
) {
  const undername = requiredStringFromOptions(o, 'undername');
  const recipient = requiredStringFromOptions(o, 'recipient');

  const writeAnt = await writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to transfer ownership of "${undername}" to "${recipient}" on ANT process ${writeAnt.processId}?\n${JSON.stringify(
        { undername, recipient },
        null,
        2,
      )}`,
      o,
    );
  }

  return (await writeANTFromOptions(o)).transferRecord(
    { undername, recipient },
    customTagsFromOptions(o),
  );
}

export async function upgradeAntCLICommand(
  o: CLIWriteOptionsFromAoAntParams<Record<string, unknown>>,
): Promise<{ [key: string]: JsonSerializable }> {
  // Solana: simple per-ANT schema migration (no forking, no name reassignment)
  if (!o.ao) {
    const writeAnt = await writeANTFromOptions(o);

    if (!o.skipConfirmation) {
      await assertConfirmationPrompt(
        `Migrate ANT to latest schema version?\n` +
          `ANT: ${writeAnt.processId}`,
        o,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await writeAnt.upgrade();
    if (!result.needsMigration) {
      return { message: 'ANT is already at the latest version' };
    }
    return { message: 'ANT migrated successfully', txId: String(result.id) };
  }

  // AO: fork process and reassign names
  const writeAnt = await writeANTFromOptions(o);
  const arioProcessId = arioProcessIdFromOptions(o);
  const ario = readARIOFromOptions(o);
  const reassignAffiliatedNames = booleanFromOptions(
    o,
    'reassignAffiliatedNames',
  );

  const names = stringArrayFromOptions(o, 'names') || [];

  if (reassignAffiliatedNames) {
    const allRecords = await ario.getArNSRecords({
      filters: {
        processId: writeAnt.processId,
      },
    });

    const affiliatedNames = allRecords.items.map((record) => record.name);
    names.push(...affiliatedNames);
  }

  if (names.length === 0) {
    throw new Error('No names to reassign');
  }

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Upgrade all names affiliated with this ANT on ARIO process?\n` +
        `ARIO Process ID: ${arioProcessId}\n` +
        `ANT Process ID: ${writeAnt.processId}\n` +
        `Names that will be reassigned (${names.length}): ${names.join(', ')}`,
      o,
    );
  }

  const result = reassignAffiliatedNames
    ? await (await writeANTFromOptions(o)).upgrade({
        reassignAffiliatedNames,
        arioProcessId,
      })
    : await (await writeANTFromOptions(o)).upgrade({
        names,
        arioProcessId,
      });

  const serializedFailedReassignedNames: Record<
    string,
    { id?: string; error: string }
  > = {};
  for (const [name, failure] of Object.entries(result.failedReassignedNames)) {
    serializedFailedReassignedNames[name] = {
      id: failure.id,
      error: failure.error.message,
    };
  }

  return {
    forkedProcessId: result.forkedProcessId,
    reassignedNames: result.reassignedNames,
    failedReassignedNames: serializedFailedReassignedNames,
  };
}
