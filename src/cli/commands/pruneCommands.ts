/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
/**
 * CLI commands for the permissionless prune / cleanup surface.
 *
 * These mirror the prune methods on `SolanaARIOWriteable` —
 * see `sdk/src/solana/io-writeable.ts` and `docs/CRANKER_PRUNING_PLAN.md`.
 */
import type { SolanaARIOWriteable } from '../../solana/io-writeable.js';
import type { WriteActionCLIOptions } from '../types.js';
import {
  assertConfirmationPrompt,
  requiredStringFromOptions,
  writeARIOFromOptions,
} from '../utils.js';

type PruneOptions = WriteActionCLIOptions & {
  name?: string;
  max?: string;
  gateway?: string;
  delegator?: string;
  observer?: string;
  initiator?: string;
  owner?: string;
  withdrawalId?: string;
  vaultId?: string;
  epochIndex?: string;
  arnsRecords?: string[];
  returnedNames?: string[];
};

async function getSolanaWriter(o: PruneOptions): Promise<SolanaARIOWriteable> {
  const { ario } = await writeARIOFromOptions(o);
  return ario as unknown as SolanaARIOWriteable;
}

function parseMaxNames(o: PruneOptions): number {
  const raw = o.max;
  if (raw === undefined) {
    throw new Error('--max <count> is required (u8 batch size, 1-255)');
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 255) {
    throw new Error(`--max must be an integer 1-255 (got ${raw})`);
  }
  return n;
}

// =========================================
// ArNS prune
// =========================================

export async function pruneExpiredNamesCLICommand(o: PruneOptions) {
  const max = parseMaxNames(o);
  const ario = await getSolanaWriter(o);

  // If `--arns-records` wasn't provided, discover them via the readable's
  // helper. Cap at `max` so we never overshoot the ix's u8 batch parameter.
  let records: string[] = o.arnsRecords ?? [];
  if (records.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    const expired = await ario.getExpiredArnsRecords(now);
    records = expired.slice(0, max).map((r) => r.pubkey as string);
    if (records.length === 0) {
      return { message: 'No expired ArnsRecords to prune' };
    }
  } else {
    records = records.slice(0, max);
  }

  await assertConfirmationPrompt(
    `Prune ${records.length} expired ArnsRecord(s)?`,
    o,
  );

  return ario.pruneExpiredNames({ maxNames: max, arnsRecords: records });
}

export async function pruneNameToReturnedCLICommand(o: PruneOptions) {
  const name = requiredStringFromOptions(o, 'name');
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Convert expired lease for "${name}" to a ReturnedName (Dutch auction)?`,
    o,
  );

  return ario.pruneNameToReturned({ name });
}

export async function pruneReturnedNamesCLICommand(o: PruneOptions) {
  const max = parseMaxNames(o);
  const ario = await getSolanaWriter(o);

  let returned: string[] = o.returnedNames ?? [];
  if (returned.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    const expired = await ario.getExpiredReturnedNames(now);
    returned = expired.slice(0, max).map((r) => r.pubkey as string);
    if (returned.length === 0) {
      return { message: 'No expired ReturnedNames to prune' };
    }
  } else {
    returned = returned.slice(0, max);
  }

  await assertConfirmationPrompt(
    `Prune ${returned.length} expired ReturnedName(s)?`,
    o,
  );

  return ario.pruneReturnedNames({
    maxNames: max,
    returnedNames: returned,
  });
}

export async function pruneExpiredReservationCLICommand(o: PruneOptions) {
  const name = requiredStringFromOptions(o, 'name');
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(`Close expired reservation for "${name}"?`, o);

  return ario.pruneExpiredReservation({ name });
}

// =========================================
// Gateway prune
// =========================================

export async function pruneGatewayCLICommand(o: PruneOptions) {
  const gateway = requiredStringFromOptions(o, 'gateway');
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Slash + remove deficient gateway ${gateway}?`,
    o,
  );

  return ario.pruneGateway({ gateway });
}

export async function finalizeGoneCLICommand(o: PruneOptions) {
  const gateway = requiredStringFromOptions(o, 'gateway');
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Finalize-GC departed gateway ${gateway} (reclaim PDA rent)?`,
    o,
  );

  return ario.finalizeGone({ gateway });
}

// =========================================
// Rent reclaim
// =========================================

export async function closeObservationCLICommand(o: PruneOptions) {
  const epochIndexStr = requiredStringFromOptions(o, 'epochIndex');
  const observer = requiredStringFromOptions(o, 'observer');
  const epochIndex = Number(epochIndexStr);
  if (!Number.isInteger(epochIndex) || epochIndex < 0) {
    throw new Error(
      `--epoch-index must be a non-negative integer (got ${epochIndexStr})`,
    );
  }
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Close Observation PDA (epoch ${epochIndex}, observer ${observer})?`,
    o,
  );

  return ario.closeObservation({ epochIndex, observer });
}

export async function closeEmptyDelegationCLICommand(o: PruneOptions) {
  const gateway = requiredStringFromOptions(o, 'gateway');
  const delegator = requiredStringFromOptions(o, 'delegator');
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Close empty Delegation PDA (gateway=${gateway}, delegator=${delegator})?`,
    o,
  );

  return ario.closeEmptyDelegation({ gateway, delegator });
}

export async function closeDrainedWithdrawalCLICommand(o: PruneOptions) {
  const owner = requiredStringFromOptions(o, 'owner');
  const withdrawalIdStr = requiredStringFromOptions(o, 'withdrawalId');
  // Validate before BigInt() — `BigInt('0xff')` and `BigInt('  1  ')` succeed
  // and `BigInt('abc')` throws an opaque SyntaxError. Restrict to the u64
  // decimal form the on-chain seed encoder expects so the CLI fails with a
  // clear message instead of a downstream parser error.
  if (!/^\d+$/.test(withdrawalIdStr)) {
    throw new Error(
      `--withdrawal-id must be a non-negative decimal integer (got "${withdrawalIdStr}")`,
    );
  }
  const withdrawalId = BigInt(withdrawalIdStr);
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Close drained Withdrawal PDA (owner=${owner}, id=${withdrawalIdStr})?`,
    o,
  );

  return ario.closeDrainedWithdrawal({ owner, withdrawalId });
}

// =========================================
// Vault + primary-name request
// =========================================

export async function releaseVaultCLICommand(o: PruneOptions) {
  // The on-chain handler requires `owner: Signer` — the SDK uses the
  // configured signer as the owner. The `--owner` flag is accepted as
  // documentation but ignored unless it matches the signer; fail loud if
  // it doesn't, so users don't think they can release someone else's vault.
  const ario = await getSolanaWriter(o);
  if (o.owner) {
    const signerAddr = (await writeARIOFromOptions(o)).signerAddress;
    if (o.owner !== signerAddr) {
      throw new Error(
        `release-vault: --owner ${o.owner} does not match signer ${signerAddr}. ` +
          `release_vault is owner-signed; use the owner's wallet to call it.`,
      );
    }
  }
  const vaultIdStr = requiredStringFromOptions(o, 'vaultId');
  const vaultId = vaultIdStr;

  await assertConfirmationPrompt(
    `Release expired vault id=${vaultIdStr} (transfer tokens back to owner)?`,
    o,
  );

  return ario.releaseVault({ vaultId });
}

export async function closeExpiredRequestCLICommand(o: PruneOptions) {
  const initiator = requiredStringFromOptions(o, 'initiator');
  const ario = await getSolanaWriter(o);

  await assertConfirmationPrompt(
    `Close expired primary-name request from ${initiator}?`,
    o,
  );

  return ario.closeExpiredRequest({ initiator });
}
