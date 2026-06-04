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
 * Solana implementation of `ANT.spawn`.
 *
 * Mints a fresh Metaplex Core asset (the ANT NFT) AND initializes the
 * `ario-ant` extended state PDAs (`AntConfig`, `AntControllers`, root `@`
 * record) in a single atomic transaction.
 *
 * This is the Solana counterpart to the legacy AO `spawnANT` flow:
 * - AO: `ao.spawn({ module, scheduler, ... })` → returns AO process id.
 * - Solana: mint MPL Core asset + initialize ario-ant PDAs → returns the
 *   asset's pubkey (which serves as the SDK's stable `processId`).
 *
 * For the bulk-import flow used by `migration/import` we use a separate
 * code path that mints to the migration authority and uses the gated
 * `import_account` instruction — that's intentional and not what this SDK
 * helper is for.
 */
import {
  type Address,
  type Commitment,
  type Instruction,
  type KeyPairSigner,
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

import { getInitializeInstructionAsync } from '@ar.io/solana-contracts/ant';
import {
  DataState,
  getCreateV1Instruction,
} from '@ar.io/solana-contracts/mpl-core';
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import { SolanaANTRegistryWriteable } from './ant-registry-writeable.js';
import { ARIO_ANT_PROGRAM_ID } from './constants.js';
import { getAntRecordPDA } from './pda.js';
import type {
  SolanaRpc,
  SolanaRpcSubscriptions,
  SolanaSigner,
} from './types.js';

/** AR.IO logo Arweave TX — matches the Rust default in `ario_ant::initialize`. */
export const ARIO_LOGO_TX_ID = 'AnYvLJTWcG9lr2Ll5MwYWZR2o5uTE39WbpYB0zCxwKM';

/**
 * Default Arweave transaction id used when an ANT is spawned without an
 * explicit `transactionId`. Empty string would fail the on-chain
 * `is_valid_arweave_id` check, so we fall back to the AR.IO logo TX (which is
 * a real Arweave id and won't trip validation).
 */
export const DEFAULT_ANT_TRANSACTION_ID = ARIO_LOGO_TX_ID;

export type SpawnSolanaANTState = {
  /** ANT display name (1–51 chars). */
  name: string;
  /** Optional ticker (defaults to "ANT" on chain). */
  ticker?: string;
  /**
   * Content target for the root `@` record (Arweave TX ID, IPFS CID, etc.).
   * Defaults to the AR.IO logo TX — callers that want a real pointer should
   * override this.
   */
  transactionId?: string;
  /**
   * Storage protocol for the root `@` record target.
   * 0 = Arweave (default), 1 = IPFS.
   */
  targetProtocol?: number;
  /** Logo TX id (43 chars). Defaults to the AR.IO logo. */
  logo?: string;
  /** Description (≤ 512 chars). */
  description?: string;
  /** Keywords (≤ 16 entries). */
  keywords?: string[];
  /**
   * Metadata URI baked into the MPL Core asset (`uri` field). Defaults to
   * `ar://{logo}` — wallets resolve `ar://{txId}` to `https://arweave.net/{txId}`.
   */
  uri?: string;
};

export type SpawnSolanaANTParams = {
  /** RPC client used to fetch a recent blockhash + send the spawn transaction. */
  rpc: SolanaRpc;
  /** RPC subscriptions client — required to confirm the transaction. */
  rpcSubscriptions: SolanaRpcSubscriptions;
  /** Solana signer — pays rent + receives the NFT. */
  signer: SolanaSigner;
  /** ANT metadata for the new asset. `name` is the only required field. */
  state: SpawnSolanaANTState;
  /** Override the deployed `ario-ant` program id (devnet/localnet only). */
  antProgramId?: Address;
  /**
   * Pre-derived mint signer. Useful for tests that want a deterministic
   * asset address. When omitted a fresh random keypair signer is generated.
   */
  mintSigner?: KeyPairSigner;
  /** Confirmation commitment for the resulting tx. Defaults to 'confirmed'. */
  commitment?: Commitment;
  /** CU limit for the bundled tx. Defaults to 400_000 (matches existing writes). */
  computeUnitLimit?: number;
};

export type SpawnSolanaANTResult = {
  /**
   * SDK-canonical ANT identifier on Solana — this is the MPL Core asset's
   * pubkey (base58). Pass it back into `ANT.init({ backend: 'solana',
   * processId, ... })` to drive subsequent reads/writes.
   */
  processId: string;
  /** Same value as `processId`, as an `Address` for convenience. */
  mint: Address;
  /** Confirmed transaction signature. */
  signature: string;
};

/** A single on-chain `Attributes` plugin entry. */
export type AntAttribute = { key: string; value: string };

/**
 * Public, low-level builder for the `CreateV1` MPL Core instruction with the
 * AR.IO-standard ANT shape (Attributes plugin pre-installed, Owner authority).
 *
 * Delegates to the Codama-generated `getCreateV1Instruction`, but accepts
 * plain `Address`es (rather than full `TransactionSigner`s) so test fixtures
 * and devnet validation scripts can byte-pin the wire format without
 * standing up real keypairs. The signer roles still flow through correctly
 * because we re-cast under `unknown`.
 *
 * Most callers should use `ANT.spawn` / `spawnSolanaANT` instead — that path
 * also wires up `ario_ant::initialize` so the ANT is fully usable end to end.
 * Use this raw builder when you need fine-grained control over signing, or
 * are bundling the mint into a larger compound transaction.
 *
 * **Why we always emit an Attributes plugin (even with an empty list):**
 * `ario_arns::buy_record` and friends CPI into `UpdatePluginV1` to populate
 * traits at purchase time. If the asset has no Attributes plugin, that CPI
 * fails. Emitting an empty plugin here keeps every spawned ANT
 * `purchase`-ready and matches what `migration/import` mints — see ADR-012
 * and BD-096. Authority is `Owner` so the ANT NFT holder (= asset owner)
 * can sign their own trait updates.
 */
export function buildCreateAntInstruction({
  mint,
  authority,
  payer,
  name,
  uri,
  attributes = [],
}: {
  mint: Address;
  authority: Address;
  payer: Address;
  name: string;
  uri: string;
  attributes?: AntAttribute[];
}): Instruction {
  // Codama wants TransactionSigners for asset/authority/payer because the
  // resulting account meta is marked SIGNER. The byte-pinning surface we're
  // exposing only cares about pubkeys + wire bytes, so we adapt by feeding
  // it minimal signer-shaped objects.
  const asSigner = (a: Address) =>
    ({ address: a, signTransactions: () => Promise.resolve([]) }) as never;
  return getCreateV1Instruction({
    asset: asSigner(mint),
    authority: asSigner(authority),
    payer: asSigner(payer),
    dataState: DataState.AccountState,
    name,
    uri,
    plugins: [
      {
        plugin: {
          __kind: 'Attributes',
          fields: [{ attributeList: attributes }],
        },
        authority: { __kind: 'Owner' },
      },
    ],
  });
}

/**
 * Build the `ario_ant::initialize` instruction for a freshly minted asset.
 */
async function buildInitializeAntIx({
  programId,
  mint,
  signer,
  state,
}: {
  programId: Address;
  mint: Address;
  signer: SolanaSigner;
  state: Required<Pick<SpawnSolanaANTState, 'name'>> &
    Pick<
      SpawnSolanaANTState,
      | 'ticker'
      | 'transactionId'
      | 'targetProtocol'
      | 'logo'
      | 'description'
      | 'keywords'
    >;
}): Promise<Instruction> {
  // Codama auto-resolves antConfig + antControllers PDAs. rootRecord uses a
  // hashed-undername seed Codama can't infer from args, so we derive it here.
  const [rootRecordPda] = await getAntRecordPDA(mint, '@', programId);
  return getInitializeInstructionAsync(
    {
      asset: mint,
      rootRecord: rootRecordPda,
      owner: signer,
      name: state.name,
      ticker: state.ticker ?? null,
      target: state.transactionId ?? DEFAULT_ANT_TRANSACTION_ID,
      targetProtocol: state.targetProtocol ?? null,
      logo: state.logo ?? '',
      description: state.description ?? '',
      keywords: state.keywords ?? [],
    },
    { programAddress: programId },
  );
}

/**
 * Spawn a brand-new ANT on Solana. Returns the asset address, which is the
 * SDK's stable `processId` for that ANT.
 */
export async function spawnSolanaANT(
  params: SpawnSolanaANTParams,
): Promise<SpawnSolanaANTResult> {
  if (!params.state?.name || params.state.name.length === 0) {
    throw new Error('spawnSolanaANT: state.name is required');
  }

  const {
    rpc,
    rpcSubscriptions,
    signer,
    state,
    antProgramId = ARIO_ANT_PROGRAM_ID,
    commitment = 'confirmed',
    computeUnitLimit = 400_000,
  } = params;

  const mintSigner = params.mintSigner ?? (await generateKeyPairSigner());
  const owner = signer.address;
  const mint = mintSigner.address;

  const uri =
    state.uri ??
    `ar://${state.logo && state.logo.length > 0 ? state.logo : ARIO_LOGO_TX_ID}`;

  // Emit the Attributes plugin (Owner authority) at mint time with the
  // asset-side `ANT Program` entry pre-installed. Two reasons to always
  // include it:
  //
  //   1. ADR-016 / BD-100 — the program managing this asset's per-mint
  //      state PDAs is named on the asset itself. Writing it here means
  //      every fresh ANT carries an explicit, queryable program id from
  //      the moment it's minted; resolvers can read it without a lookup
  //      against any external registry.
  //   2. The Attributes plugin must already exist before
  //      `ario_arns::buy_name` CPIs into `UpdatePluginV1` to populate
  //      ARNS Name / Type / Undername Limit. Skipping this returns
  //      MPL Core 0x4 ("Plugin not found") at ArNS purchase time.
  //
  // Default value is the canonical `ARIO_ANT_PROGRAM_ID`; passing
  // `antProgramId` opts into the BYO-ANT (third-party) path.
  const createIx = getCreateV1Instruction({
    asset: mintSigner,
    payer: signer,
    authority: signer,
    dataState: DataState.AccountState,
    name: state.name,
    uri,
    plugins: [
      {
        plugin: {
          __kind: 'Attributes',
          fields: [
            {
              attributeList: [
                { key: 'ANT Program', value: antProgramId as string },
              ],
            },
          ],
        },
        authority: { __kind: 'Owner' },
      },
    ],
  });

  const initIx = await buildInitializeAntIx({
    programId: antProgramId,
    mint,
    signer,
    state,
  });

  // ADR-012 (ACL): bootstrap the new owner's paginated ACL. The
  // contract's `initialize` handler seeds `ant_controllers = vec![owner]`
  // (matches the Lua source), so the owner needs entries under both
  // `Owner` (for "ANTs I own" lookups) and `Controller` (for "ANTs I
  // can manage" lookups). Bundling here keeps the ACL atomic with the
  // spawn — by the time the tx confirms, frontends can resolve the
  // owner's ANT list via the head config + paged accounts.
  const registry = new SolanaANTRegistryWriteable({
    rpc,
    signer,
    commitment,
    antProgramId,
  });
  const aclIxs = await registry.bootstrapOwnerOnSpawn({
    owner,
    asset: mint,
  });

  // The create instruction has two signers (mint + authority+payer). Kit picks
  // them up from the account metadata roles: accounts marked as SIGNER roles
  // must have a matching `TransactionSigner` attached. We do that by placing
  // the mint signer on the message alongside the fee payer signer.
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction({ units: computeUnitLimit }),
          // Pin the priority fee (at 0) so wallets like Phantom don't
          // silently append their own compute-budget instructions and
          // invalidate the paired mint keypair signer's signature. See
          // `sendAndConfirm` in `./send.js` for the full rationale.
          getSetComputeUnitPriceInstruction({ microLamports: 0n }),
          createIx,
          initIx,
          ...aclIxs,
        ],
        tx,
      ),
  );

  // Attach the mint signer so kit can satisfy the WRITABLE_SIGNER role on the
  // mint account. `addSignersToTransactionMessage` walks the message's account
  // metas and registers each matching signer by address, which is what
  // `signTransactionMessageWithSigners` then looks up to produce signatures.
  const withMintSigner = addSignersToTransactionMessage([mintSigner], message);

  const signedTx = await signTransactionMessageWithSigners(withMintSigner);
  const sendAndConfirmFactory = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });
  await sendAndConfirmFactory(signedTx as never, { commitment });

  return {
    processId: mint as string,
    mint,
    signature: getSignatureFromTransaction(signedTx) as string,
  };
}
