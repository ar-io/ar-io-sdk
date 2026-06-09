import assert from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, address } from '@solana/kit';

import { ANT } from '../common/ant.js';
import { ARIO_ANT_PROGRAM_ID, ARIO_CORE_PROGRAM_ID } from './constants.js';
import {
  TRAIT_KEY_ANT_PROGRAM,
  TRAIT_KEY_ARNS_NAME,
  readAttribute,
  resolveWriteAntProgram,
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

// ---------------------------------------------------------------------------
// resolveWriteAntProgram — the trust gate for the SIGNING (write) path.
// The `ANT Program` trait is untrusted asset/RPC data; a non-canonical
// detected value must not be signed against without explicit opt-in, or a
// spoofed trait could route a victim's signature to an attacker program.
// ---------------------------------------------------------------------------

describe('resolveWriteAntProgram', () => {
  // A valid-but-non-canonical program id stands in for an attacker's program.
  const NON_CANONICAL = ARIO_CORE_PROGRAM_ID;

  it('falls back to canonical when no trait is detected', () => {
    assert.equal(
      resolveWriteAntProgram({ detected: null }),
      ARIO_ANT_PROGRAM_ID,
    );
  });

  it('accepts a detected value that equals the canonical program', () => {
    assert.equal(
      resolveWriteAntProgram({ detected: ARIO_ANT_PROGRAM_ID }),
      ARIO_ANT_PROGRAM_ID,
    );
  });

  it('THROWS on an auto-detected non-canonical program (no opt-in)', () => {
    assert.throws(
      () => resolveWriteAntProgram({ detected: NON_CANONICAL }),
      /non-canonical ANT program/,
    );
  });

  it('honors an explicit non-canonical program (BYO-ANT opt-in)', () => {
    assert.equal(
      resolveWriteAntProgram({ explicit: NON_CANONICAL, detected: null }),
      NON_CANONICAL,
    );
  });

  it('explicit opt-in wins even if a different value was detected', () => {
    assert.equal(
      resolveWriteAntProgram({
        explicit: ARIO_ANT_PROGRAM_ID,
        detected: NON_CANONICAL,
      }),
      ARIO_ANT_PROGRAM_ID,
    );
  });
});

// ---------------------------------------------------------------------------
// ANT.init end-to-end: a spoofed `ANT Program` trait must NOT become the
// signed-write program, but the read-only client may still auto-detect it.
// Mirrors the security finding's PoC step.
// ---------------------------------------------------------------------------

/** A valid asset address to stand in as the ANT `processId`. */
const ASSET_ADDRESS = address('So11111111111111111111111111111111111111112');

/** Stub rpc whose getAccountInfo returns `bytes` for any pubkey. */
function stubRpcReturningAsset(bytes: Uint8Array): unknown {
  return {
    getAccountInfo: () => ({
      send: async () => ({
        value: {
          data: [Buffer.from(bytes).toString('base64'), 'base64'] as readonly [
            string,
            string,
          ],
          lamports: 1,
          owner: '11111111111111111111111111111111',
          executable: false,
          rentEpoch: 0,
        },
      }),
    }),
  };
}

describe('ANT.init ANT-program trust', () => {
  // Asset advertising an attacker-controlled `ANT Program` trait.
  const spoofedAsset = makeAssetWithAttributes([
    ['ANT Program', ARIO_CORE_PROGRAM_ID as string],
  ]);

  it('refuses to build a writeable client against a spoofed program', async () => {
    const rpc = stubRpcReturningAsset(spoofedAsset);
    await assert.rejects(
      ANT.init({
        processId: ASSET_ADDRESS,
        rpc: rpc as never,
        signer: {} as never,
        rpcSubscriptions: {} as never,
      }),
      /non-canonical ANT program/,
    );
  });

  it('allows a readable client to auto-detect (no signature at risk)', async () => {
    const rpc = stubRpcReturningAsset(spoofedAsset);
    const ant = await ANT.init({
      processId: ASSET_ADDRESS,
      rpc: rpc as never,
    });
    assert.ok(ant, 'read-only ANT.init should resolve without throwing');
  });

  it('builds a writeable client when the spoofed program is explicitly opted into', async () => {
    const rpc = stubRpcReturningAsset(spoofedAsset);
    const ant = await ANT.init({
      processId: ASSET_ADDRESS,
      rpc: rpc as never,
      signer: {} as never,
      rpcSubscriptions: {} as never,
      antProgramId: ARIO_CORE_PROGRAM_ID as Address,
    });
    assert.ok(ant, 'explicit opt-in should bypass the auto-detect guard');
  });
});
