/**
 * Solana implementation of ARIOWrite interface.
 *
 * Extends SolanaARIOReadable with write operations that build and send
 * Solana transactions via Codama-generated instruction builders.
 *
 * All instruction encoding (discriminators, account ordering, Borsh codecs,
 * default value resolution for token/system programs) is delegated to the
 * generated builders in `./generated/{core,gar,arns}/instructions/`. The
 * builders are derived from the on-chain IDL and stay in sync via codegen.
 *
 * This file's job is just to:
 *   1. Translate the AO-style SDK params into the builder's input shape.
 *   2. Pre-derive the PDAs that the *Async builders can't infer (the ones
 *      whose seeds depend on runtime state — e.g. the next withdrawal id
 *      from the on-chain counter, or the buyer's ATA from a runtime mint).
 *   3. Append remaining_accounts (gateway PDAs, name registry) for the
 *      epoch crank instructions, since Codama doesn't generate a typed
 *      surface for them.
 */
import {
  type AccountMeta,
  AccountRole,
  type Address,
  type Instruction,
  address,
  fetchEncodedAccount,
  getAddressDecoder,
} from '@solana/kit';

import {
  PurchaseType,
  getBuyNameFromDelegationInstructionAsync,
  getBuyNameFromFundingPlanInstructionAsync,
  getBuyNameFromOperatorStakeInstructionAsync,
  getBuyNameFromWithdrawalInstructionAsync,
  getBuyNameInstructionAsync,
  getBuyReturnedNameFromDelegationInstructionAsync,
  getBuyReturnedNameFromFundingPlanInstructionAsync,
  getBuyReturnedNameFromOperatorStakeInstructionAsync,
  getBuyReturnedNameFromWithdrawalInstructionAsync,
  getBuyReturnedNameInstructionAsync,
  getExtendLeaseFromDelegationInstructionAsync,
  getExtendLeaseFromFundingPlanInstructionAsync,
  getExtendLeaseFromOperatorStakeInstructionAsync,
  getExtendLeaseFromWithdrawalInstructionAsync,
  getExtendLeaseInstructionAsync,
  getIncreaseUndernameLimitFromDelegationInstructionAsync,
  getIncreaseUndernameLimitFromFundingPlanInstructionAsync,
  getIncreaseUndernameLimitFromOperatorStakeInstructionAsync,
  getIncreaseUndernameLimitFromWithdrawalInstructionAsync,
  getIncreaseUndernameLimitInstructionAsync,
  getMigrateArnsRecordInstruction,
  getPruneExpiredNamesInstructionAsync,
  getPruneExpiredReservationInstruction,
  getPruneNameToReturnedInstructionAsync,
  getPruneReturnedNamesInstructionAsync,
  getReassignNameInstructionAsync,
  getReleaseNameInstructionAsync,
  getUpgradeNameFromDelegationInstructionAsync,
  getUpgradeNameFromFundingPlanInstructionAsync,
  getUpgradeNameFromOperatorStakeInstructionAsync,
  getUpgradeNameFromWithdrawalInstructionAsync,
  getUpgradeNameInstructionAsync,
} from '@ar.io/solana-contracts/arns';
import {
  type FundingSourceKind as GeneratedFundingSourceKind,
  type FundingSourceSpec as GeneratedFundingSourceSpec,
} from '@ar.io/solana-contracts/gar';
import { FundingSourceKind as GeneratedFundingSourceKindEnum } from '@ar.io/solana-contracts/gar';
import type { ILogger } from '../common/logger.js';
import type { MessageResult, WriteOptions } from '../types/common.js';
import type {
  ArNSPurchaseParams,
  BuyRecordParams,
  CreateVaultParams,
  DelegateStakeParams,
  ExtendLeaseParams,
  ExtendVaultParams,
  IncreaseUndernameLimitParams,
  IncreaseVaultParams,
  JoinNetworkParams,
  RedelegateStakeParams,
  RevokeVaultParams,
  UpdateGatewaySettingsParams,
  VaultedTransferParams,
} from '../types/io.js';
import { type FundingSourceSpec as PublicFundingSourceSpec } from '../types/io.js';
import type { mARIOToken } from '../types/token.js';
import {
  buildCreateAtaIdempotentIx,
  getAssociatedTokenAddressKit,
} from './ata.js';
import {
  deserializeArnsRecord,
  deserializeEpochSettingsFull,
  deserializePrimaryName,
} from './deserialize.js';
import {
  type FundingPlan as InternalFundingPlan,
  type InsufficientFundingError as InternalInsufficientFundingError,
  buildFundingPlan as buildFundingPlanCore,
  buildFundingPlanRemainingAccounts,
  computeResidueIndexes,
  predictResidueVaults,
} from './funding-plan.js';

/** Maps the SDK's user-facing FundingSourceKind string union to the
 *  Codama-generated enum used by the on-chain ix payload. */
function toGeneratedFundingSourceSpec(
  s: PublicFundingSourceSpec,
): GeneratedFundingSourceSpec {
  const kindMap: Record<
    PublicFundingSourceSpec['kind'],
    GeneratedFundingSourceKind
  > = {
    balance: GeneratedFundingSourceKindEnum.Balance,
    delegation: GeneratedFundingSourceKindEnum.Delegation,
    operatorStake: GeneratedFundingSourceKindEnum.OperatorStake,
    withdrawal: GeneratedFundingSourceKindEnum.Withdrawal,
  };
  return { kind: kindMap[s.kind], amount: s.amount };
}
import { getSyncAttributesInstruction } from '@ar.io/solana-contracts/ant';
import {
  getApprovePrimaryNameInstructionAsync,
  getCloseExpiredRequestInstruction,
  getCreateVaultInstructionAsync,
  getExtendVaultInstructionAsync,
  getIncreaseVaultInstructionAsync,
  getReleaseVaultInstructionAsync,
  getRemovePrimaryNameInstructionAsync,
  getRequestAndSetPrimaryNameFromFundingPlanInstructionAsync,
  getRequestAndSetPrimaryNameInstructionAsync,
  getRequestPrimaryNameFromFundingPlanInstructionAsync,
  getRequestPrimaryNameInstructionAsync,
  getRevokeVaultInstructionAsync,
  getVaultedTransferInstructionAsync,
} from '@ar.io/solana-contracts/core';
import {
  getDelegationDecoder,
  getGatewayDecoder,
} from '@ar.io/solana-contracts/gar';
import {
  Protocol,
  getAllowDelegateInstructionAsync,
  getCancelWithdrawalInstruction,
  getClaimDelegateFromDisabledGatewayInstructionAsync,
  getClaimDelegateFromLeavingGatewayInstructionAsync,
  getClaimWithdrawalInstructionAsync,
  getCloseDrainedWithdrawalInstruction,
  getCloseEmptyDelegationInstruction,
  getCloseEpochInstructionAsync,
  getCloseObservationInstructionAsync,
  getCreateEpochInstructionAsync,
  getDecreaseDelegateStakeInstructionAsync,
  getDecreaseOperatorStakeInstructionAsync,
  getDelegateStakeInstructionAsync,
  getDisallowDelegateInstructionAsync,
  getDistributeEpochInstructionAsync,
  getFinalizeGoneInstructionAsync,
  getIncreaseOperatorStakeInstructionAsync,
  getInstantWithdrawalInstructionAsync,
  getJoinNetworkInstructionAsync,
  getLeaveNetworkInstructionAsync,
  getPrescribeEpochInstructionAsync,
  getPruneGatewayInstructionAsync,
  getRedelegateStakeInstructionAsync,
  getSaveObservationsInstructionAsync,
  getSetAllowlistEnabledInstructionAsync,
  getTallyWeightsInstructionAsync,
  getUpdateGatewaySettingsInstructionAsync,
} from '@ar.io/solana-contracts/gar';
import { getTransferCheckedInstruction } from '@solana-program/token';
import { ARIO_ANT_PROGRAM_ID, TOKEN_DECIMALS } from './constants.js';
import { SolanaARIOReadable } from './io-readable.js';
import {
  getAntRecordPDA,
  getArioConfigPDA,
  getArnsRecordPDA,
  getArnsRegistryPDA,
  getArnsSettingsPDA,
  getDelegationPDA,
  getDemandFactorPDA,
  getEpochPDA,
  getEpochSettingsPDA,
  getGarSettingsPDA,
  getGatewayPDA,
  getGatewayRegistryPDA,
  getObservationPDA,
  getObserverLookupPDA,
  getPrimaryNamePDA,
  getPrimaryNameRequestPDA,
  getPrimaryNameReversePDA,
  getReservedNamePDA,
  getReturnedNamePDA,
  getVaultPDA,
  getWithdrawalCounterPDA,
  getWithdrawalPDA,
  hashName,
} from './pda.js';
import {
  type RegistrySlotWeight,
  predictPrescribedObservers,
} from './predict-prescribed-observers.js';
import {
  reclaimLookupTablesForSigner,
  sendAndConfirm,
  sendWithEphemeralLookupTable,
} from './send.js';
import type {
  SolanaRpcSubscriptions,
  SolanaSigner,
  SolanaWriteConfig,
} from './types.js';

const addressDecoder = getAddressDecoder();

/** Resolve mARIOToken | number to a plain number */
function toAmount(qty: number | mARIOToken): number {
  if (typeof qty === 'number') return qty;
  return (qty as any).valueOf();
}

/**
 * Append additional `AccountMeta`s to a Codama-generated instruction.
 *
 * The generated `getXInstruction[Async]` builders return frozen objects with
 * a typed, fixed `accounts` tuple. The Solana program accepts extra
 * `remaining_accounts` for epoch crank ops (gateway PDAs, name registry) and
 * for primary-name authorization (arnsRecord, demandFactor, antRecord — see
 * `_buildPrimaryNameValidationAccounts`), but
 * Codama has no typed surface for them — so we splice them in here.
 */
function withRemainingAccounts<I extends Instruction>(
  ix: I,
  remaining: AccountMeta[],
): I {
  const accounts = [
    ...((ix as unknown as { accounts: readonly AccountMeta[] }).accounts ?? []),
    ...remaining,
  ];
  return { ...ix, accounts } as I;
}

/**
 * Split a primary name into its undername + base parts using the same rule
 * as the on-chain `splitn(2, '_')` in `programs/ario-core/src/instructions/primary_name.rs`:
 * everything before the first '_' is the undername, the rest is the base.
 *
 * Exposed as a top-level helper so it can be unit-tested without spinning up
 * an `SolanaARIOWriteable`. Lowercases the input to match contract behavior.
 */
export function splitPrimaryName(name: string): {
  isUndername: boolean;
  baseName: string;
  undername: string | null;
} {
  const lower = name.toLowerCase();
  const ix = lower.indexOf('_');
  if (ix === -1) {
    return { isUndername: false, baseName: lower, undername: null };
  }
  return {
    isUndername: true,
    baseName: lower.slice(ix + 1),
    undername: lower.slice(0, ix),
  };
}

/**
 * Solana-backed read-write client for the AR.IO protocol.
 *
 * Usage:
 * ```ts
 * import {
 *   createSolanaRpc,
 *   createSolanaRpcSubscriptions,
 *   generateKeyPairSigner,
 * } from '@solana/kit';
 * import { SolanaARIOWriteable } from '@ar.io/sdk/solana';
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 * const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com');
 * const signer = await generateKeyPairSigner();
 * const ario = new SolanaARIOWriteable({ rpc, rpcSubscriptions, signer });
 *
 * await ario.transfer({ target: 'RecipientPubkey...', qty: 100_000_000 });
 * ```
 */
// =========================================================================
// save_observations encoding helpers
// =========================================================================
// Extracted as pure functions so the bitmap-pack + base64url-decode logic
// can be unit-tested without standing up the rpc/signer plumbing of the
// SolanaARIOWriteable class. The on-chain ABI:
//   - gateway_results: [u8; 375]   bit i = 1 (pass) / 0 (fail) for the
//                                  gateway at registry index i.
//   - gateway_count:   u16         must equal epoch.active_gateway_count.
//   - report_tx_id:    [u8; 32]    raw 32-byte Arweave hash (base64url
//                                  decoded from its 43-char string form).

/** Build the gateway_results bitmap for save_observations.
 *  All bits start as 1 (pass) for the first `registryAddresses.length`
 *  positions; positions named in `failedGateways` get cleared to 0; all
 *  positions beyond `registryAddresses.length` are 0. */
export function buildObservationBitmap(
  registryAddresses: string[],
  failedGateways: string[],
): Buffer {
  const buf = Buffer.alloc(375, 0xff);
  const failedSet = new Set(failedGateways);
  for (let i = 0; i < registryAddresses.length; i++) {
    if (failedSet.has(registryAddresses[i])) {
      buf[Math.floor(i / 8)] &= ~(1 << (i % 8));
    }
  }
  // Clear bits beyond the active gateway count so the bitmap is exactly
  // the prescribed shape (1s only at indices < gatewayCount that passed).
  for (let i = registryAddresses.length; i < 3000; i++) {
    buf[Math.floor(i / 8)] &= ~(1 << (i % 8));
  }
  return buf;
}

/** Encode an Arweave TX ID into the on-chain `[u8; 32]` slot.
 *
 *  An Arweave TX ID **is** a 32-byte SHA-256 hash; the 43-char base64url
 *  string is just its presentation encoding. We decode here so the
 *  on-chain bytes are the raw hash — lossless and trivially reversible
 *  via base64url-encode on the consumer side. Without this, on-chain
 *  bytes alone couldn't be used to look up the original report bundle
 *  on permaweb (the whole point of recording the txid for auditability).
 *
 *  Empty / undefined input → 32 zero bytes ("no permaweb archive
 *  configured for this submission" — the report still lives off-chain
 *  in the observer's local sinks but isn't anchored on Arweave).
 *
 *  Throws on malformed input: the base64url string must be exactly 43
 *  chars and decode to 32 bytes. Strict validation here is desirable —
 *  silently truncating or accepting bad input would erode the
 *  auditability that the field exists for.
 */
export function encodeReportTxId(reportTxId: string | undefined): Buffer {
  const out = Buffer.alloc(32);
  if (reportTxId === undefined || reportTxId === '') {
    return out;
  }
  // base64url → base64. The 43-char Arweave form has no padding; add it
  // back so Node's `Buffer.from(_, 'base64')` accepts the input.
  const padded = reportTxId
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(reportTxId.length / 4) * 4, '=');
  // Reject non-base64url chars up front — `Buffer.from` silently
  // tolerates them, which would mask typos.
  if (!/^[A-Za-z0-9+/=]+$/.test(padded)) {
    throw new Error(
      `reportTxId contains non-base64url characters: "${reportTxId}". ` +
        `Expected a 43-char Arweave TX ID using A-Z, a-z, 0-9, -, _.`,
    );
  }
  const decoded = Buffer.from(padded, 'base64');
  if (decoded.length !== 32) {
    throw new Error(
      `reportTxId must be a 43-char base64url Arweave TX ID decoding to 32 bytes; ` +
        `got ${reportTxId.length} chars decoding to ${decoded.length} bytes.`,
    );
  }
  decoded.copy(out);
  return out;
}

/** The single on-chain action a {@link SolanaARIOWriteable.crankEpochStep} call performed. */
export type CrankAction =
  | 'create'
  | 'tally'
  | 'prescribe'
  | 'distribute'
  | 'close'
  | 'idle';

/** Options for {@link SolanaARIOWriteable.crankEpochStep}. */
export interface CrankEpochStepOptions {
  /** Gateways per tally/distribute batch. Default 30. */
  batchSize?: number;
  /**
   * NameRegistry account for the name-prescription leg. Defaults to the
   * registry derived from the configured ArNS program. Pass `null` to disable
   * name prescription entirely.
   */
  nameRegistryAccount?: Address | null;
  /** Close fully-distributed epochs older than `epochRetention`. Default true. */
  enableClose?: boolean;
  /** Epochs of retention before an epoch may be closed (GAR-006). Default 7. */
  epochRetention?: number;
  /** Unix seconds; defaults to the wall clock. Injectable for testing. */
  now?: number;
}

/** Result of a single {@link SolanaARIOWriteable.crankEpochStep} call. */
export interface CrankEpochStepResult {
  /** The action performed (or `'idle'` when nothing was due). */
  action: CrankAction;
  /** The epoch the action targeted (absent for `'idle'`). */
  epochIndex?: number;
  /** Confirmed transaction signature, when an action was submitted. */
  txId?: string;
  /** Batch progress for `'tally'` / `'distribute'`. */
  progress?: { index: number; total: number };
  /** For `action: 'idle'`, why nothing was done. */
  reason?:
    | 'epochs_disabled'
    | 'waiting_for_genesis'
    | 'waiting_for_epoch'
    | 'waiting_for_observations'
    | 'epoch_complete';
}

/**
 * Detect the GAR `InvalidGatewayAccount` error by Anchor error name/message
 * (walking the cause chain + `context.logs`), NOT by numeric code — codes are
 * `6000 + enum-index` and shift across program versions, but the name and
 * message are stable. `prescribe_epoch` raises this when a supplied observer
 * Gateway PDA is missing/spoofed (e.g. a predicted observer left the registry
 * between prediction and tx landing).
 */
export function isInvalidGatewayAccountError(error: unknown): boolean {
  const parts: string[] = [];
  let cur: unknown = error;
  for (let i = 0; cur != null && i < 8; i++) {
    const e = cur as {
      message?: string;
      context?: { logs?: string[] };
      cause?: unknown;
    };
    if (e.message) parts.push(e.message);
    if (Array.isArray(e.context?.logs)) parts.push(e.context.logs.join('\n'));
    cur = e.cause;
  }
  const text = parts.join('\n');
  return (
    text.includes('InvalidGatewayAccount') ||
    text.includes('Invalid gateway account')
  );
}

export class SolanaARIOWriteable extends SolanaARIOReadable {
  protected readonly signer: SolanaSigner;
  protected readonly rpcSubscriptions: SolanaRpcSubscriptions;

  constructor(
    config: SolanaWriteConfig & {
      logger?: ILogger;
      coreProgramId?: Address;
      garProgramId?: Address;
      arnsProgramId?: Address;
      antProgramId?: Address;
    },
  ) {
    super(config);
    this.signer = config.signer;
    this.rpcSubscriptions = config.rpcSubscriptions;
  }

  /** The signer's on-chain address. */
  protected get signerAddress(): Address {
    return this.signer.address;
  }

  protected async sendTransaction(
    instructions: Instruction[],
    computeUnitLimit = 400_000,
  ): Promise<string> {
    return sendAndConfirm({
      rpc: this.rpc,
      rpcSubscriptions: this.rpcSubscriptions,
      signer: this.signer,
      instructions,
      commitment: this.commitment,
      computeUnitLimit,
    });
  }

  /** Helper to get the ARIO mint and treasury from ArioConfig */
  private async getCoreConfig(): Promise<{
    mint: Address;
    treasury: Address;
  }> {
    const [configPda] = await getArioConfigPDA(this.coreProgram);
    const account = await fetchEncodedAccount(this.rpc, configPda, {
      commitment: this.commitment,
    });
    if (!account.exists) throw new Error('ArioConfig not found');
    const data = Buffer.from(account.data);
    // ArioConfig: [8 disc][32 authority][32 mint][32 arns_program][32 treasury]
    const mint = addressDecoder.decode(data.subarray(40, 72));
    const treasury = addressDecoder.decode(data.subarray(104, 136));
    return { mint, treasury };
  }

  private async getMint(): Promise<Address> {
    return (await this.getCoreConfig()).mint;
  }

  /** Helper to get ArNS config fields (mint and treasury) */
  private async getArnsConfig(): Promise<{
    mint: Address;
    treasury: Address;
  }> {
    const [settingsPda] = await getArnsSettingsPDA(this.arnsProgram);
    const account = await fetchEncodedAccount(this.rpc, settingsPda, {
      commitment: this.commitment,
    });
    if (!account.exists) throw new Error('ArnsConfig not found');
    const data = Buffer.from(account.data);
    // ArnsConfig layout: [8 disc][32 authority][32 mint][32 treasury]...
    const mint = addressDecoder.decode(data.subarray(40, 72));
    const treasury = addressDecoder.decode(data.subarray(72, 104));
    return { mint, treasury };
  }

  /** Helper to get GAR config fields (mint, stake pool, protocol pool) */
  private async getGarConfig(): Promise<{
    mint: Address;
    stakeTokenAccount: Address;
    protocolTokenAccount: Address;
  }> {
    const [settingsPda] = await getGarSettingsPDA(this.garProgram);
    const account = await fetchEncodedAccount(this.rpc, settingsPda, {
      commitment: this.commitment,
    });
    if (!account.exists) throw new Error('GarSettings not found');
    const data = Buffer.from(account.data);
    // GarSettings: [8 disc][32 authority][32 mint][8+8+8+8+8+8=48 u64s][4 u32][1 bool]
    //   [32 migration_authority][32 stake_token_account][32 protocol_token_account][1 bump]
    const mint = addressDecoder.decode(data.subarray(40, 72));
    const stakeTokenAccount = addressDecoder.decode(data.subarray(157, 189));
    const protocolTokenAccount = addressDecoder.decode(data.subarray(189, 221));
    return { mint, stakeTokenAccount, protocolTokenAccount };
  }

  // =========================================
  // Codama default-PDA injection helpers
  // =========================================
  //
  // Codama's auto-generated `getXInstructionAsync` builders fall back to
  // calling `find<Account>Pda()` (no args) when a "defaultable" account is
  // omitted from the input. Those `find*Pda` helpers default to the
  // **placeholder** program addresses baked into the generated client
  // (`ARioArnsProgXXX...`, `ArioCoreProgXXX...`, etc.), *not* the env- or
  // constructor-overridden program ID we actually deploy at. The result is a
  // PDA derived against the wrong program id, which on-chain shows up as
  // Anchor `AccountNotInitialized` (#3012) for `config` / `demand_factor` /
  // `name_registry` / `settings` / etc.
  //
  // The wrappers below pre-derive each program's defaultable PDAs against
  // the **real** program id and merge them into the input so codama never
  // touches its placeholder defaults. Caller-provided values still win
  // because spread order is `(...defaults, ...input)`.

  /**
   * Inject ARNS default PDAs (config, demandFactor, nameRegistry).
   *
   * Extra fields not consumed by a given builder are harmlessly ignored
   * (codama only reads the named keys from `input`).
   */
  private async withArnsDefaults<T extends object>(input: T): Promise<T> {
    const [config] = await getArnsSettingsPDA(this.arnsProgram);
    const [demandFactor] = await getDemandFactorPDA(this.arnsProgram);
    const [nameRegistry] = await getArnsRegistryPDA(this.arnsProgram);
    return { config, demandFactor, nameRegistry, ...input } as T;
  }

  /**
   * If the on-chain ArnsRecord for `name` hasn't been migrated to the
   * current schema (name_hash at offset 8 doesn't match the expected
   * hash), return a `migrate_arns_record` instruction that must be
   * prepended to any operation referencing the record with PDA seed
   * verification.
   *
   * Returns an empty array when the record is already up-to-date or
   * doesn't exist.
   */
  private async _buildMigrateArnsRecordIxIfNeeded(
    name: string,
  ): Promise<Instruction[]> {
    const [arnsRecordPda] = await getArnsRecordPDA(name, this.arnsProgram);
    const account = await fetchEncodedAccount(this.rpc, arnsRecordPda, {
      commitment: this.commitment,
    });
    if (!account.exists) return [];

    const data = Buffer.from(account.data);
    const expectedHash = hashName(name);
    const storedHash = data.subarray(8, 40);

    if (storedHash.equals(expectedHash)) return [];

    return [
      getMigrateArnsRecordInstruction(
        {
          record: arnsRecordPda,
          payer: this.signer,
        },
        { programAddress: this.arnsProgram },
      ),
    ];
  }

  /** Inject ARIO core default PDAs (config). */
  private async withCoreDefaults<T extends object>(input: T): Promise<T> {
    const [config] = await getArioConfigPDA(this.coreProgram);
    return { config, ...input } as T;
  }

  /** Inject GAR default PDAs (settings, epochSettings, registry). */
  private async withGarDefaults<T extends object>(input: T): Promise<T> {
    const [settings] = await getGarSettingsPDA(this.garProgram);
    const [epochSettings] = await getEpochSettingsPDA(this.garProgram);
    const [registry] = await getGatewayRegistryPDA(this.garProgram);
    return { settings, epochSettings, registry, ...input } as T;
  }

  /** Read WithdrawalCounter's next_id (returns 0n if not yet created) */
  private async getNextWithdrawalId(owner: Address): Promise<bigint> {
    const [counterPda] = await getWithdrawalCounterPDA(owner, this.garProgram);
    const account = await fetchEncodedAccount(this.rpc, counterPda, {
      commitment: this.commitment,
    });
    if (!account.exists) return 0n;
    // WithdrawalCounter: [8 disc][32 owner][8 next_id]
    return Buffer.from(account.data).readBigUInt64LE(40);
  }

  // =========================================
  // Token operations (ario-core)
  // =========================================

  async transfer(
    params: { target: string; qty: number | mARIOToken },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.qty);
    const recipient = address(params.target);
    const mint = await this.getMint();
    const fromATA = await getAssociatedTokenAddressKit(
      mint,
      this.signer.address,
    );
    const toATA = await getAssociatedTokenAddressKit(mint, recipient);

    // SPL `transferChecked` requires the recipient ATA to exist; bundle
    // an idempotent ATA-create so fresh recipients just work. Same
    // pattern as `vaultedTransfer` below.
    const createToAtaIx = buildCreateAtaIdempotentIx(
      this.signer.address,
      toATA,
      recipient,
      mint,
    );

    // Standard SPL Token `transferChecked`. The custom `ario-core::transfer`
    // ix is deprecated — it added no protocol-level accounting, just wrapped
    // this same CPI plus a `TransferEvent` emission that no major Solana
    // indexer needs (Helius, Solscan, etc. all track SPL transfers natively).
    // See `docs/REMOVE_CUSTOM_TRANSFER_PLAN.md` in `ar-io/solana-ar-io`.
    // `transferChecked` (vs `transfer`) validates the mint + decimals
    // on-chain, preventing cross-mint mistakes.
    const ix = getTransferCheckedInstruction({
      source: fromATA,
      mint,
      destination: toATA,
      authority: this.signer,
      amount,
      decimals: TOKEN_DECIMALS,
    });

    const sig = await this.sendTransaction([createToAtaIx, ix]);
    return { id: sig };
  }

  async vaultedTransfer(
    params: VaultedTransferParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.quantity);
    const lockSeconds = Math.floor(params.lockLengthMs / 1000);
    const recipient = address(params.recipient);
    const mint = await this.getMint();

    // Vault PDA depends on the recipient's *current* vault counter id, which
    // the codegen builder can't infer — derive it manually.
    const nextId = await this.getNextVaultId(recipient);
    const [vaultPda] = await getVaultPDA(recipient, nextId, this.coreProgram);
    const senderATA = await getAssociatedTokenAddressKit(
      mint,
      this.signer.address,
    );
    const vaultATA = await getAssociatedTokenAddressKit(mint, vaultPda, true);

    const ix = await getVaultedTransferInstructionAsync(
      await this.withCoreDefaults({
        vault: vaultPda,
        senderTokenAccount: senderATA,
        vaultTokenAccount: vaultATA,
        recipient,
        sender: this.signer,
        amount,
        lockDurationSeconds: lockSeconds,
        revocable: params.revokable ?? false,
      }),
      { programAddress: this.coreProgram },
    );

    // The on-chain CreateVault / VaultedTransfer constraint is
    // `Account<TokenAccount>` (NOT `init`) — Anchor expects the vault ATA to
    // already exist. Bundle an idempotent CreateAssociatedTokenAccount in
    // the same tx so the caller doesn't need a separate setup step.
    const createVaultAtaIx = buildCreateAtaIdempotentIx(
      this.signer.address,
      vaultATA,
      vaultPda,
      mint,
    );

    const sig = await this.sendTransaction([createVaultAtaIx, ix]);
    return { id: sig };
  }

  async createVault(
    params: CreateVaultParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.quantity);
    const lockSeconds = Math.floor(params.lockLengthMs / 1000);
    const mint = await this.getMint();

    const nextId = await this.getNextVaultId(this.signer.address);
    const [vaultPda] = await getVaultPDA(
      this.signer.address,
      nextId,
      this.coreProgram,
    );
    const ownerATA = await getAssociatedTokenAddressKit(
      mint,
      this.signer.address,
    );
    const vaultATA = await getAssociatedTokenAddressKit(mint, vaultPda, true);

    const ix = await getCreateVaultInstructionAsync(
      await this.withCoreDefaults({
        vault: vaultPda,
        ownerTokenAccount: ownerATA,
        vaultTokenAccount: vaultATA,
        owner: this.signer,
        amount,
        lockDurationSeconds: lockSeconds,
      }),
      { programAddress: this.coreProgram },
    );

    // See note in vaultedTransfer above — vault ATA is not init'd by the
    // on-chain handler; bundle the create.
    const createVaultAtaIx = buildCreateAtaIdempotentIx(
      this.signer.address,
      vaultATA,
      vaultPda,
      mint,
    );

    const sig = await this.sendTransaction([createVaultAtaIx, ix]);
    return { id: sig };
  }

  /** Read VaultCounter's next_id (returns 0n if not yet created). */
  private async getNextVaultId(owner: Address): Promise<bigint> {
    // VaultCounter PDA derivation lives in pda.ts as getVaultCounterPDA.
    const { getVaultCounterPDA } = await import('./pda.js');
    const [counterPda] = await getVaultCounterPDA(owner, this.coreProgram);
    const account = await fetchEncodedAccount(this.rpc, counterPda, {
      commitment: this.commitment,
    });
    if (!account.exists) return 0n;
    return Buffer.from(account.data).readBigUInt64LE(40);
  }

  async extendVault(
    params: ExtendVaultParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const additionalSeconds = Math.floor(params.extendLengthMs / 1000);
    const [vaultPda] = await getVaultPDA(
      this.signer.address,
      BigInt(params.vaultId),
      this.coreProgram,
    );

    const ix = await getExtendVaultInstructionAsync(
      await this.withCoreDefaults({
        vault: vaultPda,
        owner: this.signer,
        additionalSeconds,
      }),
      { programAddress: this.coreProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async increaseVault(
    params: IncreaseVaultParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.quantity);
    const mint = await this.getMint();
    const [vaultPda] = await getVaultPDA(
      this.signer.address,
      BigInt(params.vaultId),
      this.coreProgram,
    );
    const ownerATA = await getAssociatedTokenAddressKit(
      mint,
      this.signer.address,
    );
    const vaultATA = await getAssociatedTokenAddressKit(mint, vaultPda, true);

    const ix = await getIncreaseVaultInstructionAsync(
      await this.withCoreDefaults({
        vault: vaultPda,
        ownerTokenAccount: ownerATA,
        vaultTokenAccount: vaultATA,
        owner: this.signer,
        amount,
      }),
      { programAddress: this.coreProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  async revokeVault(
    params: RevokeVaultParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const recipient = address(params.recipient);
    const mint = await this.getMint();
    const [vaultPda] = await getVaultPDA(
      recipient,
      BigInt(params.vaultId),
      this.coreProgram,
    );
    const vaultATA = await getAssociatedTokenAddressKit(mint, vaultPda, true);
    const controllerATA = await getAssociatedTokenAddressKit(
      mint,
      this.signer.address,
    );

    const ix = await getRevokeVaultInstructionAsync(
      await this.withCoreDefaults({
        vault: vaultPda,
        vaultTokenAccount: vaultATA,
        controllerTokenAccount: controllerATA,
        controller: this.signer,
      }),
      { programAddress: this.coreProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // =========================================
  // Gateway operations (ario-gar)
  // =========================================

  async joinNetwork(
    params: JoinNetworkParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const garConfig = await this.getGarConfig();
    const operatorATA = await getAssociatedTokenAddressKit(
      garConfig.mint,
      this.signer.address,
    );
    const observerAddress = params.observerAddress
      ? address(params.observerAddress)
      : this.signer.address;
    const [observerLookupPda] = await getObserverLookupPDA(
      observerAddress,
      this.garProgram,
    );

    const ix = await getJoinNetworkInstructionAsync(
      await this.withGarDefaults({
        operatorTokenAccount: operatorATA,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        observerLookup: observerLookupPda,
        operator: this.signer,
        operatorStake: BigInt(params.operatorStake),
        label: params.label ?? '',
        fqdn: params.fqdn ?? '',
        port: params.port ?? 443,
        protocol: Protocol.Https,
        properties: params.properties ?? null,
        note: params.note ?? null,
        allowDelegatedStaking:
          params.allowDelegatedStaking === true ||
          params.allowDelegatedStaking === 'allowlist',
        delegateRewardShareRatio: params.delegateRewardShareRatio ?? 0,
        minDelegateStake:
          params.minDelegatedStake !== undefined
            ? BigInt(params.minDelegatedStake)
            : null,
        observerAddress,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async leaveNetwork(_options?: WriteOptions): Promise<MessageResult> {
    // BD-102: leave_network may produce 1 or 2 Withdrawal PDAs. The
    // protected exit vault uses `next_id`; the optional excess vault
    // uses `next_id + 1`. The SDK always derives both PDAs and passes
    // them to the codama-emitted builder — the contract's
    // `Option<UncheckedAccount>` excess slot is consumed only when the
    // post-stake excess is positive. Passing it unconditionally keeps
    // the SDK side stateless (no need to fetch gateway.operator_stake +
    // settings.min_operator_stake to decide).
    const nextId = await this.getNextWithdrawalId(this.signer.address);
    const [exitVaultPda] = await getWithdrawalPDA(
      this.signer.address,
      nextId,
      this.garProgram,
    );
    const [excessVaultPda] = await getWithdrawalPDA(
      this.signer.address,
      nextId + 1n,
      this.garProgram,
    );

    const ix = await getLeaveNetworkInstructionAsync(
      await this.withGarDefaults({
        withdrawal: exitVaultPda,
        excessWithdrawal: excessVaultPda,
        operator: this.signer,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async updateGatewaySettings(
    params: UpdateGatewaySettingsParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getUpdateGatewaySettingsInstructionAsync(
      await this.withGarDefaults({
        operator: this.signer,
        label: params.label ?? null,
        fqdn: params.fqdn ?? null,
        port: params.port ?? null,
        // Codama exposes `protocol` as Option<Protocol>. We only ever updated
        // the URL parts above, so leave protocol untouched (None).
        protocol: null,
        properties: params.properties ?? null,
        note: params.note ?? null,
        allowDelegatedStaking:
          typeof params.allowDelegatedStaking === 'boolean'
            ? params.allowDelegatedStaking
            : null,
        delegateRewardShareRatio: params.delegateRewardShareRatio ?? null,
        minDelegateStake:
          params.minDelegatedStake !== undefined
            ? BigInt(params.minDelegatedStake)
            : null,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async increaseOperatorStake(
    params: { increaseQty: number | mARIOToken },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.increaseQty);
    const garConfig = await this.getGarConfig();
    const operatorATA = await getAssociatedTokenAddressKit(
      garConfig.mint,
      this.signer.address,
    );

    const ix = await getIncreaseOperatorStakeInstructionAsync(
      await this.withGarDefaults({
        operatorTokenAccount: operatorATA,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        operator: this.signer,
        amount,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async decreaseOperatorStake(
    params: { decreaseQty: number | mARIOToken; instant?: boolean },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.decreaseQty);
    const nextId = await this.getNextWithdrawalId(this.signer.address);
    const [withdrawalPda] = await getWithdrawalPDA(
      this.signer.address,
      nextId,
      this.garProgram,
    );

    const ix = await getDecreaseOperatorStakeInstructionAsync(
      await this.withGarDefaults({
        withdrawal: withdrawalPda,
        operator: this.signer,
        amount,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async delegateStake(
    params: DelegateStakeParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.stakeQty);
    const target = address(params.target);
    const garConfig = await this.getGarConfig();

    const [gatewayPda] = await getGatewayPDA(target, this.garProgram);
    const [delegationPda] = await getDelegationPDA(
      target,
      this.signer.address,
      this.garProgram,
    );
    const delegatorATA = await getAssociatedTokenAddressKit(
      garConfig.mint,
      this.signer.address,
    );

    const ix = await getDelegateStakeInstructionAsync(
      await this.withGarDefaults({
        gateway: gatewayPda,
        delegation: delegationPda,
        delegatorTokenAccount: delegatorATA,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        delegator: this.signer,
        amount,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async decreaseDelegateStake(
    params: {
      target: string;
      decreaseQty: number | mARIOToken;
      instant?: boolean;
    },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.decreaseQty);
    const target = address(params.target);

    const [gatewayPda] = await getGatewayPDA(target, this.garProgram);
    const [delegationPda] = await getDelegationPDA(
      target,
      this.signer.address,
      this.garProgram,
    );
    const nextId = await this.getNextWithdrawalId(this.signer.address);
    const [withdrawalPda] = await getWithdrawalPDA(
      this.signer.address,
      nextId,
      this.garProgram,
    );

    const ix = await getDecreaseDelegateStakeInstructionAsync(
      await this.withGarDefaults({
        gateway: gatewayPda,
        delegation: delegationPda,
        withdrawal: withdrawalPda,
        delegator: this.signer,
        amount,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async instantWithdrawal(
    params: { gatewayAddress?: string; vaultId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const garConfig = await this.getGarConfig();
    const [withdrawalPda] = await getWithdrawalPDA(
      this.signer.address,
      BigInt(params.vaultId),
      this.garProgram,
    );
    const ownerATA = await getAssociatedTokenAddressKit(
      garConfig.mint,
      this.signer.address,
    );

    const ix = await getInstantWithdrawalInstructionAsync(
      await this.withGarDefaults({
        withdrawal: withdrawalPda,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        ownerTokenAccount: ownerATA,
        protocolTokenAccount: garConfig.protocolTokenAccount,
        owner: this.signer,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async cancelWithdrawal(
    params: { gatewayAddress?: string; vaultId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const gateway = params.gatewayAddress
      ? address(params.gatewayAddress)
      : this.signer.address;
    const [gatewayPda] = await getGatewayPDA(gateway, this.garProgram);
    const [withdrawalPda] = await getWithdrawalPDA(
      this.signer.address,
      BigInt(params.vaultId),
      this.garProgram,
    );
    const isDelegate = gateway !== this.signer.address;
    const delegation = isDelegate
      ? (
          await getDelegationPDA(gateway, this.signer.address, this.garProgram)
        )[0]
      : undefined;

    const [settingsPda] = await getGarSettingsPDA(this.garProgram);
    const ix = getCancelWithdrawalInstruction(
      {
        settings: settingsPda,
        gateway: gatewayPda,
        withdrawal: withdrawalPda,
        delegation,
        owner: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async saveObservations(
    params: {
      reportTxId: string;
      failedGateways: string[];
      epochIndex?: number;
      /** Raw 256-byte gateway results bitfield (if provided, overrides failedGateways) */
      gatewayResults?: Uint8Array;
      gatewayCount?: number;
    },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    let epochIndex: number;
    if (params.epochIndex !== undefined) {
      epochIndex = params.epochIndex;
    } else {
      const [settingsPda] = await getEpochSettingsPDA(this.garProgram);
      const settingsAccount = await fetchEncodedAccount(this.rpc, settingsPda, {
        commitment: this.commitment,
      });
      if (!settingsAccount.exists) throw new Error('EpochSettings not found');
      const settings = deserializeEpochSettingsFull(
        Buffer.from(settingsAccount.data),
      );
      epochIndex = settings.currentEpochIndex;
    }

    // Build the [u8; 375] gateway_results bitfield. On-chain convention:
    //   bit set (1) = passed, bit clear (0) = failed.
    let resultsBuf: Buffer;
    let gatewayCount: number;
    if (params.gatewayResults) {
      resultsBuf = Buffer.alloc(375);
      resultsBuf.set(params.gatewayResults.subarray(0, 375));
      gatewayCount = params.gatewayCount ?? 0;
    } else {
      const registryAddresses = await this.getRegistryGatewayAddresses();
      gatewayCount = registryAddresses.length;
      resultsBuf = buildObservationBitmap(
        registryAddresses,
        params.failedGateways,
      );
    }

    const reportTxId = encodeReportTxId(params.reportTxId);

    const ix = await getSaveObservationsInstructionAsync(
      {
        observer: this.signer,
        epochIndex: BigInt(epochIndex),
        gatewayResults: new Uint8Array(resultsBuf),
        gatewayCount,
        reportTxId: new Uint8Array(reportTxId),
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  async redelegateStake(
    params: RedelegateStakeParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const amount = toAmount(params.stakeQty);
    const source = address(params.source);
    const target = address(params.target);
    const garConfig = await this.getGarConfig();

    const [sourceGatewayPda] = await getGatewayPDA(source, this.garProgram);
    const [targetGatewayPda] = await getGatewayPDA(target, this.garProgram);
    const [sourceDelegationPda] = await getDelegationPDA(
      source,
      this.signer.address,
      this.garProgram,
    );
    const [targetDelegationPda] = await getDelegationPDA(
      target,
      this.signer.address,
      this.garProgram,
    );
    const delegatorATA = await getAssociatedTokenAddressKit(
      garConfig.mint,
      this.signer.address,
    );

    const ix = await getRedelegateStakeInstructionAsync(
      await this.withGarDefaults({
        sourceGateway: sourceGatewayPda,
        targetGateway: targetGatewayPda,
        sourceDelegation: sourceDelegationPda,
        targetDelegation: targetDelegationPda,
        delegatorTokenAccount: delegatorATA,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        protocolTokenAccount: garConfig.protocolTokenAccount,
        delegator: this.signer,
        amount,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  // =========================================
  // ArNS operations (ario-arns)
  // =========================================

  async buyRecord(
    params: BuyRecordParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const arnsConfig = await this.getArnsConfig();
    const buyerATA = await getAssociatedTokenAddressKit(
      arnsConfig.mint,
      this.signer.address,
    );
    const antPubkey = address(
      params.processId ?? ('11111111111111111111111111111111' as Address),
    );
    const [arnsRecord] = await getArnsRecordPDA(params.name, this.arnsProgram);
    const [reservedNameCheck] = await getReservedNamePDA(
      params.name,
      this.arnsProgram,
    );
    const [returnedNameCheck] = await getReturnedNamePDA(
      params.name,
      this.arnsProgram,
    );
    const buyNameParams = {
      name: params.name,
      purchaseType:
        params.type === 'permabuy' ? PurchaseType.Permabuy : PurchaseType.Lease,
      years: params.years ?? 1,
      ant: antPubkey,
    };

    // Phase 4 of FUND_FROM_PLAN.md: dispatch on params.fundFrom. The pre-Phase-4
    // path always fell through to the balance-funded `buyName` ix even when
    // CLI-set `--fund-from stakes`; we now route to the corresponding on-chain
    // wrapper for each mode.
    let ix;
    if (params.fundFrom === 'stakes' && params.gatewayAddress) {
      const gatewayAddr = address(params.gatewayAddress);
      const garConfig = await this.getGarConfig();
      const [garSettings] = await getGarSettingsPDA(this.garProgram);
      const [gatewayPda] = await getGatewayPDA(gatewayAddr, this.garProgram);
      const baseShared = {
        config: await this.arnsConfigPda(),
        demandFactor: await this.demandFactorPda(),
        arnsRecord,
        nameRegistry: await this.nameRegistryPda(),
        reservedNameCheck,
        returnedNameCheck,
        garSettings,
        gateway: gatewayPda,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        protocolTokenAccount: arnsConfig.treasury,
        buyer: this.signer,
        garProgram: this.garProgram,
        params: buyNameParams,
      };
      if (params.fundAsOperator) {
        ix = await getBuyNameFromOperatorStakeInstructionAsync(baseShared, {
          programAddress: this.arnsProgram,
        });
      } else {
        const [delegationPda] = await getDelegationPDA(
          gatewayAddr,
          this.signer.address,
          this.garProgram,
        );
        ix = await getBuyNameFromDelegationInstructionAsync(
          { ...baseShared, delegation: delegationPda },
          { programAddress: this.arnsProgram },
        );
      }
    } else if (
      params.fundFrom === 'withdrawal' &&
      params.withdrawalId !== undefined
    ) {
      const garConfig = await this.getGarConfig();
      const [garSettings] = await getGarSettingsPDA(this.garProgram);
      const [withdrawalPda] = await getWithdrawalPDA(
        this.signer.address,
        params.withdrawalId,
        this.garProgram,
      );
      ix = await getBuyNameFromWithdrawalInstructionAsync(
        {
          config: await this.arnsConfigPda(),
          demandFactor: await this.demandFactorPda(),
          arnsRecord,
          nameRegistry: await this.nameRegistryPda(),
          reservedNameCheck,
          returnedNameCheck,
          garSettings,
          withdrawal: withdrawalPda,
          stakeTokenAccount: garConfig.stakeTokenAccount,
          protocolTokenAccount: arnsConfig.treasury,
          buyer: this.signer,
          garProgram: this.garProgram,
          params: buyNameParams,
        },
        { programAddress: this.arnsProgram },
      );
    } else if (params.fundFrom === 'plan' || params.fundFrom === 'any') {
      ix = await this._buildBuyNameFromFundingPlanIx({
        params,
        antPubkey,
        arnsRecord,
        reservedNameCheck,
        returnedNameCheck,
        buyNameParams,
        arnsConfig,
      });
    } else {
      // 'balance' or undefined falls through to the original direct-buy path.
      ix = await getBuyNameInstructionAsync(
        await this.withArnsDefaults({
          arnsRecord,
          buyerTokenAccount: buyerATA,
          protocolTokenAccount: arnsConfig.treasury,
          reservedNameCheck,
          returnedNameCheck,
          buyer: this.signer,
          params: buyNameParams,
        }),
        { programAddress: this.arnsProgram },
      );
    }

    // Sprint 4 / ADR-016: bundle `ant.sync_attributes` IFF the buyer
    // owns the ANT (preserves BD-096 — non-holder buys defer the trait
    // sync to a later `syncAttributes()` call by the actual owner).
    // Pass `antPubkey` as assetOverride: the ArnsRecord PDA is CREATED
    // by the buy_name ix, so it doesn't exist on-chain at SDK build
    // time — the helper would 404 if it tried to read it.
    const syncIx = await this._buildSyncAttributesIxIfOwner(
      params.name,
      antPubkey,
    );
    const sig = await this.sendTransaction(syncIx ? [ix, syncIx] : [ix]);
    return { id: sig };
  }

  /**
   * Resolve a `FundingPlan` for a fee-paying ArNS ix. When `params.sources`
   * is set, use it verbatim (caller-supplied plan); otherwise discover the
   * user's sources and build a plan via the Lua-faithful planner.
   *
   * Throws `InsufficientFundingError` (as a thrown Error with the structured
   * payload as `cause`) when no plan covers `amountNeeded`.
   */
  private async _resolveFundingPlan(
    params: ArNSPurchaseParams,
    amountNeeded: bigint,
  ): Promise<InternalFundingPlan> {
    // `'plan'` is the explicit "I'll supply my own sources, skip discovery"
    // mode (per FUNDING_MODES.md). Fail loudly if a caller picks `'plan'`
    // without sources — pre-2026-05 the SDK silently fell through to
    // discovery, making `'plan'` a synonym for `'any'`. The new semantic
    // matches the doc: `'any'` discovers, `'plan'` uses what you give it.
    if (params.fundFrom === 'plan' && !params.sources?.length) {
      throw new Error(
        "fundFrom: 'plan' requires explicit `sources`. Pass them via " +
          "params.sources, or use fundFrom: 'any' to let the SDK discover " +
          'and plan automatically.',
      );
    }
    if (params.sources?.length) {
      // Caller supplied an explicit plan; build the FundingPlan envelope
      // around it without source discovery. Each Delegation/OperatorStake
      // source MUST carry an explicit `gateway` field so the executor knows
      // which gateway PDA to slot in. Earlier single-gateway flows used
      // `params.gatewayAddress` as a fallback for the first stake source —
      // we preserve that for back-compat in the explicit-plan path.
      const hasBalance = params.sources.some((s) => s.kind === 'balance');
      const fallbackGateway = params.gatewayAddress
        ? address(params.gatewayAddress)
        : undefined;
      const gatewayPerSource: (Address | undefined)[] = params.sources.map(
        (s) => {
          if (s.kind !== 'delegation' && s.kind !== 'operatorStake')
            return undefined;
          const explicit = (s as { gateway?: string }).gateway;
          if (explicit) return address(explicit);
          if (fallbackGateway) return fallbackGateway;
          throw new Error(
            'sources includes delegation/operatorStake but no gateway is set on that source and gatewayAddress is unset',
          );
        },
      );
      // Auto-detect residue: for each Delegation source, fetch the live
      // Delegation + Gateway PDAs and compute the post-drain. If it lands
      // in (0, min_delegation_amount), that source will trigger an on-
      // chain residue auto-vault and we must reserve a residue PDA slot.
      const residueDelegationIndexes = await this._detectResidueIndexes(
        params.sources,
        gatewayPerSource,
      );
      return {
        sources: params.sources.map((s) => ({
          kind: s.kind,
          amount: s.amount,
          ...((s as { withdrawalId?: bigint }).withdrawalId !== undefined
            ? { withdrawalId: (s as { withdrawalId?: bigint }).withdrawalId }
            : {}),
        })),
        gatewayPerSource,
        residueDelegationIndexes,
        hasBalanceSource: hasBalance,
      };
    }
    // No explicit sources: discover + plan.
    const arnsConfig = await this.getArnsConfig();
    const { discoverFundingSources } = await import('./funding-plan.js');
    const sources = await discoverFundingSources(
      this.rpc,
      this.signer.address,
      {
        arioMint: arnsConfig.mint,
        garProgram: this.garProgram,
      },
    );
    const plan = buildFundingPlanCore(sources, amountNeeded, {
      fundFrom: params.fundFrom as
        | 'balance'
        | 'stakes'
        | 'withdrawal'
        | 'plan'
        | 'any'
        | undefined,
      preferGateway: params.gatewayAddress
        ? address(params.gatewayAddress)
        : undefined,
      fundAsOperator: params.fundAsOperator,
    });
    if ('kind' in plan) {
      const err = new Error(plan.message) as Error & {
        cause: InternalInsufficientFundingError;
      };
      err.cause = plan;
      throw err;
    }
    return plan;
  }

  /**
   * Build a `buy_name_from_funding_plan` ix using the funding-plan module.
   * Resolves per-source PDAs (Delegation, Withdrawal) and the residue-vault
   * PDA prediction in one shot.
   */
  private async _buildBuyNameFromFundingPlanIx(args: {
    params: BuyRecordParams;
    antPubkey: Address;
    arnsRecord: Address;
    reservedNameCheck: Address;
    returnedNameCheck: Address;
    buyNameParams: {
      name: string;
      purchaseType: PurchaseType;
      years: number;
      ant: Address;
    };
    arnsConfig: { mint: Address; treasury: Address };
  }) {
    const garConfig = await this.getGarConfig();
    const [garSettings] = await getGarSettingsPDA(this.garProgram);
    const buyerATA = await getAssociatedTokenAddressKit(
      args.arnsConfig.mint,
      this.signer.address,
    );
    const cost = await this._estimateBuyNameCost(args.buyNameParams);
    const plan = await this._resolveFundingPlan(args.params, cost);
    const { remainingAccounts, withdrawalCounter, residueVaultCount } =
      await this._materializeFundingPlan(args.params, plan);

    return await getBuyNameFromFundingPlanInstructionAsync(
      {
        config: await this.arnsConfigPda(),
        demandFactor: await this.demandFactorPda(),
        arnsRecord: args.arnsRecord,
        nameRegistry: await this.nameRegistryPda(),
        reservedNameCheck: args.reservedNameCheck,
        returnedNameCheck: args.returnedNameCheck,
        garSettings,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        protocolTokenAccount: args.arnsConfig.treasury,
        payerTokenAccount: plan.hasBalanceSource ? buyerATA : undefined,
        buyer: this.signer,
        withdrawalCounter,
        garProgram: this.garProgram,
        params: args.buyNameParams,
        sources: plan.sources.map(toGeneratedFundingSourceSpec),
        discountAccountCount: 0,
        residueVaultCount,
      },
      {
        programAddress: this.arnsProgram,
      },
    ).then((ix) =>
      remainingAccounts.length > 0
        ? withRemainingAccounts(ix, remainingAccounts)
        : ix,
    );
  }

  /**
   * For an explicit caller-supplied plan, detect which Delegation sources
   * will trigger an on-chain residue auto-vault. Reads each (Delegation,
   * Gateway) pair in parallel; computes post-drain; flags `(0, min)`.
   *
   * Hard-fails on RPC error or missing PDA — silently skipping would let
   * the on-chain handler reject the tx with `MissingResidueVault` and
   * burn fees. The error message points at remediation.
   */
  private async _detectResidueIndexes(
    sources: PublicFundingSourceSpec[],
    gatewayPerSource: (Address | undefined)[],
  ): Promise<number[]> {
    const delegationIndexes = sources
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.kind === 'delegation');
    if (delegationIndexes.length === 0) return [];

    const owner = this.signer.address;
    const reads = await Promise.all(
      delegationIndexes.map(async ({ i }) => {
        const gateway = gatewayPerSource[i];
        if (!gateway) {
          throw new Error(
            `funding plan source #${i} is a Delegation but gatewayPerSource[${i}] is undefined; set source.gateway or params.gatewayAddress`,
          );
        }
        const [delegationPda] = await getDelegationPDA(
          gateway,
          owner,
          this.garProgram,
        );
        const [gatewayPda] = await getGatewayPDA(gateway, this.garProgram);
        const [delAcct, gwAcct] = await Promise.all([
          fetchEncodedAccount(this.rpc, delegationPda, {
            commitment: this.commitment,
          }),
          fetchEncodedAccount(this.rpc, gatewayPda, {
            commitment: this.commitment,
          }),
        ]);
        if (!delAcct.exists) {
          throw new Error(
            `residue auto-detect failed: Delegation PDA ${delegationPda} not found for source #${i} (gateway ${gateway}); ensure the delegation exists or pass an explicit funding plan with residue hints`,
          );
        }
        if (!gwAcct.exists) {
          throw new Error(
            `residue auto-detect failed: Gateway PDA ${gatewayPda} not found for source #${i}`,
          );
        }
        return { i, delAcct, gwAcct };
      }),
    );

    const delegationDecoder = getDelegationDecoder();
    const gatewayDecoder = getGatewayDecoder();
    const states: (
      | { delegationAmount: bigint; minDelegationAmount: bigint }
      | undefined
    )[] = new Array(sources.length).fill(undefined);
    for (const { i, delAcct, gwAcct } of reads) {
      const delegation = delegationDecoder.decode(delAcct.data);
      const gateway = gatewayDecoder.decode(gwAcct.data);
      states[i] = {
        delegationAmount: delegation.amount,
        minDelegationAmount: gateway.settings.minDelegationAmount,
      };
    }
    return computeResidueIndexes(sources, states);
  }

  /**
   * Materialize a `FundingPlan` into the on-chain ix's per-source remaining
   * accounts, residue-vault PDAs, and the withdrawal_counter slot. Shared
   * across all 5 ArNS funding-plan ix dispatches and the 2 ario-core
   * primary-name funding-plan dispatches.
   *
   * Throws when the plan has Withdrawal sources whose ids cannot be
   * resolved from either `spec.withdrawalId` (preferred) or
   * `params.withdrawalId` (single-withdrawal back-compat).
   */
  private async _materializeFundingPlan(
    params: {
      withdrawalId?: number | bigint;
      sources?: PublicFundingSourceSpec[];
    },
    plan: InternalFundingPlan,
  ): Promise<{
    remainingAccounts: AccountMeta[];
    withdrawalCounter: Address;
    residueVaultCount: number;
  }> {
    // Resolve withdrawalIds: prefer per-source `spec.withdrawalId` (the
    // multi-withdrawal canonical path — discoverFundingSources sets it
    // and explicit caller plans can too); fall back to params.withdrawalId
    // for single-withdrawal CLI back-compat.
    const withdrawalSpecs = (params.sources ?? plan.sources).filter(
      (s) => s.kind === 'withdrawal',
    );
    const withdrawalIds: bigint[] = withdrawalSpecs.map((s, idx) => {
      const specId = (s as { withdrawalId?: bigint }).withdrawalId;
      if (specId !== undefined) return BigInt(specId);
      if (params.withdrawalId !== undefined && idx === 0) {
        return BigInt(params.withdrawalId);
      }
      throw new Error(
        `funding plan Withdrawal source #${idx} has no withdrawalId; set it on the source spec or pass params.withdrawalId for single-withdrawal plans`,
      );
    });
    const { residueVaults, withdrawalCounter } = await predictResidueVaults(
      this.rpc,
      this.signer.address,
      plan,
      { garProgram: this.garProgram },
    );
    const remainingAccounts = await buildFundingPlanRemainingAccounts(
      plan,
      this.signer.address,
      { withdrawalIds, residueVaults, garProgram: this.garProgram },
    );
    return {
      remainingAccounts: remainingAccounts as unknown as AccountMeta[],
      withdrawalCounter,
      residueVaultCount: residueVaults.length,
    };
  }

  /**
   * Best-effort cost estimation for `buy_name`. Reads the live DemandFactor
   * + ArnsConfig and applies the on-chain pricing math. Used by the funding-
   * plan path so callers don't have to compute cost client-side.
   *
   * The estimate may be 1-2 mARIO higher than the actual on-chain cost when a
   * demand-factor period rolls during the tx; the on-chain handler reads the
   * live demand-factor and verifies sum(sources) == cost, so an overestimate
   * fails fast with `FundingPlanAmountMismatch`. Callers should retry with a
   * fresh estimate on that error.
   */
  private async _estimateBuyNameCost(buyNameParams: {
    name: string;
    purchaseType: PurchaseType;
    years: number;
  }): Promise<bigint> {
    // Importing the pricing helpers from generated/ would couple the SDK to
    // codegen layout; instead we re-implement the same math (see
    // programs/ario-arns/src/pricing.rs::calculate_registration_fee).
    const [demandFactorPda] = await getDemandFactorPDA(this.arnsProgram);
    const dfAccount = await fetchEncodedAccount(this.rpc, demandFactorPda, {
      commitment: this.commitment,
    });
    if (!dfAccount.exists) throw new Error('DemandFactor not found');
    const data = Buffer.from(dfAccount.data);
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const demandFactor = dv.getBigUint64(8, true);
    // DemandFactor layout (Borsh, packed; ario-arns/src/state/mod.rs):
    //   disc(8) + current_demand_factor(u64) + current_period(u64) +
    //   purchases_this_period(u64) + revenue_this_period(u64) +
    //   consecutive_periods_with_min_demand_factor(u32) +
    //   trailing_period_purchases([u64; 7]) +
    //   trailing_period_revenues([u64; 7]) + fees([u64; 51]) + ...
    // -> fees starts at 8 + 8 + 8 + 8 + 8 + 4 + 56 + 56 = 156.
    const FEES_OFFSET = 156;
    if (data.length < FEES_OFFSET + 51 * 8) {
      throw new Error('DemandFactor account data too short for fees array');
    }
    const nameLen = buyNameParams.name.length;
    const idx = Math.min(Math.max(nameLen, 1), 51) - 1;
    const baseFee = dv.getBigUint64(FEES_OFFSET + idx * 8, true);
    const SCALE = 1_000_000n; // DEMAND_FACTOR_SCALE
    if (buyNameParams.purchaseType === PurchaseType.Permabuy) {
      // Permabuy = base_fee * 20% * 20 (annual share × 20 years cap)
      const permabuy = (baseFee * 200_000n) / SCALE; // 20% annual
      return (permabuy * 20n * demandFactor) / SCALE;
    }
    // Lease: base_fee * (1 + 0.20 * years) * demand_factor
    const leasePct = SCALE + 200_000n * BigInt(buyNameParams.years);
    return (((baseFee * leasePct) / SCALE) * demandFactor) / SCALE;
  }

  private async arnsConfigPda(): Promise<Address> {
    // The ArNS config (`Settings`) PDA is seeded with `arns_config` — NOT
    // the `ario_config` seed used by the ario-core `Config` PDA. Earlier
    // revisions of this helper called `getArioConfigPDA(this.arnsProgram)`
    // which composes the wrong seed against the right program; the
    // resulting PDA points at an account that never exists, and every
    // fund-from-stakes / withdrawal / funding-plan path simulated as
    // AccountNotInitialized (#3012) on the `config` slot.
    const [pda] = await getArnsSettingsPDA(this.arnsProgram);
    return pda;
  }
  private async demandFactorPda(): Promise<Address> {
    const [pda] = await getDemandFactorPDA(this.arnsProgram);
    return pda;
  }
  private async nameRegistryPda(): Promise<Address> {
    const [pda] = await getArnsRegistryPDA(this.arnsProgram);
    return pda;
  }

  async upgradeRecord(
    params: ArNSPurchaseParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );
    const ix = await this._buildManageStakeIx({
      params,
      operation: 'upgrade',
    });
    const syncIx = await this._buildSyncAttributesIxIfOwner(params.name);
    const sig = await this.sendTransaction(
      syncIx ? [...migrateIxs, ix, syncIx] : [...migrateIxs, ix],
    );
    return { id: sig };
  }

  async syncAttributes(
    params: { name: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    // Public method — caller is asking explicitly to sync. Build the ix
    // unconditionally; if they don't actually own the ANT, the on-chain
    // handler returns NotNftHolder. (The bundle path uses
    // `_buildSyncAttributesIxIfOwner`, which skips when not the owner so
    // the wrapping arns ix can still succeed for non-holder management
    // — see BD-095.)
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );
    const ix = await this._buildSyncAttributesIxUnconditional(params.name);
    const sig = await this.sendTransaction([...migrateIxs, ix]);
    return { id: sig };
  }

  /**
   * Build a `sync_attributes` instruction for `name` IFF the signer is
   * the current MPL Core asset owner. Returns `null` otherwise.
   *
   * Sprint 4 / ADR-016: bundle helper for `buyRecord`, `upgradeRecord`,
   * `increaseUndernameLimit`, `reassignName`, and `buyReturnedName`.
   * Returning `null` lets the caller send the arns ix alone — preserves
   * BD-095 (non-holder ArNS lease management) and BD-096 (deferred
   * trait sync for non-holder buyers). The actual ANT owner reconciles
   * state later via the public `syncAttributes()`.
   *
   * `extendLease` is NOT a caller of this helper — extend_lease changes
   * only `end_timestamp`, which isn't mirrored in any Attributes-plugin
   * trait (BD-095 last row). `releaseName` is also excluded — release_name
   * closes the ArnsRecord PDA, so a follow-up `sync_attributes` would
   * fail the PDA-existence check.
   *
   * `assetOverride` MUST be set when the bundling ix mutates
   * `record.ant` mid-tx (i.e. `reassign_name`). The on-chain record
   * still points at the OLD asset at SDK build time, so without the
   * override the bundled sync would target the wrong asset and fail
   * the post-reassign `record.ant == asset.key()` check. The owner
   * check runs against the supplied asset (= new ANT for reassign),
   * matching the pre-reshape "new owner reconciles later" semantic.
   */
  private async _buildSyncAttributesIxIfOwner(
    name: string,
    assetOverride?: Address,
  ): Promise<Instruction | null> {
    let asset: Address;
    if (assetOverride !== undefined) {
      asset = assetOverride;
    } else {
      const record = await this.getArNSRecord({ name });
      asset = address(record.processId);
    }

    const { fetchMplCoreOwner } = await import('./mpl-core.js');
    const owner = await fetchMplCoreOwner(this.rpc, asset, {
      commitment: this.commitment,
    });
    if (owner === null || owner !== this.signer.address) {
      return null;
    }

    return this._buildSyncAttributesIxFor(name, asset);
  }

  /**
   * Build a `sync_attributes` instruction unconditionally (no owner
   * check). Used by the public `syncAttributes()` method, where the
   * caller is asking explicitly — if they aren't the owner the chain
   * returns NotNftHolder.
   */
  private async _buildSyncAttributesIxUnconditional(
    name: string,
  ): Promise<Instruction> {
    const record = await this.getArNSRecord({ name });
    return this._buildSyncAttributesIxFor(name, address(record.processId));
  }

  /** Pure builder; no RPC. Used by both gated + unconditional helpers. */
  private async _buildSyncAttributesIxFor(
    name: string,
    asset: Address,
  ): Promise<Instruction> {
    const [arnsRecord] = await getArnsRecordPDA(name, this.arnsProgram);
    return getSyncAttributesInstruction(
      {
        asset,
        payer: this.signer,
        authority: this.signer,
        arnsRecord,
        name,
      },
      { programAddress: this.antProgram },
    );
  }

  async extendLease(
    params: ExtendLeaseParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );
    const ix = await this._buildManageStakeIx({
      params,
      operation: 'extend',
      years: params.years,
    });
    // BD-095: extend_lease changes only `end_timestamp`, which isn't
    // mirrored in any Metaplex Attributes plugin trait. No bundle.
    const sig = await this.sendTransaction([...migrateIxs, ix]);
    return { id: sig };
  }

  async increaseUndernameLimit(
    params: IncreaseUndernameLimitParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );
    const ix = await this._buildManageStakeIx({
      params,
      operation: 'increaseUndername',
      quantity: params.increaseCount,
    });
    const syncIx = await this._buildSyncAttributesIxIfOwner(params.name);
    const sig = await this.sendTransaction(
      syncIx ? [...migrateIxs, ix, syncIx] : [...migrateIxs, ix],
    );
    return { id: sig };
  }

  /**
   * Shared dispatch helper for the 3 manage variants (upgrade / extend /
   * increaseUndername). They share the same account shape per the
   * `manage_from_delegation_accounts!` / `manage_from_operator_stake_accounts!`
   * macros in `programs/ario-arns/src/instructions/manage_from_stake.rs`.
   * Only the operation-specific extra args differ (years for extend,
   * quantity for increaseUndername).
   */
  private async _buildManageStakeIx(args: {
    params: ArNSPurchaseParams & {
      years?: number;
      increaseCount?: number;
    };
    operation: 'upgrade' | 'extend' | 'increaseUndername';
    years?: number;
    quantity?: number;
  }) {
    const arnsConfig = await this.getArnsConfig();
    const callerATA = await getAssociatedTokenAddressKit(
      arnsConfig.mint,
      this.signer.address,
    );
    const [arnsRecord] = await getArnsRecordPDA(
      args.params.name,
      this.arnsProgram,
    );

    // Balance / undefined → original direct-transfer ix (matches pre-Phase-4).
    if (
      !args.params.fundFrom ||
      args.params.fundFrom === 'balance' ||
      args.params.fundFrom === 'turbo'
    ) {
      const baseAccounts = await this.withArnsDefaults({
        arnsRecord,
        callerTokenAccount: callerATA,
        protocolTokenAccount: arnsConfig.treasury,
        caller: this.signer,
      });
      if (args.operation === 'upgrade') {
        return getUpgradeNameInstructionAsync(baseAccounts, {
          programAddress: this.arnsProgram,
        });
      }
      if (args.operation === 'extend') {
        return getExtendLeaseInstructionAsync(
          { ...baseAccounts, years: args.years! },
          { programAddress: this.arnsProgram },
        );
      }
      return getIncreaseUndernameLimitInstructionAsync(
        { ...baseAccounts, quantity: args.quantity! },
        { programAddress: this.arnsProgram },
      );
    }

    // Stake / withdrawal / funding-plan paths share an account skeleton.
    const garConfig = await this.getGarConfig();
    const [garSettings] = await getGarSettingsPDA(this.garProgram);
    const sharedManageBase = {
      config: await this.arnsConfigPda(),
      demandFactor: await this.demandFactorPda(),
      arnsRecord,
      garSettings,
      stakeTokenAccount: garConfig.stakeTokenAccount,
      protocolTokenAccount: arnsConfig.treasury,
      caller: this.signer,
      garProgram: this.garProgram,
    };

    if (args.params.fundFrom === 'stakes' && args.params.gatewayAddress) {
      const gatewayAddr = address(args.params.gatewayAddress);
      const [gatewayPda] = await getGatewayPDA(gatewayAddr, this.garProgram);
      const stakeBase = { ...sharedManageBase, gateway: gatewayPda };
      if (args.params.fundAsOperator) {
        if (args.operation === 'upgrade')
          return getUpgradeNameFromOperatorStakeInstructionAsync(stakeBase, {
            programAddress: this.arnsProgram,
          });
        if (args.operation === 'extend')
          return getExtendLeaseFromOperatorStakeInstructionAsync(
            { ...stakeBase, years: args.years! },
            { programAddress: this.arnsProgram },
          );
        return getIncreaseUndernameLimitFromOperatorStakeInstructionAsync(
          { ...stakeBase, quantity: args.quantity! },
          { programAddress: this.arnsProgram },
        );
      }
      const [delegationPda] = await getDelegationPDA(
        gatewayAddr,
        this.signer.address,
        this.garProgram,
      );
      const delBase = { ...stakeBase, delegation: delegationPda };
      if (args.operation === 'upgrade')
        return getUpgradeNameFromDelegationInstructionAsync(delBase, {
          programAddress: this.arnsProgram,
        });
      if (args.operation === 'extend')
        return getExtendLeaseFromDelegationInstructionAsync(
          { ...delBase, years: args.years! },
          { programAddress: this.arnsProgram },
        );
      return getIncreaseUndernameLimitFromDelegationInstructionAsync(
        { ...delBase, quantity: args.quantity! },
        { programAddress: this.arnsProgram },
      );
    }

    if (
      args.params.fundFrom === 'withdrawal' &&
      args.params.withdrawalId !== undefined
    ) {
      const [withdrawalPda] = await getWithdrawalPDA(
        this.signer.address,
        args.params.withdrawalId,
        this.garProgram,
      );
      const wBase = { ...sharedManageBase, withdrawal: withdrawalPda };
      if (args.operation === 'upgrade')
        return getUpgradeNameFromWithdrawalInstructionAsync(wBase, {
          programAddress: this.arnsProgram,
        });
      if (args.operation === 'extend')
        return getExtendLeaseFromWithdrawalInstructionAsync(
          { ...wBase, years: args.years! },
          { programAddress: this.arnsProgram },
        );
      return getIncreaseUndernameLimitFromWithdrawalInstructionAsync(
        { ...wBase, quantity: args.quantity! },
        { programAddress: this.arnsProgram },
      );
    }

    if (args.params.fundFrom === 'plan' || args.params.fundFrom === 'any') {
      // Cost estimation for manage variants: each operation has its own
      // pricing path. Keep it pragmatic — let the planner build the plan
      // around the user's desired total (caller can pass explicit sources
      // to bypass cost estimation entirely).
      const cost = await this._estimateManageStakeCost({
        operation: args.operation,
        name: args.params.name,
        years: args.years,
        quantity: args.quantity,
      });
      const plan = await this._resolveFundingPlan(args.params, cost);
      const buyerATA = await getAssociatedTokenAddressKit(
        arnsConfig.mint,
        this.signer.address,
      );
      const { remainingAccounts, withdrawalCounter, residueVaultCount } =
        await this._materializeFundingPlan(args.params, plan);
      const fpBase = {
        config: await this.arnsConfigPda(),
        demandFactor: await this.demandFactorPda(),
        arnsRecord,
        garSettings,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        protocolTokenAccount: arnsConfig.treasury,
        payerTokenAccount: plan.hasBalanceSource ? buyerATA : undefined,
        caller: this.signer,
        withdrawalCounter,
        garProgram: this.garProgram,
        sources: plan.sources.map(toGeneratedFundingSourceSpec),
        discountAccountCount: 0,
        residueVaultCount,
      };
      let ix;
      if (args.operation === 'upgrade')
        ix = await getUpgradeNameFromFundingPlanInstructionAsync(fpBase, {
          programAddress: this.arnsProgram,
        });
      else if (args.operation === 'extend')
        ix = await getExtendLeaseFromFundingPlanInstructionAsync(
          { ...fpBase, years: args.years! },
          { programAddress: this.arnsProgram },
        );
      else
        ix = await getIncreaseUndernameLimitFromFundingPlanInstructionAsync(
          { ...fpBase, quantity: args.quantity! },
          { programAddress: this.arnsProgram },
        );
      return remainingAccounts.length > 0
        ? withRemainingAccounts(ix, remainingAccounts)
        : ix;
    }

    throw new Error(
      `unsupported fundFrom mode '${args.params.fundFrom}' for ${args.operation}`,
    );
  }

  /**
   * Cost estimate for manage operations (upgrade / extend / increaseUndername).
   * Reads the live DemandFactor account + applies the on-chain pricing math.
   */
  private async _estimateManageStakeCost(args: {
    operation: 'upgrade' | 'extend' | 'increaseUndername';
    name: string;
    years?: number;
    quantity?: number;
  }): Promise<bigint> {
    const [demandFactorPda] = await getDemandFactorPDA(this.arnsProgram);
    const dfAccount = await fetchEncodedAccount(this.rpc, demandFactorPda, {
      commitment: this.commitment,
    });
    if (!dfAccount.exists) throw new Error('DemandFactor not found');
    const data = Buffer.from(dfAccount.data);
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const demandFactor = dv.getBigUint64(8, true);
    const FEES_OFFSET = 156; // see DemandFactor layout note above
    const idx = Math.min(Math.max(args.name.length, 1), 51) - 1;
    const baseFee = dv.getBigUint64(FEES_OFFSET + idx * 8, true);
    const SCALE = 1_000_000n;
    if (args.operation === 'upgrade') {
      // Permabuy upgrade: 20% × 20 × demand_factor
      const permabuy = (baseFee * 200_000n) / SCALE;
      return (permabuy * 20n * demandFactor) / SCALE;
    }
    if (args.operation === 'extend') {
      // Lease extension fee: base_fee * 0.20 * years * demand_factor
      return (
        (baseFee * 200_000n * BigInt(args.years!) * demandFactor) /
        SCALE /
        SCALE
      );
    }
    // increaseUndername: base_fee * UNDERNAME_LEASE_FEE_PCT * quantity * demand_factor
    // UNDERNAME_LEASE_FEE_PCT = 1% = 10_000 in RATE_SCALE = 1_000_000.
    return (
      (baseFee * 10_000n * BigInt(args.quantity!) * demandFactor) /
      SCALE /
      SCALE
    );
  }

  // =========================================
  // Primary name operations (ario-core)
  // =========================================

  /**
   * If the signer already has a primary name set, build the instruction(s)
   * needed to remove it so they can be prepended to a request/set tx —
   * enabling single-tx "change primary name" flows.
   *
   * Returns an empty array when the signer has no existing primary name.
   *
   * Throws when the signer has a legacy primary-name state (forward
   * `PrimaryName` PDA exists but its paired `PrimaryNameReverse` PDA does
   * NOT). Both `remove_primary_name` AND `request_and_set_primary_name`
   * require the reverse PDA on-chain — the latter rejects with
   * `MustRemoveExistingPrimaryName` (0x1786, code 6022) any time a
   * forward record already exists for the signer, regardless of reverse
   * state. Silently skipping the remove would queue a tx guaranteed to
   * fail with that opaque error. Surfacing it at the client with a clear
   * remediation pointer is the only safe behavior.
   *
   * The legacy state should not exist on any cluster post-snapshot/import
   * PR #159 (which emits PrimaryNameReverse in lockstep with PrimaryName)
   * — it's a relic of pre-#159 imports. Operators on affected clusters
   * must run `yarn workspace @ar-io/migration-import backfill:primary-name-reverse`
   * (in the solana-ar-io repo) before this method can succeed.
   */
  private async _buildRemoveExistingPrimaryNameIxs(): Promise<Instruction[]> {
    const [primaryNamePda] = await getPrimaryNamePDA(
      this.signer.address,
      this.coreProgram,
    );
    const account = await fetchEncodedAccount(this.rpc, primaryNamePda, {
      commitment: this.commitment,
    });
    if (!account.exists) return [];

    const { name: oldName } = deserializePrimaryName(Buffer.from(account.data));
    const [primaryNameReversePda] = await getPrimaryNameReversePDA(
      oldName,
      this.coreProgram,
    );

    const reverseAccount = await fetchEncodedAccount(
      this.rpc,
      primaryNameReversePda,
      { commitment: this.commitment },
    );
    if (!reverseAccount.exists) {
      // Fail fast with an actionable message. See method docstring for
      // why request_and_set would reject this regardless.
      throw new Error(
        `Cannot change primary name: signer "${this.signer.address}" has a ` +
          `legacy PrimaryName ("${oldName}") with no paired PrimaryNameReverse PDA ` +
          `(${primaryNameReversePda}). The on-chain remove_primary_name and ` +
          `request_and_set_primary_name ixs both require the reverse PDA — ` +
          `request_and_set will reject with MustRemoveExistingPrimaryName (code 6022). ` +
          `Run \`yarn workspace @ar-io/migration-import backfill:primary-name-reverse\` ` +
          `against this cluster's ario-core program to materialize the missing reverse ` +
          `PDA, then retry.`,
      );
    }

    return [
      await getRemovePrimaryNameInstructionAsync(
        {
          primaryName: primaryNamePda,
          primaryNameReverse: primaryNameReversePda,
          owner: this.signer,
          reverseLookupHash: hashName(oldName),
        },
        { programAddress: this.coreProgram },
      ),
    ];
  }

  /**
   * Build the `remaining_accounts` slice + the `antProgramId` arg the
   * four ario-core primary-name instructions consume. Sprint 2/5
   * reshape (ADR-016): ario-core no longer reads MPL Core asset bytes.
   * Authorization is "caller is the AntRecord.owner for this name" via
   * PDA-seed-pinned lookup.
   *
   * Layouts the on-chain handlers expect:
   *   request_primary_name:               [arnsRecord, demandFactor]
   *   request_and_set_primary_name:       [arnsRecord, demandFactor, antRecord]
   *   approve_primary_name:               [arnsRecord, antRecord]
   *   remove_primary_name_for_base_name:  [arnsRecord, antRecord(@)]
   *
   * `antRecord` keys off the undername part for undernames (e.g.
   * "blog_arweave" → AntRecord at "blog") or the canonical "@" sentinel
   * for base names. `removeForBaseName` is special — it always uses "@"
   * regardless of whether the primary name being removed is an undername,
   * since the *base* name owner is the one revoking it.
   *
   * `antProgram` honors ADR-016 / BD-100 pluggability: the asset's
   * `ANT Program` Attributes-plugin trait selects which program owns the
   * AntRecord PDA. Absent / unparseable → canonical fallback. The detected
   * trait is untrusted asset/RPC data, so it is honored only when it matches
   * the canonical program or this client's explicitly-configured
   * `this.antProgram`; any other value falls back to the configured program
   * (see the SECURITY note in the body). Both the PDA derivation here and the
   * `ant_program_id` arg the caller passes to the on-chain ix MUST agree (the
   * handler re-derives and rejects mismatches).
   */
  private async _buildPrimaryNameValidationAccounts(
    name: string,
    variant: 'request' | 'requestAndSet' | 'approve' | 'removeForBaseName',
  ): Promise<{ remaining: AccountMeta[]; antProgram: Address }> {
    const { isUndername, baseName, undername } = splitPrimaryName(name);
    const [arnsRecordPda] = await getArnsRecordPDA(baseName, this.arnsProgram);

    const remaining: AccountMeta[] = [
      { address: arnsRecordPda, role: AccountRole.READONLY },
    ];

    // Fee-charging variants need the demand factor for fee scaling.
    if (variant === 'request' || variant === 'requestAndSet') {
      const [demandFactorPda] = await getDemandFactorPDA(this.arnsProgram);
      remaining.push({ address: demandFactorPda, role: AccountRole.READONLY });
    }

    // ANT-auth variants need the AntRecord PDA. We have to read the
    // ArnsRecord first to recover the ANT mint, then read the asset's
    // `ANT Program` trait (ADR-016 / BD-100) to pick the right program
    // for the AntRecord PDA derivation.
    let antProgram: Address = this.antProgram;
    if (variant !== 'request') {
      const arnsAccount = await fetchEncodedAccount(this.rpc, arnsRecordPda, {
        commitment: this.commitment,
      });
      if (!arnsAccount.exists) {
        throw new Error(`ArNS record not found for base name: ${baseName}`);
      }
      const arnsRecord = deserializeArnsRecord(Buffer.from(arnsAccount.data));
      const antMint = address(arnsRecord.processId);

      const { fetchAntProgramFromAsset } = await import('./mpl-core.js');
      const detected = await fetchAntProgramFromAsset(this.rpc, antMint, {
        commitment: this.commitment,
      });
      // SECURITY (BD-100 / SDK ANT-program auth finding): the asset's
      // `ANT Program` trait is untrusted asset/RPC data. Only honor a detected
      // value when it matches the canonical program or the program this client
      // was explicitly configured with (`this.antProgram`); otherwise fall back
      // to the configured program so a spoofed trait can't redirect the
      // AntRecord PDA derivation. This path only derives a READONLY validation
      // account (the instruction itself targets the canonical core program), so
      // the fallback is silent rather than a throw — but the gate keeps an
      // attacker from steering PDA derivation. Heterogeneous BYO-ANT primary
      // names (an asset on a non-configured program) await the contract-side
      // resolution of the `ant_program == ario_ant::ID` pin; see the
      // accompanying security note.
      antProgram =
        detected !== null &&
        (detected === ARIO_ANT_PROGRAM_ID || detected === this.antProgram)
          ? detected
          : this.antProgram;

      // removeForBaseName always uses the "@" undername (the base-name
      // owner's record). The other ANT-auth variants use the undername
      // part if the primary name is an undername.
      const antUndername =
        variant === 'removeForBaseName' || !isUndername || undername === null
          ? '@'
          : undername;
      const [antRecordPda] = await getAntRecordPDA(
        antMint,
        antUndername,
        antProgram,
      );
      remaining.push({ address: antRecordPda, role: AccountRole.READONLY });
    }

    return { remaining, antProgram };
  }

  async requestPrimaryName(
    params: ArNSPurchaseParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    // If the caller already has a primary name, prepend remove ixs so
    // the on-chain handler doesn't reject with MustRemoveExistingPrimaryName.
    const removeIxs = await this._buildRemoveExistingPrimaryNameIxs();

    const { baseName } = splitPrimaryName(params.name);
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(baseName);

    const coreConfig = await this.getCoreConfig();
    const signerATA = await getAssociatedTokenAddressKit(
      coreConfig.mint,
      this.signer.address,
    );

    const { remaining } = await this._buildPrimaryNameValidationAccounts(
      params.name,
      'request',
    );

    // Phase 4 of FUND_FROM_PLAN.md: dispatch primary-name funding via the
    // funding-plan ix when caller asks for stakes/withdrawal/plan/any. The
    // direct-transfer ix stays the path for fundFrom='balance' / undefined.
    let ix;
    if (
      !params.fundFrom ||
      params.fundFrom === 'balance' ||
      params.fundFrom === 'turbo'
    ) {
      ix = withRemainingAccounts(
        await getRequestPrimaryNameInstructionAsync(
          await this.withCoreDefaults({
            initiatorTokenAccount: signerATA,
            protocolTokenAccount: coreConfig.treasury,
            initiator: this.signer,
            name: params.name,
          }),
          { programAddress: this.coreProgram },
        ),
        remaining,
      );
    } else {
      ix = await this._buildPrimaryNameFromFundingPlanIx({
        params,
        coreConfig,
        validationAccounts: remaining,
        operation: 'request',
      });
    }

    const sig = await this.sendTransaction([...removeIxs, ...migrateIxs, ix]);
    return { id: sig };
  }

  async setPrimaryName(
    params: ArNSPurchaseParams,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    // setPrimaryName routes to the on-chain `request_and_set_primary_name`
    // path — the auto-approve flow when the caller owns the AntRecord
    // for the matching name (undername part, or "@" for base names).
    // If the caller already has a primary name, prepend remove ixs so
    // the "change" is atomic in a single transaction.
    const removeIxs = await this._buildRemoveExistingPrimaryNameIxs();

    const { baseName } = splitPrimaryName(params.name);
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(baseName);

    const coreConfig = await this.getCoreConfig();
    const signerATA = await getAssociatedTokenAddressKit(
      coreConfig.mint,
      this.signer.address,
    );

    const { remaining, antProgram } =
      await this._buildPrimaryNameValidationAccounts(
        params.name,
        'requestAndSet',
      );

    let ix;
    if (
      !params.fundFrom ||
      params.fundFrom === 'balance' ||
      params.fundFrom === 'turbo'
    ) {
      ix = withRemainingAccounts(
        await getRequestAndSetPrimaryNameInstructionAsync(
          await this.withCoreDefaults({
            initiatorTokenAccount: signerATA,
            protocolTokenAccount: coreConfig.treasury,
            initiator: this.signer,
            name: params.name,
            reverseLookupHash: hashName(params.name),
            antProgramId: antProgram,
          }),
          { programAddress: this.coreProgram },
        ),
        remaining,
      );
    } else {
      ix = await this._buildPrimaryNameFromFundingPlanIx({
        params,
        coreConfig,
        validationAccounts: remaining,
        operation: 'requestAndSet',
        antProgramId: antProgram,
      });
    }
    const sig = await this.sendTransaction([...removeIxs, ...migrateIxs, ix]);
    return { id: sig };
  }

  /**
   * Build a `request_primary_name_from_funding_plan` or
   * `request_and_set_primary_name_from_funding_plan` ix. Forwards both:
   *   - validation accounts (ArnsRecord + DemandFactor [+ ant_asset
   *     [+ AntRecord]]) — passed via remaining_accounts at indices
   *     [0..validation_account_count)
   *   - per-source PDAs from the funding plan — passed at indices
   *     [validation_account_count..)
   *
   * The on-chain handler (programs/ario-core/src/instructions/primary_name.rs)
   * splits remaining_accounts at `validation_account_count` and forwards the
   * funding-source slice to ario-gar's pay_from_funding_plan via CPI.
   */
  private async _buildPrimaryNameFromFundingPlanIx(args: {
    params: ArNSPurchaseParams;
    coreConfig: { mint: Address; treasury: Address };
    validationAccounts: AccountMeta[];
    operation: 'request' | 'requestAndSet';
    /** Required for `requestAndSet`. Set to the asset's `ANT Program`
     *  trait (see `_buildPrimaryNameValidationAccounts`); the on-chain
     *  PDA seed check pins this against the AntRecord PDA passed in
     *  validationAccounts. Ignored for the `request` variant. */
    antProgramId?: Address;
  }) {
    // Estimate the fee — primary-name fee = PRIMARY_NAME_REQUEST_BASE_FEE *
    // demand_factor / DEMAND_FACTOR_SCALE. Read demand_factor from chain.
    const [demandFactorPda] = await getDemandFactorPDA(this.arnsProgram);
    const dfAccount = await fetchEncodedAccount(this.rpc, demandFactorPda, {
      commitment: this.commitment,
    });
    if (!dfAccount.exists) throw new Error('DemandFactor not found');
    const dv = new DataView(
      dfAccount.data.buffer,
      dfAccount.data.byteOffset,
      dfAccount.data.byteLength,
    );
    const demandFactor = dv.getBigUint64(8, true);
    const PRIMARY_NAME_REQUEST_BASE_FEE = 200_000n; // 0.2 ARIO in mARIO
    const SCALE = 1_000_000n;
    const fee = (PRIMARY_NAME_REQUEST_BASE_FEE * demandFactor) / SCALE;

    const plan = await this._resolveFundingPlan(args.params, fee);
    const garConfig = await this.getGarConfig();
    const [garSettings] = await getGarSettingsPDA(this.garProgram);
    const initiatorATA = await getAssociatedTokenAddressKit(
      args.coreConfig.mint,
      this.signer.address,
    );
    const {
      remainingAccounts: fundingRemaining,
      withdrawalCounter,
      residueVaultCount,
    } = await this._materializeFundingPlan(args.params, plan);
    const allRemaining: AccountMeta[] = [
      ...args.validationAccounts,
      ...fundingRemaining,
    ];
    const validationAccountCount = args.validationAccounts.length;

    const baseFp = {
      config: await this._coreConfigPda(),
      garSettings,
      stakeTokenAccount: garConfig.stakeTokenAccount,
      protocolTokenAccount: args.coreConfig.treasury,
      payerTokenAccount: plan.hasBalanceSource ? initiatorATA : undefined,
      initiator: this.signer,
      withdrawalCounter,
      garProgram: this.garProgram,
      sources: plan.sources.map(toGeneratedFundingSourceSpec),
      validationAccountCount,
      residueVaultCount,
    };

    let ix;
    if (args.operation === 'request') {
      const [requestPda] = await getPrimaryNameRequestPDA(
        this.signer.address,
        this.coreProgram,
      );
      ix = await getRequestPrimaryNameFromFundingPlanInstructionAsync(
        { ...baseFp, request: requestPda, name: args.params.name },
        { programAddress: this.coreProgram },
      );
    } else {
      const [primaryNamePda] = await getPrimaryNamePDA(
        this.signer.address,
        this.coreProgram,
      );
      const [primaryNameReversePda] = await getPrimaryNameReversePDA(
        args.params.name,
        this.coreProgram,
      );
      ix = await getRequestAndSetPrimaryNameFromFundingPlanInstructionAsync(
        {
          ...baseFp,
          primaryName: primaryNamePda,
          primaryNameReverse: primaryNameReversePda,
          name: args.params.name,
          reverseLookupHash: hashName(args.params.name),
          antProgramId: args.antProgramId ?? this.antProgram,
        },
        { programAddress: this.coreProgram },
      );
    }
    return allRemaining.length > 0
      ? withRemainingAccounts(ix, allRemaining)
      : ix;
  }

  private async _coreConfigPda(): Promise<Address> {
    const [pda] = await getArioConfigPDA(this.coreProgram);
    return pda;
  }

  /**
   * Approve a previously-created primary name request. The signer must be
   * the AntRecord.owner for the requested name (undername part for
   * undernames, "@" for base names) — Sprint 2 / ADR-016 reshape.
   *
   * Mirrors the on-chain `approve_primary_name` instruction
   * (`programs/ario-core/src/instructions/primary_name.rs`).
   * remaining_accounts: [arns_record(base), ant_record(undername | @)].
   */
  async approvePrimaryName(
    params: { initiator: Address; name: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const { baseName } = splitPrimaryName(params.name);
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(baseName);

    const [requestPda] = await getPrimaryNameRequestPDA(
      params.initiator,
      this.coreProgram,
    );
    const [primaryNamePda] = await getPrimaryNamePDA(
      params.initiator,
      this.coreProgram,
    );
    const [primaryNameReversePda] = await getPrimaryNameReversePDA(
      params.name,
      this.coreProgram,
    );

    const { remaining, antProgram } =
      await this._buildPrimaryNameValidationAccounts(params.name, 'approve');

    // withCoreDefaults injects `config` as the ArioConfig PDA derived against
    // *this.coreProgram*. Without it, Codama's `findConfigPda()` fallback
    // resolves to the source-pinned `ARioCoreProgramXXXX...` placeholder
    // program id (declare_id! literal pre-anchor-keys-sync), which on any
    // non-mainnet deployment produces an unallocated PDA → Anchor #3012
    // AccountNotInitialized on `config`. requestPrimaryName /
    // requestAndSetPrimaryName already use withCoreDefaults; this was the
    // last setPrimaryName-family entrypoint missing it.
    const ix = withRemainingAccounts(
      await getApprovePrimaryNameInstructionAsync(
        await this.withCoreDefaults({
          request: requestPda,
          initiator: params.initiator,
          primaryName: primaryNamePda,
          primaryNameReverse: primaryNameReversePda,
          nameOwner: this.signer,
          reverseLookupHash: hashName(params.name),
          antProgramId: antProgram,
        }),
        { programAddress: this.coreProgram },
      ),
      remaining,
    );

    const sig = await this.sendTransaction([...migrateIxs, ix]);
    return { id: sig };
  }

  // =========================================
  // Vault release (ario-core)
  // =========================================

  /** Release tokens from an unlocked vault back to the owner. */
  async releaseVault(
    params: { vaultId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const mint = await this.getMint();
    const [vaultPda] = await getVaultPDA(
      this.signer.address,
      BigInt(params.vaultId),
      this.coreProgram,
    );
    const vaultATA = await getAssociatedTokenAddressKit(mint, vaultPda, true);
    const ownerATA = await getAssociatedTokenAddressKit(
      mint,
      this.signer.address,
    );

    const ix = await getReleaseVaultInstructionAsync(
      await this.withCoreDefaults({
        vault: vaultPda,
        vaultTokenAccount: vaultATA,
        ownerTokenAccount: ownerATA,
        owner: this.signer,
      }),
      { programAddress: this.coreProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // =========================================
  // Close expired primary name request (ario-core)
  // =========================================

  /** Close an expired primary name request (permissionless — anyone can call). */
  async closeExpiredRequest(
    params: { initiator: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const initiatorPubkey = address(params.initiator);
    const [requestPda] = await getPrimaryNameRequestPDA(
      initiatorPubkey,
      this.coreProgram,
    );

    const ix = getCloseExpiredRequestInstruction(
      {
        request: requestPda,
        initiator: initiatorPubkey,
        payer: this.signer,
      },
      { programAddress: this.coreProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // =========================================
  // Withdrawal claim (ario-gar)
  // =========================================

  /** Claim tokens from a completed withdrawal (after lock period). */
  async claimWithdrawal(
    params: { withdrawalId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const garConfig = await this.getGarConfig();
    const [withdrawalPda] = await getWithdrawalPDA(
      this.signer.address,
      BigInt(params.withdrawalId),
      this.garProgram,
    );
    const ownerATA = await getAssociatedTokenAddressKit(
      garConfig.mint,
      this.signer.address,
    );

    const ix = await getClaimWithdrawalInstructionAsync(
      await this.withGarDefaults({
        withdrawal: withdrawalPda,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        ownerTokenAccount: ownerATA,
        owner: this.signer,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  // =========================================
  // Claim delegation from leaving gateway (ario-gar)
  // =========================================

  /** Claim delegated stake from a gateway that is leaving the network. */
  async claimDelegateFromLeavingGateway(
    params: { gatewayAddress: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const gateway = address(params.gatewayAddress);
    const [gatewayPda] = await getGatewayPDA(gateway, this.garProgram);
    const [delegationPda] = await getDelegationPDA(
      gateway,
      this.signer.address,
      this.garProgram,
    );
    const nextId = await this.getNextWithdrawalId(this.signer.address);
    const [withdrawalPda] = await getWithdrawalPDA(
      this.signer.address,
      nextId,
      this.garProgram,
    );

    // The on-chain handler is permissionless since `af38a40` (delegator +
    // payer split — anyone can crank). The IDL exposes both fields:
    // `delegator: Address` (no signature, just the seeds-derivation key)
    // and `payer: Signer` (covers rent on the init_if_needed withdrawal
    // counter + the new withdrawal account). The SDK's primary self-
    // claim path passes the signer for both roles; cranker callers can
    // pass distinct addresses by adding a `payer?` param to this method
    // (out of scope here — feature gap; tracked in
    // docs/E2E_TEST_COVERAGE_PLAN.md Phase 3.3).
    const ix = await getClaimDelegateFromLeavingGatewayInstructionAsync(
      {
        gateway: gatewayPda,
        delegation: delegationPda,
        withdrawal: withdrawalPda,
        delegator: this.signer.address,
        payer: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  // =========================================
  // Claim delegation from gateway with delegation DISABLED (ario-gar, Fix #6)
  // =========================================

  /**
   * Claim a delegate's stake out of a gateway that has DISABLED delegation
   * (`allow_delegated_staking == false`), moving it into the delegate's own
   * withdrawal vault (WP §6.3 / Fix #6). This is the disabled-gateway analog of
   * {@link claimDelegateFromLeavingGateway}: the on-chain instruction is
   * permissionless, so a cranker can sweep delegates out (the operator cannot
   * re-enable delegation until `total_delegated_stake == 0` and the cooldown
   * elapses). The withdrawal-counter and withdrawal PDAs are seeded by the
   * DELEGATOR, so a cranker must pass that delegate's `delegatorAddress`.
   *
   * @param params.gatewayAddress  The gateway whose delegation was disabled.
   * @param params.delegatorAddress  The delegate to claim for. Defaults to the
   *   signer (self-claim). Pass another address to crank on a delegate's behalf;
   *   the signer covers rent (`payer`) but stake still routes to the delegate's
   *   own vault (the delegator key is bound by the delegation PDA seeds).
   */
  async claimDelegateFromDisabledGateway(
    params: { gatewayAddress: string; delegatorAddress?: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const gateway = address(params.gatewayAddress);
    const delegator = params.delegatorAddress
      ? address(params.delegatorAddress)
      : this.signer.address;
    const [gatewayPda] = await getGatewayPDA(gateway, this.garProgram);
    const [delegationPda] = await getDelegationPDA(
      gateway,
      delegator,
      this.garProgram,
    );
    // Withdrawal counter + vault are PDA-seeded by the delegator, not the payer.
    const nextId = await this.getNextWithdrawalId(delegator);
    const [withdrawalPda] = await getWithdrawalPDA(
      delegator,
      nextId,
      this.garProgram,
    );

    const ix = await getClaimDelegateFromDisabledGatewayInstructionAsync(
      {
        gateway: gatewayPda,
        delegation: delegationPda,
        withdrawal: withdrawalPda,
        // `delegator` is an unsigned seeds-derivation key; `payer` (the signer)
        // covers rent on the init_if_needed counter + the new withdrawal.
        delegator,
        payer: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  // =========================================
  // Delegation allowlist (ario-gar)
  // =========================================

  /** Add an address to the gateway's delegation allowlist. */
  async allowDelegate(
    params: { delegate: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getAllowDelegateInstructionAsync(
      {
        delegate: address(params.delegate),
        operator: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  /** Remove an address from the gateway's delegation allowlist. */
  async disallowDelegate(
    params: { delegate: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getDisallowDelegateInstructionAsync(
      {
        delegate: address(params.delegate),
        operator: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  /** Enable or disable the delegation allowlist for the gateway. */
  async setAllowlistEnabled(
    params: { enabled: boolean },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getSetAllowlistEnabledInstructionAsync(
      await this.withGarDefaults({
        operator: this.signer,
        enabled: params.enabled,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  // =========================================
  // Buy returned name (ario-arns)
  // =========================================

  /**
   * Buy a name from the returned name auction (Dutch auction with premium).
   *
   * Phase 4: now dispatches on `params.fundFrom`. Note that for
   * `buyReturnedName`, only the protocol share funds from the chosen source;
   * the initiator share is always a direct buyer-ATA → initiator-ATA SPL
   * transfer (matches the on-chain `_from_*` variant behavior).
   */
  async buyReturnedName(
    params: {
      name: string;
      type: 'lease' | 'permabuy';
      years?: number;
      processId: string;
    } & Partial<ArNSPurchaseParams>,
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const arnsConfig = await this.getArnsConfig();
    const buyerATA = await getAssociatedTokenAddressKit(
      arnsConfig.mint,
      this.signer.address,
    );
    const antPubkey = address(params.processId);

    // Read the ReturnedName to find the original initiator (gets the premium).
    const [returnedNamePda] = await getReturnedNamePDA(
      params.name,
      this.arnsProgram,
    );
    const returnedNameAccount = await fetchEncodedAccount(
      this.rpc,
      returnedNamePda,
      { commitment: this.commitment },
    );
    if (!returnedNameAccount.exists) {
      throw new Error(`Returned name not found: ${params.name}`);
    }
    const returnedNameData = Buffer.from(returnedNameAccount.data);
    const nameLen = returnedNameData.readUInt32LE(8);
    const initiatorOffset = 8 + 4 + nameLen + 32;
    const initiator = addressDecoder.decode(
      returnedNameData.subarray(initiatorOffset, initiatorOffset + 32),
    );
    const initiatorATA = await getAssociatedTokenAddressKit(
      arnsConfig.mint,
      initiator,
    );
    const [arnsRecord] = await getArnsRecordPDA(params.name, this.arnsProgram);
    const buyParams = {
      name: params.name,
      purchaseType:
        params.type === 'permabuy' ? PurchaseType.Permabuy : PurchaseType.Lease,
      years: params.years ?? 1,
      ant: antPubkey,
    };

    let ix;
    if (
      !params.fundFrom ||
      params.fundFrom === 'balance' ||
      params.fundFrom === 'turbo'
    ) {
      ix = await getBuyReturnedNameInstructionAsync(
        await this.withArnsDefaults({
          arnsRecord,
          returnedName: returnedNamePda,
          buyerTokenAccount: buyerATA,
          protocolTokenAccount: arnsConfig.treasury,
          initiatorTokenAccount: initiatorATA,
          buyer: this.signer,
          params: buyParams,
        }),
        { programAddress: this.arnsProgram },
      );
    } else {
      const garConfig = await this.getGarConfig();
      const [garSettings] = await getGarSettingsPDA(this.garProgram);
      const sharedReturnedBase = {
        config: await this.arnsConfigPda(),
        demandFactor: await this.demandFactorPda(),
        returnedName: returnedNamePda,
        arnsRecord,
        nameRegistry: await this.nameRegistryPda(),
        buyerTokenAccount: buyerATA,
        initiatorTokenAccount: initiatorATA,
        garSettings,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        protocolTokenAccount: arnsConfig.treasury,
        buyer: this.signer,
        garProgram: this.garProgram,
        params: buyParams,
      };

      if (params.fundFrom === 'stakes' && params.gatewayAddress) {
        const gatewayAddr = address(params.gatewayAddress);
        const [gatewayPda] = await getGatewayPDA(gatewayAddr, this.garProgram);
        if (params.fundAsOperator) {
          ix = await getBuyReturnedNameFromOperatorStakeInstructionAsync(
            { ...sharedReturnedBase, gateway: gatewayPda },
            { programAddress: this.arnsProgram },
          );
        } else {
          const [delegationPda] = await getDelegationPDA(
            gatewayAddr,
            this.signer.address,
            this.garProgram,
          );
          ix = await getBuyReturnedNameFromDelegationInstructionAsync(
            {
              ...sharedReturnedBase,
              gateway: gatewayPda,
              delegation: delegationPda,
            },
            { programAddress: this.arnsProgram },
          );
        }
      } else if (
        params.fundFrom === 'withdrawal' &&
        params.withdrawalId !== undefined
      ) {
        const [withdrawalPda] = await getWithdrawalPDA(
          this.signer.address,
          params.withdrawalId,
          this.garProgram,
        );
        ix = await getBuyReturnedNameFromWithdrawalInstructionAsync(
          { ...sharedReturnedBase, withdrawal: withdrawalPda },
          { programAddress: this.arnsProgram },
        );
      } else if (params.fundFrom === 'plan' || params.fundFrom === 'any') {
        // Returned-name pricing is dynamic (Dutch auction premium); we trust
        // explicit caller-supplied sources here and skip auto-discovery if
        // sources is provided. For 'any' without sources, we fall back to a
        // best-effort estimate using the plain registration fee — caller can
        // always retry with explicit sources on FundingPlanAmountMismatch.
        const cost = await this._estimateBuyNameCost({
          name: params.name,
          purchaseType: buyParams.purchaseType,
          years: buyParams.years,
        });
        const plan = await this._resolveFundingPlan(
          params as ArNSPurchaseParams,
          cost,
        );
        const { remainingAccounts, withdrawalCounter, residueVaultCount } =
          await this._materializeFundingPlan(
            params as ArNSPurchaseParams,
            plan,
          );
        ix = await getBuyReturnedNameFromFundingPlanInstructionAsync(
          {
            ...sharedReturnedBase,
            payerTokenAccount: plan.hasBalanceSource ? buyerATA : undefined,
            withdrawalCounter,
            sources: plan.sources.map(toGeneratedFundingSourceSpec),
            discountAccountCount: 0,
            residueVaultCount,
          },
          { programAddress: this.arnsProgram },
        );
        if (remainingAccounts.length > 0)
          ix = withRemainingAccounts(ix, remainingAccounts);
      } else {
        throw new Error(
          `unsupported fundFrom mode '${params.fundFrom}' for buyReturnedName`,
        );
      }
    }

    // Sprint 4 / ADR-016: bundle ant.sync_attributes after the buy so the
    // Attributes plugin reflects the new record holder. assetOverride =
    // antPubkey because the ArnsRecord PDA is created by buy_returned_name
    // and doesn't exist on-chain at SDK build time.
    const syncIx = await this._buildSyncAttributesIxIfOwner(
      params.name,
      antPubkey,
    );
    const sig = await this.sendTransaction(syncIx ? [ix, syncIx] : [ix]);
    return { id: sig };
  }

  // =========================================
  // Name management (ario-arns)
  // =========================================

  /** Reassign an ArNS name to a different ANT. */
  async reassignName(
    params: { name: string; processId: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );

    const newAnt = address(params.processId);
    const [arnsRecord] = await getArnsRecordPDA(params.name, this.arnsProgram);
    const record = await this.getArNSRecord({ name: params.name });
    const antAsset = address(record.processId);

    const ix = await getReassignNameInstructionAsync(
      await this.withArnsDefaults({
        arnsRecord,
        antAsset,
        caller: this.signer,
        newAnt,
      }),
      { programAddress: this.arnsProgram },
    );

    // Post-reassign the record points at `newAnt`. The bundled
    // `sync_attributes` MUST target `newAnt` — without the override, the
    // helper would read the on-chain record at SDK build time (still
    // pointing at the OLD asset), build a sync ix for the OLD asset, and
    // fail the post-reassign `record.ant == asset.key()` check. The
    // owner-check inside _buildSyncAttributesIxIfOwner runs against
    // `newAnt`, so the bundle fires only when the reassign caller is also
    // the new ANT's holder; otherwise the ix is sent alone and the new
    // owner runs `syncAttributes()` later (BD-095/096).
    const syncIx = await this._buildSyncAttributesIxIfOwner(
      params.name,
      newAnt,
    );
    const reassignWithMetas = withRemainingAccounts(ix, [
      { address: newAnt, role: AccountRole.READONLY },
    ]);
    const sig = await this.sendTransaction(
      syncIx
        ? [...migrateIxs, reassignWithMetas, syncIx]
        : [...migrateIxs, reassignWithMetas],
    );
    return { id: sig };
  }

  /** Release a permabuy name back to the registry (creates a returned name auction). */
  async releaseName(
    params: { name: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );

    const [returnedNamePda] = await getReturnedNamePDA(
      params.name,
      this.arnsProgram,
    );
    const [arnsRecord] = await getArnsRecordPDA(params.name, this.arnsProgram);
    const record = await this.getArNSRecord({ name: params.name });
    const antAsset = address(record.processId);

    const ix = await getReleaseNameInstructionAsync(
      await this.withArnsDefaults({
        arnsRecord,
        returnedName: returnedNamePda,
        antAsset,
        caller: this.signer,
      }),
      { programAddress: this.arnsProgram },
    );

    // Note: no sync_attributes bundle here — release_name closes the
    // ArnsRecord PDA, so a follow-up sync would fail PDA validation. The
    // asset's stale traits remain pointing at the released name; off-chain
    // resolvers should treat ArnsRecord as the source of truth and ignore
    // a "ArNS Name" trait that no longer resolves.
    const sig = await this.sendTransaction([...migrateIxs, ix]);
    return { id: sig };
  }

  // =========================================
  // Epoch cranking (ario-gar) — permissionless
  // =========================================

  /**
   * Create a new epoch. Permissionless — anyone can call when the next
   * epoch's start time has arrived.
   */
  async createEpoch(_options?: WriteOptions): Promise<MessageResult> {
    const garConfig = await this.getGarConfig();

    const [epochSettingsPda] = await getEpochSettingsPDA(this.garProgram);
    const settingsAccount = await fetchEncodedAccount(
      this.rpc,
      epochSettingsPda,
      { commitment: this.commitment },
    );
    if (!settingsAccount.exists) throw new Error('EpochSettings not found');
    const settings = deserializeEpochSettingsFull(
      Buffer.from(settingsAccount.data),
    );
    const epochIndex = settings.currentEpochIndex;
    const [epochPda] = await getEpochPDA(epochIndex, this.garProgram);

    const ix = await getCreateEpochInstructionAsync(
      await this.withGarDefaults({
        epoch: epochPda,
        protocolTokenAccount: garConfig.protocolTokenAccount,
        payer: this.signer,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  /**
   * Tally weights for a batch of gateways. Permissionless — call repeatedly
   * until all gateways are processed. Pass gateway PDAs as
   * `gatewayAccounts`; they're appended as `remaining_accounts`.
   */
  async tallyWeights(
    params: {
      epochIndex: number;
      gatewayAccounts: Address[];
    },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getTallyWeightsInstructionAsync(
      await this.withGarDefaults({
        payer: this.signer,
        epochIndex: BigInt(params.epochIndex),
      }),
      { programAddress: this.garProgram },
    );

    const remaining = params.gatewayAccounts.map((address) => ({
      address,
      role: AccountRole.WRITABLE,
    }));

    const sig = await this.sendTransaction(
      [withRemainingAccounts(ix, remaining)],
      1_000_000,
    );
    return { id: sig };
  }

  /**
   * Prescribe observers and names for an epoch. Permissionless — call after
   * weights are tallied.
   *
   * `gatewayAccounts` MUST be the Gateway PDAs of the SELECTED observers only
   * — at most `epoch_settings.prescribed_observer_count` (≤50), NOT the whole
   * registry. The selection is computed on-chain; mirror it off-chain with
   * {@link predictPrescribedObservers} / {@link getPredictedObserverPDAs} to
   * learn the set. Passing every registry gateway (e.g. via
   * {@link getAllRegistryGatewayPDAs}) hits Solana's `MAX_TX_ACCOUNT_LOCKS = 64`
   * on large registries and the tx fails at pre-flight.
   *
   * The selected PDAs are appended as `remaining_accounts`, followed by the
   * optional `nameRegistryAccount` (must be LAST) which enables the name
   * prescription leg.
   *
   * If a selected gateway leaves between prediction and tx landing, the tx
   * fails with `InvalidGatewayAccount` — retry once with a fresh prediction.
   */
  async prescribeEpoch(
    params: {
      epochIndex: number;
      gatewayAccounts: Address[];
      /** Optional NameRegistry account — pass to enable name prescription */
      nameRegistryAccount?: Address;
    },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getPrescribeEpochInstructionAsync(
      await this.withGarDefaults({
        payer: this.signer,
        epochIndex: BigInt(params.epochIndex),
      }),
      { programAddress: this.garProgram },
    );

    const remaining: AccountMeta[] = params.gatewayAccounts.map((address) => ({
      address,
      role: AccountRole.READONLY,
    }));
    if (params.nameRegistryAccount) {
      remaining.push({
        address: params.nameRegistryAccount,
        role: AccountRole.READONLY,
      });
    }
    const fullIx = withRemainingAccounts(ix, remaining);

    // A prescribe tx with the selected observer set (~50 PDAs) exceeds Solana's
    // 1232-byte limit once there are more than ~24 remaining accounts, so route
    // those through an ephemeral Address Lookup Table (create → extend →
    // compressed v0 tx). Small sets (sparse testnets) take the cheaper inline
    // path. `prescribe_epoch` searches `remaining_accounts` by PDA, so serving
    // them via the ALT (which preserves instruction account order) is
    // transparent — incl. NameRegistry staying last. Validated on staging
    // (667 gateways, 50 observers): 428k CU, name prescription intact.
    if (remaining.length > 24) {
      const id = await sendWithEphemeralLookupTable({
        rpc: this.rpc,
        rpcSubscriptions: this.rpcSubscriptions,
        signer: this.signer,
        instruction: fullIx,
        lookupAddresses: remaining.map((a) => a.address),
        commitment: this.commitment,
        computeUnitLimit: 1_000_000,
      });
      return { id };
    }

    const sig = await this.sendTransaction([fullIx], 1_000_000);
    return { id: sig };
  }

  /**
   * Distribute rewards for a completed epoch in batches. Permissionless —
   * call after epoch ends. Gateway PDAs appended as `remaining_accounts`.
   */
  async distributeEpoch(
    params: {
      epochIndex: number;
      gatewayAccounts: Address[];
    },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const garConfig = await this.getGarConfig();

    // ario_gar::distribute_epoch CPIs into ario_core::release_treasury_to_recipient
    // (signed by the ArioConfig PDA — the canonical treasury authority). The
    // generated builder expects `arioConfig` + `arioCoreProgram` accounts at
    // positions 6+7 (post-PR-19 in ar-io-solana-contracts). Pin both to the
    // configured core program so devnet/testnet deployments don't fall back
    // to the bundled mainnet default.
    const [arioConfig] = await getArioConfigPDA(this.coreProgram);
    const ix = await getDistributeEpochInstructionAsync(
      await this.withGarDefaults({
        protocolTokenAccount: garConfig.protocolTokenAccount,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        arioConfig,
        arioCoreProgram: this.coreProgram,
        payer: this.signer,
        epochIndex: BigInt(params.epochIndex),
      }),
      { programAddress: this.garProgram },
    );

    const remaining = params.gatewayAccounts.map((address) => ({
      address,
      role: AccountRole.WRITABLE,
    }));

    const sig = await this.sendTransaction(
      [withRemainingAccounts(ix, remaining)],
      1_000_000,
    );
    return { id: sig };
  }

  /**
   * Close an old epoch account and reclaim rent. Permissionless — call after
   * the epoch is distributed and at least 7 epochs have passed.
   */
  async closeEpoch(
    params: { epochIndex: number },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getCloseEpochInstructionAsync(
      await this.withGarDefaults({
        payer: this.signer,
        epochIndex: BigInt(params.epochIndex),
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // =========================================
  // Cranker helpers
  // =========================================

  /**
   * Get gateway PDAs for a batch starting at registryIndex.
   * Reads the GatewayRegistry and derives PDAs for the next `batchSize`
   * active gateways.
   */
  async getRegistryGatewayPDAs(
    startIndex: number,
    batchSize: number,
  ): Promise<Address[]> {
    const [registryPda] = await getGatewayRegistryPDA(this.garProgram);
    const registryAccount = await fetchEncodedAccount(this.rpc, registryPda, {
      commitment: this.commitment,
    });
    if (!registryAccount.exists) return [];

    const registryData = Buffer.from(registryAccount.data);
    const count = registryData.readUInt32LE(40); // 8 disc + 32 authority
    const slotsOffset = 48; // 8 + 32 + 4 + 4
    // GatewaySlot: address(32) + composite_weight(8) + start_timestamp(8)
    //            + status(1) + _padding(7) = 56 bytes.
    const SLOT_STRIDE = 56;

    const pdas: Address[] = [];
    const end = Math.min(startIndex + batchSize, count);
    const zero = '11111111111111111111111111111111' as Address;
    for (let i = startIndex; i < end && i < 3000; i++) {
      const slotOffset = slotsOffset + i * SLOT_STRIDE;
      const addr = addressDecoder.decode(
        registryData.subarray(slotOffset, slotOffset + 32),
      );
      if (addr === zero) continue;
      const [gatewayPda] = await getGatewayPDA(addr, this.garProgram);
      pdas.push(gatewayPda);
    }
    return pdas;
  }

  /** Get ALL active gateway PDAs from the registry. */
  async getAllRegistryGatewayPDAs(): Promise<Address[]> {
    const [registryPda] = await getGatewayRegistryPDA(this.garProgram);
    const registryAccount = await fetchEncodedAccount(this.rpc, registryPda, {
      commitment: this.commitment,
    });
    if (!registryAccount.exists) return [];

    const registryData = Buffer.from(registryAccount.data);
    const count = registryData.readUInt32LE(40);
    const slotsOffset = 48;
    const SLOT_STRIDE = 56;

    const pdas: Address[] = [];
    const zero = '11111111111111111111111111111111' as Address;
    for (let i = 0; i < count && i < 3000; i++) {
      const slotOffset = slotsOffset + i * SLOT_STRIDE;
      const addr = addressDecoder.decode(
        registryData.subarray(slotOffset, slotOffset + 32),
      );
      if (addr === zero) continue;
      const [gatewayPda] = await getGatewayPDA(addr, this.garProgram);
      pdas.push(gatewayPda);
    }
    return pdas;
  }

  /**
   * Predict the Gateway PDAs that `prescribe_epoch` will select as observers
   * for `epochIndex`, mirroring the on-chain weighted-roulette selection.
   *
   * Returns at most `epoch_settings.prescribed_observer_count` (≤50) PDAs
   * regardless of registry size — the set to pass as `gatewayAccounts` to
   * {@link prescribeEpoch}. This is the size-safe replacement for
   * {@link getAllRegistryGatewayPDAs} on the prescribe path (which oversupplies
   * and trips `MAX_TX_ACCOUNT_LOCKS = 64` on large registries).
   *
   * Reads three accounts (epoch, registry, epoch settings) at the configured
   * commitment so the prediction reflects live registry weights. If a selected
   * gateway races out before the tx lands, `prescribeEpoch` throws
   * `InvalidGatewayAccount` — re-call this and retry once.
   */
  async getPredictedObserverPDAs(epochIndex: number): Promise<Address[]> {
    // --- Epoch: hashchain (frozen entropy) + active_gateway_count (walk bound) ---
    const [epochPda] = await getEpochPDA(epochIndex, this.garProgram);
    const epochAccount = await fetchEncodedAccount(this.rpc, epochPda, {
      commitment: this.commitment,
    });
    if (!epochAccount.exists) throw new Error(`Epoch ${epochIndex} not found`);
    const epochData = Buffer.from(epochAccount.data);
    // After the 8-byte discriminator (see fetchEpochRawFields): 9×u64 = 72
    // bytes, then hashchain[32], then active_gateway_count(u32).
    const EPOCH_BASE = 8;
    const hashchain = epochData.subarray(EPOCH_BASE + 72, EPOCH_BASE + 72 + 32);
    const activeGatewayCount = epochData.readUInt32LE(EPOCH_BASE + 104);

    // --- Registry: slots[0..activeGatewayCount] (address + composite_weight) ---
    const [registryPda] = await getGatewayRegistryPDA(this.garProgram);
    const registryAccount = await fetchEncodedAccount(this.rpc, registryPda, {
      commitment: this.commitment,
    });
    if (!registryAccount.exists) throw new Error('GatewayRegistry not found');
    const registryData = Buffer.from(registryAccount.data);
    const registryCount = registryData.readUInt32LE(40); // 8 disc + 32 authority
    const SLOTS_OFFSET = 48; // 8 + 32 + 4 count + 4 pad
    const SLOT_STRIDE = 56; // address(32)+weight(8)+start_ts(8)+status(1)+pad(7)
    // Walk exactly the on-chain prefix. The roulette uses
    // registry.gateways[0..epoch.active_gateway_count]; include zero-weight
    // slots so the cumulative walk and weight sum match byte-for-byte.
    const walkCount = Math.min(activeGatewayCount, registryCount, 3000);
    const slots: RegistrySlotWeight[] = [];
    for (let i = 0; i < walkCount; i++) {
      const slotOffset = SLOTS_OFFSET + i * SLOT_STRIDE;
      slots.push({
        address: addressDecoder.decode(
          registryData.subarray(slotOffset, slotOffset + 32),
        ),
        compositeWeight: registryData.readBigUInt64LE(slotOffset + 32),
      });
    }

    // --- Epoch settings: prescribed_observer_count ---
    const [epochSettingsPda] = await getEpochSettingsPDA(this.garProgram);
    const settingsAccount = await fetchEncodedAccount(
      this.rpc,
      epochSettingsPda,
      {
        commitment: this.commitment,
      },
    );
    if (!settingsAccount.exists) throw new Error('EpochSettings not found');
    const settings = deserializeEpochSettingsFull(
      Buffer.from(settingsAccount.data),
    );

    // --- Predict selected operators, then derive their Gateway PDAs ---
    const operators = predictPrescribedObservers(
      hashchain,
      slots,
      settings.prescribedObserverCount,
    );
    const pdas: Address[] = [];
    for (const operator of operators) {
      const [gatewayPda] = await getGatewayPDA(operator, this.garProgram);
      pdas.push(gatewayPda);
    }
    return pdas;
  }

  /**
   * Reclaim rent from the ephemeral Address Lookup Tables this signer created
   * for `prescribe_epoch` (see {@link sendWithEphemeralLookupTable}). Each
   * prescribe leaves a single-use table allocated (~0.0126 SOL); reclaiming
   * needs a deactivate → ~513-slot cooldown → close sequence, so it can't run
   * inline. Call this from a throttled/permissionless cleanup pass (cranker /
   * observer) to deactivate active tables and close cooled-down ones, refunding
   * the rent to the signer.
   *
   * Discovery reads the signer's transaction history (RPC-portable; the ALT
   * program can't be enumerated via `getProgramAccounts`). The GAR + ArNS
   * program IDs are passed as the entry-ownership fingerprint so only genuine
   * prescribe tables are touched. Best-effort: at most `maxTables` submissions
   * per call, scanning at most `scanLimit` recent signatures.
   */
  async reclaimLookupTableRent(opts?: {
    maxTables?: number;
    scanLimit?: number;
  }): Promise<{
    deactivated: number;
    closed: number;
    candidates: number;
    scannedSignatures: number;
  }> {
    return reclaimLookupTablesForSigner({
      rpc: this.rpc,
      rpcSubscriptions: this.rpcSubscriptions,
      signer: this.signer,
      allowedEntryOwners: [this.garProgram, this.arnsProgram],
      commitment: this.commitment,
      maxTables: opts?.maxTables,
      scanLimit: opts?.scanLimit,
    });
  }

  /** Read and deserialize the full EpochSettings account. */
  async getEpochSettingsFull(): Promise<
    ReturnType<typeof deserializeEpochSettingsFull>
  > {
    const [esPda] = await getEpochSettingsPDA(this.garProgram);
    const account = await fetchEncodedAccount(this.rpc, esPda, {
      commitment: this.commitment,
    });
    if (!account.exists) throw new Error('EpochSettings not found');
    return deserializeEpochSettingsFull(Buffer.from(account.data));
  }

  /**
   * Submit `prescribe_epoch` using the off-chain-predicted observer set, with a
   * single re-predict-and-retry on `InvalidGatewayAccount` (covers a gateway
   * leaving the registry between the prediction read and the tx landing).
   */
  protected async prescribeWithPrediction(
    epochIndex: number,
    nameRegistryAccount?: Address,
  ): Promise<MessageResult> {
    const submit = async () =>
      this.prescribeEpoch({
        epochIndex,
        gatewayAccounts: await this.getPredictedObserverPDAs(epochIndex),
        nameRegistryAccount,
      });
    try {
      return await submit();
    } catch (err) {
      if (!isInvalidGatewayAccountError(err)) throw err;
      return submit();
    }
  }

  /**
   * Advance the epoch lifecycle by ONE on-chain action and return what it did.
   *
   * Stateless and idempotent: it reads `EpochSettings` + the current `Epoch`,
   * determines the single next required step
   * (`create` → `tally` → `prescribe` → `distribute` → `close`), submits it,
   * and returns a {@link CrankEpochStepResult}. Call it repeatedly on your own
   * schedule — it owns *which* on-chain action is correct and *which accounts*
   * it needs; you own scheduling, logging, error classification, and any
   * permissionless cleanup.
   *
   * Crucially, the `prescribe` leg uses {@link getPredictedObserverPDAs} (only
   * the ~`prescribed_observer_count` selected Gateway PDAs), so it never trips
   * `MAX_TX_ACCOUNT_LOCKS = 64` on large registries — and it re-predicts and
   * retries once on `InvalidGatewayAccount`.
   *
   * Errors propagate to the caller (classify/retry as you see fit); the only
   * internally-handled error is the prescribe `InvalidGatewayAccount` retry.
   */
  async crankEpochStep(
    opts: CrankEpochStepOptions = {},
  ): Promise<CrankEpochStepResult> {
    // tally_weights / distribute_epoch append the batch's Gateway PDAs as
    // remaining_accounts. distribute also CPIs into ario-core (treasury
    // release) so it carries 10 named accounts; with ~18+ gateway PDAs on top
    // the tx exceeds Solana's 1232-byte limit. Cap the lifecycle batch at 18 so
    // an oversized caller `batchSize` can't produce an unsendable tx (verified:
    // 30 gateways → 1527B; 18 → ~1050B). prescribe is the exception — it needs
    // ALL selected observers in one tx, so it uses an ALT instead (see
    // prescribeEpoch).
    const MAX_LIFECYCLE_BATCH = 18;
    const batchSize = Math.min(
      opts.batchSize ?? MAX_LIFECYCLE_BATCH,
      MAX_LIFECYCLE_BATCH,
    );
    const enableClose = opts.enableClose ?? true;
    const retention = opts.epochRetention ?? 7;
    const now = opts.now ?? Math.floor(Date.now() / 1000);

    const settings = await this.getEpochSettingsFull();
    if (!settings.enabled) return { action: 'idle', reason: 'epochs_disabled' };

    const currentIndex = settings.currentEpochIndex;
    // currentIndex is the NEXT epoch to create; the live one is currentIndex-1.
    const targetEpochIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const nextEpochStart =
      settings.genesisTimestamp + currentIndex * settings.epochDuration;

    // Bootstrap: no epochs yet.
    if (currentIndex === 0) {
      if (now < nextEpochStart)
        return { action: 'idle', reason: 'waiting_for_genesis' };
      const { id } = await this.createEpoch();
      return { action: 'create', epochIndex: 0, txId: id };
    }

    const epoch = await this.getEpochRaw(targetEpochIndex);
    if (!epoch) return { action: 'idle', reason: 'waiting_for_epoch' };

    // Tally (batched). activeGatewayCount===0 still needs one tx to flip the flag.
    if (epoch.weightsTallied === 0) {
      const gatewayAccounts =
        epoch.activeGatewayCount > 0
          ? await this.getRegistryGatewayPDAs(epoch.tallyIndex, batchSize)
          : [];
      const { id } = await this.tallyWeights({
        epochIndex: targetEpochIndex,
        gatewayAccounts,
      });
      return {
        action: 'tally',
        epochIndex: targetEpochIndex,
        txId: id,
        progress: { index: epoch.tallyIndex, total: epoch.activeGatewayCount },
      };
    }

    // Prescribe (predicted observers only — the size-safe path).
    if (epoch.prescriptionsDone === 0) {
      const nameRegistryAccount =
        opts.nameRegistryAccount === null
          ? undefined
          : (opts.nameRegistryAccount ??
            (await getArnsRegistryPDA(this.arnsProgram))[0]);
      const { id } = await this.prescribeWithPrediction(
        targetEpochIndex,
        nameRegistryAccount,
      );
      return { action: 'prescribe', epochIndex: targetEpochIndex, txId: id };
    }

    // Observations happen while the epoch is live.
    if (now < epoch.endTimestamp)
      return { action: 'idle', reason: 'waiting_for_observations' };

    // Distribute (batched).
    if (epoch.rewardsDistributed === 0) {
      const gatewayAccounts =
        epoch.activeGatewayCount > 0
          ? await this.getRegistryGatewayPDAs(
              epoch.distributionIndex,
              batchSize,
            )
          : [];
      const { id } = await this.distributeEpoch({
        epochIndex: targetEpochIndex,
        gatewayAccounts,
      });
      return {
        action: 'distribute',
        epochIndex: targetEpochIndex,
        txId: id,
        progress: {
          index: epoch.distributionIndex,
          total: epoch.activeGatewayCount,
        },
      };
    }

    // Close a fully-distributed epoch past retention (GAR-006).
    if (enableClose && targetEpochIndex >= retention) {
      const closeTarget = targetEpochIndex - retention;
      const old = await this.getEpochRaw(closeTarget);
      if (old && old.rewardsDistributed === 1) {
        const { id } = await this.closeEpoch({ epochIndex: closeTarget });
        return { action: 'close', epochIndex: closeTarget, txId: id };
      }
    }

    // Current epoch fully processed — create the next once its start arrives.
    if (now >= nextEpochStart) {
      const { id } = await this.createEpoch();
      return { action: 'create', epochIndex: currentIndex, txId: id };
    }

    return { action: 'idle', reason: 'epoch_complete' };
  }

  /**
   * Read the raw epoch account data for cranker state inspection.
   * Returns null if the epoch account doesn't exist yet.
   */
  async getEpochRaw(epochIndex: number): Promise<{
    tallyIndex: number;
    distributionIndex: number;
    weightsTallied: number;
    prescriptionsDone: number;
    rewardsDistributed: number;
    activeGatewayCount: number;
    endTimestamp: number;
  } | null> {
    const [epochPda] = await getEpochPDA(epochIndex, this.garProgram);
    const account = await fetchEncodedAccount(this.rpc, epochPda, {
      commitment: this.commitment,
    });
    if (!account.exists) return null;

    try {
      return this.fetchEpochRawFields(Buffer.from(account.data));
    } catch {
      return null;
    }
  }

  /**
   * Parse raw epoch account data for cranker-relevant fields.
   * Offsets match the Rust Epoch zero-copy struct (repr(C)).
   *
   * Layout after 8-byte discriminator:
   *   [8 epoch_index][8 start_ts][8 end_ts][8 total_eligible][8 per_gw]
   *   [8 per_obs][8 reward_rate][8 weight_lo][8 weight_hi][32 hashchain]
   *   [4 active_gw_count][4 dist_idx][4 tally_idx]
   *   [1 observer_count][1 name_count][1 obs_submitted][1 rewards_dist]
   *   [1 weights_tallied][1 prescriptions_done][1 bump][1 _pad1]
   *   [6000 failure_counts][1600 prescribed_observers]
   *   [1600 prescribed_observer_gateways][64 prescribed_names]
   *   [7 has_observed][5 _pad2]
   */
  private fetchEpochRawFields(data: Buffer): {
    tallyIndex: number;
    distributionIndex: number;
    weightsTallied: number;
    prescriptionsDone: number;
    rewardsDistributed: number;
    activeGatewayCount: number;
    endTimestamp: number;
  } {
    const base = 8;
    const endTimestamp = Number(data.readBigInt64LE(base + 16));
    const activeGatewayCount = data.readUInt32LE(base + 104);
    const distributionIndex = data.readUInt32LE(base + 108);
    const tallyIndex = data.readUInt32LE(base + 112);
    const rewardsDistributed = data.readUInt8(base + 119);
    const weightsTallied = data.readUInt8(base + 120);
    const prescriptionsDone = data.readUInt8(base + 121);

    return {
      tallyIndex,
      distributionIndex,
      weightsTallied,
      prescriptionsDone,
      rewardsDistributed,
      activeGatewayCount,
      endTimestamp,
    };
  }

  // =========================================
  // Prune / cleanup (permissionless crank)
  // =========================================
  //
  // These mirror `tick()`-driven lazy pruning in the Lua source — on Solana
  // each is a discrete instruction someone has to call. All are
  // permissionless except `releaseVault`, which the on-chain handler still
  // gates on `owner: Signer` (ADR / vault.rs::ReleaseVault). See
  // docs/CRANKER_PRUNING_PLAN.md for the full design.

  /**
   * Batch-prune expired ArnsRecord PDAs from the NameRegistry. The caller
   * supplies the eligible records as `arnsRecords` — they're appended as
   * `remaining_accounts` and the on-chain handler verifies each is past
   * `end_timestamp + grace_period + return_auction_duration` before closing.
   * `maxNames` caps the per-tx work (u8). Submit in batches of ~10-15.
   */
  async pruneExpiredNames(
    params: { maxNames: number; arnsRecords: string[] },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getPruneExpiredNamesInstructionAsync(
      await this.withArnsDefaults({
        payer: this.signer,
        maxNames: params.maxNames,
      }),
      { programAddress: this.arnsProgram },
    );

    const remaining: AccountMeta[] = params.arnsRecords.map((a) => ({
      address: address(a),
      role: AccountRole.WRITABLE,
    }));

    const sig = await this.sendTransaction(
      [withRemainingAccounts(ix, remaining)],
      1_000_000,
    );
    return { id: sig };
  }

  /**
   * Convert a single expired-but-not-yet-returned lease into a `ReturnedName`
   * (kicks off the Dutch auction). Permissionless.
   */
  async pruneNameToReturned(
    params: { name: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const migrateIxs = await this._buildMigrateArnsRecordIxIfNeeded(
      params.name,
    );

    const [arnsRecord] = await getArnsRecordPDA(params.name, this.arnsProgram);
    const [returnedName] = await getReturnedNamePDA(
      params.name,
      this.arnsProgram,
    );

    const ix = await getPruneNameToReturnedInstructionAsync(
      await this.withArnsDefaults({
        arnsRecord,
        returnedName,
        payer: this.signer,
      }),
      { programAddress: this.arnsProgram },
    );

    const sig = await this.sendTransaction([...migrateIxs, ix]);
    return { id: sig };
  }

  /**
   * Batch-prune expired ReturnedName PDAs (auction window elapsed). Caller
   * supplies the eligible PDAs as `returnedNames`; they're appended as
   * `remaining_accounts`. `maxNames` caps per-tx work (u8).
   */
  async pruneReturnedNames(
    params: { maxNames: number; returnedNames: string[] },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ix = await getPruneReturnedNamesInstructionAsync(
      await this.withArnsDefaults({
        payer: this.signer,
        maxNames: params.maxNames,
      }),
      { programAddress: this.arnsProgram },
    );

    const remaining: AccountMeta[] = params.returnedNames.map((a) => ({
      address: address(a),
      role: AccountRole.WRITABLE,
    }));

    // Match `pruneExpiredNames` (1M CU) — both dispatch the same batched
    // shape over `remaining_accounts`, and the default 400K is too tight
    // when the cranker batches near `maxNames` (≈15) on a busy registry.
    const sig = await this.sendTransaction(
      [withRemainingAccounts(ix, remaining)],
      1_000_000,
    );
    return { id: sig };
  }

  /**
   * Close a single expired ReservedName PDA. Permissionless after
   * `expires_at`.
   */
  async pruneExpiredReservation(
    params: { name: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const [reservedName] = await getReservedNamePDA(
      params.name,
      this.arnsProgram,
    );

    const ix = getPruneExpiredReservationInstruction(
      {
        reservedName,
        payer: this.signer,
      },
      { programAddress: this.arnsProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  /**
   * Slash and remove a deficient gateway (`stats.failed_consecutive >=
   * max_consecutive_failures`). Builds the protected exit vault for the
   * post-slash min portion plus the optional excess vault for any surplus.
   * The contract's `excess_withdrawal: Option<UncheckedAccount>` slot is
   * always passed (PDA derived from `next_id + 1`); the handler consumes
   * it only when the post-slash stake exceeds `min_operator_stake`.
   * Permissionless.
   */
  async pruneGateway(
    params: { gateway: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const gatewayAddr = address(params.gateway);
    const garConfig = await this.getGarConfig();

    const [gatewayPda] = await getGatewayPDA(gatewayAddr, this.garProgram);
    const [withdrawalCounterPda] = await getWithdrawalCounterPDA(
      gatewayAddr,
      this.garProgram,
    );
    const nextId = await this.getNextWithdrawalId(gatewayAddr);
    const [withdrawalPda] = await getWithdrawalPDA(
      gatewayAddr,
      nextId,
      this.garProgram,
    );
    const [excessWithdrawalPda] = await getWithdrawalPDA(
      gatewayAddr,
      nextId + 1n,
      this.garProgram,
    );

    const ix = await getPruneGatewayInstructionAsync(
      await this.withGarDefaults({
        gateway: gatewayPda,
        withdrawalCounter: withdrawalCounterPda,
        withdrawal: withdrawalPda,
        excessWithdrawal: excessWithdrawalPda,
        stakeTokenAccount: garConfig.stakeTokenAccount,
        protocolTokenAccount: garConfig.protocolTokenAccount,
        payer: this.signer,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix], 1_000_000);
    return { id: sig };
  }

  /**
   * GC a `Leaving`/`Gone` gateway whose leave window has fully elapsed.
   * Closes the Gateway PDA and refunds rent to the caller. Permissionless.
   */
  async finalizeGone(
    params: { gateway: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const gatewayAddr = address(params.gateway);
    const [gatewayPda] = await getGatewayPDA(gatewayAddr, this.garProgram);

    const ix = await getFinalizeGoneInstructionAsync(
      await this.withGarDefaults({
        gateway: gatewayPda,
        caller: this.signer,
      }),
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  /**
   * Reclaim rent from an Observation PDA whose epoch has been distributed.
   * Permissionless. Pass `epochIndex` and the `observer` address used as
   * the Observation seed.
   */
  async closeObservation(
    params: { epochIndex: number; observer: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const observerAddr = address(params.observer);
    const [observationPda] = await getObservationPDA(
      params.epochIndex,
      observerAddr,
      this.garProgram,
    );

    const ix = await getCloseObservationInstructionAsync(
      {
        observation: observationPda,
        payer: this.signer,
        epochIndex: BigInt(params.epochIndex),
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  /**
   * Close an empty Delegation PDA (`amount == 0`) and refund rent to the
   * original delegator (NOT the caller — see GAR-016, prevents griefing).
   * Permissionless.
   */
  async closeEmptyDelegation(
    params: { gateway: string; delegator: string },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const gatewayAddr = address(params.gateway);
    const delegatorAddr = address(params.delegator);
    const [gatewayPda] = await getGatewayPDA(gatewayAddr, this.garProgram);
    const [delegationPda] = await getDelegationPDA(
      gatewayAddr,
      delegatorAddr,
      this.garProgram,
    );

    const ix = getCloseEmptyDelegationInstruction(
      {
        gateway: gatewayPda,
        delegation: delegationPda,
        delegator: delegatorAddr,
        payer: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  /**
   * Close a drained Withdrawal PDA (`amount == 0`) and refund rent to the
   * original owner (NOT the caller). Permissionless.
   */
  async closeDrainedWithdrawal(
    params: { owner: string; withdrawalId: number | bigint },
    _options?: WriteOptions,
  ): Promise<MessageResult> {
    const ownerAddr = address(params.owner);
    const [withdrawalPda] = await getWithdrawalPDA(
      ownerAddr,
      BigInt(params.withdrawalId),
      this.garProgram,
    );

    const ix = getCloseDrainedWithdrawalInstruction(
      {
        withdrawal: withdrawalPda,
        owner: ownerAddr,
        closer: this.signer,
      },
      { programAddress: this.garProgram },
    );

    const sig = await this.sendTransaction([ix]);
    return { id: sig };
  }

  // NOTE: `releaseVault` and `closeExpiredRequest` already exist higher in
  // this class (under `Vault release` / `Close expired primary name request`
  // sections). Both fit the cranker's permissionless cleanup surface, so the
  // cranker uses them in `runCleanup()` directly.
}
