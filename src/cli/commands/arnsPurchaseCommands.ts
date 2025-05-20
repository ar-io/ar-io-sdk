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
  AoArNSPurchaseParams,
  AoBuyRecordParams,
  AoExtendLeaseParams,
  AoIncreaseUndernameLimitParams,
} from '../../types/io.js';
import { CLIWriteOptionsFromAoParams } from '../types.js';
import {
  assertConfirmationPrompt,
  assertEnoughBalanceForArNSPurchase,
  customTagsFromOptions,
  fundFromFromOptions,
  positiveIntegerFromOptions,
  recordTypeFromOptions,
  requiredPositiveIntegerFromOptions,
  requiredStringFromOptions,
  stringArrayFromOptions,
  writeARIOFromOptions,
} from '../utils.js';

export async function buyRecordCLICommand(
  o: CLIWriteOptionsFromAoParams<AoBuyRecordParams>,
) {
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');
  const type = recordTypeFromOptions(o);
  const years = positiveIntegerFromOptions(o, 'years');
  const fundFrom = fundFromFromOptions(o);

  const processId = o.processId;
  if (processId === undefined) {
    // TODO: Spawn ANT process, register it to ANT registry, get process ID
    throw new Error('Process ID must be provided for buy-record');
  }

  if (!o.skipConfirmation) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord !== undefined) {
      throw new Error(`ArNS Record ${name} is already owned`);
    }

    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Buy-Name',
        type,
        name,
        years,
        fundFrom,
        fromAddress: signerAddress,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to ${type} the record ${name}?`,
      o,
    );
  }

  return ario.buyRecord(
    {
      name: requiredStringFromOptions(o, 'name'),
      processId,
      type,
      years,
      fundFrom: fundFromFromOptions(o),
      paidBy: stringArrayFromOptions(o, 'paidBy'),
    },
    customTagsFromOptions(o),
  );
}

export async function upgradeRecordCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  const name = requiredStringFromOptions(o, 'name');
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const fundFrom = fundFromFromOptions(o);

  if (!o.skipConfirmation) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord === undefined) {
      throw new Error(`ArNS Record ${name} does not exist`);
    }
    if (existingRecord.type === 'permabuy') {
      throw new Error(`ArNS Record ${name} is already a permabuy`);
    }
    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Upgrade-Name',
        name,
        fundFrom,
        fromAddress: signerAddress,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to upgrade the lease of ${name} to a permabuy?`,
      o,
    );
  }
  return ario.upgradeRecord({
    name,
    fundFrom,
    paidBy: stringArrayFromOptions(o, 'paidBy'),
  });
}

export async function extendLeaseCLICommand(
  o: CLIWriteOptionsFromAoParams<AoExtendLeaseParams>,
) {
  const name = requiredStringFromOptions(o, 'name');
  const years = requiredPositiveIntegerFromOptions(o, 'years');
  const fundFrom = fundFromFromOptions(o);
  const { ario, signerAddress } = writeARIOFromOptions(o);

  if (!o.skipConfirmation) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord === undefined) {
      throw new Error(`ArNS Record ${name} does not exist`);
    }
    if (existingRecord.type === 'permabuy') {
      throw new Error(
        `ArNS Record ${name} is a permabuy and cannot be extended`,
      );
    }

    await assertEnoughBalanceForArNSPurchase({
      ario: ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Extend-Lease',
        name,
        years,
        fundFrom,
        fromAddress: signerAddress,
      },
    });
    await assertConfirmationPrompt(
      `Are you sure you want to extend the lease of ${name} by ${years}?`,
      o,
    );
  }
  return ario.extendLease(
    {
      name,
      years,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
    },
    customTagsFromOptions(o),
  );
}

export async function increaseUndernameLimitCLICommand(
  o: CLIWriteOptionsFromAoParams<AoIncreaseUndernameLimitParams>,
) {
  const name = requiredStringFromOptions(o, 'name');
  const increaseCount = requiredPositiveIntegerFromOptions(o, 'increaseCount');
  const fundFrom = fundFromFromOptions(o);
  const { ario, signerAddress } = writeARIOFromOptions(o);

  if (!o.skipConfirmation) {
    const existingRecord = await ario.getArNSRecord({
      name,
    });
    if (existingRecord === undefined) {
      throw new Error(`ArNS Record ${name} does not exist`);
    }

    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Increase-Undername-Limit',
        name,
        quantity: increaseCount,
        fundFrom,
        fromAddress: signerAddress,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to increase the undername limit of ${name} by ${increaseCount}?`,
      o,
    );
  }

  return ario.increaseUndernameLimit(
    {
      name,
      increaseCount,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
    },
    customTagsFromOptions(o),
  );
}

export async function requestPrimaryNameCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  const { ario, signerAddress } = writeARIOFromOptions(o);
  const fundFrom = fundFromFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');

  if (!o.skipConfirmation) {
    // TODO: Assert name requested is not already owned?
    // TODO: More assertions?
    await assertEnoughBalanceForArNSPurchase({
      ario,
      address: signerAddress,
      costDetailsParams: {
        intent: 'Primary-Name-Request',
        name,
        fromAddress: signerAddress,
        fundFrom,
      },
    });

    await assertConfirmationPrompt(
      `Are you sure you want to request the primary name ${name}?`,
      o,
    );
  }

  return ario.requestPrimaryName(
    {
      name,
      fundFrom,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
    },
    customTagsFromOptions(o),
  );
}
