/**
 * Solana implementation of the ARIORead interface.
 *
 * Reads AR.IO protocol state directly from Solana PDAs using RPC,
 * returning the same types that the AO implementation returns.
 * This allows consumers to switch backends transparently.
 */
import {
  type Address,
  type Commitment,
  type ReadonlyUint8Array,
  address,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  getAddressDecoder,
} from '@solana/kit';
import bs58 from 'bs58';

import {
  ARNS_RECORD_DISCRIMINATOR,
  RESERVED_NAME_DISCRIMINATOR,
  RETURNED_NAME_DISCRIMINATOR,
  getArnsConfigDecoder,
  getArnsRecordDecoder,
  getReservedNameDecoder,
  getReturnedNameDecoder,
} from '@ar.io/solana-contracts/arns';
import {
  PRIMARY_NAME_DISCRIMINATOR,
  PRIMARY_NAME_REQUEST_DISCRIMINATOR,
  VAULT_DISCRIMINATOR,
  getPrimaryNameRequestDecoder,
  getVaultDecoder,
} from '@ar.io/solana-contracts/core';
import {
  ALLOWLIST_ENTRY_DISCRIMINATOR,
  DELEGATION_DISCRIMINATOR,
  GATEWAY_DISCRIMINATOR,
  GatewayStatus,
  OBSERVATION_DISCRIMINATOR,
  WITHDRAWAL_DISCRIMINATOR,
  getDelegationDecoder,
  getGatewayDecoder,
  getWithdrawalDecoder,
} from '@ar.io/solana-contracts/gar';
import { type ILogger, Logger } from '../common/logger.js';
import type {
  PrimaryName,
  PrimaryNameRequest,
  RedelegationFeeInfo,
  WalletAddress,
} from '../types/common.js';
import type {
  AddressParams,
  AllDelegates,
  AllGatewayVaults,
  ArNSNameData,
  ArNSNameDataWithName,
  ArNSReservedNameData,
  ArNSReservedNameDataWithName,
  BalanceWithAddress,
  CostDetailsResult,
  Delegation,
  DemandFactorSettings,
  EligibleDistribution,
  EpochData,
  EpochDistributionData,
  EpochInput,
  EpochObservationData,
  EpochSettings,
  FundFrom,
  FundingPlan,
  Gateway,
  GatewayDelegateWithAddress,
  GatewayRegistrySettings,
  GatewayVault,
  GatewayWeights,
  GatewayWithAddress,
  GetArNSRecordsParams,
  GetCostDetailsParams,
  PaginatedAddressParams,
  PaginationParams,
  PaginationResult,
  RegistrationFees,
  ReturnedName,
  TokenCostParams,
  TokenSupplyData,
  UserWithdrawal,
  VaultData,
  WalletVault,
  WeightedObserver,
} from '../types/io.js';
import { SolanaANTRegistryReadable } from './ant-registry-readable.js';
import { getAssociatedTokenAddressKit } from './ata.js';
import {
  ARIO_ANT_PROGRAM_ID,
  ARIO_ARNS_PROGRAM_ID,
  ARIO_CORE_PROGRAM_ID,
  ARIO_GAR_PROGRAM_ID,
  ARNS_RECORD_ANT_OFFSET,
  RATE_SCALE,
} from './constants.js';
import { computeLiveDelegationBalance } from './delegation-math.js';
import {
  deserializeAllowlist,
  deserializeArioConfig,
  deserializeArnsRecord,
  deserializeDelegation,
  deserializeDemandFactor,
  deserializeEpoch,
  deserializeEpochSettings,
  deserializeEpochSettingsFull,
  deserializeGarSettings,
  deserializeGarSupplyCounters,
  deserializeGateway,
  deserializeGatewayWithAccumulator,
  deserializeObservation,
  deserializePrimaryName,
  deserializePrimaryNameRequest,
  deserializeRedelegationRecord,
  deserializeReservedName,
  deserializeReturnedName,
  deserializeVault,
  deserializeWithdrawal,
} from './deserialize.js';
import { TOKEN_PROGRAM_ADDRESS } from './instruction.js';
import {
  getArioConfigPDA,
  getArnsRecordPDA,
  getArnsRecordPDAFromHash,
  getArnsSettingsPDA,
  getDemandFactorPDA,
  getEpochPDA,
  getEpochSettingsPDA,
  getGarSettingsPDA,
  getGatewayPDA,
  getGatewayRegistryPDA,
  getObserverLookupPDA,
  getPrimaryNamePDA,
  getPrimaryNameRequestPDA,
  getReservedNamePDA,
  getReturnedNamePDA,
  getVaultPDA,
} from './pda.js';
import { withRetry } from './retry.js';
import type { SolanaReadConfig, SolanaRpc } from './types.js';

const addressDecoder = getAddressDecoder();
/** All-zero address — equivalent of web3.js `PublicKey.default`. */
const DEFAULT_ADDRESS: Address = address('11111111111111111111111111111111');

// Memcmp filter shape for kit's getProgramAccounts.
type MemcmpFilter = {
  memcmp: { offset: bigint; bytes: string; encoding: 'base58' | 'base64' };
};

// =========================================
// Pagination helper
// =========================================

/**
 * Normalize whatever `params.filters?.processId` shape came in (undefined,
 * single string, or array — `PaginationParams` widens it past what ArNS
 * actually supports) into a flat `string[]` ANT-mint list.
 */
function normalizeProcessIdFilter(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw))
    return raw.filter((v): v is string => typeof v === 'string');
  return [];
}

/**
 * On-chain timestamps in the Solana programs are stored in **seconds**
 * (matching the Lua-source convention as ported), but the public SDK
 * surface — shared with the AO backend — exposes them in **milliseconds**
 * because every JS consumer (UI, cranker, migration tools) feeds them into
 * `new Date()`/`Date.now()` arithmetic. This boundary helper converts at
 * the read-path projection layer so internal arithmetic in this file can
 * keep working in seconds against the deserializer output, but everything
 * we hand back to a caller is in JS-millisecond units.
 *
 * Use `toMsTimestamps(obj)` for projection-layer return values, and
 * `secToMs(n)` for one-off scalars.
 */
const TIMESTAMP_FIELDS_MS = [
  'startTimestamp',
  'endTimestamp',
  'distributionTimestamp',
] as const;
function secToMs(n: number): number {
  return n * 1000;
}
function toMsTimestamps<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of TIMESTAMP_FIELDS_MS) {
    const v = out[f];
    if (typeof v === 'number') out[f] = v * 1000;
  }
  return out as T;
}

/**
 * Drop the SDK-internal extras (`name`, `owner`) and the `processId` re-key
 * that `deserializeArnsRecord` adds, projecting back to the cross-backend
 * `ArNSNameDataWithName` shape consumers expect.
 *
 * Timestamps are converted from on-chain seconds to JS milliseconds here
 * (see `toMsTimestamps` above for rationale).
 */
function arnsRecordToWithName(
  record: ReturnType<typeof deserializeArnsRecord>,
): ArNSNameDataWithName {
  return {
    name: record.name,
    processId: record.processId,
    startTimestamp: secToMs(record.startTimestamp),
    undernameLimit: record.undernameLimit,
    purchasePrice: record.purchasePrice,
    type: record.type,
    ...('endTimestamp' in record
      ? { endTimestamp: secToMs(record.endTimestamp) }
      : {}),
  } as ArNSNameDataWithName;
}

function paginate<T>(
  items: T[],
  params?: { cursor?: string; limit?: number; sortOrder?: 'asc' | 'desc' },
): PaginationResult<T> {
  const limit = params?.limit ?? 100;
  const startIdx = params?.cursor ? parseInt(params.cursor, 10) : 0;
  const page = items.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < items.length;

  return {
    items: page,
    limit,
    totalItems: items.length,
    sortOrder: params?.sortOrder ?? 'asc',
    hasMore,
    nextCursor: hasMore ? String(startIdx + limit) : undefined,
  };
}

/**
 * Solana-backed read-only client for the AR.IO protocol.
 *
 * Usage:
 * ```ts
 * import { createSolanaRpc } from '@solana/kit';
 * import { SolanaARIOReadable } from '@ar.io/sdk/solana';
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 * const ario = new SolanaARIOReadable({ rpc });
 *
 * const gateway = await ario.getGateway({ address: 'GatewayOperatorPubkey...' });
 * const record = await ario.getArNSRecord({ name: 'ardrive' });
 * ```
 */
export class SolanaARIOReadable {
  protected readonly rpc: SolanaRpc;
  protected readonly commitment: Commitment;
  protected readonly logger: ILogger;

  // Allow overriding program IDs (e.g., for devnet/localnet)
  protected readonly coreProgram: Address;
  protected readonly garProgram: Address;
  protected readonly arnsProgram: Address;
  protected readonly antProgram: Address;

  // Memoized ARIO mint address (read once from ArioConfig.mint and reused
  // for every SPL-ATA derivation in getBalance/getBalances).
  private _arioMint?: Address;

  constructor(
    config: SolanaReadConfig & {
      logger?: ILogger;
      coreProgramId?: Address;
      garProgramId?: Address;
      arnsProgramId?: Address;
      antProgramId?: Address;
    },
  ) {
    this.rpc = config.rpc;
    this.commitment = config.commitment ?? 'confirmed';
    this.logger = config.logger ?? Logger.default;
    this.coreProgram = config.coreProgramId ?? ARIO_CORE_PROGRAM_ID;
    this.garProgram = config.garProgramId ?? ARIO_GAR_PROGRAM_ID;
    this.arnsProgram = config.arnsProgramId ?? ARIO_ARNS_PROGRAM_ID;
    this.antProgram = config.antProgramId ?? ARIO_ANT_PROGRAM_ID;
  }

  /** Helper to fetch an encoded account (kit's replacement for Connection.getAccountInfo). */
  private async getAccount(pda: Address) {
    return withRetry(() =>
      fetchEncodedAccount(this.rpc, pda, {
        commitment: this.commitment,
      }),
    );
  }

  /**
   * Helper for `getProgramAccounts` with a discriminator memcmp filter.
   *
   * Pass the Codama-generated `<NAME>_DISCRIMINATOR: Uint8Array` constant
   * directly — kit's RPC requires a base58 string for `memcmp.bytes`, so
   * we bs58-encode here to keep call sites from doing it inline (and to
   * keep the IDL-derived bytes as the single source of truth).
   */
  private async getAccountsByDiscriminator(
    programId: Address,
    discriminator: Uint8Array | ReadonlyUint8Array,
    extraFilters: MemcmpFilter[] = [],
  ): Promise<Array<{ pubkey: Address; data: Buffer }>> {
    const filters: MemcmpFilter[] = [
      {
        memcmp: {
          offset: 0n,
          bytes: bs58.encode(discriminator as Uint8Array),
          encoding: 'base58',
        },
      },
      ...extraFilters,
    ];
    // Note: kit's getProgramAccounts returns a plain array (no context wrapper)
    // when called without `withContext: true`. With `encoding: 'base64'`, each
    // account's `data` is a `[base64, 'base64']` tuple. We bypass kit's strict
    // generic overload typing here with a cast — the runtime shape is stable.
    const result = await withRetry(
      () =>
        (this.rpc as any)
          .getProgramAccounts(programId, {
            commitment: this.commitment,
            encoding: 'base64',
            filters,
          })
          .send() as Promise<
          ReadonlyArray<{
            account: { data: readonly [string, string] };
            pubkey: Address;
          }>
        >,
    );

    return result.map((entry) => ({
      pubkey: entry.pubkey,
      data: Buffer.from(entry.account.data[0], 'base64'),
    }));
  }

  /**
   * Batch-fetch the `cumulative_reward_per_token` accumulator for every gateway
   * in `operatorAddresses`. Returns a Map keyed by base58 operator address.
   * Used by the delegate readers below to compute the live delegation balance
   * without an on-chain settlement call (see {@link computeLiveDelegationBalance}
   * and `INVARIANTS.md` in the contracts repo). Missing gateways are silently
   * skipped — callers fall back to the stale `Delegation.amount` for those
   * (the accumulator delta is 0 and live == stored anyway when the gateway
   * has no rewards to distribute).
   */
  protected async getGatewayAccumulators(
    operatorAddresses: string[],
  ): Promise<Map<string, bigint>> {
    const unique = Array.from(new Set(operatorAddresses));
    if (unique.length === 0) return new Map();
    const pdas = await Promise.all(
      unique.map(
        async (op) => (await getGatewayPDA(address(op), this.garProgram))[0],
      ),
    );
    const accounts = await withRetry(() =>
      fetchEncodedAccounts(this.rpc, pdas, {
        commitment: this.commitment,
      }),
    );
    const out = new Map<string, bigint>();
    for (let i = 0; i < accounts.length; i++) {
      const acct = accounts[i];
      if (!acct.exists) continue;
      try {
        // Internal variant: surfaces the u128 accumulator that the public
        // `deserializeGateway` deliberately drops (BigInt is not
        // JSON-serializable and would leak through getGateway).
        const gw = deserializeGatewayWithAccumulator(Buffer.from(acct.data));
        out.set(unique[i], gw.cumulativeRewardPerToken);
      } catch {
        // Skip malformed; the caller will fall back to the raw delegation amount.
      }
    }
    return out;
  }

  /** Read the gateway registry and return addresses in registry index order */
  protected async getRegistryGatewayAddresses(): Promise<string[]> {
    const [registryPda] = await getGatewayRegistryPDA(this.garProgram);
    const registryAccount = await this.getAccount(registryPda);
    if (!registryAccount.exists) return [];

    const registryData = Buffer.from(registryAccount.data);
    const count = registryData.readUInt32LE(40); // 8 disc + 32 authority
    const slotsOffset = 48; // 8 + 32 + 4 + 4
    // GatewaySlot: address(32) + composite_weight(8) + start_timestamp(8)
    //            + status(1) + _padding(7) = 56 bytes (see ario-gar
    //            state/mod.rs::GatewaySlot).
    const SLOT_STRIDE = 56;
    const addresses: string[] = [];
    for (let i = 0; i < count && i < 3000; i++) {
      const slotOffset = slotsOffset + i * SLOT_STRIDE;
      const addr = addressDecoder.decode(
        registryData.subarray(slotOffset, slotOffset + 32),
      );
      addresses.push(addr as string);
    }
    return addresses;
  }

  // =========================================
  // Protocol info
  // =========================================

  async getInfo() {
    const [[configPda], [epochSettingsPda]] = await Promise.all([
      getArioConfigPDA(this.coreProgram),
      getEpochSettingsPDA(this.garProgram),
    ]);

    const [configAccount, epochAccount] = await Promise.all([
      this.getAccount(configPda),
      this.getAccount(epochSettingsPda),
    ]);

    const config = configAccount.exists
      ? deserializeArioConfig(Buffer.from(configAccount.data))
      : null;
    const epoch = epochAccount.exists
      ? deserializeEpochSettings(Buffer.from(epochAccount.data))
      : null;

    return {
      Ticker: 'ARIO',
      Name: 'AR.IO',
      Logo: '',
      Denomination: 6,
      Handlers: [],
      LastCreatedEpochIndex: 0,
      LastDistributedEpochIndex: 0,
      ...(config
        ? {
            totalSupply: config.totalSupply,
            protocolBalance: config.protocolBalance,
          }
        : {}),
      ...(epoch ? { epochSettings: epoch } : {}),
    };
  }

  async getTokenSupply(): Promise<TokenSupplyData> {
    const [configPda] = await getArioConfigPDA(this.coreProgram);
    const [garSettingsPda] = await getGarSettingsPDA(this.garProgram);

    const [configAccount, garSettingsAccount] = await Promise.all([
      this.getAccount(configPda),
      this.getAccount(garSettingsPda),
    ]);

    if (!configAccount.exists) {
      throw new Error('ArioConfig account not found');
    }
    const config = deserializeArioConfig(Buffer.from(configAccount.data));

    // Supply counters from GatewaySettings (staked/delegated/withdrawn).
    // Falls back to 0 if GatewaySettings doesn't exist yet or is at the
    // old size (pre-supply-counters layout).
    let staked = 0;
    let delegated = 0;
    let withdrawn = 0;
    if (garSettingsAccount.exists) {
      try {
        const counters = deserializeGarSupplyCounters(
          Buffer.from(garSettingsAccount.data),
        );
        staked = counters.totalStaked;
        delegated = counters.totalDelegated;
        withdrawn = counters.totalWithdrawn;
      } catch {
        // Old-layout account without supply counters — fall back to 0
      }
    }

    return {
      total: config.totalSupply,
      circulating: config.circulatingSupply,
      locked: config.lockedSupply,
      staked,
      delegated,
      withdrawn,
      protocolBalance: config.protocolBalance,
    };
  }

  // =========================================
  // Balance read methods
  // =========================================

  /**
   * Resolve the ARIO SPL mint address from the on-chain `ArioConfig`.
   *
   * `ArioConfig` layout: [8 disc][32 authority][32 mint][...]. We decode
   * the mint at offset 40 and cache it for the lifetime of this instance —
   * the mint never changes once the protocol is deployed.
   */
  protected async getArioMint(): Promise<Address> {
    if (this._arioMint) return this._arioMint;
    const [configPda] = await getArioConfigPDA(this.coreProgram);
    const account = await this.getAccount(configPda);
    if (!account.exists) {
      throw new Error(
        `ArioConfig not found at ${configPda} on coreProgram ${this.coreProgram} — is the program deployed and initialized?`,
      );
    }
    const data = Buffer.from(account.data);
    const mint = addressDecoder.decode(data.subarray(40, 72));
    this._arioMint = mint;
    return mint;
  }

  /**
   * Liquid ARIO balance for an address.
   *
   * On Solana the ARIO token is a real SPL mint, so the canonical liquid
   * balance lives on the user's Associated Token Account — *not* the
   * `ario-core::Balance` PDA. The Balance PDA is only populated by the
   * one-shot AO-to-Solana migration importer for legacy snapshot accounts;
   * spending it requires a separate claim flow that mints/transfers SPL
   * tokens to the user's ATA. Steady-state instructions like `buy_name`,
   * gateway/delegate stake, and ARIO transfers all move SPL tokens, so the
   * ATA is what every UI and on-chain caller cares about.
   *
   * Returns 0 if the user has no ATA initialized yet.
   */
  async getBalance({
    address: owner,
  }: {
    address: WalletAddress;
  }): Promise<number> {
    const mint = await this.getArioMint();
    const ata = await getAssociatedTokenAddressKit(mint, address(owner));
    const account = await this.getAccount(ata);
    if (!account.exists) return 0;
    // SPL Token Account layout: [0..32]=mint, [32..64]=owner, [64..72]=amount(u64 LE), …
    const data = account.data;
    if (data.length < 72) return 0;
    // NOTE: avoid `Buffer.readBigUInt64LE` — some browser bundlers (notably
    // arns-react's Vite output) strip the BigInt readers from the
    // `buffer@6.0.3` shim's prototype. Manual little-endian u64 decode is
    // portable across every JS runtime.
    let amount = 0n;
    for (let i = 7; i >= 0; i--) {
      amount = (amount << 8n) | BigInt(data[64 + i]);
    }
    // ARIO supply caps at 1B * 1e6 mARIO ≈ 2^50, well under Number.MAX_SAFE_INTEGER.
    return Number(amount);
  }

  /**
   * Enumerate liquid ARIO balances by querying the SPL Token program for
   * every initialized token account on the ARIO mint.
   *
   * Filters: token-account size = 165, mint at offset 0. We then decode
   * `owner` (offset 32) and `amount` (offset 64) from each.
   */
  async getBalances(
    params?: PaginationParams<BalanceWithAddress>,
  ): Promise<PaginationResult<BalanceWithAddress>> {
    const mint = await this.getArioMint();

    const filters = [
      { dataSize: 165n },
      {
        memcmp: {
          offset: 0n,
          bytes: mint as string,
          encoding: 'base58' as const,
        },
      },
    ];
    const result = await withRetry(
      () =>
        (this.rpc as any)
          .getProgramAccounts(TOKEN_PROGRAM_ADDRESS, {
            commitment: this.commitment,
            encoding: 'base64',
            filters,
          })
          .send() as Promise<
          ReadonlyArray<{
            account: { data: readonly [string, string] };
            pubkey: Address;
          }>
        >,
    );

    const items: BalanceWithAddress[] = [];
    for (const entry of result) {
      try {
        const data = Buffer.from(entry.account.data[0], 'base64');
        if (data.length < 72) continue;
        const ownerAddress = addressDecoder.decode(data.subarray(32, 64));
        const amount = Number(data.readBigUInt64LE(64));
        if (amount > 0) {
          items.push({ address: ownerAddress, balance: amount });
        }
      } catch {
        // Skip malformed accounts
      }
    }

    return paginate(items, params);
  }

  // =========================================
  // Vault read methods
  // =========================================

  async getVault({
    address: owner,
    vaultId,
  }: {
    address: WalletAddress;
    vaultId: string;
  }): Promise<VaultData> {
    const [pda] = await getVaultPDA(
      address(owner),
      BigInt(vaultId),
      this.coreProgram,
    );
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`Vault not found for ${owner}:${vaultId}`);
    }
    const vault = deserializeVault(Buffer.from(account.data));
    return {
      balance: vault.balance,
      startTimestamp: secToMs(vault.startTimestamp),
      endTimestamp: secToMs(vault.endTimestamp),
      controller: vault.controller,
    };
  }

  async getVaults(
    params?: PaginationParams<WalletVault>,
  ): Promise<PaginationResult<WalletVault>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.coreProgram,
      VAULT_DISCRIMINATOR,
    );

    const items: WalletVault[] = [];
    for (const { pubkey, data } of accounts) {
      try {
        const vault = deserializeVault(data);
        items.push({
          address: vault.owner,
          vaultId: pubkey as string,
          balance: vault.balance,
          startTimestamp: secToMs(vault.startTimestamp),
          endTimestamp: secToMs(vault.endTimestamp),
          controller: vault.controller,
        });
      } catch {
        // Skip malformed accounts
      }
    }

    return paginate(items, params);
  }

  // =========================================
  // Gateway read methods
  // =========================================

  async getGateway({ address: addr }: AddressParams): Promise<Gateway> {
    const [pda] = await getGatewayPDA(address(addr), this.garProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`Gateway not found for operator ${addr}`);
    }
    const gw = deserializeGateway(Buffer.from(account.data));
    const { operator: _, ...gateway } = gw;
    return toMsTimestamps(gateway);
  }

  async getGateways(
    params?: PaginationParams<GatewayWithAddress>,
  ): Promise<PaginationResult<GatewayWithAddress>> {
    const [registryPda] = await getGatewayRegistryPDA(this.garProgram);
    const registryAccount = await this.getAccount(registryPda);
    if (!registryAccount.exists) {
      return paginate<GatewayWithAddress>([], params);
    }

    const registryData = Buffer.from(registryAccount.data);
    const count = registryData.readUInt32LE(40);
    const slotsOffset = 48;

    // GatewaySlot = address(32) + composite_weight(8) + start_timestamp(8)
    //              + status(1) + _padding(7) = 56 bytes (see ario-gar
    //              state/mod.rs::GatewaySlot). A previous off-by-16-bytes-per-slot
    //              stride silently read garbage for slots 1+, returning at most
    //              one gateway no matter how many had joined.
    const SLOT_STRIDE = 56;
    const gatewayAddresses: Address[] = [];
    for (let i = 0; i < count && i < 3000; i++) {
      const slotOffset = slotsOffset + i * SLOT_STRIDE;
      const addr = addressDecoder.decode(
        registryData.subarray(slotOffset, slotOffset + 32),
      );
      if (addr !== DEFAULT_ADDRESS) {
        gatewayAddresses.push(addr);
      }
    }

    // Batch fetch gateway PDAs (kit has no hard limit but keep 100-at-a-time
    // for sensible RPC request sizes).
    const allItems: GatewayWithAddress[] = [];
    for (let i = 0; i < gatewayAddresses.length; i += 100) {
      const batch = gatewayAddresses.slice(i, i + 100);
      const pdas = await Promise.all(
        batch.map(
          async (addr) => (await getGatewayPDA(addr, this.garProgram))[0],
        ),
      );
      const accounts = await fetchEncodedAccounts(this.rpc, pdas, {
        commitment: this.commitment,
      });

      for (const acct of accounts) {
        if (!acct.exists) continue;
        try {
          const gw = deserializeGateway(Buffer.from(acct.data));
          allItems.push(toMsTimestamps({ ...gw, gatewayAddress: gw.operator }));
        } catch {
          // Skip malformed
        }
      }
    }

    return paginate(allItems, params);
  }

  async getGatewayDelegates(
    params: AddressParams & PaginationParams<GatewayDelegateWithAddress>,
  ): Promise<PaginationResult<GatewayDelegateWithAddress>> {
    const gateway = address(params.address);
    // Filter delegations by gateway pubkey at offset 8 (after discriminator)
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      DELEGATION_DISCRIMINATOR,
      [
        {
          memcmp: { offset: 8n, bytes: gateway as string, encoding: 'base58' },
        },
      ],
    );

    // Fetch this gateway's current reward accumulator so we can return live
    // balances (raw `Delegation.amount` is stale between settlements — see
    // INVARIANTS.md and `computeLiveDelegationBalance`).
    const accumulators = await this.getGatewayAccumulators([gateway as string]);
    const cumulative = accumulators.get(gateway as string) ?? 0n;

    const items: GatewayDelegateWithAddress[] = [];
    for (const { data } of accounts) {
      try {
        const del = deserializeDelegation(data);
        items.push({
          address: del.delegator,
          delegatedStake: computeLiveDelegationBalance({
            delegatedStake: del.delegatedStake,
            rewardDebt: del.rewardDebt,
            cumulativeRewardPerToken: cumulative,
          }),
          startTimestamp: secToMs(del.startTimestamp),
        });
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  async getGatewayDelegateAllowList(
    params: PaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>> {
    const gateway = address(params.address);
    // Filter allowlist entries by gateway pubkey at offset 8
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      ALLOWLIST_ENTRY_DISCRIMINATOR,
      [
        {
          memcmp: { offset: 8n, bytes: gateway as string, encoding: 'base58' },
        },
      ],
    );

    const items: WalletAddress[] = [];
    for (const { data } of accounts) {
      try {
        const entry = deserializeAllowlist(data);
        items.push(entry.delegate);
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  /**
   * Returns every delegation a wallet currently has, covering both halves
   * of the `Delegation` union:
   *
   * - `type: 'stake'` — active `Delegation` PDAs (filtered by delegator at
   *   memcmp offset 40 = 8 disc + 32 gateway).
   * - `type: 'vault'` — pending delegate-stake withdrawals: `Withdrawal`
   *   PDAs filtered by owner at memcmp offset 8 (= 8 disc), then narrowed
   *   client-side to `isDelegate: true`. Operator-stake withdrawals are
   *   excluded — those are surfaced via `getWithdrawals` /
   *   `getGatewayVaults`.
   *
   * Both queries run in parallel; consumers see a single merged result
   * matching the cross-backend interface contract.
   */
  async getDelegations(
    params: PaginationParams<Delegation> & { address: WalletAddress },
  ): Promise<PaginationResult<Delegation>> {
    const owner = address(params.address);

    const [delegationAccounts, withdrawalAccounts] = await Promise.all([
      // Active delegations — `Delegation` PDA layout:
      // disc(8) + gateway(32) + delegator(32) + ... — delegator at offset 40.
      this.getAccountsByDiscriminator(
        this.garProgram,
        DELEGATION_DISCRIMINATOR,
        [
          {
            memcmp: { offset: 40n, bytes: owner as string, encoding: 'base58' },
          },
        ],
      ),
      // Pending vault delegations — `Withdrawal` PDA layout:
      // disc(8) + owner(32) + withdrawal_id(8) + gateway(32) + ... — owner at offset 8.
      this.getAccountsByDiscriminator(
        this.garProgram,
        WITHDRAWAL_DISCRIMINATOR,
        [
          {
            memcmp: { offset: 8n, bytes: owner as string, encoding: 'base58' },
          },
        ],
      ),
    ]);

    const decodedDelegations: Array<{
      pubkey: string;
      del: ReturnType<typeof deserializeDelegation>;
    }> = [];
    for (const { pubkey, data } of delegationAccounts) {
      try {
        decodedDelegations.push({
          pubkey: pubkey as string,
          del: deserializeDelegation(data),
        });
      } catch {
        // Skip malformed
      }
    }

    // Batch-fetch each referenced gateway's reward accumulator so we can
    // return live balances. See INVARIANTS.md and `computeLiveDelegationBalance`.
    const accumulators = await this.getGatewayAccumulators(
      decodedDelegations.map(({ del }) => del.gateway),
    );

    const stakeItems: Delegation[] = decodedDelegations.map(
      ({ pubkey, del }) => ({
        type: 'stake' as const,
        gatewayAddress: del.gateway,
        delegationId: pubkey,
        startTimestamp: secToMs(del.startTimestamp),
        balance: computeLiveDelegationBalance({
          delegatedStake: del.delegatedStake,
          rewardDebt: del.rewardDebt,
          cumulativeRewardPerToken: accumulators.get(del.gateway) ?? 0n,
        }),
      }),
    );

    const vaultItems: Delegation[] = [];
    for (const { pubkey, data } of withdrawalAccounts) {
      try {
        const w = deserializeWithdrawal(data);
        // Delegate-stake decreases only. Operator-stake withdrawals (the
        // operator's own decreaseOperatorStake calls) belong on
        // `getWithdrawals` / `getGatewayVaults`, not `getDelegations`.
        if (!w.isDelegate) continue;
        vaultItems.push({
          type: 'vault' as const,
          gatewayAddress: w.gateway,
          delegationId: pubkey as string,
          vaultId: w.vaultId,
          balance: w.balance,
          startTimestamp: secToMs(w.startTimestamp),
          endTimestamp: secToMs(w.endTimestamp),
        });
      } catch {
        // Skip malformed
      }
    }

    return paginate([...stakeItems, ...vaultItems], params);
  }

  async getAllowedDelegates(
    params: PaginatedAddressParams,
  ): Promise<PaginationResult<WalletAddress>> {
    return this.getGatewayDelegateAllowList(params);
  }

  async getGatewayVaults(
    params: PaginationParams<GatewayVault> & { address: WalletAddress },
  ): Promise<PaginationResult<GatewayVault>> {
    const gateway = address(params.address);
    // Withdrawal: disc(8) + owner(32) + withdrawal_id(8) + gateway(32)
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      WITHDRAWAL_DISCRIMINATOR,
      [
        {
          memcmp: { offset: 48n, bytes: gateway as string, encoding: 'base58' },
        },
      ],
    );

    const items: GatewayVault[] = [];
    for (const { pubkey, data } of accounts) {
      try {
        const w = deserializeWithdrawal(data);
        if (!w.isDelegate) {
          items.push({
            cursorId: pubkey as string,
            vaultId: w.vaultId,
            balance: w.balance,
            startTimestamp: secToMs(w.startTimestamp),
            endTimestamp: secToMs(w.endTimestamp),
          });
        }
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  /**
   * Return every pending stake withdrawal owned by `address` — operator-stake
   * decreases (`isDelegate: false`) and delegate-stake decreases
   * (`isDelegate: true`) in one paginated result. A withdrawal is claimable
   * when `Date.now() >= endTimestamp`; release the funds via
   * `claimWithdrawal({ withdrawalId: item.vaultId })`.
   *
   * Solana-only: AO releases withdrawals automatically at maturity and has no
   * equivalent per-owner read; the AO backend throws.
   */
  async getWithdrawals(
    params: PaginationParams<UserWithdrawal> & { address: WalletAddress },
  ): Promise<PaginationResult<UserWithdrawal>> {
    const owner = address(params.address);
    // Withdrawal layout: disc(8) + owner(32) + withdrawal_id(8) + gateway(32).
    // Filter by owner at offset 8 — returns both operator-stake (isDelegate=false)
    // and delegate-stake (isDelegate=true) withdrawals for this wallet.
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      WITHDRAWAL_DISCRIMINATOR,
      [
        {
          memcmp: { offset: 8n, bytes: owner as string, encoding: 'base58' },
        },
      ],
    );

    const items: UserWithdrawal[] = [];
    for (const { pubkey, data } of accounts) {
      try {
        const w = deserializeWithdrawal(data);
        items.push({
          cursorId: pubkey as string,
          vaultId: w.vaultId,
          balance: w.balance,
          startTimestamp: secToMs(w.startTimestamp),
          endTimestamp: secToMs(w.endTimestamp),
          gatewayAddress: w.gateway,
          isDelegate: w.isDelegate,
        });
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  // =========================================
  // ArNS read methods
  // =========================================

  async getArNSRecord({ name }: { name: string }): Promise<ArNSNameData> {
    const [pda] = await getArnsRecordPDA(name, this.arnsProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`ArNS record not found: ${name}`);
    }
    const record = deserializeArnsRecord(Buffer.from(account.data));
    const { name: _, owner: __, ...nameData } = record;
    return nameData;
  }

  async getArNSRecords(
    params?: GetArNSRecordsParams,
  ): Promise<PaginationResult<ArNSNameDataWithName>> {
    // `processId` is the only filter the AO backend supports today and the
    // only one that maps to a fixed-offset memcmp on `ArnsRecord` (the
    // `ant` field, see `ARNS_RECORD_ANT_OFFSET`). When supplied we
    // dispatch through the bulk-by-mint path so the RPC does the
    // filtering instead of streaming every record back to the client.
    const filterMints = normalizeProcessIdFilter(params?.filters?.processId);
    if (filterMints.length > 0) {
      const items = await this.fetchArnsRecordsByAntMints(filterMints);
      return paginate(items, params);
    }

    const accounts = await this.getAccountsByDiscriminator(
      this.arnsProgram,
      ARNS_RECORD_DISCRIMINATOR,
    );

    const items: ArNSNameDataWithName[] = [];
    for (const { data } of accounts) {
      try {
        items.push(arnsRecordToWithName(deserializeArnsRecord(data)));
      } catch {
        // Skip accounts that don't match
      }
    }

    return paginate(items, params);
  }

  /**
   * Fetch every `ArnsRecord` whose `ant` field equals one of `mints`.
   *
   * Issues one `getProgramAccounts` per mint with a memcmp filter at
   * `ARNS_RECORD_ANT_OFFSET`, in parallel. Cheaper than scanning the
   * whole registry as soon as the caller has fewer mints than the
   * registry has records (today the break-even is ≈ a few hundred
   * mints against ≈ 4k records, and rises as the registry grows).
   *
   * The shape mirrors `getArNSRecord` / `getArNSRecords` — same
   * `ArNSNameDataWithName` items, no pagination wrapper. Callers
   * that want pagination should drive it via `getArNSRecords({
   * filters: { processId: mints } })` instead.
   */
  async getArNSRecordsByAntMints({
    mints,
  }: {
    mints: ReadonlyArray<string>;
  }): Promise<ArNSNameDataWithName[]> {
    return this.fetchArnsRecordsByAntMints(mints);
  }

  private async fetchArnsRecordsByAntMints(
    mints: ReadonlyArray<string>,
  ): Promise<ArNSNameDataWithName[]> {
    const unique = Array.from(new Set(mints));
    if (unique.length === 0) return [];

    // Parallel fan-out: one filtered gPA per mint. Each request is
    // selective (matches at most one record on a healthy registry),
    // so the marginal cost is mostly the round trip; major RPCs index
    // memcmp filters at stable offsets, keeping this O(N) in network
    // round trips rather than O(N) in registry size.
    const perMint = await Promise.all(
      unique.map((mint) =>
        this.getAccountsByDiscriminator(
          this.arnsProgram,
          ARNS_RECORD_DISCRIMINATOR,
          [
            {
              memcmp: {
                offset: BigInt(ARNS_RECORD_ANT_OFFSET),
                bytes: mint,
                encoding: 'base58',
              },
            },
          ],
        ),
      ),
    );

    const items: ArNSNameDataWithName[] = [];
    const seen = new Set<string>();
    for (const accounts of perMint) {
      for (const { pubkey, data } of accounts) {
        const key = String(pubkey);
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          items.push(arnsRecordToWithName(deserializeArnsRecord(data)));
        } catch {
          // Skip malformed
        }
      }
    }
    return items;
  }

  /**
   * Resolve every ArNS record currently controlled by `address`.
   *
   * Mirrors the AO backend: walk the on-chain ANT ACL for the wallet
   * (`Owned ∪ Controlled`), then issue point-queries against the
   * ArNS registry for those mints. This is semantically *not* a query
   * over `ArnsRecord.owner` — that field is a write-once "purchase
   * receipt" and never reflects current control on Solana (see
   * ISSUES.md). Authoritative control flows through the ANT NFT
   * owner / `AntControllers`, which is exactly what the ACL
   * indexes.
   */
  async getArNSRecordsForAddress(
    params: PaginationParams<ArNSNameDataWithName> & {
      address: WalletAddress;
      antRegistryProcessId?: string;
    },
  ): Promise<PaginationResult<ArNSNameDataWithName>> {
    const registry = new SolanaANTRegistryReadable({
      rpc: this.rpc,
      commitment: this.commitment,
      logger: this.logger,
      antProgramId: this.antProgram,
    });
    const { Owned = [], Controlled = [] } = await registry.accessControlList({
      address: params.address,
    });
    const mints = Array.from(new Set([...Owned, ...Controlled]));
    if (mints.length === 0) {
      return {
        items: [],
        hasMore: false,
        nextCursor: undefined,
        limit: params.limit ?? 100,
        totalItems: 0,
        sortOrder: params.sortOrder ?? 'asc',
      };
    }

    const items = await this.fetchArnsRecordsByAntMints(mints);
    return paginate(items, params);
  }

  async getArNSReservedNames(
    params?: PaginationParams<ArNSReservedNameDataWithName>,
  ): Promise<PaginationResult<ArNSReservedNameDataWithName>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.arnsProgram,
      RESERVED_NAME_DISCRIMINATOR,
    );

    const items: ArNSReservedNameDataWithName[] = [];
    for (const { data } of accounts) {
      try {
        const reserved = deserializeReservedName(data);
        items.push({
          name: reserved.name,
          target: reserved.target,
          endTimestamp:
            typeof reserved.endTimestamp === 'number'
              ? secToMs(reserved.endTimestamp)
              : reserved.endTimestamp,
        });
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  async getArNSReservedName({
    name,
  }: {
    name: string;
  }): Promise<ArNSReservedNameData> {
    const [pda] = await getReservedNamePDA(name, this.arnsProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`Reserved name not found: ${name}`);
    }
    const reserved = deserializeReservedName(Buffer.from(account.data));
    return {
      target: reserved.target,
      endTimestamp:
        typeof reserved.endTimestamp === 'number'
          ? secToMs(reserved.endTimestamp)
          : reserved.endTimestamp,
    };
  }

  async getArNSReturnedNames(
    params?: PaginationParams<ReturnedName>,
  ): Promise<PaginationResult<ReturnedName>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.arnsProgram,
      RETURNED_NAME_DISCRIMINATOR,
    );

    const items: ReturnedName[] = [];
    for (const { data } of accounts) {
      try {
        items.push(toMsTimestamps(deserializeReturnedName(data)));
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  async getArNSReturnedName({
    name,
  }: {
    name: string;
  }): Promise<ReturnedName> {
    const [pda] = await getReturnedNamePDA(name, this.arnsProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`Returned name not found: ${name}`);
    }
    return toMsTimestamps(deserializeReturnedName(Buffer.from(account.data)));
  }

  // =========================================
  // Epoch read methods
  // =========================================

  async getEpochSettings(): Promise<EpochSettings> {
    const [pda] = await getEpochSettingsPDA(this.garProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error('Epoch settings account not found');
    }
    return deserializeEpochSettings(Buffer.from(account.data));
  }

  /**
   * Resolve an EpochInput to an epoch index number.
   * - undefined: returns current epoch index from EpochSettings
   * - { epochIndex }: returns directly
   * - { timestamp }: computes from genesis timestamp and epoch duration
   */
  private async resolveEpochIndex(epoch?: EpochInput): Promise<number> {
    if (epoch && 'epochIndex' in epoch) {
      return epoch.epochIndex;
    }

    const [pda] = await getEpochSettingsPDA(this.garProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) throw new Error('EpochSettings account not found');
    const settings = deserializeEpochSettingsFull(Buffer.from(account.data));

    if (!epoch) {
      // On-chain `current_epoch_index` is "NEXT epoch to be created"
      // (incremented inside `create_epoch` AFTER the PDA is initialized
      // — see programs/ario-gar/src/instructions/epoch.rs:161). The
      // currently-active epoch is therefore one back. Floor at 0 for
      // the pre-bootstrap edge case where no epochs have been created
      // yet. Without this adjustment, every call to getEpoch(undefined)
      // sits in the cranker's close_epoch ↔ create_epoch gap and throws
      // "Epoch N not found" — which broke ContractEpochSource on a
      // live cluster (May 2026 devnet).
      return Math.max(0, settings.currentEpochIndex - 1);
    }

    // { timestamp } — compute epoch index. The public API takes `timestamp`
    // in JS milliseconds (matching the AO contract convention), but
    // genesisTimestamp/epochDuration come straight off chain in seconds, so
    // normalize to seconds before doing the division.
    const tsSeconds = Math.floor(epoch.timestamp / 1000);
    const elapsed = tsSeconds - settings.genesisTimestamp;
    return Math.floor(elapsed / settings.epochDuration);
  }

  /** Fetch and deserialize an Epoch account by index */
  private async fetchEpoch(epochIndex: number) {
    const [pda] = await getEpochPDA(epochIndex, this.garProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`Epoch ${epochIndex} not found`);
    }
    return deserializeEpoch(Buffer.from(account.data));
  }

  async getEpoch(epoch?: EpochInput): Promise<EpochData> {
    const epochIndex = await this.resolveEpochIndex(epoch);
    const epochData = await this.fetchEpoch(epochIndex);

    // Build prescribed observers list (only up to observerCount)
    const prescribedObservers: WeightedObserver[] = [];
    for (let i = 0; i < epochData.observerCount; i++) {
      const observerAddress = epochData.prescribedObservers[i];
      const gatewayAddress = epochData.prescribedObserverGateways[i];
      if (observerAddress === DEFAULT_ADDRESS) continue;

      // Try to fetch gateway data for weights
      let weights: GatewayWeights = {
        stakeWeight: 0,
        tenureWeight: 0,
        gatewayRewardRatioWeight: 0,
        observerRewardRatioWeight: 0,
        gatewayPerformanceRatio: 0,
        observerPerformanceRatio: 0,
        compositeWeight: 0,
        normalizedCompositeWeight: 0,
      };
      let stake = 0;
      let startTimestamp = 0;

      try {
        const gw = await this.getGateway({ address: gatewayAddress as string });
        weights = gw.weights;
        stake = gw.operatorStake;
        // gw.startTimestamp is already converted to ms by getGateway.
        startTimestamp = gw.startTimestamp;
      } catch {
        // Gateway may no longer exist
      }

      prescribedObservers.push({
        gatewayAddress: gatewayAddress as string,
        observerAddress: observerAddress as string,
        stake,
        startTimestamp,
        ...weights,
      });
    }

    // Build prescribed names list by resolving hashes → ArnsRecord PDAs
    const prescribedNames: string[] = [];
    const zeroHash = Buffer.alloc(32);
    for (let i = 0; i < epochData.nameCount; i++) {
      const nameHash = epochData.prescribedNameHashes[i];
      if (!nameHash || nameHash.equals(zeroHash)) continue;
      try {
        const [recordPda] = await getArnsRecordPDAFromHash(
          nameHash,
          this.arnsProgram,
        );
        const recordAccount = await this.getAccount(recordPda);
        if (recordAccount.exists) {
          const record = deserializeArnsRecord(Buffer.from(recordAccount.data));
          prescribedNames.push(record.name);
        }
      } catch {
        // Record may have been removed
      }
    }

    // Build observations from Observation PDAs
    const observations = await this.getObservations({ epochIndex });

    // Build distribution totals
    const distributions: EpochDistributionData = {
      totalEligibleGateways: epochData.activeGatewayCount,
      totalEligibleRewards: epochData.totalEligibleRewards,
      totalEligibleObserverReward:
        epochData.perObserverReward * epochData.observerCount,
      totalEligibleGatewayReward:
        epochData.perGatewayReward * epochData.activeGatewayCount,
    };

    return {
      epochIndex,
      startHeight: 0, // Solana doesn't use AO block heights
      startTimestamp: secToMs(epochData.startTimestamp),
      endTimestamp: secToMs(epochData.endTimestamp),
      distributionTimestamp: secToMs(epochData.endTimestamp),
      observations,
      prescribedObservers,
      prescribedNames,
      distributions,
      arnsStats: {
        totalReturnedNames: 0,
        totalActiveNames: 0,
        totalGracePeriodNames: 0,
        totalReservedNames: 0,
      },
    };
  }

  async getCurrentEpoch(): Promise<EpochData> {
    return this.getEpoch(undefined);
  }

  async getPrescribedObservers(
    epoch?: EpochInput,
  ): Promise<WeightedObserver[]> {
    const epochData = await this.getEpoch(epoch);
    return epochData.prescribedObservers;
  }

  async getPrescribedNames(epoch?: EpochInput): Promise<string[]> {
    const epochIndex = await this.resolveEpochIndex(epoch);
    const epochData = await this.fetchEpoch(epochIndex);

    const names: string[] = [];
    const zeroHash = Buffer.alloc(32);
    for (let i = 0; i < epochData.nameCount; i++) {
      const nameHash = epochData.prescribedNameHashes[i];
      if (!nameHash || nameHash.equals(zeroHash)) continue;
      try {
        const [recordPda] = await getArnsRecordPDAFromHash(
          nameHash,
          this.arnsProgram,
        );
        const recordAccount = await this.getAccount(recordPda);
        if (recordAccount.exists) {
          const record = deserializeArnsRecord(Buffer.from(recordAccount.data));
          names.push(record.name);
        }
      } catch {
        // Record may have been removed
      }
    }
    return names;
  }

  async getObservations(epoch?: EpochInput): Promise<EpochObservationData> {
    const epochIndex = await this.resolveEpochIndex(epoch);

    // Fetch all Observation accounts for this epoch
    const epochIndexBuf = Buffer.alloc(8);
    epochIndexBuf.writeBigUInt64LE(BigInt(epochIndex));

    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      OBSERVATION_DISCRIMINATOR,
      [
        {
          memcmp: {
            offset: 8n,
            bytes: bs58.encode(epochIndexBuf),
            encoding: 'base58',
          },
        },
      ],
    );

    const failureSummaries: Record<string, string[]> = {};
    const reports: Record<string, string> = {};

    // Read gateway registry to get index-to-address mapping (matches bitfield order)
    const gatewayAddresses = await this.getRegistryGatewayAddresses();

    for (const { data } of accounts) {
      try {
        const obs = deserializeObservation(data);
        reports[obs.observer] = obs.reportTxId;

        // Parse gateway_results bitmap — 1 = passed, 0 = failed (on-chain convention)
        for (
          let i = 0;
          i < obs.gatewayCount && i < gatewayAddresses.length;
          i++
        ) {
          const byteIdx = Math.floor(i / 8);
          const bitIdx = i % 8;
          const passed = (obs.gatewayResults[byteIdx] >> bitIdx) & 1;
          if (!passed) {
            const gwAddr = gatewayAddresses[i];
            if (!failureSummaries[gwAddr]) {
              failureSummaries[gwAddr] = [];
            }
            failureSummaries[gwAddr].push(obs.observer);
          }
        }
      } catch {
        // Skip malformed
      }
    }

    return { failureSummaries, reports };
  }

  async getDistributions(epoch?: EpochInput): Promise<EpochDistributionData> {
    const epochIndex = await this.resolveEpochIndex(epoch);
    const epochData = await this.fetchEpoch(epochIndex);

    return {
      totalEligibleGateways: epochData.activeGatewayCount,
      totalEligibleRewards: epochData.totalEligibleRewards,
      totalEligibleObserverReward:
        epochData.perObserverReward * epochData.observerCount,
      totalEligibleGatewayReward:
        epochData.perGatewayReward * epochData.activeGatewayCount,
    };
  }

  async getEligibleEpochRewards(
    epoch?: EpochInput,
    params?: PaginationParams<EligibleDistribution>,
  ): Promise<PaginationResult<EligibleDistribution>> {
    const epochIndex = await this.resolveEpochIndex(epoch);
    const epochData = await this.fetchEpoch(epochIndex);

    const items: EligibleDistribution[] = [];

    // Each gateway operator gets a gateway reward
    const gatewayAccounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      GATEWAY_DISCRIMINATOR,
    );

    for (const { data } of gatewayAccounts) {
      try {
        const gw = deserializeGateway(data);
        if (gw.status !== 'joined') continue;

        items.push({
          type: 'operatorReward',
          recipient: gw.operator,
          eligibleReward: epochData.perGatewayReward,
          gatewayAddress: gw.operator,
          cursorId: gw.operator,
        });
      } catch {
        // skip
      }
    }

    // Each prescribed observer gets an observer reward
    for (let i = 0; i < epochData.observerCount; i++) {
      const observerAddr = epochData.prescribedObservers[i];
      const gatewayAddr = epochData.prescribedObserverGateways[i];
      if (observerAddr === DEFAULT_ADDRESS) continue;

      items.push({
        type: 'operatorReward',
        recipient: gatewayAddr as string,
        eligibleReward: epochData.perObserverReward,
        gatewayAddress: gatewayAddr as string,
        cursorId: `${gatewayAddr}-observer`,
      });
    }

    return paginate(items, params);
  }

  // =========================================
  // Pricing / cost read methods
  // =========================================

  /**
   * Compute the token cost for an ArNS operation.
   *
   * Mirrors the Rust pricing functions in ario-arns/src/pricing.rs.
   * Uses BigInt for u128-equivalent overflow-safe arithmetic.
   */
  async getTokenCost(params: TokenCostParams): Promise<number> {
    const [dfPda] = await getDemandFactorPDA(this.arnsProgram);
    const dfAccount = await this.getAccount(dfPda);
    if (!dfAccount.exists) throw new Error('DemandFactor account not found');
    const df = deserializeDemandFactor(Buffer.from(dfAccount.data));

    const name = params.name.toLowerCase();
    const nameLen = Math.min(Math.max(name.length, 1), 51);
    const baseFee = df.fees[nameLen - 1] ?? df.fees[df.fees.length - 1];
    // currentDemandFactor is already divided by RATE_SCALE in deserializer,
    // but we need the raw scaled value for integer math
    const demandFactorRaw = BigInt(
      Math.round(df.currentDemandFactor * RATE_SCALE),
    );
    const scale = BigInt(RATE_SCALE);
    const bf = BigInt(baseFee);

    let cost: bigint;

    switch (params.intent) {
      case 'Buy-Name':
      case 'Buy-Record': {
        const purchaseType = params.type ?? 'lease';
        if (purchaseType === 'permabuy') {
          cost = (bf * demandFactorRaw * 5n) / scale;
        } else {
          const years = BigInt(params.years ?? 1);
          const annualPct = 200_000n;
          const yearFactor = scale + annualPct * years;
          cost = (bf * demandFactorRaw * yearFactor) / scale / scale;
        }

        try {
          const returned = await this.getArNSReturnedName({ name });
          if (returned) {
            // returned.startTimestamp is in ms (public API convention),
            // so the rest of this comparison is in ms too.
            const now = Date.now();
            const elapsed = now - returned.startTimestamp;
            const duration = 14 * 86_400_000;
            if (elapsed < duration) {
              const remaining = BigInt(duration - elapsed);
              const dur = BigInt(duration);
              const pctRemaining = (remaining * scale) / dur;
              const multiplier = 50n * pctRemaining;
              cost = (cost * multiplier) / scale;
            }
          }
        } catch {
          // Not a returned name — no premium
        }
        break;
      }

      case 'Extend-Lease': {
        const years = BigInt(params.years ?? 1);
        const annualPct = 200_000n;
        cost = (bf * demandFactorRaw * annualPct * years) / scale / scale;
        break;
      }

      case 'Increase-Undername-Limit': {
        const qty = BigInt(params.quantity ?? 1);
        let isPermabuy = false;
        try {
          const record = await this.getArNSRecord({ name });
          isPermabuy = record.type === 'permabuy';
        } catch {
          // default to lease pricing
        }
        const pct = isPermabuy ? 5_000n : 1_000n;
        cost = (bf * demandFactorRaw * pct * qty) / scale / scale;
        break;
      }

      case 'Upgrade-Name': {
        const permabuyCost = (bf * demandFactorRaw * 5n) / scale;
        cost = permabuyCost;
        break;
      }

      case 'Primary-Name-Request': {
        const primaryBaseFee = BigInt(df.fees[50]);
        const annualPct = 200_000n;
        const yearFactor = scale + annualPct;
        cost = (primaryBaseFee * demandFactorRaw * yearFactor) / scale / scale;
        break;
      }

      default:
        throw new Error(`Unknown intent: ${params.intent}`);
    }

    return Number(cost);
  }

  async getCostDetails(
    params: GetCostDetailsParams,
  ): Promise<CostDetailsResult> {
    const tokenCost = await this.getTokenCost(params);

    const discounts: Array<{
      name: string;
      discountTotal: number;
      multiplier: number;
    }> = [];

    if (params.fromAddress) {
      try {
        const gw = await this.getGateway({ address: params.fromAddress });
        if (gw.status === 'joined') {
          const discountAmount = Math.floor((tokenCost * 200_000) / RATE_SCALE);
          discounts.push({
            name: 'Gateway Operator',
            discountTotal: discountAmount,
            multiplier: 0.8,
          });
        }
      } catch {
        // Not a gateway operator — no discount
      }
    }

    const totalDiscount = discounts.reduce(
      (sum, d) => sum + d.discountTotal,
      0,
    );
    const finalCost = tokenCost - totalDiscount;

    // Project Solana state into the public-facing `FundingPlan` shape when
    // the caller asks about a specific funding source for a specific wallet.
    // (`fromAddress` is required — we can't enumerate funding sources for
    // an unknown wallet; without `fundFrom` we don't know what to budget
    // against.) The internal `funding-plan.ts` `FundingPlan` is a
    // separate, instruction-building plan — keep them distinct.
    let fundingPlan: FundingPlan | undefined;
    if (params.fromAddress && params.fundFrom !== undefined) {
      fundingPlan = await this.buildPublicFundingPlan({
        fromAddress: params.fromAddress,
        fundFrom: params.fundFrom,
        cost: finalCost,
      });
    }

    return {
      tokenCost: finalCost,
      discounts,
      ...(fundingPlan ? { fundingPlan } : {}),
    };
  }

  /**
   * Project Solana on-chain state into the cross-backend `FundingPlan`
   * shape consumed by UI flows like "how short are you on this purchase,
   * and from which sources?". Always returns the wallet's `balance` and
   * full per-gateway `stakes` breakdown (active delegations + pending
   * delegate-stake withdrawals); `shortfall` is computed against the
   * specific `fundFrom` semantics.
   *
   * Note: the internal `src/solana/funding-plan.ts` `FundingPlan` is a
   * different type — that's the multi-source instruction-building plan
   * used by `buyRecord({ fundFrom: 'any' })`. The two share a concept but
   * not a shape; the public type here is what consumer UIs see.
   */
  private async buildPublicFundingPlan({
    fromAddress,
    fundFrom,
    cost,
  }: {
    fromAddress: WalletAddress;
    fundFrom: FundFrom;
    cost: number;
  }): Promise<FundingPlan> {
    // Pull balance + full delegation list (stake + vault) in parallel.
    // Limit is intentionally large — the public FundingPlan reports the
    // *entire* per-gateway breakdown, not a pagination window.
    const [balance, delegations] = await Promise.all([
      this.getBalance({ address: fromAddress }),
      this.getDelegations({ address: fromAddress, limit: 10_000 }),
    ]);

    const stakes: Record<
      WalletAddress,
      {
        vaults: Record<string, number>[];
        delegatedStake: number;
      }
    > = {};
    for (const d of delegations.items) {
      const gateway = d.gatewayAddress;
      if (!stakes[gateway]) {
        stakes[gateway] = { vaults: [], delegatedStake: 0 };
      }
      if (d.type === 'stake') {
        stakes[gateway].delegatedStake = d.balance;
      } else {
        // `Record<string, number>[]` per-vault entries — AO-era shape we
        // keep for cross-backend compatibility.
        stakes[gateway].vaults.push({ [d.vaultId]: d.balance });
      }
    }

    const sumDelegated = Object.values(stakes).reduce(
      (sum, g) => sum + g.delegatedStake,
      0,
    );
    const sumVaulted = Object.values(stakes).reduce(
      (sum, g) =>
        sum +
        g.vaults.reduce(
          (vsum, v) =>
            vsum + Object.values(v).reduce((a: number, b) => a + b, 0),
          0,
        ),
      0,
    );

    // Compute shortfall against the *eligible* pool for the chosen
    // `fundFrom`. `turbo` and `plan` are special: turbo is paid in
    // off-chain credits (no mARIO shortfall meaningful here), and plan
    // is caller-supplied (caller did their own arithmetic).
    let eligible: number;
    switch (fundFrom) {
      case 'balance':
        eligible = balance;
        break;
      case 'stakes':
        eligible = sumDelegated;
        break;
      case 'withdrawal':
        eligible = sumVaulted;
        break;
      case 'any':
        eligible = balance + sumDelegated + sumVaulted;
        break;
      case 'turbo':
      case 'plan':
        eligible = Number.MAX_SAFE_INTEGER;
        break;
      default: {
        // Exhaustiveness check — surface a missed FundFrom variant at
        // type-check time, not at runtime.
        const _exhaustive: never = fundFrom;
        eligible = 0;
        void _exhaustive;
      }
    }

    return {
      address: fromAddress,
      balance,
      stakes,
      shortfall: Math.max(0, cost - eligible),
    };
  }

  async getRegistrationFees(): Promise<RegistrationFees> {
    const [dfPda] = await getDemandFactorPDA(this.arnsProgram);
    const account = await this.getAccount(dfPda);
    if (!account.exists) {
      throw new Error('DemandFactor account not found');
    }
    const df = deserializeDemandFactor(Buffer.from(account.data));

    const result: RegistrationFees = {};
    for (let len = 1; len <= 51; len++) {
      const baseFee = df.fees[len - 1] ?? 0;
      result[len] = {
        lease: {
          1: Math.floor(baseFee * (1 + 0.2 * 1) * df.currentDemandFactor),
          2: Math.floor(baseFee * (1 + 0.2 * 2) * df.currentDemandFactor),
          3: Math.floor(baseFee * (1 + 0.2 * 3) * df.currentDemandFactor),
          4: Math.floor(baseFee * (1 + 0.2 * 4) * df.currentDemandFactor),
          5: Math.floor(baseFee * (1 + 0.2 * 5) * df.currentDemandFactor),
        },
        permabuy: Math.floor(baseFee * 5 * df.currentDemandFactor),
      };
    }

    return result;
  }

  async getDemandFactor(): Promise<number> {
    const [pda] = await getDemandFactorPDA(this.arnsProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error('DemandFactor account not found');
    }
    return deserializeDemandFactor(Buffer.from(account.data))
      .currentDemandFactor;
  }

  async getDemandFactorSettings(): Promise<DemandFactorSettings> {
    const [pda] = await getDemandFactorPDA(this.arnsProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error('DemandFactor account not found');
    }
    const df = deserializeDemandFactor(Buffer.from(account.data));

    return {
      periodZeroStartTimestamp: df.periodZeroStartTimestamp,
      movingAvgPeriodCount: 7,
      periodLengthMs: 86_400 * 1000,
      demandFactorBaseValue: 1,
      demandFactorMin: 0.5,
      demandFactorUpAdjustmentRate: 50,
      demandFactorDownAdjustmentRate: 25,
      maxPeriodsAtMinDemandFactor: df.consecutivePeriodsWithMinDemandFactor,
      criteria: 'revenue',
    };
  }

  // =========================================
  // Primary name read methods
  // =========================================

  async getPrimaryName(
    params: { address: WalletAddress } | { name: string },
  ): Promise<PrimaryName> {
    // On-chain `PrimaryName` stores only {owner, name, set_at}. The ANT mint
    // that PrimaryName.processId expects lives on the matching ArnsRecord
    // (looked up by the base name). Both lookup paths below deserialize the
    // on-chain account and then enrich with the ArnsRecord lookup.
    const baseNameOf = (n: string): string => {
      const parts = n.toLowerCase().split('_');
      return parts.length === 2 ? parts[1] : parts[0];
    };
    const enrich = async (pn: {
      owner: string;
      name: string;
      startTimestamp: number;
    }): Promise<PrimaryName> => {
      const rec = await this.getArNSRecord({ name: baseNameOf(pn.name) });
      return { ...pn, processId: rec.processId };
    };

    if ('address' in params) {
      const [pda] = await getPrimaryNamePDA(
        address(params.address),
        this.coreProgram,
      );
      const account = await this.getAccount(pda);
      if (!account.exists) {
        throw new Error(`Primary name not found for address ${params.address}`);
      }
      return enrich(deserializePrimaryName(Buffer.from(account.data)));
    }

    // Lookup by name — scan all primary name accounts
    const accounts = await this.getAccountsByDiscriminator(
      this.coreProgram,
      PRIMARY_NAME_DISCRIMINATOR,
    );

    for (const { data } of accounts) {
      try {
        const pn = deserializePrimaryName(data);
        if (pn.name === params.name) {
          return enrich(pn);
        }
      } catch {
        // Skip malformed
      }
    }

    throw new Error(`Primary name not found: ${params.name}`);
  }

  async getPrimaryNameRequest(params: {
    initiator: WalletAddress;
  }): Promise<PrimaryNameRequest> {
    const [pda] = await getPrimaryNameRequestPDA(
      address(params.initiator),
      this.coreProgram,
    );
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error(`Primary name request not found for ${params.initiator}`);
    }
    return deserializePrimaryNameRequest(Buffer.from(account.data));
  }

  async getPrimaryNameRequests(
    params?: PaginationParams<PrimaryNameRequest>,
  ): Promise<PaginationResult<PrimaryNameRequest>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.coreProgram,
      PRIMARY_NAME_REQUEST_DISCRIMINATOR,
    );

    const items: PrimaryNameRequest[] = [];
    for (const { data } of accounts) {
      try {
        items.push(deserializePrimaryNameRequest(data));
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  async getPrimaryNames(
    params?: PaginationParams<PrimaryName>,
  ): Promise<PaginationResult<PrimaryName>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.coreProgram,
      PRIMARY_NAME_DISCRIMINATOR,
    );

    // Enrich each on-chain PrimaryName with its ArnsRecord.processId (the
    // on-chain account doesn't store it; see deserializePrimaryName).
    // Records that no longer have a matching ArnsRecord are silently
    // skipped — same forgiveness the per-name lookup already applies.
    const baseNameOf = (n: string): string => {
      const parts = n.toLowerCase().split('_');
      return parts.length === 2 ? parts[1] : parts[0];
    };
    const items: PrimaryName[] = [];
    for (const { data } of accounts) {
      try {
        const pn = deserializePrimaryName(data);
        const rec = await this.getArNSRecord({ name: baseNameOf(pn.name) });
        items.push({ ...pn, processId: rec.processId });
      } catch {
        // Skip malformed or orphaned (ArnsRecord missing).
      }
    }

    return paginate(items, params);
  }

  // =========================================
  // Redelegation fee
  // =========================================

  async getRedelegationFee(params: {
    address: WalletAddress;
  }): Promise<RedelegationFeeInfo> {
    const { getRedelegationRecordPDA } = await import('./pda.js');
    const [pda] = await getRedelegationRecordPDA(
      address(params.address),
      this.garProgram,
    );

    const account = await this.getAccount(pda);
    if (!account.exists) {
      return { redelegationFeeRate: 0, feeResetTimestamp: 0 };
    }

    const record = deserializeRedelegationRecord(Buffer.from(account.data));
    const now = Math.floor(Date.now() / 1000);

    if (now >= record.feeResetAt) {
      return { redelegationFeeRate: 0, feeResetTimestamp: record.feeResetAt };
    }

    const feeRate = Math.min(record.redelegationCount * 10, 60);
    return {
      redelegationFeeRate: feeRate,
      feeResetTimestamp: record.feeResetAt,
    };
  }

  // =========================================
  // Gateway registry settings
  // =========================================

  async getGatewayRegistrySettings(): Promise<GatewayRegistrySettings> {
    const [pda] = await getGarSettingsPDA(this.garProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) {
      throw new Error('GarSettings account not found');
    }
    return deserializeGarSettings(Buffer.from(account.data));
  }

  // =========================================
  // Aggregate queries
  // =========================================

  async getAllDelegates(
    params?: PaginationParams<AllDelegates>,
  ): Promise<PaginationResult<AllDelegates>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      DELEGATION_DISCRIMINATOR,
    );

    const decoded: Array<{
      pubkey: string;
      del: ReturnType<typeof deserializeDelegation>;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        decoded.push({
          pubkey: pubkey as string,
          del: deserializeDelegation(data),
        });
      } catch {
        // Skip malformed
      }
    }

    // Batch-fetch each referenced gateway's reward accumulator so we can
    // return live balances. See INVARIANTS.md and `computeLiveDelegationBalance`.
    const accumulators = await this.getGatewayAccumulators(
      decoded.map(({ del }) => del.gateway),
    );

    const items: AllDelegates[] = decoded.map(({ pubkey, del }) => ({
      address: del.delegator,
      gatewayAddress: del.gateway,
      delegatedStake: computeLiveDelegationBalance({
        delegatedStake: del.delegatedStake,
        rewardDebt: del.rewardDebt,
        cumulativeRewardPerToken: accumulators.get(del.gateway) ?? 0n,
      }),
      startTimestamp: secToMs(del.startTimestamp),
      vaultedStake: 0,
      cursorId: pubkey,
    }));

    return paginate(items, params);
  }

  async getAllGatewayVaults(
    params?: PaginationParams<AllGatewayVaults>,
  ): Promise<PaginationResult<AllGatewayVaults>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      WITHDRAWAL_DISCRIMINATOR,
    );

    const items: AllGatewayVaults[] = [];
    for (const { pubkey, data } of accounts) {
      try {
        const w = deserializeWithdrawal(data);
        items.push({
          cursorId: pubkey as string,
          vaultId: w.vaultId,
          balance: w.balance,
          startTimestamp: secToMs(w.startTimestamp),
          endTimestamp: secToMs(w.endTimestamp),
          gatewayAddress: w.gateway,
        });
      } catch {
        // Skip malformed
      }
    }

    return paginate(items, params);
  }

  // =========================================
  // Prune / cleanup discovery (Solana-only)
  // =========================================
  //
  // These helpers enumerate accounts eligible for the permissionless prune
  // ix surface (see SolanaARIOWriteable). All read on-chain via
  // `getProgramAccounts` + the Codama decoders, then post-filter
  // client-side because most eligibility predicates can't be expressed as
  // memcmp filters (variable-length names shift offsets; Option<i64>
  // adds a tag byte). Volume is bounded — the cranker is expected to
  // call these once per epoch cycle, not per-tx.
  //
  // See `docs/CRANKER_PRUNING_PLAN.md` for the design.

  /**
   * Enumerate ArnsRecord PDAs whose lease has fully expired
   * (`end_timestamp + grace_period + return_auction_duration <= now`).
   * Permabuys (no `end_timestamp`) are excluded. Pass a unix-seconds `now`.
   */
  async getExpiredArnsRecords(
    now: number,
  ): Promise<Array<{ pubkey: Address; name: string; endTimestamp: bigint }>> {
    const [arnsConfigPda] = await getArnsSettingsPDA(this.arnsProgram);
    const cfgAccount = await this.getAccount(arnsConfigPda);
    if (!cfgAccount.exists) return [];
    const cfg = getArnsConfigDecoder().decode(cfgAccount.data);
    const grace = Number(cfg.gracePeriodSeconds);
    const auction = Number(cfg.returnAuctionDurationSeconds);

    const accounts = await this.getAccountsByDiscriminator(
      this.arnsProgram,
      ARNS_RECORD_DISCRIMINATOR,
    );
    const decoder = getArnsRecordDecoder();
    const out: Array<{
      pubkey: Address;
      name: string;
      endTimestamp: bigint;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const r = decoder.decode(data);
        if (r.endTimestamp.__option !== 'Some') continue;
        const end = Number(r.endTimestamp.value);
        if (end + grace + auction <= now) {
          out.push({
            pubkey,
            name: r.name,
            endTimestamp: r.endTimestamp.value,
          });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate ReturnedName PDAs whose Dutch auction window has fully
   * elapsed (`returned_at + return_auction_duration <= now`).
   */
  async getExpiredReturnedNames(
    now: number,
  ): Promise<Array<{ pubkey: Address; name: string; returnedAt: bigint }>> {
    const [arnsConfigPda] = await getArnsSettingsPDA(this.arnsProgram);
    const cfgAccount = await this.getAccount(arnsConfigPda);
    if (!cfgAccount.exists) return [];
    const cfg = getArnsConfigDecoder().decode(cfgAccount.data);
    const auction = Number(cfg.returnAuctionDurationSeconds);

    const accounts = await this.getAccountsByDiscriminator(
      this.arnsProgram,
      RETURNED_NAME_DISCRIMINATOR,
    );
    const decoder = getReturnedNameDecoder();
    const out: Array<{
      pubkey: Address;
      name: string;
      returnedAt: bigint;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const r = decoder.decode(data);
        if (Number(r.returnedAt) + auction <= now) {
          out.push({ pubkey, name: r.name, returnedAt: r.returnedAt });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate ReservedName PDAs whose `expires_at` has passed.
   * Permanent reservations (`expires_at: None`) are excluded.
   */
  async getExpiredReservations(
    now: number,
  ): Promise<Array<{ pubkey: Address; name: string }>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.arnsProgram,
      RESERVED_NAME_DISCRIMINATOR,
    );
    const decoder = getReservedNameDecoder();
    const out: Array<{ pubkey: Address; name: string }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const r = decoder.decode(data);
        if (r.expiresAt.__option !== 'Some') continue;
        if (Number(r.expiresAt.value) <= now) {
          out.push({ pubkey, name: r.name });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate Gateway PDAs in `Joined` status with
   * `stats.failed_consecutive >= maxFailures`. These are eligible for
   * `pruneGateway` (slash + remove from registry).
   */
  async getDeficientGateways(
    maxFailures: number,
  ): Promise<
    Array<{ pubkey: Address; operator: Address; failedConsecutive: number }>
  > {
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      GATEWAY_DISCRIMINATOR,
    );
    const decoder = getGatewayDecoder();
    const out: Array<{
      pubkey: Address;
      operator: Address;
      failedConsecutive: number;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const g = decoder.decode(data);
        if (g.status !== GatewayStatus.Joined) continue;
        if (g.stats.failedConsecutive >= maxFailures) {
          out.push({
            pubkey,
            operator: g.operator,
            failedConsecutive: g.stats.failedConsecutive,
          });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate Gateway PDAs whose `status == Gone` (already left the
   * network but PDA not yet GC'd). Eligible for `finalizeGone`.
   */
  async getGoneGateways(): Promise<
    Array<{ pubkey: Address; operator: Address }>
  > {
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      GATEWAY_DISCRIMINATOR,
    );
    const decoder = getGatewayDecoder();
    const out: Array<{ pubkey: Address; operator: Address }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const g = decoder.decode(data);
        if (g.status === GatewayStatus.Gone) {
          out.push({ pubkey, operator: g.operator });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate Delegation PDAs with `amount == 0`. Eligible for
   * `closeEmptyDelegation` (rent refund to the original delegator).
   */
  async getEmptyDelegations(): Promise<
    Array<{ pubkey: Address; gateway: Address; delegator: Address }>
  > {
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      DELEGATION_DISCRIMINATOR,
    );
    const decoder = getDelegationDecoder();
    const out: Array<{
      pubkey: Address;
      gateway: Address;
      delegator: Address;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const d = decoder.decode(data);
        if (d.amount === 0n) {
          out.push({ pubkey, gateway: d.gateway, delegator: d.delegator });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate Withdrawal PDAs with `amount == 0` (drained via
   * fund-from-withdrawal payments). Eligible for `closeDrainedWithdrawal`
   * (rent refund to owner).
   */
  async getDrainedWithdrawals(): Promise<
    Array<{ pubkey: Address; owner: Address; withdrawalId: bigint }>
  > {
    const accounts = await this.getAccountsByDiscriminator(
      this.garProgram,
      WITHDRAWAL_DISCRIMINATOR,
    );
    const decoder = getWithdrawalDecoder();
    const out: Array<{
      pubkey: Address;
      owner: Address;
      withdrawalId: bigint;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const w = decoder.decode(data);
        if (w.amount === 0n) {
          out.push({ pubkey, owner: w.owner, withdrawalId: w.withdrawalId });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate Vault PDAs whose `end_timestamp` has passed (eligible for
   * `releaseVault`). Note: `releaseVault` is owner-signed, so the cranker
   * can only release its own vaults — the helper still surfaces every
   * expired vault so other consumers (UIs, indexers) can use it too.
   */
  async getExpiredVaults(now: number): Promise<
    Array<{
      pubkey: Address;
      owner: Address;
      vaultId: bigint;
      endTimestamp: bigint;
    }>
  > {
    const accounts = await this.getAccountsByDiscriminator(
      this.coreProgram,
      VAULT_DISCRIMINATOR,
    );
    const decoder = getVaultDecoder();
    const out: Array<{
      pubkey: Address;
      owner: Address;
      vaultId: bigint;
      endTimestamp: bigint;
    }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const v = decoder.decode(data);
        if (Number(v.endTimestamp) <= now) {
          out.push({
            pubkey,
            owner: v.owner,
            vaultId: v.vaultId,
            endTimestamp: v.endTimestamp,
          });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Enumerate PrimaryNameRequest PDAs whose `expires_at` has passed.
   * Eligible for `closeExpiredRequest` (rent refund to original initiator).
   */
  async getExpiredPrimaryNameRequests(
    now: number,
  ): Promise<Array<{ pubkey: Address; initiator: Address }>> {
    const accounts = await this.getAccountsByDiscriminator(
      this.coreProgram,
      PRIMARY_NAME_REQUEST_DISCRIMINATOR,
    );
    const decoder = getPrimaryNameRequestDecoder();
    const out: Array<{ pubkey: Address; initiator: Address }> = [];
    for (const { pubkey, data } of accounts) {
      try {
        const r = decoder.decode(data);
        if (Number(r.expiresAt) <= now) {
          out.push({ pubkey, initiator: r.initiator });
        }
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Read the live `ArnsConfig` (used by the cranker to gate
   * `pruneExpiredNames` / `pruneReturnedNames` on the
   * `next_*_prune_timestamp` hints).
   */
  async getArnsConfigRaw(): Promise<{
    nextRecordsPruneTimestamp: bigint;
    nextReturnedNamesPruneTimestamp: bigint;
    gracePeriodSeconds: bigint;
    returnAuctionDurationSeconds: bigint;
  } | null> {
    const [pda] = await getArnsSettingsPDA(this.arnsProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) return null;
    const cfg = getArnsConfigDecoder().decode(account.data);
    return {
      nextRecordsPruneTimestamp: cfg.nextRecordsPruneTimestamp,
      nextReturnedNamesPruneTimestamp: cfg.nextReturnedNamesPruneTimestamp,
      gracePeriodSeconds: cfg.gracePeriodSeconds,
      returnAuctionDurationSeconds: cfg.returnAuctionDurationSeconds,
    };
  }

  // =========================================
  // Name resolution (ArNSNameResolver)
  // =========================================

  async resolveArNSName({ name }: { name: string }) {
    const parts = name.split('_');
    const baseName = parts.length > 1 ? parts[parts.length - 1] : parts[0];

    const record = await this.getArNSRecord({ name: baseName });

    // TODO: resolve undername via ANT program when undername !== '@'
    return {
      name: baseName,
      txId: '',
      type: record.type,
      processId: record.processId,
      ttlSeconds: 3600,
      undernameLimit: record.undernameLimit,
    };
  }

  // =========================================================================
  // Observer helpers (Solana-only; used by gateway-side report submission)
  // =========================================================================

  /**
   * Resolve the gateway operator pubkey backing a given observer pubkey.
   * The `ObserverLookup` PDA is written at `join_network` (and rotated by
   * `update_observer_address`); when present its `gateway` field is the
   * operator pubkey. Returns `undefined` when the observer isn't
   * registered on any gateway.
   */
  async getObserverLookup(
    observer: Address,
  ): Promise<{ gateway: Address; bump: number } | undefined> {
    const [pda] = await getObserverLookupPDA(observer, this.garProgram);
    const account = await this.getAccount(pda);
    if (!account.exists) return undefined;
    const data = Buffer.from(account.data);
    // Layout: 8 disc + 32 gateway + 1 bump.
    const gateway = addressDecoder.decode(data.subarray(8, 40));
    const bump = data.readUInt8(40);
    return { gateway, bump };
  }

  /**
   * Pre-flight gate for `save_observations` submission. Reads the Epoch
   * account once and reports whether the given observer pubkey is:
   *   - `prescribed`: in `epoch.prescribed_observers[..observer_count]`
   *   - `observerIdx`: position in the array (matches the `has_observed`
   *     bit index when prescribed)
   *   - `alreadyObserved`: whether the bit at `observerIdx` is set
   *   - `windowOpen`: whether `now < epoch.end_timestamp`
   *
   * Use this from a sink/wrapper to skip cheap-to-skip cases before
   * paying for a transaction simulation that would just bounce.
   */
  async getEpochObservationStatus(
    epochIndex: number,
    observer: Address,
  ): Promise<{
    prescribed: boolean;
    observerIdx: number; // -1 when not prescribed
    alreadyObserved: boolean;
    windowOpen: boolean;
    endTimestampSec: number;
  }> {
    const epoch = await this.fetchEpoch(epochIndex);
    let observerIdx = -1;
    for (let i = 0; i < epoch.observerCount; i++) {
      if (epoch.prescribedObservers[i] === (observer as string)) {
        observerIdx = i;
        break;
      }
    }
    const prescribed = observerIdx !== -1;
    const alreadyObserved =
      prescribed &&
      ((epoch.hasObserved[Math.floor(observerIdx / 8)] >> (observerIdx % 8)) &
        1) ===
        1;
    const nowSec = Math.floor(Date.now() / 1000);
    return {
      prescribed,
      observerIdx,
      alreadyObserved,
      windowOpen: nowSec < epoch.endTimestamp,
      endTimestampSec: epoch.endTimestamp,
    };
  }
}
