/**
 * Cluster-specific deployment constants for AR.IO programs.
 *
 * Mainnet IDs are baked into the IDL at codegen time and surfaced via the
 * placeholder constants in `./constants.ts` (e.g. `ARIO_CORE_PROGRAM_ID`).
 * This module exposes the same values for *other* clusters where the
 * programs are deployed at non-default addresses — primarily devnet.
 *
 * Source of truth: `/devnet-config.json` at the repo root. Keep these
 * exports in sync when devnet is redeployed; the bundled drift test
 * (`clusters.test.ts`) will fail CI on mismatch.
 *
 * Usage:
 * ```ts
 * import { ARIO } from '@ar.io/sdk';
 * import { DEVNET_PROGRAM_IDS, DEVNET_RPC_URL } from '@ar.io/sdk/solana';
 * import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
 *
 * const rpc = createSolanaRpc(DEVNET_RPC_URL);
 * const rpcSubscriptions = createSolanaRpcSubscriptions(
 *   DEVNET_RPC_URL.replace(/^https/, 'wss'),
 * );
 * const ario = ARIO.init({
 *   backend: 'solana',
 *   rpc,
 *   rpcSubscriptions,
 *   programIds: DEVNET_PROGRAM_IDS,
 * });
 * ```
 */
import { type Address, address } from '@solana/kit';

/**
 * Default JSON-RPC URL for the Solana devnet cluster.
 *
 * Public devnet rate-limits aggressively — for high-volume work, swap in
 * a premium RPC (QuickNode / Helius / Triton). Derive the WS URL with
 * `DEVNET_RPC_URL.replace(/^https/, 'wss')`.
 */
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

/**
 * AR.IO program IDs deployed on Solana devnet.
 *
 * Shape matches the `programIds` argument of
 * `ARIO.init({ backend: 'solana', programIds, ... })`.
 *
 * `antEscrow` is `null` because `ario-ant-escrow` is not deployed on
 * devnet — the `sol_big_mod_exp` syscall it depends on is inactive on
 * all public clusters today.
 */
export const DEVNET_PROGRAM_IDS = {
  core: address('83CQLP848zzCgnZ4LTq87g6hvxTooNLX7YXXkUUGv5ig'),
  gar: address('AF8QAEaR4hzsqeUDwEdeTXMYtdyFegTENBdnJro6WVLR'),
  arns: address('2HgSCKYjcapJPdHRKqkLrGXm7kvBmCP45ZyhWEm87oM1'),
  ant: address('8ZMuXhiK7DorjPUg8RB1rzu7CvsABMk38WDJRbM62y2C'),
  antEscrow: null as Address | null,
} as const;

/** ARIO SPL Token mint on devnet. */
export const DEVNET_ARIO_MINT: Address = address(
  'BZ3nczDe8To3c39eN7Beq9FW34BveUcEs9sDNkbGxn4U',
);

/** Protocol treasury token account on devnet (owner = ArioConfig PDA). */
export const DEVNET_TREASURY_TOKEN_ACCOUNT: Address = address(
  'WLh1PNwSg5QstPeATJxD21cb6wvYkj4ibQetkz5RTn3',
);

/** Protocol stake token account on devnet (owner = GatewaySettings PDA). */
export const DEVNET_STAKE_TOKEN_ACCOUNT: Address = address(
  '6vV7qQTf8Bv6SVagLKMSj3dnK7Vv9uaiujpMsHTJ2onF',
);
