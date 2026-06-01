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
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

import type { SolanaRpc, SolanaRpcSubscriptions } from './types.js';

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
  addressLookupTables,
}: {
  rpc: SolanaRpc;
  rpcSubscriptions: SolanaRpcSubscriptions;
  signer: TransactionSigner;
  instructions: Instruction[];
  commitment?: Commitment;
  computeUnitLimit?: number;
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
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const baseMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction({ units: computeUnitLimit }),
          // Always pin the priority fee (even at 0) so wallets like Phantom
          // don't silently *append* their own compute-budget instructions
          // when the transaction is missing either limit or price. That
          // mutation invalidates signatures already attached by paired
          // keypair signers (e.g. the ANT mint signer in `spawnSolanaANT`),
          // producing `Transaction did not pass signature verification` on
          // the validator. Pre-supplying both keeps the wallet from
          // rewriting the message, so signatures over the original bytes
          // still verify.
          getSetComputeUnitPriceInstruction({ microLamports: 0n }),
          ...instructions,
        ],
        tx,
      ),
  );

  // Compress against any supplied lookup tables (v0). No-op when none given.
  const message = addressLookupTables
    ? compressTransactionMessageUsingAddressLookupTables(
        baseMessage,
        addressLookupTables as never,
      )
    : baseMessage;

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
