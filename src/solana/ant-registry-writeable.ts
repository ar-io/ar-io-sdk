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
 * Solana implementation of the ANT Registry write interface.
 *
 * This class owns the per-user paginated ACL surface (ADR-012). After
 * the on-chain hardening pass, the *primary* contract handlers
 * (`add_controller`, `remove_controller`, `transfer`) write the ACL
 * inline as part of their own instruction — Codama renders the ACL
 * accounts as required, so callers cannot bypass them. The registry's
 * job is therefore split in two:
 *
 *   1. **Preflight resolution.** Pick the right `AclConfig` + `AclPage`
 *      to pass for a record / remove operation, and emit the
 *      `register_acl_config` / `add_acl_page` ixs needed to bootstrap
 *      missing accounts. See `resolveDestinationAclAccounts` and
 *      `resolveSourceAclAccountsForEntry`.
 *   2. **Bulk maintenance.** For operations the contract can't bundle
 *      atomically (notably the variable-length ex-controller cleanup
 *      after a transfer, plus any caller-driven heal flows), expose
 *      `planAclMaintenance` + the standalone `record_acl_*` /
 *      `remove_acl_*` instruction builders. `SolanaANTWriteable`
 *      forwards an `aclOps` array to `sendTransaction` for these.
 *
 * Why the registry, not `SolanaANTWriteable`?
 *   The ACL is a per-user structure shared across every ANT a user
 *   touches, so the right home for the page-selection / preflight logic
 *   is the registry itself. `SolanaANTWriteable` composes a
 *   `SolanaANTRegistryWriteable` and delegates ACL planning to it.
 *
 * Per-user ACL layout (recap):
 *   - `AclConfig` head at `["acl_config", user]` tracks `page_count` +
 *     `total_entries`.
 *   - Each `AclPage` is a content-addressable PDA at
 *     `["acl_page", user, page_idx_le]` holding up to
 *     `MAX_ACL_PAGE_ENTRIES` `(asset, role)` tuples.
 *
 * NOTE: `register_acl_config` and `add_acl_page` are permissionless —
 * anyone can pay rent on behalf of any user. `payer` (the writeable
 * registry's signer) acts as the rent payer for everything bundled here.
 */
import {
  type Address,
  type Instruction,
  type TransactionSigner,
  address,
} from '@solana/kit';

import {
  getAddAclPageInstruction,
  getCloseAclConfigInstruction,
  getCloseAclPageInstruction,
  getRecordAclControllerInstructionAsync,
  getRecordAclOwnerInstructionAsync,
  getRegisterAclConfigInstruction,
  getRemoveAclControllerInstructionAsync,
  getRemoveAclOwnerInstructionAsync,
} from '@ar.io/solana-contracts/ant';
import type {
  ANTRegistryWrite,
  AclMaintenanceOp,
  AclMaintenanceRole,
} from '../types/ant-registry.js';
import type { MessageResult } from '../types/common.js';
import {
  type SolanaANTRegistryConfig,
  SolanaANTRegistryReadable,
} from './ant-registry-readable.js';
import {
  ACL_ROLE_CONTROLLER,
  ACL_ROLE_OWNER,
  MAX_ACL_PAGE_ENTRIES,
} from './constants.js';
import { deserializeAclConfig, deserializeAclPage } from './deserialize.js';
import {
  getAccountInfoLegacy,
  getMultipleAccountsInfoLegacy,
} from './json-rpc.js';
import { getAclConfigPDA, getAclPagePDA } from './pda.js';

export type SolanaANTRegistryWriteableConfig = SolanaANTRegistryConfig & {
  /** Pays rent on `register_acl_config` / `add_acl_page` and authorises ix bundles. */
  signer: TransactionSigner;
};

/** Map the cross-backend role string → on-chain `u8` byte. */
const ROLE_TO_BYTE: Record<AclMaintenanceRole, number> = {
  owner: ACL_ROLE_OWNER,
  controller: ACL_ROLE_CONTROLLER,
};

/**
 * Mutable, in-memory mirror of one user's on-chain paginated ACL. We
 * update the snapshot as we synthesise instructions so subsequent ops in
 * the same batch see the post-tx state and pick the same page the
 * contract will choose at execution time.
 */
type AclState = {
  exists: boolean;
  /** Pages indexed by `page_idx`. Sparse only if a future remove path leaves gaps. */
  pages: Map<bigint, { entries: { asset: string; role: number }[] }>;
  pageCount: bigint;
  /** Pending `add_acl_page` ixs emitted in this batch (so we don't double-emit). */
  pendingNewPages: Set<bigint>;
};

export class SolanaANTRegistryWriteable
  extends SolanaANTRegistryReadable
  implements ANTRegistryWrite
{
  protected readonly signer: TransactionSigner;

  constructor(config: SolanaANTRegistryWriteableConfig) {
    super(config);
    this.signer = config.signer;
  }

  // =========================================
  // Cross-backend `register` no-op (Solana populates the ACL lazily)
  // =========================================

  /**
   * The Solana ANT registry does not have a centralised "register" step —
   * `AclConfig` is created lazily the first time a user becomes an owner
   * or controller (via `register_acl_config`, which `planAclMaintenance`
   * emits automatically). This method exists only to satisfy the
   * cross-backend `ANTRegistryWrite` interface.
   */
  async register(_params: { processId: string }): Promise<MessageResult> {
    return { id: '' };
  }

  // =========================================
  // Preflight: resolve ACL accounts for inline contract handlers
  // =========================================

  /**
   * Pure PDA derivation — no RPC. Useful for callers that already
   * resolved the page via `resolveSourceAclAccountsForEntry` and need a
   * fallback PDA (e.g. `removeController` when the entry can't be found
   * but we still need to pass *some* page address to the contract so
   * the on-chain handler returns the right error).
   */
  async deriveAclConfigPda(user: Address): Promise<Address> {
    const [pda] = await getAclConfigPDA(user, this.antProgram);
    return pda;
  }

  /** Pure PDA derivation — see {@link deriveAclConfigPda}. */
  async deriveAclPagePda(user: Address, pageIdx: bigint): Promise<Address> {
    const [pda] = await getAclPagePDA(user, pageIdx, this.antProgram);
    return pda;
  }

  /**
   * Pick the `AclConfig` + destination `AclPage` to wire into a contract
   * handler that is about to **record** an entry for `user` (e.g.
   * `ario-ant::add_controller`, `ario-ant::transfer`'s new-owner side).
   *
   * Behaviour mirrors the planner's record path:
   *   - If `AclConfig(user)` does not exist yet, emit
   *     `register_acl_config` so the on-chain handler's seed-binding
   *     resolves.
   *   - If every existing `AclPage` is at `MAX_ACL_PAGE_ENTRIES`, emit
   *     `add_acl_page` for `page_idx == page_count` and use it as the
   *     destination.
   *   - Otherwise pick the **first non-full page** so density recovers
   *     after a `swap_remove` left a mid-life page sparse (see
   *     `docs/ACCOUNT_SCALING_PATTERNS.md` § Pattern C).
   *
   * Returns the resolved PDAs plus any prep ixs the caller must
   * **prepend** to the bundle. Idempotent: safe to call again on a
   * partially-bootstrapped ACL — only the missing prep ixs come back.
   *
   * The on-chain handler still validates `acl_config.user == user` and
   * the page seed binding, so a stale resolution simply fails the tx;
   * over-emission is bounded by the current page layout.
   */
  async resolveDestinationAclAccounts(params: { user: Address }): Promise<{
    aclConfigPda: Address;
    aclPagePda: Address;
    pageIdx: bigint;
    prepIxs: Instruction[];
  }> {
    const state = await this.loadAclState(params.user);
    const prepIxs: Instruction[] = [];

    if (!state.exists) {
      prepIxs.push(await this.buildRegisterAclConfigIx({ user: params.user }));
      state.exists = true;
    }

    let pageIdx = findPageWithRoom(state);
    if (pageIdx === null) {
      pageIdx = state.pageCount;
      prepIxs.push(
        await this.buildAddAclPageIx({ user: params.user, pageIdx }),
      );
    }

    const [aclConfigPda] = await getAclConfigPDA(params.user, this.antProgram);
    const [aclPagePda] = await getAclPagePDA(
      params.user,
      pageIdx,
      this.antProgram,
    );
    return { aclConfigPda, aclPagePda, pageIdx, prepIxs };
  }

  /**
   * Locate the `AclPage` that currently holds `(asset, role)` for
   * `user`, so a contract handler that is about to **remove** the entry
   * (`ario-ant::remove_controller`, `ario-ant::transfer`'s old-owner
   * side) can be wired with the right page accounts.
   *
   * Returns `null` if `user` has no `AclConfig` head or no matching
   * entry — callers that want strict semantics should treat that as "no
   * record to remove" and either skip the wrapped ix entirely (when the
   * primary mutation is also unnecessary) or fall back to the standalone
   * `remove_acl_*` heal flow.
   *
   * The on-chain handler does the strict check via `position_of` on
   * the supplied page, so a wrong / stale resolution fails the tx with
   * `AclEntryNotFound` rather than corrupting state.
   */
  async resolveSourceAclAccountsForEntry(params: {
    user: Address;
    asset: Address;
    role: AclMaintenanceRole;
  }): Promise<{
    aclConfigPda: Address;
    aclPagePda: Address;
    pageIdx: bigint;
  } | null> {
    const state = await this.loadAclState(params.user);
    if (!state.exists) return null;

    const roleByte = ROLE_TO_BYTE[params.role];
    const pageIdx = findPageContaining(state, params.asset, roleByte);
    if (pageIdx === null) return null;

    const [aclConfigPda] = await getAclConfigPDA(params.user, this.antProgram);
    const [aclPagePda] = await getAclPagePDA(
      params.user,
      pageIdx,
      this.antProgram,
    );
    return { aclConfigPda, aclPagePda, pageIdx };
  }

  // =========================================
  // Low-level instruction builders (1:1 with contract handlers)
  // =========================================
  //
  // Each helper closes over `this.antProgram` + `this.signer`, so call
  // sites inside `planAclMaintenance` (and any external consumer that
  // wants raw control) don't need to thread program id / payer through
  // every call. Page indices are `bigint` to match the on-chain `u64`
  // schema — see `docs/ACCOUNT_SCALING_PATTERNS.md` for why we
  // standardised on `u64` across paginated shapes.

  /**
   * Build a `register_acl_config` instruction. Permissionless: any wallet
   * can pay to bootstrap an ACL head for any user.
   */
  async buildRegisterAclConfigIx(params: {
    user: Address;
  }): Promise<Instruction> {
    const [aclConfig] = await getAclConfigPDA(params.user, this.antProgram);
    return getRegisterAclConfigInstruction(
      { aclConfig, payer: this.signer, user: params.user },
      { programAddress: this.antProgram },
    );
  }

  /**
   * Build an `add_acl_page` instruction that appends the next page (i.e.
   * page `page_count`) to a user's ACL. Caller must derive `pageIdx` from
   * a fresh read of `AclConfig.page_count` to avoid colliding with an
   * existing PDA — `planAclMaintenance` does this for you.
   */
  async buildAddAclPageIx(params: {
    user: Address;
    pageIdx: bigint;
  }): Promise<Instruction> {
    const [aclConfig] = await getAclConfigPDA(params.user, this.antProgram);
    const [aclPage] = await getAclPagePDA(
      params.user,
      params.pageIdx,
      this.antProgram,
    );
    return getAddAclPageInstruction(
      { aclConfig, aclPage, payer: this.signer },
      { programAddress: this.antProgram },
    );
  }

  /** Build a `record_acl_*` instruction for the given role. */
  async buildRecordIx(params: {
    user: Address;
    asset: Address;
    role: AclMaintenanceRole;
    pageIdx: bigint;
  }): Promise<Instruction> {
    const [aclConfig] = await getAclConfigPDA(params.user, this.antProgram);
    const [aclPage] = await getAclPagePDA(
      params.user,
      params.pageIdx,
      this.antProgram,
    );
    if (params.role === 'owner') {
      return getRecordAclOwnerInstructionAsync(
        { asset: params.asset, aclConfig, aclPage, payer: this.signer },
        { programAddress: this.antProgram },
      );
    }
    return getRecordAclControllerInstructionAsync(
      { asset: params.asset, aclConfig, aclPage, payer: this.signer },
      { programAddress: this.antProgram },
    );
  }

  /** Build a `remove_acl_*` instruction for the given role. */
  async buildRemoveIx(params: {
    user: Address;
    asset: Address;
    role: AclMaintenanceRole;
    pageIdx: bigint;
  }): Promise<Instruction> {
    const [aclConfig] = await getAclConfigPDA(params.user, this.antProgram);
    const [aclPage] = await getAclPagePDA(
      params.user,
      params.pageIdx,
      this.antProgram,
    );
    if (params.role === 'owner') {
      return getRemoveAclOwnerInstructionAsync(
        { asset: params.asset, aclConfig, aclPage, payer: this.signer },
        { programAddress: this.antProgram },
      );
    }
    return getRemoveAclControllerInstructionAsync(
      { asset: params.asset, aclConfig, aclPage, payer: this.signer },
      { programAddress: this.antProgram },
    );
  }

  /**
   * Close the trailing `AclPage` (must be the last page and empty).
   * Returns rent to `beneficiary`, which the on-chain handler enforces
   * equals `acl_config.user`.
   */
  async buildCloseAclPageIx(params: {
    user: Address;
    pageIdx: bigint;
    beneficiary: Address;
  }): Promise<Instruction> {
    const [aclConfig] = await getAclConfigPDA(params.user, this.antProgram);
    const [aclPage] = await getAclPagePDA(
      params.user,
      params.pageIdx,
      this.antProgram,
    );
    return getCloseAclPageInstruction(
      { aclConfig, aclPage, beneficiary: params.beneficiary },
      { programAddress: this.antProgram },
    );
  }

  /**
   * Close `AclConfig` once `page_count == 0` and `total_entries == 0`.
   * Returns rent to `beneficiary`, which must equal `acl_config.user`
   * on-chain.
   */
  async buildCloseAclConfigIx(params: {
    user: Address;
    beneficiary: Address;
  }): Promise<Instruction> {
    const [aclConfig] = await getAclConfigPDA(params.user, this.antProgram);
    return getCloseAclConfigInstruction(
      { aclConfig, beneficiary: params.beneficiary },
      { programAddress: this.antProgram },
    );
  }

  // =========================================
  // High-level workflow helpers
  // =========================================
  //
  // These wrap `planAclMaintenance` with domain language so call sites
  // never need to assemble raw `AclMaintenanceOp[]` arrays. The planner
  // is kept as a `protected` building block — useful for future bulk
  // flows but not part of the public surface.

  /**
   * Build the ACL ixs needed to bootstrap a freshly-spawned ANT's
   * paginated owner ACL. The on-chain `initialize` handler seeds
   * `ant_controllers = vec![owner]` (matches the Lua source), so the
   * owner is recorded under **both** roles: `Owner` (for "ANTs I own"
   * lookups) and `Controller` (for "ANTs I can manage" lookups).
   *
   * Returns the instructions in dependency order — `register_acl_config`
   * → `add_acl_page` → `record_acl_owner` → `record_acl_controller`.
   * Caller bundles them into the same tx as the MPL Core create + ANT
   * `initialize` ixs so the ACL is atomic with the spawn.
   */
  async bootstrapOwnerOnSpawn(params: {
    owner: Address;
    asset: Address;
  }): Promise<Instruction[]> {
    return this.planAclMaintenance([
      {
        action: 'record',
        role: 'owner',
        user: params.owner,
        asset: params.asset,
      },
      {
        action: 'record',
        role: 'controller',
        user: params.owner,
        asset: params.asset,
      },
    ]);
  }

  /**
   * Build the `remove_acl_controller` ixs needed to clean up an ANT's
   * ex-controller ACL entries after a transfer. The contract handler
   * for `transfer` cannot atomically `swap_remove` each ex-controller
   * (variable-length, no clean Codama representation), so the SDK
   * bundles them via this helper instead.
   *
   * Idempotent (skips controllers whose ACL entry is already absent),
   * so it's safe to call against a stale snapshot of `AntControllers`.
   */
  async bulkRemoveControllerEntries(params: {
    asset: Address;
    controllers: ReadonlyArray<string>;
  }): Promise<Instruction[]> {
    if (params.controllers.length === 0) return [];
    return this.planAclMaintenance(
      params.controllers.map((user) => ({
        action: 'remove' as const,
        role: 'controller' as const,
        user,
        asset: params.asset,
      })),
    );
  }

  // =========================================
  // Preflight planner (internal)
  // =========================================

  /**
   * Resolve an array of desired ACL mutations into the minimum
   * instruction set needed to make them happen. For each unique user:
   *   - reads the `AclConfig` head once (and all `AclPage`s in one
   *     `getMultipleAccountsInfo` round trip)
   *   - prepends `register_acl_config` if the head is missing AND any
   *     `action: 'record'` op targets that user
   *   - emits `add_acl_page` whenever the existing pages have no room
   *   - drops `action: 'record'` ops where the entry already exists (no-op)
   *   - drops `action: 'remove'` ops where the entry is already absent (no-op)
   *
   * Returned instructions preserve the dependency order:
   * `register_acl_config` → `add_acl_page` → record/remove ixs that
   * target the new page.
   *
   * Page selection on append: we fill the **first non-full page** so
   * density recovers naturally after a `swap_remove` made a mid-life
   * page sparse (see `docs/ACCOUNT_SCALING_PATTERNS.md` § Pattern C).
   *
   * `protected` so subclasses (and the workflow helpers above) can call
   * it, but external callers go through `bootstrapOwnerOnSpawn` /
   * `bulkRemoveControllerEntries` instead.
   */
  protected async planAclMaintenance(
    ops: AclMaintenanceOp[],
  ): Promise<Instruction[]> {
    if (ops.length === 0) return [];

    // Dedupe users to load each AclConfig at most once.
    const userKeys = new Map<string, Address>();
    for (const op of ops) {
      userKeys.set(op.user, address(op.user));
    }

    const states = new Map<string, AclState>();
    await Promise.all(
      Array.from(userKeys.entries()).map(async ([key, addr]) => {
        states.set(key, await this.loadAclState(addr));
      }),
    );

    const instructions: Instruction[] = [];
    const registered = new Set<string>();

    // First pass: prepend register_acl_config for any user with a
    // `record` op whose head does not yet exist. Mutate the cached state
    // so subsequent ops in this batch see the soon-to-exist config as
    // empty (not missing).
    for (const op of ops) {
      if (op.action !== 'record') continue;
      const state = states.get(op.user)!;
      if (!state.exists && !registered.has(op.user)) {
        instructions.push(
          await this.buildRegisterAclConfigIx({ user: address(op.user) }),
        );
        registered.add(op.user);
        state.exists = true;
      }
    }

    // Second pass: emit each mutation iff it would change observable
    // state. Pick a destination page per record op (filling the first
    // non-full page, emitting `add_acl_page` when needed) and target the
    // holding page for each remove op.
    for (const op of ops) {
      const state = states.get(op.user)!;
      const userAddr = address(op.user);
      const assetAddr = address(op.asset);
      const roleByte = ROLE_TO_BYTE[op.role];

      if (op.action === 'record') {
        // Idempotent: skip if the entry is already present somewhere.
        if (findPageContaining(state, op.asset, roleByte) !== null) continue;

        let pageIdx = findPageWithRoom(state);
        if (pageIdx === null) {
          pageIdx = state.pageCount;
          if (!state.pendingNewPages.has(pageIdx)) {
            instructions.push(
              await this.buildAddAclPageIx({ user: userAddr, pageIdx }),
            );
            state.pendingNewPages.add(pageIdx);
            state.pages.set(pageIdx, { entries: [] });
            state.pageCount += 1n;
          }
        }

        instructions.push(
          await this.buildRecordIx({
            user: userAddr,
            asset: assetAddr,
            role: op.role,
            pageIdx,
          }),
        );
        state.pages
          .get(pageIdx)!
          .entries.push({ asset: op.asset, role: roleByte });
        continue;
      }

      // action === 'remove'
      if (!state.exists) continue;
      const pageIdx = findPageContaining(state, op.asset, roleByte);
      if (pageIdx === null) continue;

      instructions.push(
        await this.buildRemoveIx({
          user: userAddr,
          asset: assetAddr,
          role: op.role,
          pageIdx,
        }),
      );
      // Mirror the on-chain `swap_remove`: drop the matching entry and
      // let the last entry in the page take its slot, so subsequent
      // `findPageContaining` lookups for that page remain correct.
      const page = state.pages.get(pageIdx)!;
      const i = page.entries.findIndex(
        (e) => e.asset === op.asset && e.role === roleByte,
      );
      if (i >= 0) {
        const last = page.entries.pop();
        if (last && i < page.entries.length) {
          page.entries[i] = last;
        }
      }
    }

    return instructions;
  }

  /** Load the head + every page for `user` in two RPC calls. */
  private async loadAclState(user: Address): Promise<AclState> {
    const [configPda] = await getAclConfigPDA(user, this.antProgram);
    const configAccount = await getAccountInfoLegacy(
      this.rpc,
      configPda,
      this.commitment,
    );
    if (!configAccount) {
      return {
        exists: false,
        pages: new Map(),
        pageCount: 0n,
        pendingNewPages: new Set(),
      };
    }
    const config = deserializeAclConfig(configAccount.data as Buffer);

    const pageAddresses: Address[] = [];
    for (let i = 0n; i < config.pageCount; i++) {
      const [pagePda] = await getAclPagePDA(user, i, this.antProgram);
      pageAddresses.push(pagePda);
    }
    const pageAccounts = await getMultipleAccountsInfoLegacy(
      this.rpc,
      pageAddresses,
      this.commitment,
    );

    const pages = new Map<
      bigint,
      { entries: { asset: string; role: number }[] }
    >();
    for (let i = 0; i < pageAccounts.length; i++) {
      const acct = pageAccounts[i];
      if (!acct) continue;
      const decoded = deserializeAclPage(acct.data as Buffer);
      pages.set(decoded.pageIdx, {
        entries: decoded.entries.map((e) => ({ asset: e.asset, role: e.role })),
      });
    }

    return {
      exists: true,
      pages,
      pageCount: config.pageCount,
      pendingNewPages: new Set(),
    };
  }
}

/**
 * Find the first page that has room for one more entry. Returns `null`
 * if every existing page is at `MAX_ACL_PAGE_ENTRIES` — caller emits an
 * `add_acl_page` and uses the new page idx instead.
 */
function findPageWithRoom(state: AclState): bigint | null {
  for (let i = 0n; i < state.pageCount; i++) {
    const page = state.pages.get(i);
    // Missing pages are treated as full so we don't accidentally "fill" a
    // page the program will reject. In practice this only happens if the
    // RPC returned partial results; the worst case is one extra
    // `add_acl_page` ix.
    if (!page) continue;
    if (page.entries.length < MAX_ACL_PAGE_ENTRIES) return i;
  }
  return null;
}

/** Find which page currently holds `(asset, role)`. */
function findPageContaining(
  state: AclState,
  asset: string,
  role: number,
): bigint | null {
  for (const [idx, page] of state.pages) {
    if (page.entries.some((e) => e.asset === asset && e.role === role))
      return idx;
  }
  return null;
}
