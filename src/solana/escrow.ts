/**
 * Solana ANT-escrow and Token-escrow clients — `ario-ant-escrow` program.
 *
 * ANTEscrow holds a Metaplex Core ANT NFT in trustless custody and
 * releases it after on-chain verification of an Arweave RSA-PSS-4096 or
 * Ethereum ECDSA signature over a canonical claim message.
 *
 * TokenEscrow holds ARIO SPL tokens (liquid or vaulted) in trustless
 * custody with the same multi-protocol claim flow.
 *
 * Design: `docs/ANT_ESCROW_DESIGN.md` (account model, canonical message
 * format, threat model). Plan: `docs/ANT_ESCROW_IMPLEMENTATION_PLAN.md`.
 *
 * All instruction encoding is delegated to the Codama-generated builders
 * in `./generated/ant-escrow/instructions/` — they own the discriminator,
 * Borsh codec, and account-meta wiring derived from the on-chain IDL.
 */

import {
  type Address,
  type Commitment,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import {
  type EscrowAnt,
  type EscrowToken,
  fetchMaybeEscrowAnt,
  fetchMaybeEscrowToken,
  getCancelDepositInstruction,
  getCancelTokenDepositInstruction,
  getCancelVaultDepositInstruction,
  getClaimAntArweaveAttestedInstruction,
  getClaimAntEthereumInstruction,
  getClaimTokensArweaveAttestedInstruction,
  getClaimTokensEthereumInstruction,
  getClaimVaultArweaveAttestedInstruction,
  getClaimVaultEthereumInstruction,
  getDepositAntInstruction,
  getDepositTokensInstruction,
  getDepositVaultInstruction,
  getUpdateRecipientInstruction,
  getUpdateTokenRecipientInstruction,
  getUpdateVaultRecipientInstruction,
} from '@ar.io/solana-contracts/ant-escrow';
import type { ILogger } from '../common/logger.js';
import { Logger } from '../common/logger.js';
import { getAssociatedTokenAddressKit } from './ata.js';
import {
  ARIO_ANT_ESCROW_PROGRAM_ID,
  ARIO_CORE_PROGRAM_ID,
  ESCROW_ARWEAVE_PUBKEY_LEN,
  ESCROW_ASSET_TYPE_VAULT,
  ESCROW_ETHEREUM_PUBKEY_LEN,
  ESCROW_PROTOCOL_ARWEAVE,
  ESCROW_PROTOCOL_ETHEREUM,
} from './constants.js';
import {
  getEscrowAntPDA,
  getEscrowTokenPDA,
  getEscrowVaultPDA,
} from './pda.js';
import { sendAndConfirm } from './send.js';
import type { SolanaRpc, SolanaRpcSubscriptions } from './types.js';

// =========================================
// Public types
// =========================================

export type EscrowProtocol = 'arweave' | 'ethereum';

export interface EscrowAntState {
  /** On-chain schema version, as decoded by the generated client. */
  version: EscrowAnt['version'];
  bump: number;
  depositor: Address;
  antMint: Address;
  recipientProtocol: EscrowProtocol;
  recipientPubkey: Uint8Array; // active prefix only — 512 (arweave) or 20 (eth)
  nonce: Uint8Array; // 32 bytes
  depositSlot: bigint;
}

/** Map the Codama-generated `EscrowAnt` raw decoded type to our public
 *  `EscrowAntState` with protocol enum + active-prefix pubkey slice. */
function toEscrowAntState(raw: EscrowAnt): EscrowAntState {
  const recipientProtocol: EscrowProtocol =
    raw.recipientProtocol === ESCROW_PROTOCOL_ARWEAVE ? 'arweave' : 'ethereum';
  const expectedLen =
    recipientProtocol === 'arweave'
      ? ESCROW_ARWEAVE_PUBKEY_LEN
      : ESCROW_ETHEREUM_PUBKEY_LEN;
  if (
    raw.recipientProtocol !== ESCROW_PROTOCOL_ARWEAVE &&
    raw.recipientProtocol !== ESCROW_PROTOCOL_ETHEREUM
  ) {
    throw new Error(
      `EscrowAnt: unknown protocol byte ${raw.recipientProtocol}`,
    );
  }
  return {
    version: raw.version,
    bump: raw.bump,
    depositor: raw.depositor,
    antMint: raw.antMint,
    recipientProtocol,
    recipientPubkey: new Uint8Array(
      (raw.recipientPubkey as Uint8Array).subarray(0, expectedLen),
    ),
    nonce: new Uint8Array(raw.nonce),
    depositSlot: raw.depositSlot,
  };
}

function protocolToByte(p: EscrowProtocol): number {
  return p === 'arweave' ? ESCROW_PROTOCOL_ARWEAVE : ESCROW_PROTOCOL_ETHEREUM;
}

// =========================================
// ANTEscrow client
// =========================================

export interface ANTEscrowConfig {
  rpc: SolanaRpc;
  rpcSubscriptions?: SolanaRpcSubscriptions;
  signer?: TransactionSigner;
  programId?: Address;
  /**
   * ario-core program id. Currently unused (post-ADR-022 the SDK no longer
   * builds a sibling `vaulted_transfer`; active vault claims are rejected
   * with `VaultStillLocked`). Retained for forward-compat — if the active
   * re-lock path is ever revived via the direct-CPI restoration playbook
   * (contracts `docs/RESTORE_ACTIVE_VAULT_RELOCK.md`), this is the program
   * the new claim ABI would need to reference. Defaults to
   * {@link ARIO_CORE_PROGRAM_ID}.
   */
  coreProgram?: Address;
  commitment?: Commitment;
  logger?: ILogger;
}

/**
 * Solana-backed client for the trustless ANT-escrow program. All write
 * methods require both `rpcSubscriptions` and `signer`; read methods
 * only need `rpc`.
 */
export class ANTEscrow {
  protected readonly rpc: SolanaRpc;
  protected readonly rpcSubscriptions?: SolanaRpcSubscriptions;
  protected readonly signer?: TransactionSigner;
  readonly programId: Address;
  protected readonly commitment: Commitment;
  protected readonly logger: ILogger;

  constructor(config: ANTEscrowConfig) {
    this.rpc = config.rpc;
    this.rpcSubscriptions = config.rpcSubscriptions;
    this.signer = config.signer;
    this.programId = config.programId ?? ARIO_ANT_ESCROW_PROGRAM_ID;
    this.commitment = config.commitment ?? 'confirmed';
    this.logger = config.logger ?? Logger.default;
  }

  static init(config: ANTEscrowConfig): ANTEscrow {
    return new ANTEscrow(config);
  }

  // -------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------

  /** Fetch the on-chain `EscrowAnt` for an ANT mint, or `null` if no
   *  active escrow exists. Uses the Codama-generated decoder. */
  async get(antMint: Address): Promise<EscrowAntState | null> {
    const [pda] = await getEscrowAntPDA(antMint, this.programId);
    const account = await fetchMaybeEscrowAnt(this.rpc, pda, {
      commitment: this.commitment,
    });
    if (!account.exists) return null;
    return toEscrowAntState(account.data);
  }

  /** Address of the EscrowAnt PDA for an ANT mint (no RPC call). */
  async getPda(antMint: Address): Promise<Address> {
    const [pda] = await getEscrowAntPDA(antMint, this.programId);
    return pda;
  }

  // -------------------------------------------------------------------
  // Write — depositor-side
  // -------------------------------------------------------------------

  /**
   * Lock an ANT into escrow. The signer (depositor) must currently own
   * the asset; mpl-core's TransferV1 CPI enforces this.
   *
   * `recipient.publicKey` length must match `recipient.protocol`:
   * - `'arweave'` → 512-byte RSA-4096 modulus (the JWK `n` field)
   * - `'ethereum'` → 20-byte address
   */
  async deposit(args: {
    antMint: Address;
    recipient: { protocol: EscrowProtocol; publicKey: Uint8Array };
  }): Promise<string> {
    const signer = this.requireSigner('deposit');
    const ix = await this.depositIx(args, signer);
    return this.send([ix]);
  }

  async depositIx(
    args: {
      antMint: Address;
      recipient: { protocol: EscrowProtocol; publicKey: Uint8Array };
    },
    depositor: TransactionSigner,
  ): Promise<Instruction> {
    this.assertPubkeyLen(args.recipient);
    const [escrow] = await getEscrowAntPDA(args.antMint, this.programId);
    return getDepositAntInstruction(
      {
        escrow,
        antAsset: args.antMint,
        depositor,
        recipientProtocol: protocolToByte(args.recipient.protocol),
        recipientPubkey: args.recipient.publicKey,
      },
      { programAddress: this.programId },
    );
  }

  /**
   * Re-target the escrow at a new recipient identity. Rotates the
   * on-chain nonce, invalidating any in-flight claim signatures bound
   * to the prior recipient.
   */
  async updateRecipient(args: {
    antMint: Address;
    newRecipient: { protocol: EscrowProtocol; publicKey: Uint8Array };
  }): Promise<string> {
    const signer = this.requireSigner('updateRecipient');
    this.assertPubkeyLen(args.newRecipient);
    const [escrow] = await getEscrowAntPDA(args.antMint, this.programId);
    const ix = getUpdateRecipientInstruction(
      {
        escrow,
        depositor: signer,
        newProtocol: protocolToByte(args.newRecipient.protocol),
        newPubkey: args.newRecipient.publicKey,
      },
      { programAddress: this.programId },
    );
    return this.send([ix]);
  }

  /**
   * Pull an escrowed ANT back to the depositor. Closes the escrow PDA
   * and refunds rent.
   */
  async cancel(args: { antMint: Address }): Promise<string> {
    const signer = this.requireSigner('cancel');
    const [escrow] = await getEscrowAntPDA(args.antMint, this.programId);
    const ix = getCancelDepositInstruction(
      {
        escrow,
        antAsset: args.antMint,
        depositor: signer,
      },
      { programAddress: this.programId },
    );
    return this.send([ix]);
  }

  // -------------------------------------------------------------------
  // Write — claim
  // -------------------------------------------------------------------

  /**
   * Submit an Arweave RSA-PSS-4096 signature to release the ANT.
   * Anyone can submit (the fee payer = `signer`); only `claimant`
   * receives the ANT, and only the original `depositor` receives rent.
   */
  async claimArweave(args: {
    antMint: Address;
    claimant: Address;
    signature: Uint8Array; // 512 bytes
    saltLen?: number; // defaults to 32, the wallet-default
  }): Promise<string> {
    const escrow = await this.requireEscrow(args.antMint);
    if (escrow.recipientProtocol !== 'arweave') {
      throw new Error(
        `escrow recipient is ${escrow.recipientProtocol}, not arweave`,
      );
    }
    const ix = await this.claimArweaveIx({
      ...args,
      saltLen: args.saltLen ?? 32,
      depositor: escrow.depositor,
      messageNonce: escrow.nonce,
    });
    // RSA-PSS-4096 verification via sol_big_mod_exp is CU-intensive
    // (~200K+ for the full claim including Transfer CPI). Use 400K to
    // provide comfortable headroom.
    return this.send([ix], 400_000);
  }

  /**
   * Build the ANT-claim-via-Arweave-attested instruction.
   *
   * **API note**: this method previously took user-side RSA-PSS params
   * (`signature`, `saltLen`, `messageNonce`). The on-chain ix was
   * renamed to `claim_ant_arweave_attested` (canonical contracts
   * `ar-io-solana-contracts` PR-19+): verification is now via
   * instruction-introspection of a preceding Ed25519 sigverify ix
   * issued by the off-chain attestor (see
   * `migration/attestor/`). Those data args are no longer fed to the
   * builder. Callers MUST prepend the attestor's sigverify ix to the
   * transaction or it will fail on-chain. A higher-level helper that
   * fetches the attestor's signature and assembles the full tx is
   * tracked as a follow-up.
   *
   * @deprecated Args `signature`, `saltLen`, `messageNonce` are
   * ignored. Use the new attested flow.
   */
  async claimArweaveIx(args: {
    antMint: Address;
    claimant: Address;
    /** @deprecated unused — superseded by attestor sigverify ix */
    signature?: Uint8Array;
    /** @deprecated unused — superseded by attestor sigverify ix */
    saltLen?: number;
    depositor: Address;
    /** 32-byte nonce from the on-chain Escrow PDA; still part of the
     *  canonical claim payload that the attestor signs. */
    messageNonce: Uint8Array;
  }): Promise<Instruction> {
    if (args.messageNonce.length !== 32) {
      throw new Error('messageNonce must be 32 bytes');
    }
    const signer = this.requireSigner('claimArweave');
    const [escrow] = await getEscrowAntPDA(args.antMint, this.programId);
    return getClaimAntArweaveAttestedInstruction(
      {
        escrow,
        antAsset: args.antMint,
        claimant: args.claimant,
        depositor: args.depositor,
        payer: signer,
        messageNonce: args.messageNonce,
      },
      { programAddress: this.programId },
    );
  }

  /** Submit an Ethereum ECDSA secp256k1 + EIP-191 signature. */
  async claimEthereum(args: {
    antMint: Address;
    claimant: Address;
    signature: Uint8Array; // 65 bytes (r||s||v)
  }): Promise<string> {
    const escrow = await this.requireEscrow(args.antMint);
    if (escrow.recipientProtocol !== 'ethereum') {
      throw new Error(
        `escrow recipient is ${escrow.recipientProtocol}, not ethereum`,
      );
    }
    const ix = await this.claimEthereumIx({
      ...args,
      depositor: escrow.depositor,
      messageNonce: escrow.nonce,
    });
    return this.send([ix]);
  }

  async claimEthereumIx(args: {
    antMint: Address;
    claimant: Address;
    signature: Uint8Array;
    depositor: Address;
    messageNonce: Uint8Array;
  }): Promise<Instruction> {
    if (args.signature.length !== 65) {
      throw new Error('ethereum signature must be 65 bytes (r||s||v)');
    }
    if (args.messageNonce.length !== 32) {
      throw new Error('messageNonce must be 32 bytes');
    }
    const signer = this.requireSigner('claimEthereum');
    const [escrow] = await getEscrowAntPDA(args.antMint, this.programId);
    return getClaimAntEthereumInstruction(
      {
        escrow,
        antAsset: args.antMint,
        claimant: args.claimant,
        depositor: args.depositor,
        payer: signer,
        messageNonce: args.messageNonce,
        signature: args.signature,
      },
      { programAddress: this.programId },
    );
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private async send(
    instructions: Instruction[],
    computeUnitLimit = 200_000,
  ): Promise<string> {
    const signer = this.requireSigner('send');
    if (!this.rpcSubscriptions) {
      throw new Error(
        'ANTEscrow: rpcSubscriptions required for write operations',
      );
    }
    return sendAndConfirm({
      rpc: this.rpc,
      rpcSubscriptions: this.rpcSubscriptions,
      signer,
      instructions,
      commitment: this.commitment,
      computeUnitLimit,
    });
  }

  private requireSigner(op: string): TransactionSigner {
    if (!this.signer) {
      throw new Error(`ANTEscrow.${op}: signer is required for writes`);
    }
    return this.signer;
  }

  private async requireEscrow(antMint: Address): Promise<EscrowAntState> {
    const escrow = await this.get(antMint);
    if (!escrow) {
      throw new Error(`no escrow found for ANT ${antMint}`);
    }
    return escrow;
  }

  private assertPubkeyLen(recipient: {
    protocol: EscrowProtocol;
    publicKey: Uint8Array;
  }): void {
    const expected =
      recipient.protocol === 'arweave'
        ? ESCROW_ARWEAVE_PUBKEY_LEN
        : ESCROW_ETHEREUM_PUBKEY_LEN;
    if (recipient.publicKey.length !== expected) {
      throw new Error(
        `recipient.publicKey: expected ${expected} bytes for protocol=${recipient.protocol}, got ${recipient.publicKey.length}`,
      );
    }
  }
}

// =========================================================================
// Token / Vault Escrow
// =========================================================================

// =========================================
// Public types
// =========================================

export type EscrowAssetType = 'token' | 'vault';

export interface EscrowTokenState {
  /** On-chain schema version, as decoded by the generated client. */
  version: EscrowToken['version'];
  bump: number;
  depositor: Address;
  assetType: EscrowAssetType;
  amount: bigint;
  arioMint: Address;
  assetId: Uint8Array;
  recipientProtocol: EscrowProtocol;
  recipientPubkey: Uint8Array; // active prefix only — 512 (arweave) or 20 (eth)
  nonce: Uint8Array; // 32 bytes
  depositSlot: bigint;
  vaultEndTimestamp: bigint;
  vaultRevocable: boolean;
}

/**
 * Forward clock-skew buffer (seconds) added to `vault_end_timestamp` before
 * the SDK considers a vault claimable. The SDK reads wall-clock time
 * (`Date.now()`) while the on-chain gate reads Solana cluster time, and
 * the two can disagree by several seconds. The buffer biases every skew
 * race into the *friendly* direction: the SDK rejects when the chain
 * would actually accept (user retries 30s later, succeeds), never the
 * reverse (user submits a doomed tx and sees the raw on-chain error).
 *
 * 30s is conservative — Solana cluster clock typically drifts <2s vs
 * wall clock — but matches the order of magnitude of the previously-used
 * `60s` introspection tolerance in the removed `vault_introspect` module.
 */
export const CLOCK_SKEW_TOLERANCE_SECONDS = 30n;

/**
 * Returns `true` when a vault escrow is past its unlock timestamp by at
 * least {@link CLOCK_SKEW_TOLERANCE_SECONDS}. Non-throwing companion to
 * {@link assertVaultClaimable} for UI gating (e.g. enabling/disabling a
 * Submit button without showing an error).
 */
export function isVaultClaimable(escrow: EscrowTokenState): boolean {
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  return nowSeconds >= escrow.vaultEndTimestamp + CLOCK_SKEW_TOLERANCE_SECONDS;
}

/**
 * Pre-flight the on-chain `VaultStillLocked` gate (ADR-022): refuse to build
 * a claim tx while the vault is still locked, with a small forward
 * {@link CLOCK_SKEW_TOLERANCE_SECONDS} buffer so wall/cluster clock skew
 * biases into the friendly direction. Surfaces the unlock timestamp so
 * callers / UIs can show "claimable after <date>" instead of a doomed tx.
 *
 * Exported for unit-testability; not part of the public SDK surface — call the
 * high-level `claimVaultArweave` / `claimVaultEthereum` instead, which invoke
 * this guard internally.
 *
 * @internal
 */
export function assertVaultClaimable(escrow: EscrowTokenState): void {
  if (!isVaultClaimable(escrow)) {
    const unlockIso = new Date(
      Number(escrow.vaultEndTimestamp) * 1000,
    ).toISOString();
    throw new Error(
      `Vault escrow is still locked until ${unlockIso} ` +
        `(vault_end_timestamp=${escrow.vaultEndTimestamp}; ` +
        `the SDK adds a ${CLOCK_SKEW_TOLERANCE_SECONDS}s clock-skew buffer ` +
        `before allowing a claim). Active (still-locked) vault claims are ` +
        `rejected on-chain with VaultStillLocked (ADR-022) — wait until ` +
        `after the unlock timestamp + buffer, then claim again to receive ` +
        `the tokens liquid.`,
    );
  }
}

/** Map the Codama-generated `EscrowToken` raw decoded type to our public
 *  `EscrowTokenState` with protocol enum + active-prefix pubkey slice. */
function toEscrowTokenState(raw: EscrowToken): EscrowTokenState {
  const recipientProtocol: EscrowProtocol =
    raw.recipientProtocol === ESCROW_PROTOCOL_ARWEAVE ? 'arweave' : 'ethereum';
  if (
    raw.recipientProtocol !== ESCROW_PROTOCOL_ARWEAVE &&
    raw.recipientProtocol !== ESCROW_PROTOCOL_ETHEREUM
  ) {
    throw new Error(
      `EscrowToken: unknown protocol byte ${raw.recipientProtocol}`,
    );
  }
  const expectedLen =
    recipientProtocol === 'arweave'
      ? ESCROW_ARWEAVE_PUBKEY_LEN
      : ESCROW_ETHEREUM_PUBKEY_LEN;
  return {
    version: raw.version,
    bump: raw.bump,
    depositor: raw.depositor,
    assetType: raw.assetType === ESCROW_ASSET_TYPE_VAULT ? 'vault' : 'token',
    amount: raw.amount,
    arioMint: raw.arioMint,
    assetId: new Uint8Array(raw.assetId as Uint8Array),
    recipientProtocol,
    recipientPubkey: new Uint8Array(
      (raw.recipientPubkey as Uint8Array).subarray(0, expectedLen),
    ),
    nonce: new Uint8Array(raw.nonce),
    depositSlot: raw.depositSlot,
    vaultEndTimestamp: raw.vaultEndTimestamp,
    vaultRevocable: raw.vaultRevocable,
  };
}

// =========================================
// ATA helper
// =========================================

/** Associated Token Account program address. */
const ATA_PROGRAM_ADDRESS: Address =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;

/**
 * Build a `CreateAssociatedTokenAccountIdempotent` instruction.
 * Uses instruction index 1 (idempotent variant) of the ATA program.
 */
function buildCreateAtaIdempotentIx(
  payer: Address,
  ata: Address,
  owner: Address,
  mint: Address,
): Instruction {
  const SYSTEM_PROGRAM: Address = '11111111111111111111111111111111' as Address;
  const TOKEN_PROGRAM: Address =
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
  return {
    programAddress: ATA_PROGRAM_ADDRESS,
    accounts: [
      { address: payer, role: 3 as const }, // writable signer
      { address: ata, role: 1 as const }, // writable
      { address: owner, role: 0 as const }, // readonly
      { address: mint, role: 0 as const }, // readonly
      { address: SYSTEM_PROGRAM, role: 0 as const }, // readonly
      { address: TOKEN_PROGRAM, role: 0 as const }, // readonly
    ],
    data: new Uint8Array([1]), // CreateIdempotent = instruction discriminator 1
  };
}

// =========================================
// TokenEscrow client
// =========================================

/**
 * Solana-backed client for the trustless token/vault escrow program. All
 * write methods require both `rpcSubscriptions` and `signer`; read methods
 * only need `rpc`.
 *
 * Uses the same config shape as {@link ANTEscrow}.
 */
export class TokenEscrow {
  protected readonly rpc: SolanaRpc;
  protected readonly rpcSubscriptions?: SolanaRpcSubscriptions;
  protected readonly signer?: TransactionSigner;
  readonly programId: Address;
  readonly coreProgram: Address;
  protected readonly commitment: Commitment;
  protected readonly logger: ILogger;

  constructor(config: ANTEscrowConfig) {
    this.rpc = config.rpc;
    this.rpcSubscriptions = config.rpcSubscriptions;
    this.signer = config.signer;
    this.programId = config.programId ?? ARIO_ANT_ESCROW_PROGRAM_ID;
    this.coreProgram = config.coreProgram ?? ARIO_CORE_PROGRAM_ID;
    this.commitment = config.commitment ?? 'confirmed';
    this.logger = config.logger ?? Logger.default;
  }

  static init(config: ANTEscrowConfig): TokenEscrow {
    return new TokenEscrow(config);
  }

  // -------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------

  /**
   * Fetch the on-chain `EscrowToken` for a depositor and asset ID, or
   * `null` if no active escrow exists. Uses the Codama-generated decoder.
   */
  async get(
    depositor: Address,
    assetId: Uint8Array,
  ): Promise<EscrowTokenState | null> {
    const [pda] = await getEscrowTokenPDA(depositor, assetId, this.programId);
    const account = await fetchMaybeEscrowToken(this.rpc, pda, {
      commitment: this.commitment,
    });
    if (!account.exists) return null;
    return toEscrowTokenState(account.data);
  }

  /**
   * Fetch the on-chain `EscrowToken` for a vault escrow, or `null` if
   * no active escrow exists.
   */
  async getVault(
    depositor: Address,
    assetId: Uint8Array,
  ): Promise<EscrowTokenState | null> {
    const [pda] = await getEscrowVaultPDA(depositor, assetId, this.programId);
    const account = await fetchMaybeEscrowToken(this.rpc, pda, {
      commitment: this.commitment,
    });
    if (!account.exists) return null;
    return toEscrowTokenState(account.data);
  }

  /** Address of the EscrowToken PDA (no RPC call). */
  async getTokenPda(depositor: Address, assetId: Uint8Array): Promise<Address> {
    const [pda] = await getEscrowTokenPDA(depositor, assetId, this.programId);
    return pda;
  }

  /** Address of the EscrowVault PDA (no RPC call). */
  async getVaultPda(depositor: Address, assetId: Uint8Array): Promise<Address> {
    const [pda] = await getEscrowVaultPDA(depositor, assetId, this.programId);
    return pda;
  }

  // -------------------------------------------------------------------
  // Write — deposit
  // -------------------------------------------------------------------

  /**
   * Deposit liquid ARIO tokens into escrow for a designated Arweave or
   * Ethereum recipient. Prepends a create-ATA-idempotent instruction for
   * the escrow PDA's token account in the same transaction.
   */
  async depositTokens(args: {
    assetId: Uint8Array;
    amount: bigint;
    arioMint: Address;
    depositorTokenAccount: Address;
    recipient: { protocol: EscrowProtocol; publicKey: Uint8Array };
  }): Promise<string> {
    const signer = this.requireSigner('depositTokens');
    this.assertPubkeyLen(args.recipient);
    this.assertAssetIdLen(args.assetId);

    const [escrow] = await getEscrowTokenPDA(
      signer.address,
      args.assetId,
      this.programId,
    );

    // Derive the escrow PDA's ATA for the ARIO mint.
    const escrowAta = await getAssociatedTokenAddressKit(
      args.arioMint,
      escrow,
      true, // off-curve — PDA owner
    );

    // Prepend create-ATA-idempotent so the escrow token account exists.
    const createAtaIx = buildCreateAtaIdempotentIx(
      signer.address,
      escrowAta,
      escrow,
      args.arioMint,
    );

    const depositIx = getDepositTokensInstruction(
      {
        escrow,
        depositorTokenAccount: args.depositorTokenAccount,
        escrowTokenAccount: escrowAta,
        arioMint: args.arioMint,
        depositor: signer,
        assetId: args.assetId,
        amount: args.amount,
        recipientProtocol: protocolToByte(args.recipient.protocol),
        recipientPubkey: args.recipient.publicKey,
      },
      { programAddress: this.programId },
    );

    return this.send([createAtaIx, depositIx]);
  }

  /**
   * Deposit ARIO tokens into escrow as a vaulted (time-locked) position.
   * Same as `depositTokens` but additionally records the lock duration
   * and revocability flag. Uses the vault PDA seed.
   */
  async depositVault(args: {
    assetId: Uint8Array;
    amount: bigint;
    arioMint: Address;
    lockDurationSeconds: bigint;
    revocable: boolean;
    depositorTokenAccount: Address;
    recipient: { protocol: EscrowProtocol; publicKey: Uint8Array };
  }): Promise<string> {
    const signer = this.requireSigner('depositVault');
    this.assertPubkeyLen(args.recipient);
    this.assertAssetIdLen(args.assetId);

    const [escrow] = await getEscrowVaultPDA(
      signer.address,
      args.assetId,
      this.programId,
    );

    const escrowAta = await getAssociatedTokenAddressKit(
      args.arioMint,
      escrow,
      true,
    );

    const createAtaIx = buildCreateAtaIdempotentIx(
      signer.address,
      escrowAta,
      escrow,
      args.arioMint,
    );

    const depositIx = getDepositVaultInstruction(
      {
        escrow,
        depositorTokenAccount: args.depositorTokenAccount,
        escrowTokenAccount: escrowAta,
        arioMint: args.arioMint,
        depositor: signer,
        assetId: args.assetId,
        amount: args.amount,
        lockDurationSeconds: args.lockDurationSeconds,
        revocable: args.revocable,
        recipientProtocol: protocolToByte(args.recipient.protocol),
        recipientPubkey: args.recipient.publicKey,
      },
      { programAddress: this.programId },
    );

    return this.send([createAtaIx, depositIx]);
  }

  // -------------------------------------------------------------------
  // Write — claim
  // -------------------------------------------------------------------

  /**
   * Submit an Arweave RSA-PSS-4096 signature to release escrowed tokens.
   * Anyone can submit (fee payer = `signer`); only `claimant` receives
   * the tokens, and `depositor` receives rent.
   */
  async claimTokensArweave(args: {
    depositor: Address;
    assetId: Uint8Array;
    claimant: Address;
    claimantTokenAccount: Address;
    escrowTokenAccount: Address;
    signature: Uint8Array; // 512 bytes
    saltLen?: number;
  }): Promise<string> {
    const escrow = await this.requireTokenEscrow(args.depositor, args.assetId);
    if (escrow.recipientProtocol !== 'arweave') {
      throw new Error(
        `escrow recipient is ${escrow.recipientProtocol}, not arweave`,
      );
    }
    const ix = await this.claimTokensArweaveIx({
      ...args,
      saltLen: args.saltLen ?? 32,
      messageNonce: escrow.nonce,
    });
    // The on-chain claim handler delivers liquid tokens to
    // `claimantTokenAccount`; for fresh-wallet claimants the canonical ATA
    // doesn't exist yet (#3012). Idempotent-create when canonical.
    const createAtaIx = await this._createClaimantAtaIfCanonical(
      args.claimant,
      args.claimantTokenAccount,
      escrow.arioMint,
    );
    // RSA-PSS-4096 verification is CU-intensive; use 400K.
    return this.send(createAtaIx ? [createAtaIx, ix] : [ix], 400_000);
  }

  /**
   * @deprecated Args `signature`, `saltLen`, `messageNonce` are ignored.
   * Use the new attested flow — see `claimArweaveIx` doc.
   */
  async claimTokensArweaveIx(args: {
    depositor: Address;
    assetId: Uint8Array;
    claimant: Address;
    claimantTokenAccount: Address;
    escrowTokenAccount: Address;
    /** @deprecated unused — superseded by attestor sigverify ix */
    signature?: Uint8Array;
    /** @deprecated unused — superseded by attestor sigverify ix */
    saltLen?: number;
    /** 32-byte nonce from the on-chain Escrow PDA. */
    messageNonce: Uint8Array;
  }): Promise<Instruction> {
    if (args.messageNonce.length !== 32) {
      throw new Error('messageNonce must be 32 bytes');
    }
    const signer = this.requireSigner('claimTokensArweave');
    const [escrow] = await getEscrowTokenPDA(
      args.depositor,
      args.assetId,
      this.programId,
    );
    return getClaimTokensArweaveAttestedInstruction(
      {
        escrow,
        escrowTokenAccount: args.escrowTokenAccount,
        claimantTokenAccount: args.claimantTokenAccount,
        claimant: args.claimant,
        depositor: args.depositor,
        payer: signer,
        messageNonce: args.messageNonce,
      },
      { programAddress: this.programId },
    );
  }

  /**
   * Submit an Ethereum ECDSA secp256k1 + EIP-191 signature to release
   * escrowed tokens.
   */
  async claimTokensEthereum(args: {
    depositor: Address;
    assetId: Uint8Array;
    claimant: Address;
    claimantTokenAccount: Address;
    escrowTokenAccount: Address;
    signature: Uint8Array; // 65 bytes (r||s||v)
  }): Promise<string> {
    const escrow = await this.requireTokenEscrow(args.depositor, args.assetId);
    if (escrow.recipientProtocol !== 'ethereum') {
      throw new Error(
        `escrow recipient is ${escrow.recipientProtocol}, not ethereum`,
      );
    }
    const ix = await this.claimTokensEthereumIx({
      ...args,
      messageNonce: escrow.nonce,
    });
    // Same fresh-wallet #3012 vector as claimTokensArweave — bundle a
    // canonical-ATA idempotent-create when applicable.
    const createAtaIx = await this._createClaimantAtaIfCanonical(
      args.claimant,
      args.claimantTokenAccount,
      escrow.arioMint,
    );
    return this.send(createAtaIx ? [createAtaIx, ix] : [ix]);
  }

  async claimTokensEthereumIx(args: {
    depositor: Address;
    assetId: Uint8Array;
    claimant: Address;
    claimantTokenAccount: Address;
    escrowTokenAccount: Address;
    signature: Uint8Array;
    messageNonce: Uint8Array;
  }): Promise<Instruction> {
    if (args.signature.length !== 65) {
      throw new Error('ethereum signature must be 65 bytes (r||s||v)');
    }
    if (args.messageNonce.length !== 32) {
      throw new Error('messageNonce must be 32 bytes');
    }
    const signer = this.requireSigner('claimTokensEthereum');
    const [escrow] = await getEscrowTokenPDA(
      args.depositor,
      args.assetId,
      this.programId,
    );
    return getClaimTokensEthereumInstruction(
      {
        escrow,
        escrowTokenAccount: args.escrowTokenAccount,
        claimantTokenAccount: args.claimantTokenAccount,
        claimant: args.claimant,
        depositor: args.depositor,
        payer: signer,
        messageNonce: args.messageNonce,
        signature: args.signature,
      },
      { programAddress: this.programId },
    );
  }

  /**
   * Submit an Arweave attestor's Ed25519 signature to release escrowed vault
   * tokens. The on-chain handler delivers liquid tokens directly to
   * `claimantTokenAccount`.
   *
   * **Vaults are only claimable after `vault_end_timestamp`.** Active
   * (still-locked) vault claims are rejected on-chain with `VaultStillLocked`
   * (ADR-022 / BD-107: the former active re-lock path was removed because its
   * sibling-`vaulted_transfer` introspection had no 1:1 claim↔re-lock binding
   * → reuse / relayer skim). This method pre-flights the same gate and throws
   * a clear `vault still locked until <ISO>` error rather than building a tx
   * that will fail on-chain. To revive "claim early, stay locked" see the
   * restoration playbook in the contracts repo
   * (`docs/RESTORE_ACTIVE_VAULT_RELOCK.md`).
   */
  async claimVaultArweave(args: {
    depositor: Address;
    assetId: Uint8Array;
    claimant: Address;
    claimantTokenAccount: Address;
    escrowTokenAccount: Address;
    signature: Uint8Array; // 512 bytes
    saltLen?: number;
  }): Promise<string> {
    const escrow = await this.requireVaultEscrow(args.depositor, args.assetId);
    if (escrow.recipientProtocol !== 'arweave') {
      throw new Error(
        `escrow recipient is ${escrow.recipientProtocol}, not arweave`,
      );
    }
    // ADR-022 / VaultStillLocked: pre-flight the on-chain lock gate.
    assertVaultClaimable(escrow);
    const signer = this.requireSigner('claimVaultArweave');
    const [escrowPda] = await getEscrowVaultPDA(
      args.depositor,
      args.assetId,
      this.programId,
    );
    // `args.signature` and `args.saltLen` are no longer fed to the
    // builder — the on-chain `claim_vault_arweave_attested` ix verifies
    // the attestor's Ed25519 signature via instruction-introspection
    // of a preceding sigverify ix. See doc on `claimArweaveIx`.
    const claimIx = getClaimVaultArweaveAttestedInstruction(
      {
        escrow: escrowPda,
        escrowTokenAccount: args.escrowTokenAccount,
        claimantTokenAccount: args.claimantTokenAccount,
        claimant: args.claimant,
        depositor: args.depositor,
        payer: signer,
        messageNonce: escrow.nonce,
      },
      { programAddress: this.programId },
    );
    const createClaimantAtaIx = await this._createClaimantAtaIfCanonical(
      args.claimant,
      args.claimantTokenAccount,
      escrow.arioMint,
    );
    const ixs = createClaimantAtaIx
      ? [createClaimantAtaIx, claimIx]
      : [claimIx];
    return this.send(ixs, 400_000);
  }

  /**
   * Submit an Ethereum ECDSA signature to release escrowed vault tokens. See
   * {@link claimVaultArweave} — same lock semantics: vaults are only claimable
   * after `vault_end_timestamp`; active (still-locked) claims throw pre-flight
   * and are rejected on-chain with `VaultStillLocked` (ADR-022 / BD-107).
   */
  async claimVaultEthereum(args: {
    depositor: Address;
    assetId: Uint8Array;
    claimant: Address;
    claimantTokenAccount: Address;
    escrowTokenAccount: Address;
    signature: Uint8Array; // 65 bytes (r||s||v)
  }): Promise<string> {
    const escrow = await this.requireVaultEscrow(args.depositor, args.assetId);
    if (escrow.recipientProtocol !== 'ethereum') {
      throw new Error(
        `escrow recipient is ${escrow.recipientProtocol}, not ethereum`,
      );
    }
    assertVaultClaimable(escrow);
    const signer = this.requireSigner('claimVaultEthereum');
    const [escrowPda] = await getEscrowVaultPDA(
      args.depositor,
      args.assetId,
      this.programId,
    );
    const claimIx = getClaimVaultEthereumInstruction(
      {
        escrow: escrowPda,
        escrowTokenAccount: args.escrowTokenAccount,
        claimantTokenAccount: args.claimantTokenAccount,
        claimant: args.claimant,
        depositor: args.depositor,
        payer: signer,
        messageNonce: escrow.nonce,
        signature: args.signature,
      },
      { programAddress: this.programId },
    );
    const createClaimantAtaIx = await this._createClaimantAtaIfCanonical(
      args.claimant,
      args.claimantTokenAccount,
      escrow.arioMint,
    );
    const ixs = createClaimantAtaIx
      ? [createClaimantAtaIx, claimIx]
      : [claimIx];
    return this.send(ixs);
  }

  /**
  /**
   * Idempotent-create the claimant's canonical ATA when needed.
   *
   * The claim handler delivers liquid tokens directly to
   * `claimantTokenAccount` (post-ADR-022 there's only the liquid path for
   * vaults). If the claimant is a fresh wallet that has never held this
   * mint, the ATA doesn't exist and the tx fails with `AccountNotInitialized`
   * (#3012).
   *
   * Returns `null` when the caller passed a non-canonical
   * `claimantTokenAccount` (manually-created non-ATA token account,
   * presumably already exists — caller's responsibility).
   */
  private async _createClaimantAtaIfCanonical(
    claimant: Address,
    claimantTokenAccount: Address,
    mint: Address,
  ): Promise<Instruction | null> {
    const canonical = await getAssociatedTokenAddressKit(mint, claimant);
    if (claimantTokenAccount !== canonical) return null;
    const signer = this.requireSigner('createClaimantAtaIfCanonical');
    return buildCreateAtaIdempotentIx(
      signer.address,
      canonical,
      claimant,
      mint,
    );
  }

  // -------------------------------------------------------------------
  // Write — cancel
  // -------------------------------------------------------------------

  /**
   * Cancel a token or vault escrow deposit and return the tokens to the
   * depositor. Only callable by the original depositor.
   */
  async cancel(args: {
    assetId: Uint8Array;
    assetType: EscrowAssetType;
    depositorTokenAccount: Address;
    escrowTokenAccount: Address;
  }): Promise<string> {
    const signer = this.requireSigner('cancel');
    this.assertAssetIdLen(args.assetId);

    const pdaFn =
      args.assetType === 'vault' ? getEscrowVaultPDA : getEscrowTokenPDA;
    const [escrow] = await pdaFn(signer.address, args.assetId, this.programId);

    const ix =
      args.assetType === 'vault'
        ? getCancelVaultDepositInstruction(
            {
              escrow,
              escrowTokenAccount: args.escrowTokenAccount,
              depositorTokenAccount: args.depositorTokenAccount,
              depositor: signer,
            },
            { programAddress: this.programId },
          )
        : getCancelTokenDepositInstruction(
            {
              escrow,
              escrowTokenAccount: args.escrowTokenAccount,
              depositorTokenAccount: args.depositorTokenAccount,
              depositor: signer,
            },
            { programAddress: this.programId },
          );

    return this.send([ix]);
  }

  // -------------------------------------------------------------------
  // Write — update recipient
  // -------------------------------------------------------------------

  /**
   * Re-target the escrow at a new recipient identity. Rotates the
   * on-chain nonce, invalidating any in-flight claim signatures.
   */
  async updateRecipient(args: {
    assetId: Uint8Array;
    assetType: EscrowAssetType;
    newRecipient: { protocol: EscrowProtocol; publicKey: Uint8Array };
  }): Promise<string> {
    const signer = this.requireSigner('updateRecipient');
    this.assertPubkeyLen(args.newRecipient);
    this.assertAssetIdLen(args.assetId);

    const pdaFn =
      args.assetType === 'vault' ? getEscrowVaultPDA : getEscrowTokenPDA;
    const [escrow] = await pdaFn(signer.address, args.assetId, this.programId);

    const ix =
      args.assetType === 'vault'
        ? getUpdateVaultRecipientInstruction(
            {
              escrow,
              depositor: signer,
              newProtocol: protocolToByte(args.newRecipient.protocol),
              newPubkey: args.newRecipient.publicKey,
            },
            { programAddress: this.programId },
          )
        : getUpdateTokenRecipientInstruction(
            {
              escrow,
              depositor: signer,
              newProtocol: protocolToByte(args.newRecipient.protocol),
              newPubkey: args.newRecipient.publicKey,
            },
            { programAddress: this.programId },
          );

    return this.send([ix]);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private async send(
    instructions: Instruction[],
    computeUnitLimit = 200_000,
  ): Promise<string> {
    const signer = this.requireSigner('send');
    if (!this.rpcSubscriptions) {
      throw new Error(
        'TokenEscrow: rpcSubscriptions required for write operations',
      );
    }
    return sendAndConfirm({
      rpc: this.rpc,
      rpcSubscriptions: this.rpcSubscriptions,
      signer,
      instructions,
      commitment: this.commitment,
      computeUnitLimit,
    });
  }

  private requireSigner(op: string): TransactionSigner {
    if (!this.signer) {
      throw new Error(`TokenEscrow.${op}: signer is required for writes`);
    }
    return this.signer;
  }

  private async requireTokenEscrow(
    depositor: Address,
    assetId: Uint8Array,
  ): Promise<EscrowTokenState> {
    const escrow = await this.get(depositor, assetId);
    if (!escrow) {
      throw new Error(`no token escrow found for depositor=${depositor}`);
    }
    return escrow;
  }

  private async requireVaultEscrow(
    depositor: Address,
    assetId: Uint8Array,
  ): Promise<EscrowTokenState> {
    const escrow = await this.getVault(depositor, assetId);
    if (!escrow) {
      throw new Error(`no vault escrow found for depositor=${depositor}`);
    }
    return escrow;
  }

  private assertPubkeyLen(recipient: {
    protocol: EscrowProtocol;
    publicKey: Uint8Array;
  }): void {
    const expected =
      recipient.protocol === 'arweave'
        ? ESCROW_ARWEAVE_PUBKEY_LEN
        : ESCROW_ETHEREUM_PUBKEY_LEN;
    if (recipient.publicKey.length !== expected) {
      throw new Error(
        `recipient.publicKey: expected ${expected} bytes for protocol=${recipient.protocol}, got ${recipient.publicKey.length}`,
      );
    }
  }

  private assertAssetIdLen(assetId: Uint8Array): void {
    if (assetId.length !== 32) {
      throw new Error(`assetId must be 32 bytes, got ${assetId.length}`);
    }
  }
}
