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
} from '@solana/kit';
import bs58 from 'bs58';

// AntRecordMetadata discriminator — regenerate via `yarn codegen` after IDL rebase
// to expose ANT_RECORD_METADATA_DISCRIMINATOR. Until then, compute inline.
import { createHash as __createHash } from 'crypto';
import { type ILogger, Logger } from '../common/logger.js';
import type {
  AntReadOptions,
  AoANTHandler,
  AoANTInfo,
  AoANTRecord,
  AoANTState,
  SortedANTRecords,
} from '../types/ant.js';
import type { WalletAddress } from '../types/common.js';
import { SolanaANTRegistryReadable } from './ant-registry-readable.js';
import { ANT_CONFIG_VERSION, ARIO_ANT_PROGRAM_ID } from './constants.js';
import {
  deserializeAntConfig,
  deserializeAntControllers,
  deserializeAntRecord,
  deserializeAntRecordMetadata,
} from './deserialize.js';
import { ANT_RECORD_DISCRIMINATOR } from './generated/ant/accounts/antRecord.js';
const ANT_RECORD_METADATA_DISCRIMINATOR = new Uint8Array(
  __createHash('sha256')
    .update('account:AntRecordMetadata')
    .digest()
    .subarray(0, 8),
);
import {
  getAntConfigPDA,
  getAntControllersPDA,
  getAntRecordMetadataPDA,
  getAntRecordPDA,
} from './pda.js';
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
    return fetchEncodedAccount(this.rpc, pda, {
      commitment: this.commitment,
    });
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
    return deserializeAntConfig(Buffer.from(account.data));
  }

  private async fetchControllers() {
    const [pda] = await getAntControllersPDA(this.mint, this.antProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      return { mint: this.processId, controllers: [] };
    }
    return deserializeAntControllers(Buffer.from(account.data));
  }

  async getOwner(_opts?: AntReadOptions): Promise<WalletAddress> {
    const config = await this.fetchConfig();
    return config.owner;
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
  ): Promise<AoANTRecord | undefined> {
    const [[recordPda], [metaPda]] = await Promise.all([
      getAntRecordPDA(this.mint, undername, this.antProgram),
      getAntRecordMetadataPDA(this.mint, undername, this.antProgram),
    ]);

    const [recordAccount, metaAccount] = await Promise.all([
      this.getAccount(recordPda),
      this.getAccount(metaPda),
    ]);

    if (!recordAccount.exists) return undefined;

    const record = deserializeAntRecord(Buffer.from(recordAccount.data));
    const meta: Partial<ReturnType<typeof deserializeAntRecordMetadata>> =
      metaAccount.exists
        ? deserializeAntRecordMetadata(Buffer.from(metaAccount.data))
        : {};

    return {
      transactionId: record.transactionId,
      targetProtocol: record.targetProtocol,
      ttlSeconds: record.ttlSeconds,
      priority: record.priority,
      owner: record.owner,
      displayName: meta.displayName,
      logo: meta.logo,
      description: meta.description,
      keywords: meta.keywords,
    };
  }

  async getRecords(_opts?: AntReadOptions): Promise<SortedANTRecords> {
    // Fetch all AntRecord + AntRecordMetadata accounts for this mint in parallel.
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
      (this.rpc as any)
        .getProgramAccounts(this.antProgram, {
          commitment: this.commitment,
          encoding: 'base64',
          filters: gpaFilter(bs58.encode(ANT_RECORD_DISCRIMINATOR)),
        })
        .send(),
      (this.rpc as any)
        .getProgramAccounts(this.antProgram, {
          commitment: this.commitment,
          encoding: 'base64',
          filters: gpaFilter(bs58.encode(ANT_RECORD_METADATA_DISCRIMINATOR)),
        })
        .send(),
    ])) as [GpaResult, GpaResult];

    // Index metadata by undername hash for O(1) lookup.
    // AntRecordMetadata has undername_hash at offset 40 (8 disc + 32 mint).
    const metaByHash = new Map<
      string,
      ReturnType<typeof deserializeAntRecordMetadata>
    >();
    for (const { account } of metaAccounts) {
      try {
        const buf = Buffer.from(account.data[0], 'base64');
        const hash = buf.subarray(40, 72).toString('hex');
        metaByHash.set(hash, deserializeAntRecordMetadata(buf));
      } catch {
        // Skip malformed
      }
    }

    const result: SortedANTRecords = {};
    let index = 0;
    for (const { account } of recordAccounts) {
      try {
        const buf = Buffer.from(account.data[0], 'base64');
        const record = deserializeAntRecord(buf);
        // Look up metadata by computing the undername hash
        const { createHash } = await import('crypto');
        const hash = createHash('sha256')
          .update(record.undername.toLowerCase())
          .digest('hex');
        const meta: Partial<ReturnType<typeof deserializeAntRecordMetadata>> =
          metaByHash.get(hash) ?? {};
        result[record.undername] = {
          transactionId: record.transactionId,
          targetProtocol: record.targetProtocol,
          ttlSeconds: record.ttlSeconds,
          priority: record.priority,
          owner: record.owner,
          displayName: meta.displayName,
          logo: meta.logo,
          description: meta.description,
          keywords: meta.keywords,
          index: index++,
        };
      } catch {
        // Skip malformed
      }
    }

    return result;
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

  async getState(_opts?: AntReadOptions): Promise<AoANTState> {
    const [config, controllersData, records] = await Promise.all([
      this.fetchConfig(),
      this.fetchControllers(),
      this.getRecords(),
    ]);

    // Convert SortedANTRecords to ANTRecords (strip index)
    const plainRecords: Record<string, AoANTRecord> = {};
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
      Controllers: controllersData.controllers,
      Records: plainRecords,
      Balances: { [config.owner]: 1 },
      Logo: config.logo,
      TotalSupply: 1,
      Initialized: true,
    };
  }

  async getInfo(_opts?: AntReadOptions): Promise<AoANTInfo> {
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
    } as AoANTInfo;
  }

  async getHandlers(): Promise<AoANTHandler[]> {
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
    ] as AoANTHandler[];
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
