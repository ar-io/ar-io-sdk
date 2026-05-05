import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  TRAIT_KEY_ANT_PROGRAM,
  TRAIT_KEY_ARNS_NAME,
  readAttribute,
} from './mpl-core.js';

const ATTRIBUTES_PLUGIN_TYPE = 6;

/**
 * Build a minimal AssetV1 + Attributes plugin buffer matching the
 * on-chain layout. Mirrors the Rust fixture in
 * `programs/ario-arns/src/state/mod.rs::make_asset_with_attributes`.
 */
function makeAssetWithAttributes(attrs: Array<[string, string]>): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];

  // Asset header.
  parts.push(new Uint8Array([1])); // Key::AssetV1
  parts.push(new Uint8Array(32).fill(7)); // owner
  parts.push(new Uint8Array([0])); // UpdateAuthority::None
  parts.push(new Uint8Array([0, 0, 0, 0])); // name length=0
  parts.push(new Uint8Array([0, 0, 0, 0])); // uri length=0
  parts.push(new Uint8Array([0])); // seq=None

  // Compute running offsets so we can patch the registry offset later.
  const headerSize = parts.reduce((n, p) => n + p.length, 0);

  // PluginHeaderV1 (key=3, then registry offset to be patched).
  const headerSection = new Uint8Array(9);
  headerSection[0] = 3; // Key::PluginHeaderV1
  // We'll patch headerSection[1..9] (u64 LE registry offset) once we
  // know the plugin body size.
  parts.push(headerSection);

  // Plugin body: Attributes variant.
  const pluginBody: number[] = [];
  pluginBody.push(ATTRIBUTES_PLUGIN_TYPE); // Plugin::Attributes
  // attribute_list length (u32 LE).
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, attrs.length, true);
  pluginBody.push(...lenBytes);
  for (const [k, v] of attrs) {
    const kBytes = enc.encode(k);
    const vBytes = enc.encode(v);
    const kLen = new Uint8Array(4);
    new DataView(kLen.buffer).setUint32(0, kBytes.length, true);
    const vLen = new Uint8Array(4);
    new DataView(vLen.buffer).setUint32(0, vBytes.length, true);
    pluginBody.push(...kLen, ...kBytes, ...vLen, ...vBytes);
  }
  const pluginBodyBytes = new Uint8Array(pluginBody);
  const pluginOffset = headerSize + 9; // after header section
  parts.push(pluginBodyBytes);

  // PluginRegistryV1.
  const registryBytes: number[] = [];
  registryBytes.push(4); // Key::PluginRegistryV1
  // registry: 1 record.
  const recordCount = new Uint8Array(4);
  new DataView(recordCount.buffer).setUint32(0, 1, true);
  registryBytes.push(...recordCount);
  registryBytes.push(ATTRIBUTES_PLUGIN_TYPE); // pluginType
  registryBytes.push(1); // BasePluginAuthority::Owner (variant 1, no body)
  // offset: u64 LE → pluginOffset.
  const offBytes = new Uint8Array(8);
  new DataView(offBytes.buffer).setBigUint64(0, BigInt(pluginOffset), true);
  registryBytes.push(...offBytes);
  // externalRegistry: empty.
  const extLen = new Uint8Array(4);
  new DataView(extLen.buffer).setUint32(0, 0, true);
  registryBytes.push(...extLen);

  const registryStart = pluginOffset + pluginBodyBytes.length;
  parts.push(new Uint8Array(registryBytes));

  // Patch the PluginHeader's registry offset.
  new DataView(headerSection.buffer).setBigUint64(
    1,
    BigInt(registryStart),
    true,
  );

  // Concatenate.
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

describe('readAttribute', () => {
  it('returns the value for a present key', () => {
    const buf = makeAssetWithAttributes([
      ['ArNS Name', 'ardrive'],
      ['Type', 'permabuy'],
      ['ANT Program', 'AntPgm111111111111111111111111111111111111'],
    ]);
    assert.equal(
      readAttribute(buf, TRAIT_KEY_ANT_PROGRAM),
      'AntPgm111111111111111111111111111111111111',
    );
    assert.equal(readAttribute(buf, TRAIT_KEY_ARNS_NAME), 'ardrive');
  });

  it('returns null when the key is absent', () => {
    const buf = makeAssetWithAttributes([['ArNS Name', 'x']]);
    assert.equal(readAttribute(buf, TRAIT_KEY_ANT_PROGRAM), null);
  });

  it('returns null when the asset has no plugin section', () => {
    // Bare asset: key + owner + UpdateAuthority::None + empty name +
    // empty uri + seq=None — no plugin chain.
    const buf = new Uint8Array(43);
    buf[0] = 1;
    // bytes 1..33 = owner (zero-filled, fine for parser)
    // byte 33 = UpdateAuthority::None
    // bytes 34..38 = name length=0
    // bytes 38..42 = uri length=0
    // byte 42 = seq=None
    assert.equal(readAttribute(buf, TRAIT_KEY_ANT_PROGRAM), null);
  });

  it('returns null on a truncated buffer rather than throwing', () => {
    // 8 bytes is too short to even contain the asset header — the
    // walker must catch the decode error and fall back to null.
    const buf = new Uint8Array(8);
    buf[0] = 1;
    assert.equal(readAttribute(buf, TRAIT_KEY_ANT_PROGRAM), null);
  });
});
