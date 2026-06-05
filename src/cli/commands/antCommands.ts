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
  ANTSetBaseNameRecordParams,
  ANTSetUndernameRecordParams,
} from '../../types/ant.js';
import { CLIWriteOptionsFromAoAntParams } from '../types.js';
import {
  antRecordMetadataFromOptions,
  assertConfirmationPrompt,
  customTagsFromOptions,
  defaultTtlSecondsCLI,
  requiredStringFromOptions,
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
  o: CLIWriteOptionsFromAoAntParams<ANTSetUndernameRecordParams>,
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

  return writeAnt.setRecord(recordParams, customTagsFromOptions(o));
}

export async function setAntBaseNameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<ANTSetBaseNameRecordParams>,
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

  return writeAnt.setBaseNameRecord(params, customTagsFromOptions(o));
}

export async function setAntUndernameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<ANTSetUndernameRecordParams>,
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

  return writeAnt.setUndernameRecord(params, customTagsFromOptions(o));
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

  return writeAnt.transferRecord(
    { undername, recipient },
    customTagsFromOptions(o),
  );
}
