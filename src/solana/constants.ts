/**
 * Solana program IDs and PDA seed constants for AR.IO programs.
 *
 * These must match the seeds defined in the Anchor programs under
 * contracts/programs/{ario-core,ario-gar,ario-arns,ario-ant}/src/.
 */
import { type Address, address } from '@solana/kit';

// Program IDs — placeholder addresses (replace with deployed program IDs)
export const ARIO_CORE_PROGRAM_ID: Address = address(
  'ARioCoreProgramXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
);
export const ARIO_GAR_PROGRAM_ID: Address = address(
  'ARioGarProgramXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
);
export const ARIO_ARNS_PROGRAM_ID: Address = address(
  'ARioArnsProgXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
);
export const ARIO_ANT_PROGRAM_ID: Address = address(
  'ARioAntProgXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
);
export const ARIO_ANT_ESCROW_PROGRAM_ID: Address = address(
  'ARioAntEscrowXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
);
export const MPL_CORE_PROGRAM_ID: Address = address(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
);

// Token constants
export const TOKEN_DECIMALS = 6;
export const ONE_TOKEN = 1_000_000; // 1 ARIO = 1,000,000 mARIO
export const RATE_SCALE = 1_000_000;

// =========================================
// PDA Seeds — ario-core
// =========================================
export const ARIO_CONFIG_SEED = Buffer.from('ario_config');
export const VAULT_SEED = Buffer.from('vault');
export const VAULT_COUNTER_SEED = Buffer.from('vault_counter');
export const BALANCE_SEED = Buffer.from('balance');
export const PRIMARY_NAME_SEED = Buffer.from('primary_name');
export const PRIMARY_NAME_REQUEST_SEED = Buffer.from('primary_name_request');
export const PRIMARY_NAME_REVERSE_SEED = Buffer.from('primary_name_reverse');

// =========================================
// PDA Seeds — ario-gar
// =========================================
export const GATEWAY_REGISTRY_SEED = Buffer.from('gateway_registry');
export const GAR_SETTINGS_SEED = Buffer.from('gar_settings');
export const GATEWAY_SEED = Buffer.from('gateway');
export const DELEGATION_SEED = Buffer.from('delegation');
export const WITHDRAWAL_SEED = Buffer.from('withdrawal');
export const WITHDRAWAL_COUNTER_SEED = Buffer.from('withdrawal_counter');
export const ALLOWLIST_SEED = Buffer.from('allowlist');
export const EPOCH_SEED = Buffer.from('epoch');
export const EPOCH_SETTINGS_SEED = Buffer.from('epoch_settings');
export const OBSERVATION_SEED = Buffer.from('observation');
export const REDELEGATION_SEED = Buffer.from('redelegation');
export const OBSERVER_LOOKUP_SEED = Buffer.from('observer_lookup');

// =========================================
// PDA Seeds — ario-arns
// =========================================
export const ARNS_REGISTRY_SEED = Buffer.from('name_registry');
export const ARNS_SETTINGS_SEED = Buffer.from('arns_config');
export const ARNS_RECORD_SEED = Buffer.from('arns_record');
export const RESERVED_NAME_SEED = Buffer.from('reserved_name');
export const RETURNED_NAME_SEED = Buffer.from('returned_name');
export const DEMAND_FACTOR_SEED = Buffer.from('demand_factor');

/**
 * Byte offsets of fixed-size fields within an `ArnsRecord` account.
 *
 * Used as `memcmp` filter offsets for `getProgramAccounts` so callers
 * can resolve "which ArNS record points at this ANT mint?" as a true
 * point query instead of scanning every record. Mirrors the
 * `ArnsRecord::ANT_OFFSET` / `OWNER_OFFSET` constants in
 * `contracts/programs/ario-arns/src/state/mod.rs` — keep them in
 * sync if the on-chain layout ever changes.
 */
export const ARNS_RECORD_NAME_HASH_OFFSET = 8;
export const ARNS_RECORD_OWNER_OFFSET = 8 + 32; // 40
export const ARNS_RECORD_ANT_OFFSET = 8 + 32 + 32; // 72

// =========================================
// PDA Seeds — ario-ant
// =========================================
export const ANT_CONFIG_VERSION = 1;
export const ANT_CONFIG_SEED = Buffer.from('ant_config');
export const ANT_CONTROLLERS_SEED = Buffer.from('ant_controllers');
export const ANT_RECORD_SEED = Buffer.from('ant_record');
export const ANT_RECORD_META_SEED = Buffer.from('ant_record_meta');

// Per-user paginated ACL (ADR-012). See `docs/ACCOUNT_SCALING_PATTERNS.md`
// Pattern C: a head `AclConfig` plus deterministically-addressed `AclPage`s
// indexed by `u64` little-endian page idx.
export const ACL_CONFIG_SEED = Buffer.from('acl_config');
export const ACL_PAGE_SEED = Buffer.from('acl_page');

/**
 * Maximum live entries per `AclPage` (must match the on-chain constant).
 *
 * Each entry is 33 bytes (`Pubkey + u8`). 256 entries = 8_448 bytes raw —
 * fits the default 32 KiB BPF heap with margin and stays well under the
 * 10 KiB per-tx realloc cap when allocated at full size.
 */
export const MAX_ACL_PAGE_ENTRIES = 256;

/** ACL relationship roles (encoded as `u8` on each `AclEntry`). */
export const ACL_ROLE_OWNER = 0;
export const ACL_ROLE_CONTROLLER = 1;

// =========================================
// PDA Seeds — ario-ant-escrow
// =========================================
export const ESCROW_ANT_SEED = Buffer.from('escrow_ant');
export const ESCROW_TOKEN_SEED = Buffer.from('escrow_token');
export const ESCROW_VAULT_SEED = Buffer.from('escrow_vault');

// =========================================
// ario-ant-escrow protocol constants (must match Rust state.rs)
// =========================================
export const ESCROW_PROTOCOL_ARWEAVE = 0;
export const ESCROW_PROTOCOL_ETHEREUM = 1;
export const ESCROW_ARWEAVE_PUBKEY_LEN = 512;
export const ESCROW_ETHEREUM_PUBKEY_LEN = 20;
export const ESCROW_RECIPIENT_PUBKEY_MAX_LEN = 512;
export const ESCROW_ASSET_TYPE_TOKEN = 1;
export const ESCROW_ASSET_TYPE_VAULT = 2;

// =========================================
// Protocol constants (must match Rust)
// =========================================

// Multi-protocol target constants (must match ario-ant/src/state.rs)
export const PROTOCOL_ARWEAVE = 0;
export const PROTOCOL_IPFS = 1;
export const MAX_TARGET_LENGTH = 128;

export const MAX_NAME_LENGTH = 51;
export const MIN_TTL_SECONDS = 60;
export const MAX_TTL_SECONDS = 86_400;
export const MAX_CONTROLLERS = 10;
export const EPOCH_DURATION_SECONDS = 86_400;
export const WITHDRAWAL_LOCK_PERIOD = 30 * 86_400; // 30 days in seconds
export const MIN_OPERATOR_STAKE = 20_000 * ONE_TOKEN; // 20,000 ARIO
export const MIN_DELEGATION_AMOUNT = 10 * ONE_TOKEN; // 10 ARIO
export const LEASE_GRACE_PERIOD = 14 * 86_400; // 14 days
export const PRIMARY_NAME_REQUEST_EXPIRY = 7 * 86_400; // 7 days
export const MAX_GATEWAYS = 3000;
export const MAX_NAMES = 50_000;
