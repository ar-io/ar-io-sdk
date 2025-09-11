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
import { CLIWriteOptionsFromAoAntParams } from '../types.js';
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

/** @deprecated -- use set-ant-base-name and set-ant-undername */
export async function setAntRecordCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetUndernameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const undername = requiredStringFromOptions(o, 'undername');
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const writeAnt = writeANTFromOptions(o);
  const recordParams = {
    undername,
    transactionId,
    ttlSeconds,
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

  return writeANTFromOptions(o).setRecord(
    recordParams,
    customTagsFromOptions(o),
  );
}

export async function setAntBaseNameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetBaseNameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const params = {
    transactionId,
    ttlSeconds,
    ...antRecordMetadataFromOptions(o),
  };

  const writeAnt = writeANTFromOptions(o);

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

  return writeANTFromOptions(o).setBaseNameRecord(
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

  const params = {
    undername,
    transactionId,
    ttlSeconds,
    ...antRecordMetadataFromOptions(o),
  };

  const writeAnt = writeANTFromOptions(o);

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

  return writeANTFromOptions(o).setUndernameRecord(
    params,
    customTagsFromOptions(o),
  );
}

export async function transferRecordOwnershipCLICommand(
  o: CLIWriteOptionsFromAoAntParams<{ undername: string; recipient: string }>,
) {
  const undername = requiredStringFromOptions(o, 'undername');
  const recipient = requiredStringFromOptions(o, 'recipient');

  const writeAnt = writeANTFromOptions(o);

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

  return writeANTFromOptions(o).transferRecord(
    { undername, recipient },
    customTagsFromOptions(o),
  );
}

export async function upgradeAntCLICommand(
  o: CLIWriteOptionsFromAoAntParams<Record<string, unknown>>,
) {
  const writeAnt = writeANTFromOptions(o);
  const arioProcessId = arioProcessIdFromOptions(o);
  const ario = readARIOFromOptions(o);
  const reassignAffiliatedNames = booleanFromOptions(
    o,
    'reassignAffiliatedNames',
  );

  const names = stringArrayFromOptions(o, 'names') || [];

  if (reassignAffiliatedNames) {
    // Fetch all ArNS records that point to this ANT process
    const allRecords = await ario.getArNSRecords({
      filters: {
        processId: writeAnt.processId,
      },
    });

    // Filter records that belong to this ANT
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
    ? await writeANTFromOptions(o).upgrade({
        reassignAffiliatedNames,
        arioProcessId,
      })
    : await writeANTFromOptions(o).upgrade({
        names,
        arioProcessId,
      });

  // Serialize error objects for JSON compatibility
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
