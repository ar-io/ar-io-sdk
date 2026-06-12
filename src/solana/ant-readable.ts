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
 * Solana implementation of ANT (Arweave Name Token) read interface.
 *
 * Reads ANT state from Metaplex Core NFT + PDA accounts on Solana.
 * Each ANT is a Metaplex Core NFT with extended state in PDAs:
 *   - AntConfig: name, ticker, logo, description, keywords, owner
 *   - AntControllers: list of controller pubkeys
 *   - AntRecord: undername records (transactionId, ttl, priority, etc.)
 */
import {
  type Address,
  type Commitment,
  address,
  fetchEncodedAccount,
  fetchEncodedAccounts,
} from '@solana/kit';
import bs58 from 'bs58';

import { createHash as __createHash } from 'crypto';
import {
  ANT_RECORD_DISCRIMINATOR,
  ANT_RECORD_METADATA_DISCRIMINATOR,
  decodeAntConfig,
  decodeAntControllers,
  getAntRecordDecoder,
  getAntRecordMetadataDecoder,
} from '@ar.io/solana-contracts/ant';
import { type ILogger, Logger } from '../common/logger.js';
import type {
  ANTHandler,
  ANTInfo,
  ANTRecord,
  ANTState,
  ANTSummary,
  AntReadOptions,
  SortedANTRecords,
} from '../types/ant.js';
import type { WalletAddress } from '../types/common.js';
import type { GasEstimate } from '../types/io.js';
import { SolanaANTRegistryReadable } from './ant-registry-readable.js';
import { ANT_CONFIG_VERSION, ARIO_ANT_PROGRAM_ID } from './constants.js';
import {
  ACL_BOOTSTRAP_ACCOUNT_BYTES,
  ANT_RECORD_BYTES,
  estimateRentLamports,
  spawnAntAccountBytes,
} from './gas.js';
import {
  getAclConfigPDA,
  getAntConfigPDA,
  getAntControllersPDA,
  getAntRecordMetadataPDA,
  getAntRecordPDA,
} from './pda.js';
import { withRetry } from './retry.js';
import { estimateGasFee } from './send.js';
import type { SolanaRpc } from './types.js';

/**
 * Solana-backed read-only client for a single ANT (Arweave Name Token).
 *
 * Usage:
 * ```ts
 * import { createSolanaRpc } from '@solana/kit';
 * import { SolanaANTReadable } from '@ar.io/sdk/solana';
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 * const ant = new SolanaANTReadable({
 *   rpc,
 *   processId: 'MetaplexCoreAssetAddress...',
 * });
 *
 * const owner = await ant.getOwner();
 * const record = await ant.getRecord({ undername: '@' });
 * ```
 */
export class SolanaANTReadable {
  readonly processId: string;
  protected readonly rpc: SolanaRpc;
  protected readonly commitment: Commitment;
  protected readonly logger: ILogger;
  protected readonly antProgram: Address;
  protected readonly mint: Address;
  /**
   * Composed registry instance — the source of truth for the per-user
   * paginated ACL (ADR-012). Sharing one instance across the read and
   * write classes keeps program id / commitment / RPC configuration
   * coherent for both `accessControlList` reads and the maintenance
   * planner used during writes.
   */
  readonly registry: SolanaANTRegistryReadable;

  constructor(config: {
    rpc: SolanaRpc;
    processId: string;
    commitment?: Commitment;
    logger?: ILogger;
    antProgramId?: Address;
    /**
     * Pre-built registry to compose. When omitted we build a readable
     * registry from `rpc` / `commitment` / `antProgramId` so the simple
     * "just give me an ANT" call path keeps working with a single arg.
     */
    registry?: SolanaANTRegistryReadable;
  }) {
    this.processId = config.processId;
    this.rpc = config.rpc;
    this.commitment = config.commitment ?? 'confirmed';
    this.logger = config.logger ?? Logger.default;
    this.antProgram = config.antProgramId ?? ARIO_ANT_PROGRAM_ID;
    this.mint = address(config.processId);
    this.registry =
      config.registry ??
      new SolanaANTRegistryReadable({
        rpc: this.rpc,
        commitment: this.commitment,
        logger: this.logger,
        antProgramId: this.antProgram,
      });
  }

  /**
   * Build a `SolanaANTReadable` whose program id is read from the
   * asset's `ANT Program` Attributes-plugin entry (ADR-016 / BD-100).
   *
   * Falls back to the canonical `ARIO_ANT_PROGRAM_ID` when the asset
   * has no plugin section, no `ANT Program` trait, or any layer of the
   * walk fails to decode — matching the on-chain leniency in
   * `programs/ario-core/src/mpl_core.rs::read_ant_program`. This is the
   * factory resolution paths should reach for: it does the asset fetch
   * once, hands the resulting program id to the constructor, and
   * shares one `SolanaANTRegistryReadable` instance with the new ANT.
   *
   * Use the plain constructor when the program id is already known
   * (e.g. inside a freshly-spawned ANT flow where you've just minted
   * the asset and know the program you targeted).
   */
  static async fromAsset(config: {
    rpc: SolanaRpc;
    processId: string;
    commitment?: Commitment;
    logger?: ILogger;
  }): Promise<SolanaANTReadable> {
    const { fetchAntProgramFromAsset } = await import('./mpl-core.js');
    const mint = address(config.processId);
    const fromAsset = await fetchAntProgramFromAsset(config.rpc, mint, {
      commitment: config.commitment ?? 'confirmed',
    });
    return new SolanaANTReadable({
      rpc: config.rpc,
      processId: config.processId,
      commitment: config.commitment,
      logger: config.logger,
      antProgramId: fromAsset ?? ARIO_ANT_PROGRAM_ID,
    });
  }

  private async getAccount(pda: Address) {
    return withRetry(() =>
      fetchEncodedAccount(this.rpc, pda, {
        commitment: this.commitment,
      }),
    );
  }

  // =========================================
  // Config reads
  // =========================================

  private async fetchConfig() {
    const [pda] = await getAntConfigPDA(this.mint, this.antProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`ANT config not found for ${this.processId}`);
    }
    const decoded = decodeAntConfig(account).data;
    return {
      mint: decoded.mint as string,
      name: decoded.name,
      ticker: decoded.ticker,
      logo: decoded.logo,
      description: decoded.description,
      keywords: decoded.keywords,
      owner: decoded.lastKnownOwner as string,
      version: decoded.version.major,
    };
  }

  private async fetchControllers() {
    const [pda] = await getAntControllersPDA(this.mint, this.antProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      return { mint: this.processId, controllers: [] as string[] };
    }
    const decoded = decodeAntControllers(account).data;
    return {
      mint: decoded.mint as string,
      controllers: decoded.controllers.map((c) => c as string),
    };
  }

  /**
   * Fetch AntConfig + AntControllers in a single `getMultipleAccounts` round
   * trip (instead of two single-account reads). Used by `getState` to shave one
   * RPC per ANT — meaningful when a UI loads many ANTs.
   */
  private async _fetchConfigAndControllers() {
    const [[configPda], [controllersPda]] = await Promise.all([
      getAntConfigPDA(this.mint, this.antProgram),
      getAntControllersPDA(this.mint, this.antProgram),
    ]);
    const [configAccount, controllersAccount] = await withRetry(() =>
      fetchEncodedAccounts(this.rpc, [configPda, controllersPda], {
        commitment: this.commitment,
      }),
    );
    if (!configAccount.exists) {
      throw new Error(`ANT config not found for ${this.processId}`);
    }
    const decodedConfig = decodeAntConfig(configAccount).data;
    const config = {
      mint: decodedConfig.mint as string,
      name: decodedConfig.name,
      ticker: decodedConfig.ticker,
      logo: decodedConfig.logo,
      description: decodedConfig.description,
      keywords: decodedConfig.keywords,
      owner: decodedConfig.lastKnownOwner as string,
      version: decodedConfig.version.major,
    };
    const controllers = controllersAccount.exists
      ? decodeAntControllers(controllersAccount).data.controllers.map(
          (c) => c as string,
        )
      : [];
    return { config, controllers };
  }

  async getOwner(_opts?: AntReadOptions): Promise<WalletAddress> {
    const config = await this.fetchConfig();
    return config.owner;
  }

  /**
   * Estimate the Solana network cost ("gas") of an ANT management action,
   * in lamports — transaction fees plus rent for accounts the action
   * creates, and (for closes) the rent refunded back to the caller.
   *
   * - `set-record` (add/edit undername): creating the record deposits rent
   *   (~0.0022 SOL); editing an existing record costs fees only, but this
   *   quote conservatively assumes creation.
   * - `remove-record`: the record account (and its metadata PDA, if any) is
   *   CLOSED and its actual on-chain deposit refunded to the caller —
   *   reported in `rentReclaimedLamports`, read live from the chain.
   * - `transfer`: the caller pays to bootstrap the RECIPIENT's ACL
   *   registry accounts (~0.06 SOL) when the recipient has never owned an
   *   ANT; otherwise fees only. Removed ACL entries don't refund rent —
   *   pages stay open.
   * - `reassign-name`: mutates the ArNS record in place; fees only.
   *
   * Never throws on the quote path: fee and rent queries fall back
   * internally, and the recipient-ACL check falls back to the conservative
   * (bootstrap-needed) assumption.
   */
  async getGasEstimate(
    params:
      | { workflow: 'set-record'; undername: string }
      // Editing an existing record mutates in place — fees only.
      | { workflow: 'edit-record'; undername: string }
      | { workflow: 'remove-record'; undername: string }
      | { workflow: 'transfer'; recipient: WalletAddress }
      // `spawnsNewAnt` covers the "reassign to a brand-new ANT" flow,
      // which spawns a fresh asset first (rent for the spawned accounts;
      // `name` sizes the name-bearing ones).
      | { workflow: 'reassign-name'; spawnsNewAnt?: boolean; name?: string },
  ): Promise<GasEstimate> {
    switch (params.workflow) {
      case 'set-record': {
        const rentLamports = await estimateRentLamports(this.rpc, [
          ANT_RECORD_BYTES,
        ]);
        return estimateGasFee(this.rpc, { rentLamports });
      }
      case 'remove-record': {
        // Exact, not modeled: the close refunds whatever the record account
        // actually holds, so read its (and the metadata PDA's) lamports.
        let rentReclaimedLamports = 0;
        try {
          const [[recordPda], [metaPda]] = await Promise.all([
            getAntRecordPDA(this.mint, params.undername, this.antProgram),
            getAntRecordMetadataPDA(
              this.mint,
              params.undername,
              this.antProgram,
            ),
          ]);
          const accounts = await withRetry(() =>
            fetchEncodedAccounts(this.rpc, [recordPda, metaPda], {
              commitment: this.commitment,
            }),
          );
          rentReclaimedLamports = accounts.reduce(
            (sum, a) => (a.exists ? sum + Number(a.lamports) : sum),
            0,
          );
        } catch {
          // Quote stays fees-only; the refund still happens on chain.
        }
        return estimateGasFee(this.rpc, { rentReclaimedLamports });
      }
      case 'transfer': {
        let needsAclBootstrap = true;
        try {
          const [aclPda] = await getAclConfigPDA(
            address(params.recipient),
            this.antProgram,
          );
          needsAclBootstrap = !(await this.getAccount(aclPda)).exists;
        } catch {
          // keep the conservative default
        }
        const rentLamports = needsAclBootstrap
          ? await estimateRentLamports(this.rpc, ACL_BOOTSTRAP_ACCOUNT_BYTES)
          : 0;
        return estimateGasFee(this.rpc, { rentLamports });
      }
      case 'reassign-name': {
        if (!params.spawnsNewAnt) return estimateGasFee(this.rpc);
        // spawn (fee payer + mint keypair) then reassign (fee payer)
        const rentLamports = await estimateRentLamports(
          this.rpc,
          spawnAntAccountBytes(params.name?.length ?? 12),
        );
        return estimateGasFee(this.rpc, {
          rentLamports,
          transactionCount: 2,
          signatureCount: 3,
        });
      }
      default:
        return estimateGasFee(this.rpc);
    }
  }

  /** Get the on-chain schema version of this ANT's config. */
  async getConfigVersion(): Promise<number> {
    const config = await this.fetchConfig();
    return config.version;
  }

  /** Check if this ANT needs a schema migration to the latest version. */
  async needsMigration(): Promise<boolean> {
    const version = await this.getConfigVersion();
    return version < ANT_CONFIG_VERSION;
  }

  async getName(_opts?: AntReadOptions): Promise<string> {
    const config = await this.fetchConfig();
    return config.name;
  }

  async getTicker(_opts?: AntReadOptions): Promise<string> {
    const config = await this.fetchConfig();
    return config.ticker;
  }

  async getLogo(_opts?: AntReadOptions): Promise<string> {
    const config = await this.fetchConfig();
    return config.logo;
  }

  async getControllers(): Promise<WalletAddress[]> {
    const data = await this.fetchControllers();
    return data.controllers;
  }

  // =========================================
  // Record reads
  // =========================================

  async getRecord(
    { undername }: { undername: string },
    _opts?: AntReadOptions,
  ): Promise<ANTRecord | undefined> {
    const [[recordPda], [metaPda]] = await Promise.all([
      getAntRecordPDA(this.mint, undername, this.antProgram),
      getAntRecordMetadataPDA(this.mint, undername, this.antProgram),
    ]);

    const [recordAccount, metaAccount] = await withRetry(() =>
      fetchEncodedAccounts(this.rpc, [recordPda, metaPda], {
        commitment: this.commitment,
      }),
    );

    if (!recordAccount.exists) return undefined;

    const recordDecoder = getAntRecordDecoder();
    const metaDecoder = getAntRecordMetadataDecoder();
    const record = recordDecoder.decode(new Uint8Array(recordAccount.data));
    const meta = metaAccount.exists
      ? metaDecoder.decode(new Uint8Array(metaAccount.data))
      : undefined;

    return {
      transactionId: record.target,
      targetProtocol: record.targetProtocol,
      ttlSeconds: record.ttlSeconds,
      priority:
        record.priority?.__option === 'Some'
          ? record.priority.value
          : undefined,
      owner:
        record.owner?.__option === 'Some'
          ? (record.owner.value as string)
          : undefined,
      displayName:
        meta?.displayName?.__option === 'Some'
          ? meta.displayName.value
          : undefined,
      logo:
        meta?.recordLogo?.__option === 'Some'
          ? meta.recordLogo.value
          : undefined,
      description:
        meta?.recordDescription?.__option === 'Some'
          ? meta.recordDescription.value
          : undefined,
      keywords:
        meta?.recordKeywords?.__option === 'Some'
          ? meta.recordKeywords.value
          : undefined,
    };
  }

  async getRecords(opts?: AntReadOptions): Promise<SortedANTRecords> {
    // Fetch all AntRecord accounts for this mint. AntRecordMetadata
    // (displayName/logo/description/keywords) is a SECOND program scan and is
    // only needed in detail/edit views, so skip it unless `includeMetadata` is
    // set — halving the per-ANT request cost on list reads. See AntReadOptions.
    const includeMetadata = opts?.includeMetadata === true;
    const gpaFilter = (discriminator: string) => [
      {
        memcmp: {
          offset: 0n,
          bytes: discriminator,
          encoding: 'base58' as const,
        },
      },
      {
        memcmp: {
          offset: 8n,
          bytes: this.mint as string,
          encoding: 'base58' as const,
        },
      },
    ];

    type GpaResult = ReadonlyArray<{
      account: { data: readonly [string, string] };
      pubkey: Address;
    }>;

    const [recordAccounts, metaAccounts] = (await Promise.all([
      withRetry(() =>
        (this.rpc as any)
          .getProgramAccounts(this.antProgram, {
            commitment: this.commitment,
            encoding: 'base64',
            filters: gpaFilter(
              bs58.encode(ANT_RECORD_DISCRIMINATOR as Uint8Array),
            ),
          })
          .send(),
      ),
      includeMetadata
        ? withRetry(() =>
            (this.rpc as any)
              .getProgramAccounts(this.antProgram, {
                commitment: this.commitment,
                encoding: 'base64',
                filters: gpaFilter(
                  bs58.encode(ANT_RECORD_METADATA_DISCRIMINATOR as Uint8Array),
                ),
              })
              .send(),
          )
        : Promise.resolve([] as unknown as GpaResult),
    ])) as [GpaResult, GpaResult];

    const recordDecoder = getAntRecordDecoder();
    const metaDecoder = getAntRecordMetadataDecoder();

    // Index metadata by undername hash for O(1) lookup.
    // AntRecordMetadata has undername_hash at offset 40 (8 disc + 32 mint).
    const metaByHash = new Map<string, ReturnType<typeof metaDecoder.decode>>();
    for (const { account } of metaAccounts) {
      try {
        const buf = Buffer.from(account.data[0], 'base64');
        const hash = buf.subarray(40, 72).toString('hex');
        metaByHash.set(hash, metaDecoder.decode(new Uint8Array(buf)));
      } catch {
        // Skip malformed
      }
    }

    const result: SortedANTRecords = {};
    let index = 0;
    for (const { account } of recordAccounts) {
      try {
        const buf = Buffer.from(account.data[0], 'base64');
        const record = recordDecoder.decode(new Uint8Array(buf));
        const hash = __createHash('sha256')
          .update(record.undername.toLowerCase())
          .digest('hex');
        const meta = metaByHash.get(hash);
        result[record.undername] = {
          transactionId: record.target,
          targetProtocol: record.targetProtocol,
          ttlSeconds: record.ttlSeconds,
          priority:
            record.priority?.__option === 'Some'
              ? record.priority.value
              : undefined,
          owner:
            record.owner?.__option === 'Some'
              ? (record.owner.value as string)
              : undefined,
          displayName:
            meta?.displayName?.__option === 'Some'
              ? meta.displayName.value
              : undefined,
          logo:
            meta?.recordLogo?.__option === 'Some'
              ? meta.recordLogo.value
              : undefined,
          description:
            meta?.recordDescription?.__option === 'Some'
              ? meta.recordDescription.value
              : undefined,
          keywords:
            meta?.recordKeywords?.__option === 'Some'
              ? meta.recordKeywords.value
              : undefined,
          index: index++,
        };
      } catch {
        // Skip malformed
      }
    }

    return result;
  }

  /**
   * Bulk-load lightweight {@link ANTSummary} state for many ANTs in a handful
   * of `getMultipleAccounts` calls instead of `N × getState`. For each mint it
   * batches AntConfig + AntControllers + the apex (`@`) AntRecord — everything a
   * portfolio/names table needs. Full undername records are NOT loaded here;
   * fetch them lazily per-ANT via {@link getRecords}/{@link getState} when a
   * name is opened.
   *
   * Requests: ~`ceil(3N / 100)` calls for N mints (10 → 1, 250 → 8), versus
   * ~`4N` with per-ANT `getState`. Assumes every mint is deployed under this
   * instance's `antProgram` (true for the standard AR.IO ANT program).
   *
   * Mints whose AntConfig doesn't exist are omitted from the result.
   */
  async getANTSummaries(
    mints: ReadonlyArray<string>,
  ): Promise<Record<string, ANTSummary>> {
    const unique = Array.from(new Set(mints));
    if (unique.length === 0) return {};

    // Derive config + controllers + apex('@') record PDAs for every mint.
    const triples = await Promise.all(
      unique.map(async (m) => {
        const mintAddr = address(m);
        const [[configPda], [controllersPda], [apexPda]] = await Promise.all([
          getAntConfigPDA(mintAddr, this.antProgram),
          getAntControllersPDA(mintAddr, this.antProgram),
          getAntRecordPDA(mintAddr, '@', this.antProgram),
        ]);
        return { mint: m, configPda, controllersPda, apexPda };
      }),
    );

    // Batch-fetch all PDAs (3 per mint) — getMultipleAccounts caps at 100.
    const allPdas = triples.flatMap((t) => [
      t.configPda,
      t.controllersPda,
      t.apexPda,
    ]);
    type Acct = Awaited<ReturnType<typeof fetchEncodedAccounts>>[number];
    const accounts: Acct[] = [];
    for (let i = 0; i < allPdas.length; i += 100) {
      const chunk = allPdas.slice(i, i + 100);
      const res = await withRetry(() =>
        fetchEncodedAccounts(this.rpc, chunk, { commitment: this.commitment }),
      );
      accounts.push(...res);
    }

    const recordDecoder = getAntRecordDecoder();
    const result: Record<string, ANTSummary> = {};
    for (let i = 0; i < triples.length; i++) {
      const { mint } = triples[i];
      const configAccount = accounts[i * 3];
      const controllersAccount = accounts[i * 3 + 1];
      const apexAccount = accounts[i * 3 + 2];
      if (!configAccount?.exists) continue;

      const config = decodeAntConfig(configAccount).data;
      const controllers = controllersAccount?.exists
        ? decodeAntControllers(controllersAccount).data.controllers.map(
            (c) => c as string,
          )
        : [];

      let apexRecord: ANTRecord | undefined;
      if (apexAccount?.exists) {
        const rec = recordDecoder.decode(new Uint8Array(apexAccount.data));
        apexRecord = {
          transactionId: rec.target,
          targetProtocol: rec.targetProtocol,
          ttlSeconds: rec.ttlSeconds,
          priority:
            rec.priority?.__option === 'Some' ? rec.priority.value : undefined,
          owner:
            rec.owner?.__option === 'Some'
              ? (rec.owner.value as string)
              : undefined,
        };
      }

      result[mint] = {
        processId: mint,
        name: config.name,
        ticker: config.ticker,
        logo: config.logo,
        description: config.description,
        keywords: config.keywords,
        owner: config.lastKnownOwner as string,
        controllers,
        apexRecord,
      };
    }
    return result;
  }

  /**
   * Bulk-load FULL {@link ANTState} (including all undername records) for many
   * ANTs in a handful of calls instead of `N × getState`:
   *   - AntConfig + AntControllers for every mint via `getMultipleAccounts`
   *     (chunked at 100), and
   *   - ALL undername records via a SINGLE program-wide `getProgramAccounts`
   *     scan grouped by mint (offset 8), instead of one mint-filtered scan per
   *     ANT.
   *
   * Requests: ~`ceil(2N / 100) + 1` (+1 when `includeMetadata`) regardless of
   * N — e.g. 10 ANTs → 2 calls, 250 → ~6 — versus ~`2N` with per-ANT
   * `getState`. The records scan reads every ANT's records program-wide (cheap
   * per account, one round trip); prefer per-ANT {@link getState} when you only
   * need one ANT. Mints with no AntConfig are omitted.
   */
  async getANTStates(
    mints: ReadonlyArray<string>,
    opts?: AntReadOptions,
  ): Promise<Record<string, ANTState>> {
    const unique = Array.from(new Set(mints));
    if (unique.length === 0) return {};

    // Config + controllers PDAs for every mint, batched (100 accounts/call).
    const pairs = await Promise.all(
      unique.map(async (m) => {
        const mintAddr = address(m);
        const [[configPda], [controllersPda]] = await Promise.all([
          getAntConfigPDA(mintAddr, this.antProgram),
          getAntControllersPDA(mintAddr, this.antProgram),
        ]);
        return { mint: m, configPda, controllersPda };
      }),
    );
    const allPdas = pairs.flatMap((p) => [p.configPda, p.controllersPda]);
    type Acct = Awaited<ReturnType<typeof fetchEncodedAccounts>>[number];
    const accounts: Acct[] = [];
    for (let i = 0; i < allPdas.length; i += 100) {
      const res = await withRetry(() =>
        fetchEncodedAccounts(this.rpc, allPdas.slice(i, i + 100), {
          commitment: this.commitment,
        }),
      );
      accounts.push(...res);
    }

    const recordsByMint = await this._recordsByMint(
      opts?.includeMetadata === true,
    );

    const result: Record<string, ANTState> = {};
    for (let i = 0; i < pairs.length; i++) {
      const { mint } = pairs[i];
      const configAccount = accounts[i * 2];
      const controllersAccount = accounts[i * 2 + 1];
      if (!configAccount?.exists) continue;

      const config = decodeAntConfig(configAccount).data;
      const controllers = controllersAccount?.exists
        ? decodeAntControllers(controllersAccount).data.controllers.map(
            (c) => c as string,
          )
        : [];

      const sorted = recordsByMint.get(mint) ?? {};
      const plainRecords: Record<string, ANTRecord> = {};
      for (const [key, val] of Object.entries(sorted)) {
        const { index: _, ...rec } = val;
        plainRecords[key] = rec;
      }
      const owner = config.lastKnownOwner as string;

      result[mint] = {
        Name: config.name,
        Ticker: config.ticker,
        Description: config.description,
        Keywords: config.keywords,
        Denomination: 0,
        Owner: owner,
        Controllers: controllers,
        Records: plainRecords,
        Balances: { [owner]: 1 },
        Logo: config.logo,
        TotalSupply: 1,
        Initialized: true,
      };
    }
    return result;
  }

  /**
   * Group every AntRecord (+ optional metadata) in the program by mint via a
   * single `getProgramAccounts` scan (the mint sits at offset 8). Used by
   * {@link getANTStates} to load all ANTs' undername records in one round trip
   * instead of one mint-filtered scan per ANT.
   */
  private async _recordsByMint(
    includeMetadata: boolean,
  ): Promise<Map<string, SortedANTRecords>> {
    const discFilter = (discriminator: string) => [
      {
        memcmp: {
          offset: 0n,
          bytes: discriminator,
          encoding: 'base58' as const,
        },
      },
    ];
    type GpaResult = ReadonlyArray<{
      account: { data: readonly [string, string] };
      pubkey: Address;
    }>;
    const [recordAccounts, metaAccounts] = (await Promise.all([
      withRetry(() =>
        (this.rpc as any)
          .getProgramAccounts(this.antProgram, {
            commitment: this.commitment,
            encoding: 'base64',
            filters: discFilter(
              bs58.encode(ANT_RECORD_DISCRIMINATOR as Uint8Array),
            ),
          })
          .send(),
      ),
      includeMetadata
        ? withRetry(() =>
            (this.rpc as any)
              .getProgramAccounts(this.antProgram, {
                commitment: this.commitment,
                encoding: 'base64',
                filters: discFilter(
                  bs58.encode(ANT_RECORD_METADATA_DISCRIMINATOR as Uint8Array),
                ),
              })
              .send(),
          )
        : Promise.resolve([] as unknown as GpaResult),
    ])) as [GpaResult, GpaResult];

    const recordDecoder = getAntRecordDecoder();
    const metaDecoder = getAntRecordMetadataDecoder();

    // Metadata keyed by `${mint}:${undernameHash}` (mint at 8, hash at 40).
    const metaByKey = new Map<string, ReturnType<typeof metaDecoder.decode>>();
    for (const { account } of metaAccounts) {
      try {
        const buf = Buffer.from(account.data[0], 'base64');
        const mint = bs58.encode(buf.subarray(8, 40));
        const hash = buf.subarray(40, 72).toString('hex');
        metaByKey.set(
          `${mint}:${hash}`,
          metaDecoder.decode(new Uint8Array(buf)),
        );
      } catch {
        // Skip malformed
      }
    }

    const byMint = new Map<string, SortedANTRecords>();
    const indexByMint = new Map<string, number>();
    for (const { account } of recordAccounts) {
      try {
        const buf = Buffer.from(account.data[0], 'base64');
        const mint = bs58.encode(buf.subarray(8, 40));
        const record = recordDecoder.decode(new Uint8Array(buf));
        const hash = __createHash('sha256')
          .update(record.undername.toLowerCase())
          .digest('hex');
        const meta = metaByKey.get(`${mint}:${hash}`);
        const idx = indexByMint.get(mint) ?? 0;
        let bucket = byMint.get(mint);
        if (!bucket) {
          bucket = {};
          byMint.set(mint, bucket);
        }
        bucket[record.undername] = {
          transactionId: record.target,
          targetProtocol: record.targetProtocol,
          ttlSeconds: record.ttlSeconds,
          priority:
            record.priority?.__option === 'Some'
              ? record.priority.value
              : undefined,
          owner:
            record.owner?.__option === 'Some'
              ? (record.owner.value as string)
              : undefined,
          displayName:
            meta?.displayName?.__option === 'Some'
              ? meta.displayName.value
              : undefined,
          logo:
            meta?.recordLogo?.__option === 'Some'
              ? meta.recordLogo.value
              : undefined,
          description:
            meta?.recordDescription?.__option === 'Some'
              ? meta.recordDescription.value
              : undefined,
          keywords:
            meta?.recordKeywords?.__option === 'Some'
              ? meta.recordKeywords.value
              : undefined,
          index: idx,
        };
        indexByMint.set(mint, idx + 1);
      } catch {
        // Skip malformed
      }
    }
    return byMint;
  }

  // =========================================
  // Balance reads (NFT model — owner has balance 1)
  // =========================================

  async getBalance(
    { address: queryAddress }: { address: WalletAddress },
    _opts?: AntReadOptions,
  ): Promise<number> {
    const config = await this.fetchConfig();
    return config.owner === queryAddress ? 1 : 0;
  }

  async getBalances(
    _opts?: AntReadOptions,
  ): Promise<Record<WalletAddress, number>> {
    const config = await this.fetchConfig();
    return { [config.owner]: 1 };
  }

  // =========================================
  // State / Info composites
  // =========================================

  async getState(opts?: AntReadOptions): Promise<ANTState> {
    const [{ config, controllers }, records] = await Promise.all([
      this._fetchConfigAndControllers(),
      this.getRecords(opts),
    ]);

    // Convert SortedANTRecords to ANTRecords (strip index)
    const plainRecords: Record<string, ANTRecord> = {};
    for (const [key, val] of Object.entries(records)) {
      const { index: _, ...record } = val;
      plainRecords[key] = record;
    }

    return {
      Name: config.name,
      Ticker: config.ticker,
      Description: config.description,
      Keywords: config.keywords,
      Denomination: 0,
      Owner: config.owner,
      Controllers: controllers,
      Records: plainRecords,
      Balances: { [config.owner]: 1 },
      Logo: config.logo,
      TotalSupply: 1,
      Initialized: true,
    };
  }

  async getInfo(_opts?: AntReadOptions): Promise<ANTInfo> {
    const config = await this.fetchConfig();

    return {
      Name: config.name,
      Owner: config.owner,
      Ticker: config.ticker,
      'Total-Supply': '1',
      Description: config.description,
      Keywords: config.keywords,
      Logo: config.logo,
      Denomination: '0',
      Handlers: [
        'balance',
        'balances',
        'totalSupply',
        'info',
        'controllers',
        'record',
        'records',
        'state',
        'transfer',
        'addController',
        'removeController',
        'setRecord',
        'removeRecord',
        'setName',
        'setTicker',
        'setDescription',
        'setKeywords',
        'setLogo',
        'initializeState',
        'releaseName',
        'reassignName',
        'approvePrimaryName',
        'removePrimaryNames',
        'transferRecordOwnership',
        '_eval',
        '_default',
      ],
    } as ANTInfo;
  }

  async getHandlers(): Promise<ANTHandler[]> {
    // Solana ANT supports all standard handlers
    return [
      'balance',
      'balances',
      'totalSupply',
      'info',
      'controllers',
      'record',
      'records',
      'state',
      'transfer',
      'addController',
      'removeController',
      'setRecord',
      'removeRecord',
      'setName',
      'setTicker',
      'setDescription',
      'setKeywords',
      'setLogo',
      'initializeState',
      'releaseName',
      'reassignName',
      'approvePrimaryName',
      'removePrimaryNames',
      'transferRecordOwnership',
      '_eval',
      '_default',
    ] as ANTHandler[];
  }

  async getModuleId(_opts?: {
    graphqlUrl?: string;
    retries?: number;
  }): Promise<string> {
    // Solana programs don't have module IDs — return the program address
    return this.antProgram as string;
  }

  async getVersion(_opts?: {
    antRegistryId?: string;
    graphqlUrl?: string;
    retries?: number;
  }): Promise<string> {
    return '1.0.0-solana';
  }

  async isLatestVersion(_opts?: {
    antRegistryId?: string;
    graphqlUrl?: string;
    retries?: number;
  }): Promise<boolean> {
    return true;
  }
}
