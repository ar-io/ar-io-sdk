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
  assertConfirmationPrompt,
  customTagsFromOptions,
  defaultTtlSecondsCLI,
  requiredStringFromOptions,
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

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this record on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        { undername, transactionId, ttlSeconds },
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).setRecord(
    {
      undername,
      transactionId,
      ttlSeconds,
    },
    customTagsFromOptions(o),
  );
}

export async function setAntBaseNameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetBaseNameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const writeAnt = writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this base name on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        { transactionId, ttlSeconds },
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).setBaseNameRecord(
    {
      transactionId,
      ttlSeconds,
    },
    customTagsFromOptions(o),
  );
}

export async function setAntUndernameCLICommand(
  o: CLIWriteOptionsFromAoAntParams<AoANTSetUndernameRecordParams>,
) {
  const ttlSeconds = +(o.ttlSeconds ?? defaultTtlSecondsCLI);
  const undername = requiredStringFromOptions(o, 'undername');
  const transactionId = requiredStringFromOptions(o, 'transactionId');

  const writeAnt = writeANTFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set this undername on the ANT process ${writeAnt.processId}?\n${JSON.stringify(
        { undername, transactionId, ttlSeconds },
        null,
        2,
      )}`,
      o,
    );
  }

  return writeANTFromOptions(o).setUndernameRecord(
    {
      undername,
      transactionId,
      ttlSeconds,
    },
    customTagsFromOptions(o),
  );
}
