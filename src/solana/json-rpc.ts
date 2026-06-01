/**
 * Helpers for JSON-RPC reads against {@link SolanaRpc} that return a
 * web3.js-shaped `AccountInfo` (Buffer-backed `data`, plain Address strings).
 * Used by the ACL/AntRegistry path so the deserializers can stay agnostic of
 * the RPC client's response shape.
 */
import { type Address, type Commitment, address } from '@solana/kit';

import { withRetry } from './retry.js';
import type { SolanaRpc } from './types.js';

/** Raw account layout used by SDK readers (matches legacy web3 `AccountInfo` fields). */
export type SolanaAccountInfo = {
  data: Buffer;
  owner: Address;
  lamports: number;
  executable: boolean;
  rentEpoch: number;
};

/**
 * Map an arbitrary commitment string to one of kit's three supported tiers.
 * Anything we don't recognise (or `undefined`) falls back to `confirmed`,
 * which is the project-wide default for read paths.
 */
function toKitCommitment(commitment: string | undefined): Commitment {
  if (
    commitment === 'finalized' ||
    commitment === 'confirmed' ||
    commitment === 'processed'
  ) {
    return commitment;
  }
  return 'confirmed';
}

/**
 * Fetch a single account and decode its data into a Buffer-backed shape that
 * looks like the legacy `web3.js` `AccountInfo`. Returns `null` if the account
 * doesn't exist (so callers can handle "missing PDA" without try/catch).
 */
export async function getAccountInfoLegacy(
  rpc: SolanaRpc,
  pda: Address,
  commitment: string | undefined,
): Promise<SolanaAccountInfo | null> {
  const res = await withRetry(() =>
    rpc
      .getAccountInfo(pda, {
        encoding: 'base64',
        commitment: toKitCommitment(commitment),
      })
      .send(),
  );
  if (!res.value) return null;
  const [dataB64] = res.value.data;
  return {
    data: Buffer.from(dataB64, 'base64'),
    owner: address(res.value.owner),
    lamports: Number(res.value.lamports),
    executable: res.value.executable,
    rentEpoch: 0,
  };
}

/**
 * Fetch multiple accounts in a single RPC round-trip and decode each into
 * the legacy `AccountInfo` shape. Missing accounts come back as `null`,
 * preserving 1:1 alignment with the input `pdas` array.
 *
 * Used by paginated readers (ACL pages, etc.) to load all sibling pages
 * via `getMultipleAccountsInfo` rather than firing N parallel
 * `getAccountInfo` calls.
 */
export async function getMultipleAccountsInfoLegacy(
  rpc: SolanaRpc,
  pdas: Address[],
  commitment: string | undefined,
): Promise<(SolanaAccountInfo | null)[]> {
  if (pdas.length === 0) return [];
  const res = await withRetry(() =>
    rpc
      .getMultipleAccounts(pdas, {
        encoding: 'base64',
        commitment: toKitCommitment(commitment),
      })
      .send(),
  );
  return res.value.map((acct) => {
    if (!acct) return null;
    const [dataB64] = acct.data;
    return {
      data: Buffer.from(dataB64, 'base64'),
      owner: address(acct.owner),
      lamports: Number(acct.lamports),
      executable: acct.executable,
      rentEpoch: 0,
    } satisfies SolanaAccountInfo;
  });
}
