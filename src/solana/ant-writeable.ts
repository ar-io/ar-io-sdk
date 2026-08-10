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
 * Solana implementation of ANT (Arweave Name Token) write interface.
 *
 * Extends SolanaANTReadable with write operations that build and send
 * Solana transactions to the ario-ant program.
 *
 * All instruction encoding is delegated to the Codama-generated builders in
 * `./generated/ant/instructions/` — they own the discriminator + Borsh codec
 * + account-meta wiring derived from the on-chain IDL.
 *
 * ACL maintenance (ADR-012, paginated per-user ACL):
 *   The on-chain handlers for `add_controller`, `remove_controller`, and
 *   `transfer` *require* the controller / new-owner / old-owner ACL
 *   accounts as instruction inputs and write the ACL inline as part of
 *   the same atomic ix. This SDK's job is therefore reduced to two
 *   things:
 *     1. **Preflight resolution** — ask the composed
 *        `SolanaANTRegistryWriteable` to pick the right page and emit
 *        any `register_acl_config` / `add_acl_page` ixs that need to be
 *        prepended so the contract's account validation succeeds.
 *     2. **Ex-controller cleanup on transfer** — a wrapped transfer
 *        cannot atomically `swap_remove` every ex-controller's ACL
 *        entry (variable cardinality, no clean way to express variadic
 *        accounts in Codama). The SDK reads the controllers list and
 *        delegates to `registry.bulkRemoveControllerEntries`, which
 *        produces the right `remove_acl_controller` ixs to append into
 *        the transfer tx. Permissionless heal flows clean up any drift
 *        if a marketplace transfer bypasses this SDK entirely.
 */
import {
  type Address,
  type Commitment,
  type Instruction,
  address,
} from '@solana/kit';

import {
  getAddControllerInstructionAsync,
  getMigrateAntInstructionAsync,
  getReconcileInstructionAsync,
  getRemoveControllerInstructionAsync,
  getRemoveRecordInstructionAsync,
  getSetDescriptionInstructionAsync,
  getSetKeywordsInstructionAsync,
  getSetLogoInstructionAsync,
  getSetNameInstructionAsync,
  getSetRecordInstructionAsync,
  getSetRecordMetadataInstructionAsync,
  getSetTickerInstructionAsync,
  getTransferInstructionAsync,
  getTransferRecordInstructionAsync,
} from '@ar.io/solana-contracts/ant';
import type { ILogger } from '../common/logger.js';
import type { ANTRegistryRead } from '../types/ant-registry.js';
import type {
  ANTSetBaseNameRecordParams,
  ANTSetUndernameRecordParams,
} from '../types/ant.js';
import type { MessageResult, WriteOptions } from '../types/common.js';
import { SolanaANTReadable } from './ant-readable.js';
import { SolanaANTRegistryWriteable } from './ant-registry-writeable.js';
import {
  deserializeAntConfig,
  deserializeAntControllers,
} from './deserialize.js';
import { getAccountInfoLegacy } from './json-rpc.js';
import {
  getAntConfigPDA,
  getAntControllersPDA,
  getAntRecordMetadataPDA,
  getAntRecordPDA,
} from './pda.js';
import { sendAndConfirm } from './send.js';
import type {
  SolanaRpc,
  SolanaRpcSubscriptions,
  SolanaSigner,
} from './types.js';

/**
 * Solana-backed read-write client for a single ANT (Arweave Name Token).
 *
 * Usage:
 * ```ts
 * import { createSolanaRpc, createSolanaRpcSubscriptions, createKeyPairSignerFromBytes } from '@solana/kit';
 * import { SolanaANTWriteable } from '@ar.io/sdk/solana';
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 * const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com');
 * const signer = await createKeyPairSignerFromBytes(secretKeyBytes);
 * const ant = new SolanaANTWriteable({
 *   rpc,
 *   rpcSubscriptions,
 *   processId: 'MetaplexCoreAssetAddress...',
 *   signer,
 * });
 *
 * await ant.setRecord({ undername: 'docs', transactionId: '...', ttlSeconds: 3600 });
 * ```
 */
export class SolanaANTWriteable extends SolanaANTReadable {
  protected readonly signer: SolanaSigner;
  protected readonly rpcSubscriptions: SolanaRpcSubscriptions;
  /**
   * Override the readable's registry with the writeable variant — gives
   * us the preflight resolvers + the spawn / ex-controller workflow
   * helpers, while preserving `accessControlList` reads from the
   * parent's `ANTRegistryRead` surface.
   */
  declare readonly registry: SolanaANTRegistryWriteable & ANTRegistryRead;

  constructor(config: {
    rpc: SolanaRpc;
    rpcSubscriptions: SolanaRpcSubscriptions;
    processId: string;
    signer: SolanaSigner;
    commitment?: Commitment;
    logger?: ILogger;
    antProgramId?: Address;
    /**
     * Pre-built writeable registry to compose. When omitted we build one
     * from `rpc` / `signer` / `commitment` / `antProgramId` so the simple
     * single-arg call site keeps working.
     */
    registry?: SolanaANTRegistryWriteable;
  }) {
    const registry =
      config.registry ??
      new SolanaANTRegistryWriteable({
        rpc: config.rpc,
        signer: config.signer,
        commitment: config.commitment,
        logger: config.logger,
        antProgramId: config.antProgramId,
      });
    super({ ...config, registry });
    this.signer = config.signer;
    this.rpcSubscriptions = config.rpcSubscriptions;
  }

  /**
   * Build, sign, and send a transaction.
   *
   * Plain pass-through to `sendAndConfirm` — every ANT write whose ACL
   * footprint is bounded (controllers add/remove, owner swap on
   * transfer) is handled inline by the contract handlers. Variable-
   * length cleanup (notably ex-controller wipe after transfer) is
   * pre-built by the caller via `registry.bulkRemoveControllerEntries`
   * and appended into the same `instructions` array, so this method
   * doesn't need its own ACL plumbing.
   */
  protected async sendTransaction(
    instructions: Instruction[],
  ): Promise<string> {
    return sendAndConfirm({
      rpc: this.rpc,
      rpcSubscriptions: this.rpcSubscriptions,
      signer: this.signer,
      instructions,
      commitment: this.commitment,
      computeUnitLimit: 400_000,
    });
  }

  // =========================================
  // Record operations
  // =========================================

  async setRecord(
    params: ANTSetUndernameRecordParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const [recordPda] = await getAntRecordPDA(
      this.mint,
      params.undername,
      this.antProgram,
    );

    // Per-record metadata (display name / logo / description / keywords)
    // moved out of `set_record` into a dedicated `set_record_metadata`
    // instruction when `AntRecord` was split (ARNS-712). These fields are
    // not part of `ANTSetUndernameRecordParams` today, but we keep the
    // forward path here so callers can pass them on the params object and
    // we'll bundle a `set_record_metadata` ix into the same tx.
    const extra = params as unknown as {
      displayName?: string;
      logo?: string;
      description?: string;
      keywords?: string[];
    };

    const ixs: Instruction[] = [];

    ixs.push(
      await getSetRecordInstructionAsync(
        {
          asset: this.mint,
          record: recordPda,
          caller: this.signer,
          undername: params.undername,
          target: params.transactionId,
          targetProtocol: params.targetProtocol ?? 0,
          ttlSeconds: params.ttlSeconds,
          priority: params.priority ?? null,
          recordOwner: params.owner ? address(params.owner) : null,
        },
        { programAddress: this.antProgram },
      ),
    );

    const hasMetadata =
      extra.displayName !== undefined ||
      extra.logo !== undefined ||
      extra.description !== undefined ||
      extra.keywords !== undefined;
    if (hasMetadata) {
      const [metadataPda] = await getAntRecordMetadataPDA(
        this.mint,
        params.undername,
        this.antProgram,
      );
      ixs.push(
        await getSetRecordMetadataInstructionAsync(
          {
            asset: this.mint,
            record: recordPda,
            recordMetadata: metadataPda,
            caller: this.signer,
            undername: params.undername,
            displayName: extra.displayName ?? null,
            recordLogo: extra.logo ?? null,
            recordDescription: extra.description ?? null,
            recordKeywords: extra.keywords ?? null,
          },
          { programAddress: this.antProgram },
        ),
      );
    }

    const sig = await this.sendTransaction(ixs);
    return { id: sig };
  }

  async setBaseNameRecord(
    params: ANTSetBaseNameRecordParams,
    options?: WriteOptions,
  ): Promise<MessageResult> {
    return this.setRecord({ ...params, undername: '@' }, options);
  }

  async setUndernameRecord(
    params: ANTSetUndernameRecordParams,
    options?: WriteOptions,
  ): Promise<MessageResult> {
    return this.setRecord(params, options);
  }

  async removeRecord(
    params: { undername: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const [recordPda] = await getAntRecordPDA(
      this.mint,
      params.undername,
      this.antProgram,
    );
    const ix = await getRemoveRecordInstructionAsync(
      {
        asset: this.mint,
        record: recordPda,
        caller: this.signer,
      },
      { programAddress: this.antProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async removeUndernameRecord(
    params: { undername: string },
    options?: WriteOptions,
  ): Promise<MessageResult> {
    return this.removeRecord(params, options);
  }

  async transferRecord(
    params: { undername: string; recipient: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const [recordPda] = await getAntRecordPDA(
      this.mint,
      params.undername,
      this.antProgram,
    );
    const ix = await getTransferRecordInstructionAsync(
      {
        asset: this.mint,
        record: recordPda,
        caller: this.signer,
        newOwner: address(params.recipient),
      },
      { programAddress: this.antProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // =========================================
  // Controller operations
  // =========================================

  async addController(
    params: { controller: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const controller = address(params.controller);

    // ADR-012 (ACL): contract `add_controller` requires the controller's
    // `AclConfig` + a destination `AclPage` and writes the
    // `record_controller` entry inline. Resolve them here and prepend
    // any `register_acl_config` / `add_acl_page` bootstrap ixs needed
    // for first-time controllers.
    const dest = await this.registry.resolveDestinationAclAccounts({
      user: controller,
    });

    const addIx = await getAddControllerInstructionAsync(
      {
        asset: this.mint,
        caller: this.signer,
        controller,
        controllerAclConfig: dest.aclConfigPda,
        controllerAclPage: dest.aclPagePda,
      },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([...dest.prepIxs, addIx]);
    return { id: sig };
  }

  async removeController(
    params: { controller: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const controller = address(params.controller);

    // ADR-012 (ACL): contract `remove_controller` requires the page
    // currently holding `(asset, Controller)`. Resolve via the
    // registry; if the entry can't be found we still pass page 0 as a
    // placeholder so the on-chain handler surfaces `AclEntryNotFound`
    // (or, more likely, the page-belongs check fails first) rather
    // than us silently swallowing the removal.
    const source = await this.registry.resolveSourceAclAccountsForEntry({
      user: controller,
      asset: this.mint,
      role: 'controller',
    });
    const aclConfigPda =
      source?.aclConfigPda ??
      (await this.registry.deriveAclConfigPda(controller));
    const aclPagePda =
      source?.aclPagePda ??
      (await this.registry.deriveAclPagePda(controller, 0n));

    const removeIx = await getRemoveControllerInstructionAsync(
      {
        asset: this.mint,
        caller: this.signer,
        controller,
        controllerAclConfig: aclConfigPda,
        controllerAclPage: aclPagePda,
      },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([removeIx]);
    return { id: sig };
  }

  // =========================================
  // Metadata operations
  // =========================================

  async setName(
    params: { name: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getSetNameInstructionAsync(
      { asset: this.mint, caller: this.signer, name: params.name },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async setTicker(
    params: { ticker: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getSetTickerInstructionAsync(
      { asset: this.mint, caller: this.signer, ticker: params.ticker },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async setDescription(
    params: { description: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getSetDescriptionInstructionAsync(
      {
        asset: this.mint,
        caller: this.signer,
        description: params.description,
      },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async setKeywords(
    params: { keywords: string[] },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getSetKeywordsInstructionAsync(
      { asset: this.mint, caller: this.signer, keywords: params.keywords },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async setLogo(
    params: { txId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getSetLogoInstructionAsync(
      { asset: this.mint, caller: this.signer, logo: params.txId },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // =========================================
  // Transfer (wrapped ario_ant::transfer — CPI into MPL Core +
  // inline reconcile + inline owner ACL swap)
  // =========================================

  async transfer(
    params: { target: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const newOwner = address(params.target);
    const oldOwner = this.signer.address;

    // Resolve the new owner's destination ACL accounts (and bootstrap
    // them if missing). The contract requires a non-full page; the
    // registry preflight emits `register_acl_config` / `add_acl_page`
    // ixs so the wrapped `transfer` ix's account validation succeeds.
    const newOwnerDest = await this.registry.resolveDestinationAclAccounts({
      user: newOwner,
    });

    // Resolve the old owner's source ACL accounts. If the entry is
    // missing (e.g. the ANT was acquired via a marketplace transfer or
    // before the ACL system existed), heal it by bootstrapping the
    // config/page and recording the owner entry so the on-chain
    // transfer handler can successfully remove it.
    const oldOwnerSource = await this.registry.resolveSourceAclAccountsForEntry(
      {
        user: oldOwner,
        asset: this.mint,
        role: 'owner',
      },
    );

    let oldOwnerAclConfigPda: Address;
    let oldOwnerAclPagePda: Address;
    const oldOwnerHealIxs: Instruction[] = [];

    if (oldOwnerSource) {
      oldOwnerAclConfigPda = oldOwnerSource.aclConfigPda;
      oldOwnerAclPagePda = oldOwnerSource.aclPagePda;
    } else {
      const dest = await this.registry.resolveDestinationAclAccounts({
        user: oldOwner,
      });
      oldOwnerAclConfigPda = dest.aclConfigPda;
      oldOwnerAclPagePda = dest.aclPagePda;
      oldOwnerHealIxs.push(...dest.prepIxs);
      oldOwnerHealIxs.push(
        await this.registry.buildRecordIx({
          user: oldOwner,
          asset: this.mint,
          role: 'owner',
          pageIdx: dest.pageIdx,
        }),
      );
    }

    const transferIx = await getTransferInstructionAsync(
      {
        asset: this.mint,
        caller: this.signer,
        newOwner,
        newOwnerAclConfig: newOwnerDest.aclConfigPda,
        newOwnerAclPage: newOwnerDest.aclPagePda,
        oldOwnerAclConfig: oldOwnerAclConfigPda,
        oldOwnerAclPage: oldOwnerAclPagePda,
      },
      { programAddress: this.antProgram },
    );

    // Ex-controller cleanup. The wrapped contract handler clears
    // `AntControllers` via inline reconcile, but it cannot atomically
    // `swap_remove` each ex-controller's ACL entry (variable-length;
    // accounts can't be cleanly variadic in Codama). Read the live
    // controllers list before the transfer and let the registry build
    // the cleanup ixs — same-tx so frontends never see a stale "I
    // control this ANT" entry. Permissionless heal flows clean up any
    // drift if a marketplace transfer bypasses this SDK entirely.
    const [controllersPda] = await getAntControllersPDA(
      this.mint,
      this.antProgram,
    );
    const controllersAccount = await getAccountInfoLegacy(
      this.rpc,
      controllersPda,
      this.commitment,
    );
    const exControllers = controllersAccount
      ? deserializeAntControllers(controllersAccount.data as Buffer).controllers
      : [];
    const cleanupIxs = await this.registry.bulkRemoveControllerEntries({
      asset: this.mint,
      controllers: exControllers,
    });

    const sig = await this.sendTransaction([
      ...oldOwnerHealIxs,
      ...newOwnerDest.prepIxs,
      transferIx,
      ...cleanupIxs,
    ]);
    return { id: sig };
  }

  // =========================================
  // Reconcile (Solana-specific)
  // =========================================

  async reconcile(_options?: WriteOptions): Promise<MessageResult> {
    const ix = await getReconcileInstructionAsync(
      { asset: this.mint, caller: this.signer },
      { programAddress: this.antProgram },
    );
    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  /**
   * Heal the per-user ACL after the asset was acquired out-of-band (e.g. a
   * raw Metaplex Core marketplace/UI transfer that bypassed {@link transfer},
   * so none of the SDK's inline ACL maintenance ran).
   *
   * The caller MUST be the asset's current MPL Core owner — every ix here is
   * permissionless but the contract verifies the on-chain relationship, so a
   * non-holder simply produces a failing tx; we pre-check to fail fast with a
   * clear error instead.
   *
   * In a single tx it:
   *   1. `reconcile`s `AntConfig.last_known_owner` to the live NFT owner and
   *      clears the now-stale `AntControllers` list;
   *   2. records the caller's `owner` ACL entry (bootstrapping their
   *      `AclConfig` / `AclPage` if absent) — this is what makes the ANT show
   *      up in "ANTs I own" lookups (`getArNSRecordsForAddress`,
   *      `ANTRegistry.accessControlList`);
   *   3. removes the previous owner's stale `owner` ACL entry (if any);
   *   4. removes the ex-controllers' stale `controller` ACL entries.
   *
   * Unlike {@link reconcile} (which only touches `AntConfig`/`AntControllers`)
   * and {@link SolanaARIOWriteable.syncAttributes} (which only rewrites the
   * asset's Attributes-plugin traits), this reconciles the paginated ACL that
   * the registry/record reverse-indexes read from. Idempotent: a no-drift
   * call records nothing new and the remove ixs no-op against absent entries.
   */
  async syncAcl(_options?: WriteOptions): Promise<MessageResult> {
    const caller = this.signer.address;

    // Fail fast if the caller isn't the live NFT owner — every inner ix would
    // otherwise abort on its on-chain ownership check.
    const { fetchMplCoreOwner } = await import('./mpl-core.js');
    const nftOwner = await fetchMplCoreOwner(this.rpc, this.mint, {
      commitment: this.commitment,
    });
    if (nftOwner === null) {
      throw new Error(`MPL Core asset ${this.mint} not found.`);
    }
    if (nftOwner !== caller) {
      throw new Error(
        `Cannot sync ACL: ${caller} is not the current owner of ANT ` +
          `${this.mint} (owner is ${nftOwner}).`,
      );
    }

    // Snapshot the pre-reconcile owner + controllers so we know whose stale
    // ACL entries to remove (reconcile clears `AntControllers` mid-tx).
    const [configPda] = await getAntConfigPDA(this.mint, this.antProgram);
    const configAccount = await getAccountInfoLegacy(
      this.rpc,
      configPda,
      this.commitment,
    );
    const previousOwner = configAccount
      ? deserializeAntConfig(configAccount.data as Buffer).owner
      : null;

    const [controllersPda] = await getAntControllersPDA(
      this.mint,
      this.antProgram,
    );
    const controllersAccount = await getAccountInfoLegacy(
      this.rpc,
      controllersPda,
      this.commitment,
    );
    const exControllers = controllersAccount
      ? deserializeAntControllers(controllersAccount.data as Buffer).controllers
      : [];

    const ixs: Instruction[] = [];

    // 1. reconcile `AntConfig` / clear `AntControllers` (no-op if unchanged).
    ixs.push(
      await getReconcileInstructionAsync(
        { asset: this.mint, caller: this.signer },
        { programAddress: this.antProgram },
      ),
    );

    // 2. record the caller's owner ACL entry (bootstrap config/page if needed).
    const dest = await this.registry.resolveDestinationAclAccounts({
      user: caller,
    });
    ixs.push(...dest.prepIxs);
    ixs.push(
      await this.registry.buildRecordIx({
        user: caller,
        asset: this.mint,
        role: 'owner',
        pageIdx: dest.pageIdx,
      }),
    );

    // 3. remove the previous owner's stale owner entry, if one exists.
    if (previousOwner && previousOwner !== caller) {
      const source = await this.registry.resolveSourceAclAccountsForEntry({
        user: address(previousOwner),
        asset: this.mint,
        role: 'owner',
      });
      if (source) {
        ixs.push(
          await this.registry.buildRemoveIx({
            user: address(previousOwner),
            asset: this.mint,
            role: 'owner',
            pageIdx: source.pageIdx,
          }),
        );
      }
    }

    // 4. remove ex-controllers' stale controller entries (reconcile above
    //    cleared the canonical list; this heals the reverse index).
    ixs.push(
      ...(await this.registry.bulkRemoveControllerEntries({
        asset: this.mint,
        controllers: exControllers,
      })),
    );

    const sig = await this.sendTransaction(ixs);
    return { id: sig };
  }

  // =========================================
  // AO-specific methods (not applicable on Solana)
  // =========================================

  async releaseName(
    _params: { name: string; arioProcessId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    throw new Error(
      'releaseName not applicable on Solana — use ario-arns program directly',
    );
  }

  async reassignName(
    _params: { name: string; arioProcessId: string; antProcessId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    throw new Error(
      'reassignName not applicable on Solana — use ario-arns program directly',
    );
  }

  async approvePrimaryNameRequest(
    _params: { name: string; address: string; arioProcessId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    throw new Error(
      'approvePrimaryNameRequest not applicable on Solana — use ario-core program directly',
    );
  }

  async removePrimaryNames(
    _params: { names: string[]; arioProcessId: string; notifyOwners?: boolean },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    throw new Error(
      'removePrimaryNames not applicable on Solana — use ario-core program directly',
    );
  }

  /**
   * Migrate this ANT's on-chain state to the latest schema version.
   * On Solana, "upgrade" means per-ANT data migration, not process forking.
   * Returns the transaction signature if migration was needed.
   */
  async upgrade(
    _params?: any,
  ): Promise<{ id: string; needsMigration: boolean }> {
    const needs = await this.needsMigration();
    if (!needs) {
      return { id: '', needsMigration: false };
    }

    const ix = await getMigrateAntInstructionAsync(
      { asset: this.mint, payer: this.signer },
      { programAddress: this.antProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig, needsMigration: true };
  }
}
