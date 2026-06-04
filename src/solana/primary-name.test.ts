/**
 * Unit tests for the primary-name client helpers added alongside the
 * undername-record-owner authorization fallback.
 *
 * These are fast unit tests — no validator (the one RPC-touching case uses a
 * stub). They cover:
 *   - `splitPrimaryName` (mirrors the contract's `splitn(2, '_')` rule)
 *   - `getAntRecordPDA` / `getAntConfigPDA` derivation + cross-package parity
 *     with `@ar.io/solana-contracts`
 *   - Borsh layout for `request_and_set_primary_name` and
 *     `approve_primary_name` instruction args (must match the Rust handlers
 *     in `programs/ario-core/src/instructions/primary_name.rs`)
 *   - `_buildPrimaryNameValidationAccounts` remaining-account ordering,
 *     incl. the trailing `AntConfig` PDA (ario-core PR #91 ABI)
 *
 * See `PLAN_undername_primary_name.md` for the design rationale.
 */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  AccountRole,
  type Address,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';

import { findAntConfigPda } from '@ar.io/solana-contracts/ant';
import { findPrimaryNameReversePda } from '@ar.io/solana-contracts/core';

import {
  ANT_CONFIG_SEED,
  ANT_RECORD_SEED,
  ARIO_ANT_PROGRAM_ID,
  ARIO_ARNS_PROGRAM_ID,
  ARIO_CORE_PROGRAM_ID,
} from './constants.js';
import { BorshWriter } from './deserialize.js';
import { SolanaARIOWriteable, splitPrimaryName } from './io-writeable.js';
import {
  getAntConfigPDA,
  getAntRecordPDA,
  getArnsRecordPDA,
  getDemandFactorPDA,
  getPrimaryNameReversePDA,
  hashName,
} from './pda.js';

/** Sprint 2 / ADR-016: both `request_and_set_primary_name` and
 *  `approve_primary_name` now take an `ant_program_id: Pubkey` arg
 *  (32 bytes Borsh-encoded as raw bytes). Callers must pass the
 *  canonical ARIO_ANT_PROGRAM_ID for the canonical deployment. */
const ANT_PROGRAM_ID_BYTES = (() => {
  const enc = getAddressEncoder();
  return Buffer.from(enc.encode(ARIO_ANT_PROGRAM_ID));
})();

describe('splitPrimaryName', () => {
  it('returns base-name shape for a name without underscore', () => {
    const r = splitPrimaryName('arweave');
    assert.equal(r.isUndername, false);
    assert.equal(r.baseName, 'arweave');
    assert.equal(r.undername, null);
  });

  it('splits "undername_basename" into both parts', () => {
    const r = splitPrimaryName('blog_arweave');
    assert.equal(r.isUndername, true);
    assert.equal(r.baseName, 'arweave');
    assert.equal(r.undername, 'blog');
  });

  it('lowercases both parts to match contract semantics', () => {
    const r = splitPrimaryName('BLOG_Arweave');
    assert.equal(r.baseName, 'arweave');
    assert.equal(r.undername, 'blog');
  });

  it('only splits on the first underscore (matches splitn(2, _))', () => {
    // "a_b_c" → undername "a", base "b_c". The contract uses splitn(2, '_'),
    // so additional underscores stay on the base side. Note that "b_c" isn't
    // a *valid* base name per ArNS validation (no underscores allowed in a
    // base) — the on-chain validate_primary_name_format would reject it. This
    // test pins splitter behavior independent of validation.
    const r = splitPrimaryName('a_b_c');
    assert.equal(r.isUndername, true);
    assert.equal(r.undername, 'a');
    assert.equal(r.baseName, 'b_c');
  });

  it('treats a leading underscore as an empty undername', () => {
    // "_xyz" → undername "", base "xyz". Again, on-chain validation rejects
    // this shape (undername must be non-empty), but the splitter alone is
    // a pure string split.
    const r = splitPrimaryName('_xyz');
    assert.equal(r.isUndername, true);
    assert.equal(r.undername, '');
    assert.equal(r.baseName, 'xyz');
  });
});

describe('getAntRecordPDA derivation', () => {
  it('uses the AntRecord seed pattern: ["ant_record", mint, sha256(undername)]', async () => {
    const mint: Address = address('11111111111111111111111111111112');
    const undername = 'blog';

    // Recompute the PDA manually using the same primitives to confirm
    // the helper isn't doing anything sneaky.
    const addressEncoder = getAddressEncoder();
    const undernameHash = createHash('sha256')
      .update(undername.toLowerCase())
      .digest()
      .subarray(0, 32);
    const [expected] = await getProgramDerivedAddress({
      programAddress: ARIO_ANT_PROGRAM_ID,
      seeds: [ANT_RECORD_SEED, addressEncoder.encode(mint), undernameHash],
    });

    const [actual] = await getAntRecordPDA(mint, undername);
    assert.equal(actual, expected);
  });

  it('lowercases the undername before hashing (parity with hash_undername)', async () => {
    const mint: Address = address('11111111111111111111111111111112');
    const [a] = await getAntRecordPDA(mint, 'BLOG');
    const [b] = await getAntRecordPDA(mint, 'blog');
    const [c] = await getAntRecordPDA(mint, 'Blog');
    assert.equal(a, b);
    assert.equal(b, c);
  });

  it('produces different addresses for different undernames', async () => {
    const mint: Address = address('11111111111111111111111111111112');
    const [a] = await getAntRecordPDA(mint, 'blog');
    const [b] = await getAntRecordPDA(mint, 'docs');
    assert.notEqual(a, b);
  });
});

/**
 * Replicate the data portion of the request_and_set_primary_name
 * instruction payload after the Sprint 2 / ADR-016 reshape. Anchor encodes
 * `(name: String, reverse_lookup_hash: [u8; 32], ant_program_id: Pubkey)` as:
 *   [ u32 LE name length ][ name bytes ][ 32-byte hash ][ 32-byte program_id ]
 */
function encodeRequestPrimaryNameArgs(name: string): Buffer {
  const w = new BorshWriter(256);
  w.writeString(name);
  w.writeFixedBytes(hashName(name));
  w.writeFixedBytes(ANT_PROGRAM_ID_BYTES);
  return w.toBuffer();
}

/**
 * Replicate the data portion of the approve_primary_name instruction
 * payload after the reshape:
 *   [ 32-byte hash ][ 32-byte program_id ]
 */
function encodeApprovePrimaryNameArgs(name: string): Buffer {
  const w = new BorshWriter(96);
  w.writeFixedBytes(hashName(name));
  w.writeFixedBytes(ANT_PROGRAM_ID_BYTES);
  return w.toBuffer();
}

describe('Borsh layout: request_and_set_primary_name', () => {
  it('writes name length (u32 LE) + utf8 bytes + 32-byte hash + 32-byte program_id', () => {
    const name = 'blog_arweave';
    const buf = encodeRequestPrimaryNameArgs(name);

    // name length (u32 LE)
    assert.equal(buf.readUInt32LE(0), name.length);
    // name utf8
    assert.equal(buf.subarray(4, 4 + name.length).toString('utf8'), name);
    // reverse_lookup_hash
    const hashStart = 4 + name.length;
    assert.deepEqual(
      Buffer.from(buf.subarray(hashStart, hashStart + 32)),
      hashName(name),
    );
    // ant_program_id (raw 32 bytes — Borsh's Pubkey encoding)
    const programIdStart = hashStart + 32;
    assert.deepEqual(
      Buffer.from(buf.subarray(programIdStart, programIdStart + 32)),
      ANT_PROGRAM_ID_BYTES,
    );
    // No trailing bytes
    assert.equal(buf.length, programIdStart + 32);
  });

  it('hashes the lowercased name (parity with on-chain reverse_lookup_hash)', () => {
    const buf1 = encodeRequestPrimaryNameArgs('Blog_Arweave');
    const buf2 = encodeRequestPrimaryNameArgs('blog_arweave');
    // Names differ — first 4 + N bytes will diverge — but the
    // 32-byte reverse_lookup_hash region (just before the program_id)
    // should match because hashName lowercases.
    const tail1 = buf1.subarray(buf1.length - 64, buf1.length - 32);
    const tail2 = buf2.subarray(buf2.length - 64, buf2.length - 32);
    assert.deepEqual(tail1, tail2);
  });
});

describe('Borsh layout: approve_primary_name', () => {
  it('is exactly 64 bytes (32-byte hash + 32-byte program_id)', () => {
    const buf = encodeApprovePrimaryNameArgs('blog_arweave');
    assert.equal(buf.length, 64);
    assert.deepEqual(
      Buffer.from(buf.subarray(0, 32)),
      hashName('blog_arweave'),
    );
    assert.deepEqual(Buffer.from(buf.subarray(32, 64)), ANT_PROGRAM_ID_BYTES);
  });
});

/**
 * Cross-package regression guard for the PrimaryNameReverse PDA
 * derivation that the `fix/phase5-primary-name-reverse` PR depended on.
 *
 * Three independent pieces of code derive this PDA and they MUST agree:
 *   1. The migration snapshot — builds the reverse payload to import
 *      (`migration/snapshot/src/transform.ts::transformPrimaryNames`)
 *   2. This SDK's `getPrimaryNameReversePDA` — used when building
 *      `setPrimaryName` / `approvePrimaryName` / `requestAndSet…` ixs.
 *   3. `@ar.io/solana-contracts`'s `findPrimaryNameReversePda` — used
 *      inside the codegen instruction builders to auto-derive the
 *      reverse account when callers omit it.
 *
 * If any two diverge (different hash, different seed prefix, different
 * lowercasing rule), imported owners hit `AccountNotInitialized` on the
 * reverse PDA on their next write — the bug this PR fixed. Pin all
 * three so drift in any codebase fails CI immediately.
 *
 * Note: we always pass an explicit `programAddress` because the codegen
 * default in `findPrimaryNameReversePda` is the source-pinned
 * `ARioCoreProgramXXX…` placeholder — per-cluster deployments override
 * it at call time. The SDK helper defaults to `ARIO_CORE_PROGRAM_ID`
 * from `constants.ts`. Both must produce the same address when handed
 * the same program ID.
 */
describe('getPrimaryNameReversePDA — cross-package agreement', () => {
  for (const name of ['arweave', 'blog_arweave', 'Mixed-Case-Name']) {
    it(`matches @ar.io/solana-contracts findPrimaryNameReversePda for "${name}"`, async () => {
      const [sdkPda] = await getPrimaryNameReversePDA(name);
      const [contractsPda] = await findPrimaryNameReversePda(
        { reverseLookupHash: hashName(name) },
        { programAddress: ARIO_CORE_PROGRAM_ID },
      );
      assert.equal(sdkPda, contractsPda);
    });
  }

  it('SDK and contracts agree for a custom (cluster-override) program id', async () => {
    // Realistic localnet-style override — confirms both code paths thread
    // the programAddress arg correctly into getProgramDerivedAddress.
    const overrideProgram = ARIO_ANT_PROGRAM_ID; // any other valid Address
    const [sdkPda] = await getPrimaryNameReversePDA('arweave', overrideProgram);
    const [contractsPda] = await findPrimaryNameReversePda(
      { reverseLookupHash: hashName('arweave') },
      { programAddress: overrideProgram },
    );
    assert.equal(sdkPda, contractsPda);
  });

  it('hashes the lowercased form (same as the migration snapshot)', async () => {
    const [a] = await getPrimaryNameReversePDA('AlIcE');
    const [b] = await getPrimaryNameReversePDA('alice');
    assert.equal(a, b);
  });
});

/**
 * AntConfig PDA — pinned alongside the AntRecord for primary-name
 * authorization (ario-core PR #91 / BD-097 / BD-109). ario-core reads
 * `AntConfig.last_known_owner` as the implicit-owner source and to
 * freshness-gate the per-record `AntRecord.owner` delegate, so the SDK must
 * derive this PDA against the same `["ant_config", asset]` seeds the
 * on-chain `read_ant_config_last_known_owner` walks.
 */
describe('getAntConfigPDA derivation', () => {
  it('uses the AntConfig seed pattern: ["ant_config", asset]', async () => {
    const mint: Address = address('11111111111111111111111111111112');

    const addressEncoder = getAddressEncoder();
    const [expected] = await getProgramDerivedAddress({
      programAddress: ARIO_ANT_PROGRAM_ID,
      seeds: [ANT_CONFIG_SEED, addressEncoder.encode(mint)],
    });

    const [actual] = await getAntConfigPDA(mint);
    assert.equal(actual, expected);
  });

  it('produces different addresses for different ANT assets', async () => {
    const [a] = await getAntConfigPDA(
      address('11111111111111111111111111111112'),
    );
    const [b] = await getAntConfigPDA(
      address('11111111111111111111111111111113'),
    );
    assert.notEqual(a, b);
  });

  it('threads a custom (cluster-override) program id into the derivation', async () => {
    const mint: Address = address('11111111111111111111111111111112');
    const [canonical] = await getAntConfigPDA(mint);
    const [overridden] = await getAntConfigPDA(mint, ARIO_CORE_PROGRAM_ID);
    assert.notEqual(canonical, overridden);
  });
});

describe('getAntConfigPDA — cross-package agreement', () => {
  it('matches @ar.io/solana-contracts findAntConfigPda (canonical program)', async () => {
    const mint: Address = address('11111111111111111111111111111112');
    const [sdkPda] = await getAntConfigPDA(mint);
    const [contractsPda] = await findAntConfigPda(
      { asset: mint },
      { programAddress: ARIO_ANT_PROGRAM_ID },
    );
    assert.equal(sdkPda, contractsPda);
  });

  it('SDK and contracts agree for a custom (cluster-override) program id', async () => {
    const mint: Address = address('11111111111111111111111111111112');
    const overrideProgram = ARIO_CORE_PROGRAM_ID; // any other valid Address
    const [sdkPda] = await getAntConfigPDA(mint, overrideProgram);
    const [contractsPda] = await findAntConfigPda(
      { asset: mint },
      { programAddress: overrideProgram },
    );
    assert.equal(sdkPda, contractsPda);
  });
});

/**
 * Layout test for `_buildPrimaryNameValidationAccounts` — the single builder
 * that assembles the `remaining_accounts` slice for every ANT-auth
 * primary-name instruction (and the funding-plan variant, whose
 * `validation_account_count` is derived from this array's length). This
 * exercises the one RPC-touching path with a stub so it stays a fast unit
 * test: the stub returns a serialized `ArnsRecord` for the ArNS PDA and a
 * non-existent account for everything else (so `fetchAntProgramFromAsset`
 * returns null → the builder falls back to the configured canonical program).
 *
 * Pins the ABI ordering against ario-core PR #91: the `AntConfig` PDA must be
 * the trailing account for `requestAndSet`/`approve`, derived under the same
 * program as the `AntRecord`.
 */
const FIXTURE_ANT_MINT = address('So11111111111111111111111111111111111111112');
const FILLER_PUBKEY = address('11111111111111111111111111111112');

/** Minimal `ArnsRecord` blob matching `deserializeArnsRecord` (only `ant` /
 *  processId is asserted downstream). */
function buildArnsRecordFixture(antMint: Address): Uint8Array {
  const w = new BorshWriter(256);
  w.writeFixedBytes(Buffer.alloc(8)); // discriminator (skipped by reader)
  w.writePubkey(FILLER_PUBKEY); // name hash
  w.writePubkey(FILLER_PUBKEY); // owner
  w.writePubkey(antMint); // ant (a.k.a. processId)
  w.writeU8(1); // type = Permabuy
  w.writeI64(0); // startTimestamp
  w.writeOptionI64(undefined); // endTimestamp = None
  w.writeU16(10); // undernameLimit
  w.writeU64(0); // purchasePrice
  w.writeU8(255); // bump
  w.writeString('arweave'); // name
  // SchemaVersion { major, minor, patch }
  w.writeU8(0);
  w.writeU8(0);
  w.writeU8(0);
  return w.toBuffer();
}

/** rpc stub: ArnsRecord bytes for `arnsRecordPda`, non-existent otherwise. */
function stubRpcForArnsRecord(
  arnsRecordPda: Address,
  arnsRecordBytes: Uint8Array,
): unknown {
  const b64 = Buffer.from(arnsRecordBytes).toString('base64');
  return {
    getAccountInfo: (addr: Address) => ({
      send: async () =>
        addr === arnsRecordPda
          ? {
              value: {
                data: [b64, 'base64'] as readonly [string, string],
                lamports: 1,
                owner: ARIO_ARNS_PROGRAM_ID as string,
                executable: false,
                rentEpoch: 0,
              },
            }
          : { value: null },
    }),
  };
}

async function buildValidationAccounts(
  name: string,
  variant: 'request' | 'requestAndSet' | 'approve',
) {
  const { baseName } = splitPrimaryName(name);
  const [arnsRecordPda] = await getArnsRecordPDA(
    baseName,
    ARIO_ARNS_PROGRAM_ID,
  );
  const rpc = stubRpcForArnsRecord(
    arnsRecordPda,
    buildArnsRecordFixture(FIXTURE_ANT_MINT),
  );
  const ario = new SolanaARIOWriteable({
    rpc: rpc as never,
    rpcSubscriptions: {} as never,
    signer: {} as never,
  });
  // Private builder — reach it via index access (no public wrapper exposes
  // the raw remaining-accounts slice).
  return (
    ario as unknown as {
      _buildPrimaryNameValidationAccounts: (
        n: string,
        v: string,
      ) => Promise<{ remaining: { address: Address; role: AccountRole }[] }>;
    }
  )._buildPrimaryNameValidationAccounts(name, variant);
}

describe('_buildPrimaryNameValidationAccounts — AntConfig in remaining_accounts (PR #91 ABI)', () => {
  it('request: [arnsRecord, demandFactor] — no AntRecord/AntConfig', async () => {
    const { remaining } = await buildValidationAccounts('arweave', 'request');
    const [arns] = await getArnsRecordPDA('arweave', ARIO_ARNS_PROGRAM_ID);
    const [df] = await getDemandFactorPDA(ARIO_ARNS_PROGRAM_ID);
    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].address, arns);
    assert.equal(remaining[1].address, df);
  });

  it('requestAndSet (undername): [arnsRecord, demandFactor, antRecord, antConfig]', async () => {
    const { remaining } = await buildValidationAccounts(
      'blog_arweave',
      'requestAndSet',
    );
    const [df] = await getDemandFactorPDA(ARIO_ARNS_PROGRAM_ID);
    const [antRecord] = await getAntRecordPDA(
      FIXTURE_ANT_MINT,
      'blog',
      ARIO_ANT_PROGRAM_ID,
    );
    const [antConfig] = await getAntConfigPDA(
      FIXTURE_ANT_MINT,
      ARIO_ANT_PROGRAM_ID,
    );
    assert.equal(remaining.length, 4);
    assert.equal(remaining[1].address, df);
    assert.equal(remaining[2].address, antRecord);
    assert.equal(remaining[3].address, antConfig, 'AntConfig must be last');
    assert.equal(remaining[3].role, AccountRole.READONLY);
  });

  it('approve (undername): [arnsRecord, antRecord, antConfig]', async () => {
    const { remaining } = await buildValidationAccounts(
      'blog_arweave',
      'approve',
    );
    const [antRecord] = await getAntRecordPDA(
      FIXTURE_ANT_MINT,
      'blog',
      ARIO_ANT_PROGRAM_ID,
    );
    const [antConfig] = await getAntConfigPDA(
      FIXTURE_ANT_MINT,
      ARIO_ANT_PROGRAM_ID,
    );
    assert.equal(remaining.length, 3);
    assert.equal(remaining[1].address, antRecord);
    assert.equal(remaining[2].address, antConfig, 'AntConfig must be last');
    assert.equal(remaining[2].role, AccountRole.READONLY);
  });

  it('base name requestAndSet uses the "@" AntRecord + same-mint AntConfig', async () => {
    const { remaining } = await buildValidationAccounts(
      'arweave',
      'requestAndSet',
    );
    const [antRecordAt] = await getAntRecordPDA(
      FIXTURE_ANT_MINT,
      '@',
      ARIO_ANT_PROGRAM_ID,
    );
    const [antConfig] = await getAntConfigPDA(
      FIXTURE_ANT_MINT,
      ARIO_ANT_PROGRAM_ID,
    );
    assert.equal(remaining.length, 4);
    assert.equal(remaining[2].address, antRecordAt);
    assert.equal(remaining[3].address, antConfig);
  });
});
