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
  fundingPlanFromOptions,
  positiveIntegerFromOptions,
  recordTypeFromOptions,
  referrerFromOptions,
  requiredPositiveIntegerFromOptions,
  requiredStringFromOptions,
  stringArrayFromOptions,
  withdrawalIdFromOptions,
  writeARIOFromOptions,
} from '../utils.js';

import type { FundingSourceSpec } from '../../types/io.js';

/** Coerce the JSON-parsed funding plan to the typed `FundingSourceSpec[]`. */
function coerceFundingPlanSources(
  parsed: { kind: string; amount: bigint; gateway?: string }[] | undefined,
): FundingSourceSpec[] | undefined {
  if (!parsed) return undefined;
  return parsed.map((s) => ({
    kind: s.kind as FundingSourceSpec['kind'],
    amount: s.amount,
    ...(s.gateway ? { gateway: s.gateway } : {}),
  }));
}

export async function buyRecordCLICommand(
  o: CLIWriteOptionsFromAoParams<AoBuyRecordParams>,
) {
  const { ario, signerAddress } = await writeARIOFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');
  const type = recordTypeFromOptions(o);
  const years = positiveIntegerFromOptions(o, 'years');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const processId = o.processId;

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
      `Are you sure you want to ${type} the record ${name}?${
        processId === undefined
          ? ' Note: A new ANT (MPL Core asset) will be spawned and assigned to this name.'
          : ''
      }`,
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
      gatewayAddress: o.gatewayAddress as string | undefined,
      fundAsOperator: o.fundAsOperator as boolean | undefined,
      withdrawalId: withdrawalIdFromOptions(o as { withdrawalId?: string }),
      sources: coerceFundingPlanSources(
        fundingPlanFromOptions(o as { fundingPlanJson?: string }),
      ),
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );
}

export async function upgradeRecordCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  const name = requiredStringFromOptions(o, 'name');
  const { ario, signerAddress } = await writeARIOFromOptions(o);
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);

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
    gatewayAddress: o.gatewayAddress as string | undefined,
    fundAsOperator: o.fundAsOperator as boolean | undefined,
    paidBy: stringArrayFromOptions(o, 'paidBy'),
    referrer,
  });
}

export async function extendLeaseCLICommand(
  o: CLIWriteOptionsFromAoParams<AoExtendLeaseParams>,
) {
  const name = requiredStringFromOptions(o, 'name');
  const years = requiredPositiveIntegerFromOptions(o, 'years');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const { ario, signerAddress } = await writeARIOFromOptions(o);

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
      fundFrom,
      gatewayAddress: o.gatewayAddress as string | undefined,
      fundAsOperator: o.fundAsOperator as boolean | undefined,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
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
  const referrer = referrerFromOptions(o);
  const { ario, signerAddress } = await writeARIOFromOptions(o);

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
      fundFrom,
      gatewayAddress: o.gatewayAddress as string | undefined,
      fundAsOperator: o.fundAsOperator as boolean | undefined,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );
}

export async function requestPrimaryNameCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  const { ario, signerAddress } = await writeARIOFromOptions(o);
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');

  if (!o.skipConfirmation) {
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

  const { result } = await ario.requestPrimaryName(
    {
      name,
      fundFrom,
      paidBy: stringArrayFromOptions(o, 'paidBy'),
      referrer,
    },
    customTagsFromOptions(o),
  );

  if (result?.request === undefined) {
    throw new Error('Failed to request primary name for name ' + name);
  }

  return result.request;
}

export async function setPrimaryNameCLICommand(
  o: CLIWriteOptionsFromAoParams<AoArNSPurchaseParams>,
) {
  const { ario, signerAddress } = await writeARIOFromOptions(o);
  const name = requiredStringFromOptions(o, 'name');
  const fundFrom = fundFromFromOptions(o);
  const referrer = referrerFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Are you sure you want to set the primary name ${name} for address ${signerAddress}?`,
      o,
    );
  }

  return ario.setPrimaryName({ name, fundFrom, referrer });
}

/**
 * Reconcile the on-chain ANT Attributes plugin (`ArNS Name`, `Type`,
 * `Undername Limit`) with the current `ArnsRecord` state. Permissionless.
 *
 * Use after a `buy-record` where the buyer was not the ANT NFT holder
 * (the ANT-side trait CPI gets skipped at runtime in that case so the
 * plugin stays empty until the actual holder reconciles).
 */
export async function syncAttributesCLICommand(
  o: CLIWriteOptionsFromAoParams<{ name: string }>,
) {
  const name = requiredStringFromOptions(o, 'name');
  const { ario } = await writeARIOFromOptions(o);

  if (!o.skipConfirmation) {
    await assertConfirmationPrompt(
      `Sync on-chain ANT traits for "${name}" to match the current ArnsRecord?`,
      o,
    );
  }

  return ario.syncAttributes({ name });
}
