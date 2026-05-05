/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Solana implementation of the ANT Registry read interface.
 *
 * Backed by the per-user paginated ACL (ADR-012): a head `AclConfig` PDA
 * and N content-addressable `AclPage` PDAs, each holding up to
 * `MAX_ACL_PAGE_ENTRIES` `(asset, role)` tuples. Frontends can fetch a
 * user's ANTs in two RPC calls — one `getAccountInfo` for `AclConfig` plus
 * one `getMultipleAccountsInfo` for every page — instead of a
 * `getProgramAccounts` scan, a DAS provider, or a foundation-hosted
 * indexer.
 *
 * Usage:
 * ```ts
 * import { createSolanaRpc } from '@solana/kit';
 * import { ANTRegistry } from '@ar.io/sdk';
 *
 * const registry = ANTRegistry.init({
 *   backend: 'solana',
 *   rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
 * });
 *
 * const { Owned, Controlled } = await registry.accessControlList({
 *   address: 'SomeSolanaWalletAddress...',
 * });
 * ```
 *
 * When a user has no on-chain `AclConfig` (never registered / not yet
 * populated), both lists return empty. The write path (SDK ANT write
 * methods + migration tooling) is responsible for keeping the ACL in sync
 * as owners / controllers change.
 */
import { type Address, type Commitment, address } from '@solana/kit';

import { type ILogger, Logger } from '../common/logger.js';
import type { AoANTRegistryRead } from '../types/ant-registry.js';
import {
  ACL_ROLE_CONTROLLER,
  ACL_ROLE_OWNER,
  ARIO_ANT_PROGRAM_ID,
} from './constants.js';
import { deserializeAclConfig, deserializeAclPage } from './deserialize.js';
import {
  getAccountInfoLegacy,
  getMultipleAccountsInfoLegacy,
} from './json-rpc.js';
import { getAclConfigPDA, getAclPagePDA } from './pda.js';
import type { SolanaRpc } from './types.js';

export type SolanaANTRegistryConfig = {
  rpc: SolanaRpc;
  commitment?: Commitment;
  logger?: ILogger;
  /**
   * Override the ario-ant program ID. Required against any cluster other
   * than mainnet — devnet, localnet, and the Surfpool harness all deploy
   * programs at addresses derived from per-cluster keypair files.
   */
  antProgramId?: Address;
};

export class SolanaANTRegistryReadable implements AoANTRegistryRead {
  protected readonly rpc: SolanaRpc;
  protected readonly commitment: Commitment;
  /** Deployed `ario-ant` program id this registry talks to. */
  readonly antProgram: Address;
  protected readonly logger: ILogger;

  constructor(config: SolanaANTRegistryConfig) {
    this.rpc = config.rpc;
    this.commitment = config.commitment ?? 'confirmed';
    this.antProgram = config.antProgramId ?? ARIO_ANT_PROGRAM_ID;
    this.logger = config.logger ?? Logger.default;
  }

  /**
   * Read a user's `AclConfig` head plus every `AclPage` and return owned +
   * controlled ANT mint lists. Returns empty lists if the head PDA does not
   * exist yet.
   *
   * **Note:** This is an eventually-consistent secondary index, not a
   * canonical source of truth. Marketplace transfers update NFT ownership
   * on-chain immediately but the ACL is only updated when someone calls
   * `record_acl_owner` / `remove_acl_owner`. For real-time accuracy on a
   * specific ANT, check the Metaplex Core asset owner directly.
   */
  async accessControlList({
    address: addr,
  }: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }> {
    const userAddr = address(addr);
    const [configPda] = await getAclConfigPDA(userAddr, this.antProgram);

    this.logger.debug?.('Fetching AclConfig PDA', {
      address: addr,
      pda: configPda,
    });

    const configAccount = await getAccountInfoLegacy(
      this.rpc,
      configPda,
      this.commitment,
    );
    if (!configAccount) {
      this.logger.debug?.('AclConfig not found — returning empty lists', {
        address: addr,
      });
      return { Owned: [], Controlled: [] };
    }

    const config = deserializeAclConfig(configAccount.data as Buffer);
    if (config.pageCount === 0n) {
      return { Owned: [], Controlled: [] };
    }

    // Derive every page PDA up-front, then load them in a single
    // `getMultipleAccountsInfo` round trip.
    const pageAddrs: Address[] = [];
    for (let i = 0n; i < config.pageCount; i++) {
      const [pagePda] = await getAclPagePDA(userAddr, i, this.antProgram);
      pageAddrs.push(pagePda);
    }
    const pageAccounts = await getMultipleAccountsInfoLegacy(
      this.rpc,
      pageAddrs,
      this.commitment,
    );

    const owned: string[] = [];
    const controlled: string[] = [];
    for (const acct of pageAccounts) {
      if (!acct) continue;
      const page = deserializeAclPage(acct.data as Buffer);
      for (const entry of page.entries) {
        if (entry.role === ACL_ROLE_OWNER) owned.push(entry.asset);
        else if (entry.role === ACL_ROLE_CONTROLLER)
          controlled.push(entry.asset);
      }
    }

    return { Owned: owned, Controlled: controlled };
  }

  /**
   * Cleaner alias for `accessControlList` — matches the AO backend so
   * consumers can switch backends without renaming calls.
   */
  async getAntsForAddress({
    address,
  }: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }> {
    return this.accessControlList({ address });
  }
}
