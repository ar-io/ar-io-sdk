/**
 * Solana-specific types for the AR.IO SDK.
 *
 * These extend the common SDK types with Solana connection and signer config.
 */
import {
  type Address,
  type Commitment,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcApiMainnet,
  type SolanaRpcSubscriptionsApi,
  type TransactionSigner,
} from '@solana/kit';

// =========================================
// RPC & Signer
// =========================================

/**
 * The Solana RPC client produced by `createSolanaRpc(url)`.
 *
 * We accept both the mainnet-safe API (no `requestAirdrop`) and the test-cluster
 * API (with `requestAirdrop`). kit's `createSolanaRpc` narrows the return type
 * based on the URL string; this union lets callers pass either shape.
 */
export type SolanaRpc = Rpc<SolanaRpcApi> | Rpc<SolanaRpcApiMainnet>;

/**
 * The subscriptions client produced by `createSolanaRpcSubscriptions(wsUrl)`.
 * Required alongside `SolanaRpc` to confirm transactions (via
 * `sendAndConfirmTransactionFactory`).
 */
export type SolanaRpcSubscriptions =
  RpcSubscriptions<SolanaRpcSubscriptionsApi>;

/**
 * A transaction signer in the kit model. Covers keypair-based signers
 * (`KeyPairSigner`) and any wallet-adapter-compatible signer that implements
 * the {@link TransactionSigner} interface (partial, modifying, or sending).
 */
export type SolanaSigner = TransactionSigner;

/** Configuration for Solana SDK instances */
export type SolanaConfig = {
  rpc: SolanaRpc;
  /**
   * Subscriptions client. Required for writeable instances (confirmation).
   * Optional for readable instances.
   */
  rpcSubscriptions?: SolanaRpcSubscriptions;
  commitment?: Commitment;
};

export type SolanaReadConfig = SolanaConfig;

export type SolanaWriteConfig = SolanaConfig & {
  rpcSubscriptions: SolanaRpcSubscriptions;
  signer: SolanaSigner;
};

// =========================================
// Transaction result
// =========================================

/** Result of a Solana write operation */
export type SolanaTransactionResult<T = undefined> = {
  /** Transaction signature (base58) */
  id: string;
  result?: T;
};

// =========================================
// Account deserialization helpers
// =========================================

/** Raw account data with metadata */
export type AccountData<T> = {
  address: Address;
  data: T;
};

/** Discriminator for Anchor accounts: sha256("account:StructName")[0..8] */
export type AccountDiscriminator = Uint8Array;

// =========================================
// Solana-specific override types
// =========================================

/**
 * On Solana, "processId" (AO concept) maps to the ANT's Metaplex Core
 * asset address. We keep the field name for SDK compatibility.
 */
export type SolanaArNSNameData = {
  processId: string; // Metaplex Core asset address (ANT)
  owner: string; // ArNS record owner
  startTimestamp: number;
  type: 'lease' | 'permabuy';
  endTimestamp?: number;
  undernameLimit: number;
  purchasePrice: number;
};
