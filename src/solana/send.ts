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
/**
 * Shared helpers for building, signing, and sending Solana transactions
 * with @solana/kit. Used by SolanaARIOWriteable and SolanaANTWriteable.
 *
 * Compute budget instruction builders come from `@solana-program/compute-budget`
 * (kit-flavored Codama client); the previous hand-rolled
 * `setComputeUnitLimitIx` / `setComputeUnitPriceIx` helpers were removed in
 * favor of the official package. See `sendAndConfirm` below for why we always
 * pin BOTH instructions (even with a 0 priority fee).
 */
import {
  ADDRESS_LOOKUP_TABLE_PROGRAM_ADDRESS,
  getCloseLookupTableInstruction,
  getCreateLookupTableInstructionAsync,
  getDeactivateLookupTableInstruction,
  getExtendLookupTableInstruction,
} from '@solana-program/address-lookup-table';
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import {
  type Address,
  type Commitment,
  type Instruction,
  type TransactionSigner,
  appendTransactionMessageInstructions,
  compileTransaction,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  getAddressDecoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isTransactionModifyingSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

import type { SolanaRpc, SolanaRpcSubscriptions } from './types.js';

/**
 * Floor for the auto-estimated priority fee (micro-lamports per CU). Ensures a
 * non-zero fee so message-modifying wallets (Phantom) leave the tx alone. The
 * absolute cost stays tiny: `fee ≈ price * CU_limit / 1e6` lamports
 * (e.g. 10_000 µ£/CU × 400k CU ≈ 4_000 lamports ≈ 0.000004 SOL).
 */
const MIN_PRIORITY_FEE_MICRO_LAMPORTS = 10_000n;
/** Cap so a spiky fee market can't blow up the fee unexpectedly. */
const MAX_PRIORITY_FEE_MICRO_LAMPORTS = 2_000_000n;

/**
 * Multiplier applied to the simulated `unitsConsumed` to derive the pinned
 * compute-unit limit, giving headroom for run-to-run variance (account state
 * the simulation didn't see, slightly different inputs at land time).
 */
const COMPUTE_UNIT_LIMIT_BUFFER = 1.3;
/**
 * Floor for the auto-sized compute-unit limit. Keeps tiny instructions from
 * being pinned so tight that benign variance trips a "exceeded CUs" failure.
 */
const MIN_COMPUTE_UNIT_LIMIT = 10_000;
/** Solana's hard per-transaction compute-unit ceiling. */
const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;

/**
 * Estimate a compute-unit price from recent on-chain prioritization fees: the
 * 75th percentile of recent non-zero per-slot fees, clamped to
 * [{@link MIN_PRIORITY_FEE_MICRO_LAMPORTS}, {@link MAX_PRIORITY_FEE_MICRO_LAMPORTS}].
 * Falls back to the floor when there's no data or the query fails. Matching the
 * going rate both lands the tx and keeps Phantom from bumping (and thus
 * rewriting) the fee.
 */
export async function estimatePriorityFeeMicroLamports(
  rpc: SolanaRpc,
): Promise<bigint> {
  try {
    const recent = await rpc.getRecentPrioritizationFees().send();
    const fees = recent
      .map((r) => BigInt(r.prioritizationFee))
      .filter((f) => f > 0n)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (fees.length === 0) return MIN_PRIORITY_FEE_MICRO_LAMPORTS;
    const p75 = fees[Math.min(fees.length - 1, Math.floor(fees.length * 0.75))];
    if (p75 < MIN_PRIORITY_FEE_MICRO_LAMPORTS)
      return MIN_PRIORITY_FEE_MICRO_LAMPORTS;
    if (p75 > MAX_PRIORITY_FEE_MICRO_LAMPORTS)
      return MAX_PRIORITY_FEE_MICRO_LAMPORTS;
    return p75;
  } catch {
    return MIN_PRIORITY_FEE_MICRO_LAMPORTS;
  }
}

/**
 * Simulate `message` (sig-verify off) to learn its actual `unitsConsumed`, then
 * return a tight compute-unit limit: `unitsConsumed * COMPUTE_UNIT_LIMIT_BUFFER`,
 * clamped to [{@link MIN_COMPUTE_UNIT_LIMIT}, `fallback`].
 *
 * Why this matters: a wildly over-provisioned CU limit (e.g. the blanket
 * `1_000_000` several writes pass) is exactly what message-modifying wallets
 * like Phantom *rewrite* — they tighten the limit to lower the fee
 * (fee = price × limit), sign their modified message, and the SDK's already-
 * attached signatures no longer match the submitted bytes →
 * "Transaction did not pass signature verification" even though simulation
 * (sig-verify off) passes. Pinning a realistic limit leaves the wallet nothing
 * to optimize, so the signed bytes are the submitted bytes.
 *
 * Best-effort: on any simulation error (including a program error — let the real
 * send surface it) we fall back to `fallback` so behavior never regresses.
 */
export async function estimateComputeUnitLimit(
  rpc: SolanaRpc,
  message: unknown,
  fallback: number,
): Promise<number> {
  try {
    const compiled = compileTransaction(message as never);
    const wire = getBase64EncodedWireTransaction(compiled as never);
    const sim = await rpc
      .simulateTransaction(wire, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        encoding: 'base64',
      })
      .send();
    const consumed = sim.value.unitsConsumed;
    if (sim.value.err != null || consumed == null) return fallback;
    const sized = Math.ceil(Number(consumed) * COMPUTE_UNIT_LIMIT_BUFFER);
    return Math.min(
      Math.max(sized, MIN_COMPUTE_UNIT_LIMIT),
      Math.min(fallback, MAX_COMPUTE_UNIT_LIMIT),
    );
  } catch {
    return fallback;
  }
}

/**
 * Build, sign, send, and confirm a transaction in one call.
 *
 * The caller supplies the core instructions; a compute-unit-limit instruction
 * is prepended automatically.
 */
export async function sendAndConfirm({
  rpc,
  rpcSubscriptions,
  signer,
  instructions,
  commitment = 'confirmed',
  computeUnitLimit = 400_000,
  autoComputeUnitLimit = true,
  priorityFeeMicroLamports = 'auto',
  addressLookupTables,
}: {
  rpc: SolanaRpc;
  rpcSubscriptions: SolanaRpcSubscriptions;
  signer: TransactionSigner;
  instructions: Instruction[];
  commitment?: Commitment;
  /**
   * Upper bound for the compute-unit limit. By default the limit is auto-sized
   * from a pre-send simulation (see {@link estimateComputeUnitLimit}) and this
   * value is only the ceiling/fallback. Pass `autoComputeUnitLimit: false` to
   * pin exactly this value instead (e.g. localnet, or when simulation is
   * unavailable).
   */
  computeUnitLimit?: number;
  /**
   * When `true` (default), simulate before signing and pin a tight CU limit so
   * message-modifying wallets (Phantom) don't rewrite the over-provisioned limit
   * and invalidate signatures. When `false`, pin `computeUnitLimit` verbatim.
   */
  autoComputeUnitLimit?: boolean;
  /**
   * Compute-unit price (priority fee), in micro-lamports per CU.
   * - `'auto'` (default): estimate from recent on-chain fees (see
   *   {@link estimatePriorityFeeMicroLamports}). A NON-ZERO fee is essential:
   *   wallets like Phantom treat a missing/zero fee as "unset" and rewrite the
   *   transaction to inject their own, which invalidates already-attached
   *   signatures (→ "Transaction did not pass signature verification"). A real,
   *   network-rate fee makes the wallet leave the message untouched.
   * - a `number`/`bigint`: pin exactly this price.
   * - `false`: no priority fee (price 0) — only for environments with no fee
   *   market (localnet) where wallet rewriting isn't a concern.
   */
  priorityFeeMicroLamports?: bigint | number | 'auto' | false;
  /**
   * Address Lookup Tables to compress the (v0) message against, as
   * `{ [tableAddress]: addresses }`. Accounts present in a table are referenced
   * by 1-byte index instead of their 32-byte key, shrinking the transaction —
   * required when an instruction touches more accounts than fit inline (e.g.
   * `prescribe_epoch` with ~50 observer PDAs). The tables MUST already be
   * on-chain and active. See {@link sendWithEphemeralLookupTable}.
   */
  addressLookupTables?: Record<string, Address[]>;
}): Promise<string> {
  const microLamports =
    priorityFeeMicroLamports === 'auto'
      ? await estimatePriorityFeeMicroLamports(rpc)
      : priorityFeeMicroLamports === false
        ? 0n
        : BigInt(priorityFeeMicroLamports);

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Build the (optionally ALT-compressed) message for a given CU limit. We may
  // build it twice: once with the ceiling limit to simulate, once with the
  // tight limit we actually sign.
  const buildMessage = (units: number) => {
    const baseMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) =>
        appendTransactionMessageInstructions(
          [
            getSetComputeUnitLimitInstruction({ units }),
            // Pin an explicit, NON-ZERO priority fee so wallets like Phantom
            // don't rewrite the message to inject their own compute-budget
            // instructions. Phantom treats a missing/zero fee as "unset" and
            // overrides it on mainnet — that mutation invalidates the already-
            // attached signatures (→ "Transaction did not pass signature
            // verification" / preflight #-32002). A real, network-rate fee
            // (see `microLamports` above) makes the wallet leave the message
            // alone, so signatures over the original bytes still verify.
            getSetComputeUnitPriceInstruction({ microLamports }),
            ...instructions,
          ],
          tx,
        ),
    );

    // Compress against any supplied lookup tables (v0). No-op when none given.
    return addressLookupTables
      ? compressTransactionMessageUsingAddressLookupTables(
          baseMessage,
          addressLookupTables as never,
        )
      : baseMessage;
  };

  // Right-size the CU limit from a pre-send simulation — but ONLY for
  // non-modifying (keypair) signers, where it saves fees and nothing will
  // rewrite the message.
  //
  // Message-modifying wallets (Phantom etc.) re-optimize the compute budget
  // themselves AND attach simulation-based guards (e.g. Lighthouse) keyed to
  // the budget/state they expect. Handing them a tightly-sized limit interferes
  // with that and trips the guard at execution time (observed: Lighthouse
  // `AssertionFailed` 0x1900 on `joinNetwork`, even though the tx itself
  // simulates clean). The modifying-signer bridge already captures whatever the
  // wallet rewrites, so sizing the limit for them is both unnecessary and
  // harmful — leave the generous `computeUnitLimit` and let the wallet tune it.
  const shouldAutoSize =
    autoComputeUnitLimit && !isTransactionModifyingSigner(signer);
  const units = shouldAutoSize
    ? await estimateComputeUnitLimit(
        rpc,
        buildMessage(computeUnitLimit),
        computeUnitLimit,
      )
    : computeUnitLimit;

  const message = buildMessage(units);

  const signedTx = await signTransactionMessageWithSigners(message);
  const sendAndConfirmFactory = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });
  // Cast narrows the transaction type to what sendAndConfirmFactory expects —
  // the kit signer pipeline produces a fully-signed transaction with a blockhash
  // lifetime, but the factory's argument type doesn't quite line up with the
  // inferred union. The runtime object is correct.
  try {
    await sendAndConfirmFactory(signedTx as never, { commitment });
  } catch (err) {
    logSolanaErrorContext(err);
    await logSimulationDiagnostics(rpc, message, err);
    throw err;
  }
  return getSignatureFromTransaction(signedTx) as string;
}

/**
 * Walk the chain of `cause`s on a thrown `SolanaError` and log each one's
 * `.context` (kit packs the server-provided `err`, `logs`, `unitsConsumed`,
 * etc. there). This usually contains the program logs we want without having
 * to re-simulate.
 */
function logSolanaErrorContext(err: unknown): void {
  let current: unknown = err;
  let depth = 0;
  while (current && depth < 10) {
    const e = current as {
      name?: string;
      message?: string;
      context?: Record<string, unknown>;
      cause?: unknown;
    };
    const ctx = e?.context;
    if (ctx && typeof ctx === 'object') {
      // eslint-disable-next-line no-console
      console.warn(
        `[solana-send] error[${depth}] ${e.name ?? 'Error'}: ${e.message ?? ''}`,
        { context: ctx },
      );
      const logs = (ctx as { logs?: unknown }).logs;
      if (Array.isArray(logs) && logs.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[solana-send] error[${depth}] program logs:\n` + logs.join('\n'),
        );
      }
    }
    current = e?.cause;
    depth += 1;
  }
}

/**
 * On send/confirm failure, re-simulate the transaction with sig-verify off so
 * we can surface program logs + the failed instruction index. Kit's default
 * `SolanaError` only carries the bare `Custom program error: #N (instruction
 * #M)` summary; we also log the full simulation result and the wire-format
 * transaction so the underlying `msg!` lines and account list can be inspected
 * in the browser console.
 *
 * Best-effort and side-effect free aside from console output.
 */
async function logSimulationDiagnostics(
  rpc: SolanaRpc,
  message: unknown,
  originalError: unknown,
): Promise<void> {
  try {
    const compiled = compileTransaction(message as never);
    const wire = getBase64EncodedWireTransaction(compiled as never);
    // eslint-disable-next-line no-console
    console.warn(
      '[solana-send] sendAndConfirm failed; re-running simulateTransaction for diagnostics',
      { error: originalError },
    );

    const sim = await rpc
      .simulateTransaction(wire, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        encoding: 'base64',
      })
      .send();

    // eslint-disable-next-line no-console
    console.warn('[solana-send] simulateTransaction result:', sim.value);
    if (sim.value.err) {
      // eslint-disable-next-line no-console
      console.warn('[solana-send] simulation err:', sim.value.err);
    }
    if (sim.value.logs) {
      // eslint-disable-next-line no-console
      console.warn('[solana-send] program logs:\n' + sim.value.logs.join('\n'));
    }
  } catch (diagErr) {
    // eslint-disable-next-line no-console
    console.warn('[solana-send] failed to collect diagnostics', diagErr);
  }
}

/**
 * Submit `instruction` in a v0 transaction whose `lookupAddresses` (read-only
 * accounts) are served from a freshly-created, ephemeral Address Lookup Table,
 * so an instruction touching far more accounts than fit inline (e.g.
 * `prescribe_epoch` with ≤50 observer PDAs + NameRegistry, ~2 KB of keys) still
 * fits Solana's 1232-byte transaction-size limit.
 *
 * Three confirmed steps: create the table, extend it with the addresses (in
 * ≤20-address batches to stay within the extend tx size), then send
 * `instruction` compressed against the table. The sequential confirmations
 * satisfy the rule that appended addresses are only usable the slot AFTER they
 * are added. `signer` is the table's authority + payer; the table's (tiny) rent
 * is left allocated — a future cleanup pass can deactivate + close it.
 */
export async function sendWithEphemeralLookupTable({
  rpc,
  rpcSubscriptions,
  signer,
  instruction,
  lookupAddresses,
  commitment = 'confirmed',
  computeUnitLimit = 1_000_000,
}: {
  rpc: SolanaRpc;
  rpcSubscriptions: SolanaRpcSubscriptions;
  signer: TransactionSigner;
  instruction: Instruction;
  lookupAddresses: Address[];
  commitment?: Commitment;
  computeUnitLimit?: number;
}): Promise<string> {
  const recentSlot = await rpc.getSlot({ commitment: 'finalized' }).send();
  const createIx = await getCreateLookupTableInstructionAsync({
    authority: signer.address,
    payer: signer,
    recentSlot,
  });
  const tableAddress = (
    createIx as unknown as { accounts: { address: Address }[] }
  ).accounts[0].address;

  // Create the (empty) table.
  await sendAndConfirm({
    rpc,
    rpcSubscriptions,
    signer,
    instructions: [createIx],
    commitment,
    computeUnitLimit: 60_000,
  });

  // Fill it, ≤20 addresses per extend tx.
  const BATCH = 20;
  for (let i = 0; i < lookupAddresses.length; i += BATCH) {
    const extendIx = getExtendLookupTableInstruction({
      address: tableAddress,
      authority: signer,
      payer: signer,
      addresses: lookupAddresses.slice(i, i + BATCH),
    });
    await sendAndConfirm({
      rpc,
      rpcSubscriptions,
      signer,
      instructions: [extendIx],
      commitment,
      computeUnitLimit: 60_000,
    });
  }

  // Wait until the table holds every address AND one slot has elapsed since —
  // addresses appended to a lookup table are only usable the slot AFTER they're
  // added, and the validator that processes the prescribe must already see
  // them. Skipping this yields "address table lookup uses an invalid index".
  await waitForLookupTableActive(rpc, tableAddress, lookupAddresses.length);

  // Send the real instruction, compressed against the now-active table.
  return sendAndConfirm({
    rpc,
    rpcSubscriptions,
    signer,
    instructions: [instruction],
    commitment,
    computeUnitLimit,
    addressLookupTables: { [tableAddress]: lookupAddresses },
  });
}

/**
 * Poll until an Address Lookup Table holds at least `expectedCount` addresses
 * AND at least one slot has elapsed since they all landed. Lookup-table entries
 * are only usable the slot AFTER they are appended, and the leader processing
 * the consuming tx must already see them — otherwise the runtime rejects the tx
 * with "address table lookup uses an invalid index". ALT account layout is a
 * 56-byte metadata header followed by 32-byte addresses.
 */
async function waitForLookupTableActive(
  rpc: SolanaRpc,
  table: Address,
  expectedCount: number,
  maxWaitMs = 30_000,
): Promise<void> {
  const META = 56;
  const start = Date.now();
  let slotAllPresent: bigint | null = null;
  while (Date.now() - start < maxWaitMs) {
    const acc = await rpc.getAccountInfo(table, { encoding: 'base64' }).send();
    const slot = acc.context.slot;
    if (acc.value) {
      const len = Buffer.from(acc.value.data[0], 'base64').length;
      const count = len >= META ? Math.floor((len - META) / 32) : 0;
      if (count >= expectedCount) {
        if (slotAllPresent === null) {
          slotAllPresent = slot;
        } else if (slot > slotAllPresent) {
          return; // all addresses present + a slot has elapsed → warm
        }
      }
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(
    `lookup table ${table} not active (≥${expectedCount} addresses + 1 slot) within ${maxWaitMs}ms`,
  );
}

/**
 * Reclaim rent from the ephemeral Address Lookup Tables `signer` created for
 * prescribe (see {@link sendWithEphemeralLookupTable}). Each prescribe leaves a
 * single-use table allocated (~0.0126 SOL of rent); reclaiming needs a
 * deactivate → ~513-slot cooldown → close sequence, so it can't run inline — a
 * throttled permissionless cleanup pass (cranker / observer) calls this.
 *
 * Discovery is RPC-portable. `getProgramAccounts` on the Address Lookup Table
 * program is rejected by Agave RPCs (`Invalid param: WrongSize`, on public
 * devnet/mainnet-beta and dedicated providers alike — the ALT program can't be
 * enumerated), so instead we read the signer's own transaction history
 * (`getSignaturesForAddress` + `getTransaction`) and collect the tables it
 * referenced via `message.addressTableLookups` — a prescribe ALT is used in
 * exactly one transaction.
 *
 * Safety fingerprint: a candidate is only touched when EVERY one of its entries
 * is owned by a program in `allowedEntryOwners` (the GAR + ArNS programs — i.e.
 * observer Gateway PDAs + the ArNS NameRegistry). That composition uniquely
 * identifies a prescribe ephemeral, so the pass never deactivates/closes an
 * unrelated table even if `signer` is also used to author Address Lookup Tables
 * for other purposes.
 *
 * DEACTIVATES still-active matches (starts the cooldown) and CLOSES deactivated
 * matches past the cooldown (refunding rent to `signer`). At most `maxTables`
 * submissions per call; scans at most `scanLimit` recent signatures. Best-effort:
 * per-table failures are skipped and retried on the next pass.
 */
export async function reclaimLookupTablesForSigner({
  rpc,
  rpcSubscriptions,
  signer,
  allowedEntryOwners,
  commitment = 'confirmed',
  maxTables = 10,
  scanLimit = 500,
}: {
  rpc: SolanaRpc;
  rpcSubscriptions: SolanaRpcSubscriptions;
  signer: TransactionSigner;
  /**
   * Program IDs that EVERY entry of a reclaimable prescribe ALT must be owned by
   * — pass the GAR + ArNS program IDs. The fingerprint that keeps reclamation
   * from touching unrelated lookup tables.
   */
  allowedEntryOwners: Address[];
  commitment?: Commitment;
  maxTables?: number;
  scanLimit?: number;
}): Promise<{
  deactivated: number;
  closed: number;
  candidates: number;
  scannedSignatures: number;
}> {
  const ALT_META = 56; // metadata header before the 32-byte address array
  const ACTIVE = 0xff_ff_ff_ff_ff_ff_ff_ffn; // u64::MAX = not yet deactivated
  const COOLDOWN_SLOTS = 513n; // deactivation_slot must age out of SlotHashes
  const allowed = new Set<string>(allowedEntryOwners as unknown as string[]);
  const addressDecoder = getAddressDecoder();
  // getTransaction only honours 'confirmed' | 'finalized'.
  const historyCommitment =
    commitment === 'finalized' ? 'finalized' : 'confirmed';

  // --- Discover candidate tables from the signer's transaction history -------
  const sigs = await rpc
    .getSignaturesForAddress(signer.address, { limit: scanLimit })
    .send();
  const candidates = new Set<string>();
  for (const { signature } of sigs) {
    // A little headroom over maxTables so already-closed candidates don't
    // starve the budget; the rest get picked up next pass.
    if (candidates.size >= maxTables * 3) break;
    const tx = await rpc
      .getTransaction(signature, {
        encoding: 'json',
        maxSupportedTransactionVersion: 0,
        commitment: historyCommitment,
      })
      .send();
    const lookups =
      (
        tx as unknown as {
          transaction?: {
            message?: { addressTableLookups?: { accountKey: string }[] };
          };
        } | null
      )?.transaction?.message?.addressTableLookups ?? [];
    for (const l of lookups) candidates.add(l.accountKey);
  }

  // --- Reclaim ----------------------------------------------------------------
  const currentSlot = await rpc.getSlot().send();
  let deactivated = 0;
  let closed = 0;
  for (const table of candidates) {
    if (deactivated + closed >= maxTables) break;
    const address = table as Address;
    try {
      const info = await rpc
        .getAccountInfo(address, { encoding: 'base64' })
        .send();
      const value = info.value;
      if (!value) continue; // already closed
      if (
        (value.owner as string) !==
        (ADDRESS_LOOKUP_TABLE_PROGRAM_ADDRESS as string)
      ) {
        continue;
      }
      const data = Buffer.from(value.data[0], 'base64');
      if (data.length < ALT_META) continue;
      const deactivationSlot = data.readBigUInt64LE(4);

      // Fingerprint: every entry must be owned by an allowed program. A prescribe
      // ALT is exclusively observer Gateway PDAs (GAR) + the NameRegistry (ArNS).
      const entries: Address[] = [];
      for (let off = ALT_META; off + 32 <= data.length; off += 32) {
        entries.push(addressDecoder.decode(data.subarray(off, off + 32)));
      }
      if (entries.length === 0) continue;
      const owners = await rpc
        .getMultipleAccounts(entries, {
          encoding: 'base64',
          dataSlice: { offset: 0, length: 0 },
        })
        .send();
      const allOwned = owners.value.every(
        (a) => a != null && allowed.has(a.owner as string),
      );
      if (!allOwned) continue; // not a prescribe ephemeral — leave it alone

      if (deactivationSlot === ACTIVE) {
        await sendAndConfirm({
          rpc,
          rpcSubscriptions,
          signer,
          commitment,
          computeUnitLimit: 30_000,
          instructions: [
            getDeactivateLookupTableInstruction({ address, authority: signer }),
          ],
        });
        deactivated += 1;
      } else if (currentSlot > deactivationSlot + COOLDOWN_SLOTS) {
        await sendAndConfirm({
          rpc,
          rpcSubscriptions,
          signer,
          commitment,
          computeUnitLimit: 30_000,
          instructions: [
            getCloseLookupTableInstruction({
              address,
              authority: signer,
              recipient: signer.address,
            }),
          ],
        });
        closed += 1;
      }
    } catch {
      // best-effort: a racing close / not-yet-cooled table just gets retried
      // on the next cleanup pass.
    }
  }
  return {
    deactivated,
    closed,
    candidates: candidates.size,
    scannedSignatures: sigs.length,
  };
}
