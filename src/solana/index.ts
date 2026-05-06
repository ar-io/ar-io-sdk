/**
 * Solana backend for the AR.IO SDK.
 *
 * This module provides Solana-native implementations of the AR.IO read/write
 * interfaces, allowing consumers to interact with AR.IO protocol state
 * stored on Solana instead of AO. All primitives come from `@solana/kit` —
 * `@solana/web3.js` is not used.
 *
 * Usage:
 * ```ts
 * import {
 *   createSolanaRpc,
 *   createSolanaRpcSubscriptions,
 *   generateKeyPairSigner,
 * } from '@solana/kit';
 * import {
 *   SolanaARIOReadable,
 *   SolanaARIOWriteable,
 *   SolanaANTReadable,
 * } from '@ar.io/sdk/solana';
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 *
 * // Read-only (RPC only)
 * const ario = new SolanaARIOReadable({ rpc });
 *
 * // Read-write (signer + subscriptions client needed for confirmation)
 * const rpcSubscriptions = createSolanaRpcSubscriptions(
 *   'wss://api.mainnet-beta.solana.com',
 * );
 * const signer = await generateKeyPairSigner();
 * const arioWrite = new SolanaARIOWriteable({ rpc, rpcSubscriptions, signer });
 *
 * // ANT (Arweave Name Token)
 * const ant = new SolanaANTReadable({
 *   rpc,
 *   processId: 'MetaplexCoreAssetAddress...',
 * });
 * ```
 */

// ARIO protocol classes
export { SolanaARIOReadable } from './io-readable.js';
export { SolanaARIOWriteable } from './io-writeable.js';

// ANT classes
export { SolanaANTReadable } from './ant-readable.js';
export { SolanaANTWriteable } from './ant-writeable.js';

// ANT Registry (on-chain paginated ACL — ADR-012). Read-only fetch of
// `AclConfig` + `AclPage`s for `accessControlList`; the writeable variant
// also owns the per-instruction builders, the preflight resolvers used
// by the contract-required ACL accounts on `add_controller` /
// `remove_controller` / `transfer`, and the spawn / ex-controller
// workflow helpers (`bootstrapOwnerOnSpawn`,
// `bulkRemoveControllerEntries`).
export { SolanaANTRegistryReadable } from './ant-registry-readable.js';
export type { SolanaANTRegistryConfig } from './ant-registry-readable.js';
export { SolanaANTRegistryWriteable } from './ant-registry-writeable.js';
export type { SolanaANTRegistryWriteableConfig } from './ant-registry-writeable.js';
export type {
  AclMaintenanceOp,
  AclMaintenanceRole,
} from '../types/ant-registry.js';

// ANT-escrow client (trustless multi-protocol custody — Arweave RSA-PSS / Ethereum ECDSA)
export { ANTEscrow, TokenEscrow } from './escrow.js';
export type {
  ANTEscrowConfig,
  EscrowAntState,
  EscrowAssetType,
  EscrowProtocol,
  EscrowTokenState,
} from './escrow.js';

// Canonical claim-message helper (byte-equivalent to Rust impl)
export {
  canonicalMessage,
  canonicalMessageV2,
  bytesToHexLower,
} from './canonical-message.js';
export type {
  CanonicalMessageInput,
  CanonicalMessageV2Input,
  EscrowNetwork,
} from './canonical-message.js';

// ANT spawn (mint MPL Core asset + initialize ario-ant state in one tx)
export {
  spawnSolanaANT,
  ARIO_LOGO_TX_ID,
  DEFAULT_ANT_TRANSACTION_ID,
} from './spawn-ant.js';
export type {
  SpawnSolanaANTParams,
  SpawnSolanaANTResult,
  SpawnSolanaANTState,
} from './spawn-ant.js';

// PDA derivation
export {
  hashName,
  getArioConfigPDA,
  getBalancePDA,
  getVaultPDA,
  getVaultCounterPDA,
  getPrimaryNamePDA,
  getPrimaryNameRequestPDA,
  getGatewayRegistryPDA,
  getGarSettingsPDA,
  getGatewayPDA,
  getDelegationPDA,
  getWithdrawalPDA,
  getWithdrawalCounterPDA,
  getAllowlistPDA,
  getEpochPDA,
  getEpochSettingsPDA,
  getObservationPDA,
  getArnsRegistryPDA,
  getArnsSettingsPDA,
  getArnsRecordPDA,
  getArnsRecordPDAFromHash,
  getReservedNamePDA,
  getReturnedNamePDA,
  getDemandFactorPDA,
  getPrimaryNameReversePDA,
  getRedelegationRecordPDA,
  getAntConfigPDA,
  getAntControllersPDA,
  getAntRecordPDA,
  getAclConfigPDA,
  getAclPagePDA,
  getEscrowAntPDA,
  getEscrowTokenPDA,
  getEscrowVaultPDA,
} from './pda.js';

// Deserialization
//
// NOTE: account discriminators come from the Codama-generated modules
// under `./generated/<program>/accounts/*` (e.g. `BALANCE_DISCRIMINATOR`,
// `ANT_RECORD_DISCRIMINATOR`). Pull them from there instead of asking
// this module — single source of truth, derived from the IDL.
export {
  BorshReader,
  BorshWriter,
  deserializeGateway,
  deserializeArnsRecord,
  deserializeVault,
  deserializeDelegation,
  deserializeBalance,
  deserializeEpochSettings,
  deserializeArioConfig,
  deserializeDemandFactor,
  deserializeReservedName,
  deserializeReturnedName,
  deserializeWithdrawal,
  deserializeRedelegationRecord,
  deserializePrimaryNameRequest,
  deserializePrimaryName,
  deserializeAllowlist,
  deserializeGarSettings,
  deserializeEpochSettingsFull,
  deserializeEpoch,
  deserializeObservation,
  deserializeAntConfig,
  deserializeAntControllers,
  deserializeAntRecord,
  deserializeAclConfig,
  deserializeAclPage,
} from './deserialize.js';
export type { DeserializedAclEntry } from './deserialize.js';

// Constants
export * from './constants.js';

// Cluster-specific deployment constants (devnet program IDs, RPC URL,
// mint, treasury / stake token accounts). Source of truth is
// `/devnet-config.json` — kept in sync via the drift guard test
// `clusters.test.ts`.
export * from './clusters.js';

// Types
export type {
  SolanaConfig,
  SolanaReadConfig,
  SolanaWriteConfig,
  SolanaRpc,
  SolanaRpcSubscriptions,
  SolanaSigner,
  SolanaTransactionResult,
  AccountData,
} from './types.js';

// Event decoders
//
// `parseTransactionEvents(rpc, signature)` and `parseEventsFromLogs(logs)`
// give consumers strongly-typed access to every Anchor `#[event]` emit
// the AR.IO programs produce. Each event variant in `AnyEvent` is
// tagged by `name` for narrowing; per-program union types
// (`AnyArio*Event`) are available for filtering.
export {
  parseTransactionEvents,
  parseEventsFromLogs,
  isEvent,
} from './events.js';
export type {
  AnyEvent,
  AnyArioCoreEvent,
  AnyArioGarEvent,
  AnyArioArnsEvent,
  AnyArioAntEvent,
  AnyArioAntEscrowEvent,
  EventName,
} from './events.js';
