/**
 * Anchor error assertion helper for SDK e2e tests.
 *
 * Codes come straight from Codama's emitted error files under
 * `sdk/src/solana/generated/<program>/errors/<program>.ts`. Each error
 * is exported as a SCREAMING_SNAKE constant of the form
 * `ARIO_<PROGRAM>_ERROR__<NAME>`. The names are deterministic from the
 * IDL — never hand-maintained, never wrong.
 *
 * Anchor adds an offset of 6000 to every custom error code. Each program
 * has its own enum starting at 6000, so codes can collide numerically
 * across programs (e.g., `RecordExpired` in arns and
 * `PrimaryNameAlreadySet` in core both land in the 6000-range). The
 * SCREAMING_SNAKE prefix (`ARIO_ARNS_ERROR__` / `ARIO_CORE_ERROR__`)
 * disambiguates at the call site:
 *
 *   import { ARIO_ARNS_ERROR__INVALID_NAME_FORMAT } from
 *     '../helpers/errors.js';
 *   await expectAnchorError(p, ARIO_ARNS_ERROR__INVALID_NAME_FORMAT);
 *
 * Re-generate after any `anchor build` that changes a program's
 * error enum: `yarn codegen` (no separate script needed).
 */
// Re-export every Codama-emitted error constant so test files can import
// from a stable path (`test/helpers/errors.js`) instead of reaching into
// the generated tree directly.
export * from '@ar.io/solana-contracts/ant';
export * from '@ar.io/solana-contracts/ant-escrow';
export * from '@ar.io/solana-contracts/arns';
export * from '@ar.io/solana-contracts/core';
export * from '@ar.io/solana-contracts/gar';

const ANCHOR_ERROR_CODE_OFFSET = 6000;

/**
 * Assert that a promise rejects with the given Anchor program error code.
 *
 * Pass numeric codes from the per-program namespaces above. Hex codes
 * from on-chain logs (`custom program error: 0x178b`) match the
 * decimal `6000 + n` format directly.
 */
export async function expectAnchorError<T>(
  promise: Promise<T>,
  expectedCode: number,
): Promise<void> {
  let result: T | undefined;
  let caught: unknown;
  try {
    result = await promise;
  } catch (e) {
    caught = e;
  }
  if (caught === undefined) {
    throw new Error(
      `expectAnchorError(${expectedCode}): promise resolved with ${JSON.stringify(
        result,
      )}, expected rejection`,
    );
  }

  const code = extractAnchorCode(caught);
  if (code === null) {
    throw new Error(
      `expectAnchorError(${expectedCode}): promise rejected, but couldn't ` +
        `extract an Anchor error code from the thrown value. Raw error: ` +
        `${stringifyError(caught)}`,
    );
  }
  if (code !== expectedCode) {
    throw new Error(
      `expectAnchorError: expected ${expectedCode} (0x${expectedCode.toString(
        16,
      )}), got ${code} (0x${code.toString(16)}). Raw error: ` +
        `${stringifyError(caught)}`,
    );
  }
}

/**
 * Walk the thrown value looking for an Anchor custom error code.
 *
 * Shapes seen in practice:
 *   - `SendTransactionError` (web3.js): `error.transactionLogs`
 *     contains `Program ... failed: custom program error: 0x1772`.
 *   - kit's `SolanaError`: nested `cause.context.code`.
 *   - JSON-RPC unwrap: `{ InstructionError: [_, { Custom: number }] }`.
 *   - Re-wrapped SDK error: walk the cause chain.
 *
 * Returns the raw decimal code, or null if none could be extracted.
 */
function extractAnchorCode(err: unknown): number | null {
  let cur: unknown = err;
  for (let depth = 0; depth < 10 && cur != null; depth++) {
    if (typeof cur === 'object') {
      const obj = cur as Record<string, unknown>;
      const ctx = obj.context as Record<string, unknown> | undefined;
      if (ctx && typeof ctx.code === 'number') return ctx.code;
      if (typeof obj.code === 'number') return obj.code;
      const logs = obj.transactionLogs as string[] | undefined;
      if (Array.isArray(logs)) {
        for (const line of logs) {
          const m = line.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
          if (m) return Number.parseInt(m[1], 16);
        }
      }
      const instrErr = (obj as { InstructionError?: unknown[] })
        .InstructionError;
      if (Array.isArray(instrErr) && instrErr.length === 2) {
        const inner = instrErr[1] as { Custom?: number };
        if (inner && typeof inner.Custom === 'number') return inner.Custom;
      }
      cur = (obj as { cause?: unknown }).cause;
      continue;
    }
    if (typeof cur === 'string') {
      const m = cur.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
      if (m) return Number.parseInt(m[1], 16);
    }
    break;
  }
  const stringified = stringifyError(err);
  const m = stringified.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
  if (m) return Number.parseInt(m[1], 16);
  return null;
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n${err.stack ?? ''}`;
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

export { ANCHOR_ERROR_CODE_OFFSET };
