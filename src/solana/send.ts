/**
 * Shared helpers for building, signing, and sending Solana transactions
 * with @solana/kit. Used by SolanaARIOWriteable and SolanaANTWriteable.
 */
import {
  type Address,
  type Commitment,
  type Instruction,
  type TransactionSigner,
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

import type { SolanaRpc, SolanaRpcSubscriptions } from './types.js';

const COMPUTE_BUDGET_PROGRAM: Address = address(
  'ComputeBudget111111111111111111111111111111',
);

/**
 * Build a `SetComputeUnitLimit` instruction.
 *
 * Layout (per solana-program/compute-budget):
 *   [0]     u8 = 2  (discriminator for SetComputeUnitLimit)
 *   [1..5]  u32 LE = units
 */
export function setComputeUnitLimitIx(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  // u32 little-endian
  data[1] = units & 0xff;
  data[2] = (units >>> 8) & 0xff;
  data[3] = (units >>> 16) & 0xff;
  data[4] = (units >>> 24) & 0xff;
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM,
    accounts: [],
    data,
  };
}

/**
 * Build a `SetComputeUnitPrice` instruction.
 *
 * Layout (per solana-program/compute-budget):
 *   [0]     u8 = 3  (discriminator for SetComputeUnitPrice)
 *   [1..9]  u64 LE = micro-lamports per compute unit
 *
 * We always prepend this (alongside `SetComputeUnitLimit`) before sending,
 * even with a 0 priority fee. Wallets like Phantom will silently *append*
 * their own compute-budget instructions when the transaction is missing
 * either, and that mutation invalidates any signatures already attached by
 * paired keypair signers (e.g. the ANT mint signer in `spawnSolanaANT`),
 * producing `Transaction did not pass signature verification` on the
 * validator. Pre-supplying both keeps the wallet from rewriting the
 * message, so signatures over the original bytes still verify.
 */
export function setComputeUnitPriceIx(
  microLamports: bigint | number,
): Instruction {
  const lamports =
    typeof microLamports === 'bigint' ? microLamports : BigInt(microLamports);
  const data = new Uint8Array(9);
  data[0] = 3;
  // u64 little-endian
  let v = lamports;
  for (let i = 0; i < 8; i++) {
    data[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM,
    accounts: [],
    data,
  };
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
}: {
  rpc: SolanaRpc;
  rpcSubscriptions: SolanaRpcSubscriptions;
  signer: TransactionSigner;
  instructions: Instruction[];
  commitment?: Commitment;
  computeUnitLimit?: number;
}): Promise<string> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      appendTransactionMessageInstructions(
        [
          setComputeUnitLimitIx(computeUnitLimit),
          // Always pin the priority fee (even at 0) so wallets like Phantom
          // don't silently append their own compute-budget instructions and
          // invalidate paired keypair-signer signatures. See
          // `setComputeUnitPriceIx` doc comment for the full story.
          setComputeUnitPriceIx(0n),
          ...instructions,
        ],
        tx,
      ),
  );

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
