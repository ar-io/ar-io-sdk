/**
 * Reader for the on-chain Metaplex Core asset (`AssetV1` + plugin chain).
 *
 * The codama-generated decoders in `generated/mpl-core` only cover the
 * fixed-shape header section (`AssetV1`, `PluginHeaderV1`, etc.) — they
 * don't know how to follow the variable-offset registry chain to a
 * specific plugin payload. This module fills that gap with a small
 * walker that:
 *
 *   1. decodes the `AssetV1` prefix (key + owner + update authority +
 *      name + uri + seq);
 *   2. follows the `PluginHeaderV1.pluginRegistryOffset` to the
 *      `PluginRegistryV1`;
 *   3. iterates registry records to find the requested plugin variant;
 *   4. decodes the `Plugin` enum at the registry record's offset.
 *
 * The same walk lives on-chain in `programs/ario-arns/src/state/mod.rs`
 * (`read_mpl_core_attribute`) and `programs/ario-core/src/mpl_core.rs`
 * (`read_ant_program`). The three implementations are pinned against
 * each other by the migration import's edge-case fixtures and unit
 * tests at all three layers.
 *
 * Reading is best-effort: any parse failure returns `null` rather than
 * throwing, so callers can fall back to canonical defaults
 * (e.g. `ARIO_ANT_PROGRAM_ID`) when an asset was minted without the
 * `ANT Program` attribute or has a layout the walker doesn't recognise.
 */

import {
  type Address,
  type FetchAccountConfig,
  type ReadonlyUint8Array,
  fetchEncodedAccount,
} from '@solana/kit';

import { getAssetV1Decoder } from './generated/mpl-core/accounts/assetV1.js';
import { getPluginHeaderV1Decoder } from './generated/mpl-core/accounts/pluginHeaderV1.js';
import { getPluginRegistryV1Decoder } from './generated/mpl-core/accounts/pluginRegistryV1.js';
import { getPluginDecoder } from './generated/mpl-core/types/plugin.js';
import { PluginType } from './generated/mpl-core/types/pluginType.js';

/**
 * On-chain trait keys. Marketplaces and DAS indexers query these by
 * exact string match — keep in lock-step with:
 *   - `migration/import/src/phases/phase2-ants.ts`
 *   - `programs/ario-arns/src/mpl_core_cpi.rs::TRAIT_KEY_*`
 *   - `programs/ario-core/src/mpl_core.rs::TRAIT_KEY_ANT_PROGRAM`
 */
export const TRAIT_KEY_ARNS_NAME = 'ArNS Name' as const;
export const TRAIT_KEY_TYPE = 'Type' as const;
export const TRAIT_KEY_UNDERNAME_LIMIT = 'Undername Limit' as const;
export const TRAIT_KEY_ANT_PROGRAM = 'ANT Program' as const;

/**
 * Read a single attribute value from a Metaplex Core asset's Attributes
 * plugin. Returns `null` when the asset has no plugin section, has no
 * Attributes plugin, the requested key is absent, or any layer of the
 * walk fails to decode. This is a best-effort lookup — callers should
 * use a canonical default rather than treating absence as an error.
 *
 * `data` is the raw account data (post-discriminator? no — MPL Core
 * doesn't use the 8-byte Anchor discriminator, the asset is the
 * account's full data starting from the `Key` enum byte).
 */
export function readAttribute(
  data: Uint8Array | ReadonlyUint8Array,
  key: string,
): string | null {
  try {
    // ── 1. Asset header (variable size — name and uri are length-prefixed).
    const [, afterAsset] = getAssetV1Decoder().read(data, 0);

    // No plugin section → no attributes.
    if (afterAsset >= data.length) return null;

    // ── 2. PluginHeaderV1: 9 bytes (1-byte key + u64 registry offset).
    const [pluginHeader] = getPluginHeaderV1Decoder().read(data, afterAsset);
    const registryOffset = Number(pluginHeader.pluginRegistryOffset);
    if (registryOffset >= data.length) return null;

    // ── 3. PluginRegistryV1: list of (pluginType, authority, offset).
    const [registry] = getPluginRegistryV1Decoder().read(data, registryOffset);

    for (const record of registry.registry) {
      // `pluginType` is the kit-decoded numeric `PluginType` enum value
      // (e.g. `PluginType.Attributes === 6`). The matching `Plugin`
      // payload at `record.offset` is a discriminated union whose
      // `__kind` is the string variant name — so we use the numeric
      // enum here and the string tag below.
      if (record.pluginType !== PluginType.Attributes) continue;

      const [plugin] = getPluginDecoder().read(data, Number(record.offset));
      if (plugin.__kind !== 'Attributes') continue;

      const attrs = plugin.fields[0].attributeList;
      const found = attrs.find((a) => a.key === key);
      return found ? found.value : null;
    }

    return null;
  } catch {
    // Any decode failure (truncated buffer, unknown plugin variant, etc.)
    // — treat as "no override" and let the caller fall back.
    return null;
  }
}

/**
 * Convenience wrapper: fetch the asset account and parse its
 * `ANT Program` attribute. Returns `null` when the account doesn't
 * exist, has no `ANT Program` trait, or the value can't be parsed —
 * callers should fall back to the canonical `ARIO_ANT_PROGRAM_ID`.
 *
 * Importing this here (rather than wiring it directly into the resolver
 * paths) lets `ant-readable.ts` keep its constructor synchronous and
 * have a separate async `fromAsset(rpc, mint)` factory that does the
 * lookup once and caches the result.
 */
export async function fetchAntProgramFromAsset(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  mint: Address,
  config?: FetchAccountConfig,
): Promise<Address | null> {
  const account = await fetchEncodedAccount(rpc, mint, config);
  if (!account.exists) return null;
  const value = readAttribute(account.data, TRAIT_KEY_ANT_PROGRAM);
  if (value === null) return null;
  // The ANT Program attribute is a base58-encoded program address.
  // We don't validate length here — the kit `Address` brand is
  // structural and downstream `getProgramDerivedAddress` will reject
  // malformed values. Returning `null` on missing keeps the call site
  // simple ("found a value or didn't"); a malformed value is a holder
  // self-grief that surfaces at the next PDA derivation.
  return value as Address;
}

/**
 * Fetch the current owner of an MPL Core asset. Returns `null` when the
 * account doesn't exist or the AssetV1 layout can't be decoded.
 *
 * Used by `SolanaARIOWriteable` to decide whether to bundle
 * `ant.sync_attributes` into a buy / manage tx. The Attributes plugin's
 * `BasePluginAuthority` is `Owner`, so only the current asset holder
 * can sign the inner CPI; if the caller isn't the holder, bundling
 * would abort the whole tx (BD-095 — non-holder ArNS lease management
 * must continue to succeed; the actual ANT owner can call the public
 * `syncAttributes` later to converge state).
 */
export async function fetchMplCoreOwner(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  mint: Address,
  config?: FetchAccountConfig,
): Promise<Address | null> {
  const account = await fetchEncodedAccount(rpc, mint, config);
  if (!account.exists) return null;
  try {
    const [asset] = getAssetV1Decoder().read(account.data, 0);
    return asset.owner;
  } catch {
    return null;
  }
}
