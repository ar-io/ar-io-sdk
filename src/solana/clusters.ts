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
 * Cluster-specific deployment constants for AR.IO programs.
 *
 * The program-ID constants in `./constants.ts` (e.g. `ARIO_CORE_PROGRAM_ID`)
 * are codama *placeholders* (`ARioCoreProgramXXX…`), not real on-chain
 * addresses — consumers must pass real IDs via `ARIO.init({ programIds })`.
 * This module exposes the deployed sets per cluster: `MAINNET_PROGRAM_IDS`
 * and `DEVNET_PROGRAM_IDS`.
 *
 * Only root facts live here: program IDs, the RPC URL, and the ARIO mint.
 * Everything else is derived rather than stored — config/settings PDAs come
 * from the codama `find*Pda` helpers in `@ar.io/solana-contracts` (seeded by
 * the program IDs below), and genesis-time token accounts (treasury / stake)
 * are read on-chain from the ArioConfig / GarSettings accounts at runtime
 * (see `io-writeable.ts` `getGarConfig`). Nothing to keep in sync, nothing to
 * drift.
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
 * Default JSON-RPC URL for Solana mainnet-beta.
 *
 * The public endpoint rate-limits aggressively — for production use a premium
 * RPC (QuickNode / Helius / Triton). Derive the WS URL with
 * `MAINNET_RPC_URL.replace(/^https/, 'wss')`.
 */
export const MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';

/**
 * Default JSON-RPC URL for the Solana devnet cluster.
 *
 * Public devnet rate-limits aggressively — for high-volume work, swap in
 * a premium RPC (QuickNode / Helius / Triton). Derive the WS URL with
 * `DEVNET_RPC_URL.replace(/^https/, 'wss')`.
 */
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

/**
 * AR.IO program IDs deployed on Solana mainnet-beta.
 *
 * Shape matches the `programIds` argument of
 * `ARIO.init({ backend: 'solana', programIds, ... })`.
 */
export const MAINNET_PROGRAM_IDS = {
  core: address('73YoECm6NKXpVRoe5f1Q9BcP5DJGPFUjnFy6AxBE5Nvh'),
  gar: address('89fNiiwgpFSPHKuqfNUkgYTYjtAJAhyqHjXmgXeppGpf'),
  arns: address('2yCUx5edFvUrkibYaUa2ZXWyx9kuJkS8CwyzsgHPWdZZ'),
  ant: address('2MWexMHfMhGJwMHv9Qm9YAVCqjUFUJwDJAysW4oCUGk5'),
  antEscrow: address('5HZhe9UqKL5zAsdz81nuuaxV41h8bFhudzxxBigAQndM'),
} as const;

/**
 * Mainnet attestor pubkey — the key that signs cross-protocol attestations
 * (e.g. escrow recipient proofs). Deployment metadata; not consumed by the
 * SDK, exposed here for reference/verification by downstream tooling.
 */
export const MAINNET_ATTESTOR_PUBKEY: Address = address(
  '7XtUnotZAeYZNzVSYV5nb7S9YH9qHXyVFM6NeNMu6efE',
);

/**
 * Mainnet upgrade/admin authority pubkey — holds the upgrade authority for
 * the programs above. Deployment metadata; not consumed by the SDK, exposed
 * here for reference.
 */
export const MAINNET_AUTHORITY_PUBKEY: Address = address(
  '45ZuEb1Jk7pbjshD1BVasBekAXhimdWuJjyswQzMyTB1',
);

// TODO(mainnet): placeholder — this reuses the devnet mint and is WRONG for
// mainnet. Replace with the real mainnet ARIO mint once it is known.
/** ARIO SPL Token mint on Solana mainnet-beta. */
export const MAINNET_ARIO_MINT: Address = address(
  '6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN',
);

/**
 * AR.IO program IDs deployed on Solana devnet (staging).
 *
 * Shape matches the `programIds` argument of
 * `ARIO.init({ backend: 'solana', programIds, ... })`.
 */
export const DEVNET_PROGRAM_IDS = {
  core: address('8Njx9wPkXiNzDCgjwVsJFRjpAEV34gGW3n8DzX3V23m1'),
  gar: address('7WsDTrtZBsfKtnP33XkjuqXCY69JE7n4QVYpynqJCFxz'),
  arns: address('6EZNezcg4rc5hnh8HG34vGquT3WpW5xXypzPb24uyEpp'),
  ant: address('DbHbRwUD1oAn1mrDSqtWtvwGcNrmhWdD2g8L4xmeQ7NX'),
  antEscrow: address('bttco5oAnBwCucG63iKokBJCZmNr493f3Ewe9LM3oTx'),
} as const;

/** ARIO SPL Token mint on devnet (Staging v2). */
export const DEVNET_ARIO_MINT: Address = address(
  '6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN',
);
