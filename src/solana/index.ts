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

// Public factory classes — `ARIO.init({ rpc })` / `ANT.init({ ... })` /
// `ANTRegistry.init({ ... })` are the primary entry points for consumers.
// `createFaucet` wraps an ARIO instance with the HTTP faucet client.
export * from '../common/index.js';

// Public types (interfaces, params, pagination, etc.) shared by the SDK
// surface and the Solana implementation.
export * from '../types/index.js';

// Public utility helpers (base64, json, schema validators, ANT helpers).
export * from '../utils/index.js';

// Top-level protocol constants. Explicit named exports to avoid colliding
// with `./spawn-ant.js`'s `ARIO_LOGO_TX_ID` (different value used by the
// Solana metadata builder — kept distinct on purpose).
export {
  ARWEAVE_TX_REGEX,
  AR_IO_PROTOCOL,
  arweaveUri,
  FQDN_REGEX,
  MARIO_PER_ARIO,
} from '../constants.js';

// Solana implementation classes (still exported for advanced/direct usage —
// the `ARIO` / `ANT` factories above wrap these).
export { SolanaARIOReadable } from './io-readable.js';
export {
  type CrankAction,
  type CrankEpochStepOptions,
  type CrankEpochStepResult,
  isInvalidGatewayAccountError,
  SolanaARIOWriteable,
} from './io-writeable.js';

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
export {
  ANTEscrow,
  TokenEscrow,
  // Vault-claim pre-flight helpers (ADR-022 / VaultStillLocked).
  // Exported so downstream UIs can gate their Submit buttons using the
  // SAME forward CLOCK_SKEW_TOLERANCE_SECONDS buffer the SDK's
  // assertVaultClaimable throws use — keeping pre-flight and UI gates
  // in lock-step so users never see a raw on-chain error.
  assertVaultClaimable,
  isVaultClaimable,
  CLOCK_SKEW_TOLERANCE_SECONDS,
} from './escrow.js';
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
  deriveRecipientId,
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
  LANDING_PAGE_TX_ID,
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

// Deserialization adapters
//
// Thin wrappers over Codama-generated decoders from `@ar.io/solana-contracts`.
// They accept raw `Buffer` data and return plain-object types (string/number)
// instead of Codama's `Address`/`bigint` types, so SDK consumers don't need
// to import the contracts package directly.
// Account discriminators come from `@ar.io/solana-contracts/<program>`.
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

// Off-chain prediction of prescribe_epoch's observer selection (cranker helper)
export {
  predictPrescribedObservers,
  type RegistrySlotWeight,
} from './predict-prescribed-observers.js';

// Constants
export * from './constants.js';

// Cluster-specific deployment constants (devnet program IDs, RPC URL,
// mint). PDAs derive from these via the codama `find*Pda` helpers; token
// accounts are read on-chain — neither is stored here.
export * from './clusters.js';

// RPC circuit breaker (opossum-backed transparent fallback)
export {
  createCircuitBreakerRpc,
  defaultFallbackUrl,
} from './rpc-circuit-breaker.js';
export type {
  CircuitBreakerRpcConfig,
  CircuitBreakerRpcOptions,
} from './rpc-circuit-breaker.js';

// Retry utility (exponential back-off for transient RPC errors)
export { withRetry, isRetryableError } from './retry.js';
export type { RetryOptions } from './retry.js';

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
