/**
 * Unit tests for `SolanaARIOReadable.resolveArNSName`.
 *
 * Fast unit tests — no validator. The single RPC-touching path is driven by a
 * stub (mirroring `primary-name.test.ts`): the stub returns a serialized
 * `ArnsRecord` for the ArNS PDA and a serialized `AntRecord` for the ANT
 * record PDA, and a non-existent account for everything else. The non-existent
 * asset makes `fetchAntProgramFromAsset` return null, so resolution falls back
 * to the canonical ANT program. This exercises the real two-hop fetch (ArNS
 * record → ANT record) end to end, not a mocked seam.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, address } from '@solana/kit';
import bs58 from 'bs58';

import { getAntRecordEncoder } from '@ar.io/solana-contracts/ant';

import { Logger } from '../common/logger.js';
import { splitPrimaryName } from '../utils/arns.js';
import { ARIO_ANT_PROGRAM_ID, ARIO_ARNS_PROGRAM_ID } from './constants.js';
import { BorshWriter } from './deserialize.js';
import { SolanaARIOReadable } from './io-readable.js';
import {
  getAntRecordMetadataPDA,
  getAntRecordPDA,
  getArnsRecordPDA,
} from './pda.js';

function b58(seed: number): Address {
  return address(bs58.encode(Buffer.alloc(32, seed)));
}

const ANT_MINT = b58(7);
const FILLER = b58(3);
const TARGET_TX = 'abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEF'; // 43-char tx id
const TTL_SECONDS = 900;
const PRIORITY = 2;

/** Hand-rolled `ArnsRecord` blob matching `deserializeArnsRecord`. Mirrors the
 *  fixture in `primary-name.test.ts`; only `ant` (processId), `type` and
 *  `undernameLimit` are asserted downstream. type=1 + no endTimestamp →
 *  'permabuy'. */
function buildArnsRecordFixture(antMint: Address, name: string): Uint8Array {
  const w = new BorshWriter(256);
  w.writeFixedBytes(Buffer.alloc(8)); // discriminator (skipped by reader)
  w.writePubkey(FILLER); // name hash
  w.writePubkey(FILLER); // owner
  w.writePubkey(antMint); // ant (a.k.a. processId)
  w.writeU8(1); // type = Permabuy
  w.writeI64(0); // startTimestamp
  w.writeOptionI64(undefined); // endTimestamp = None
  w.writeU16(10); // undernameLimit
  w.writeU64(0); // purchasePrice
  w.writeU8(255); // bump
  w.writeString(name); // name
  w.writeU8(0); // SchemaVersion { major, minor, patch }
  w.writeU8(0);
  w.writeU8(0);
  return w.toBuffer();
}

function buildAntRecordFixture(mint: Address, undername: string): Uint8Array {
  return new Uint8Array(
    getAntRecordEncoder().encode({
      mint,
      undername,
      target: TARGET_TX,
      targetProtocol: 0,
      ttlSeconds: TTL_SECONDS,
      priority: PRIORITY, // OptionOrNullable<number> → Some(2)
      owner: null, // None
      lastReconciledOwner: FILLER,
      bump: 255,
      version: { major: 0, minor: 0, patch: 0 },
    }),
  );
}

function encodedAccount(bytes: Uint8Array, owner: Address) {
  return {
    data: [Buffer.from(bytes).toString('base64'), 'base64'] as readonly [
      string,
      string,
    ],
    lamports: 1,
    owner: owner as string,
    executable: false,
    rentEpoch: 0,
  };
}

/**
 * Stub rpc: ArnsRecord bytes for `arnsRecordPda` (getAccountInfo), AntRecord
 * bytes for `recordPda` (getMultipleAccounts), non-existent otherwise.
 */
function stubRpc(opts: {
  arnsRecordPda: Address;
  arnsRecordBytes: Uint8Array;
  recordPda: Address;
  recordBytes: Uint8Array | null;
}) {
  return {
    getAccountInfo: (addr: Address) => ({
      send: async () =>
        addr === opts.arnsRecordPda
          ? {
              value: encodedAccount(opts.arnsRecordBytes, ARIO_ARNS_PROGRAM_ID),
            }
          : { value: null },
    }),
    getMultipleAccounts: (addrs: Address[]) => ({
      send: async () => ({
        value: addrs.map((a) =>
          a === opts.recordPda && opts.recordBytes
            ? encodedAccount(opts.recordBytes, ARIO_ANT_PROGRAM_ID)
            : null,
        ),
      }),
    }),
  };
}

/** Build a readable whose stub rpc serves the ArNS + ANT records for `name`. */
async function makeReadable(
  name: string,
  { hasRecord = true }: { hasRecord?: boolean } = {},
) {
  const { baseName, undername } = splitPrimaryName(name);
  const undernameKey = undername ?? '@';
  const [arnsRecordPda] = await getArnsRecordPDA(
    baseName,
    ARIO_ARNS_PROGRAM_ID,
  );
  const [recordPda] = await getAntRecordPDA(
    ANT_MINT,
    undernameKey,
    ARIO_ANT_PROGRAM_ID,
  );
  // Derived so the stub never accidentally serves a record for the metadata pda.
  await getAntRecordMetadataPDA(ANT_MINT, undernameKey, ARIO_ANT_PROGRAM_ID);

  const rpc = stubRpc({
    arnsRecordPda,
    arnsRecordBytes: buildArnsRecordFixture(ANT_MINT, baseName),
    recordPda,
    recordBytes: hasRecord
      ? buildAntRecordFixture(ANT_MINT, undernameKey)
      : null,
  });

  return new SolanaARIOReadable({
    rpc: rpc as never,
    logger: new Logger({ level: 'none' }),
  });
}

describe('SolanaARIOReadable.resolveArNSName', () => {
  it('resolves an apex name to its ANT record target txId', async () => {
    const readable = await makeReadable('arweave');

    const result = await readable.resolveArNSName({ name: 'arweave' });

    assert.equal(result.txId, TARGET_TX, 'txId is the ANT record target');
    assert.equal(result.name, 'arweave');
    assert.equal(result.processId, ANT_MINT);
    assert.equal(result.type, 'permabuy');
    assert.equal(result.undernameLimit, 10);
  });

  it('returns the record TTL and priority, not hardcoded placeholders', async () => {
    const readable = await makeReadable('arweave');

    const result = await readable.resolveArNSName({ name: 'arweave' });

    assert.equal(result.ttlSeconds, TTL_SECONDS);
    assert.equal(result.priority, PRIORITY);
  });

  it('resolves an undername to its own ANT record', async () => {
    const readable = await makeReadable('logo_arweave');

    const result = await readable.resolveArNSName({ name: 'logo_arweave' });

    assert.equal(result.txId, TARGET_TX);
    assert.equal(result.name, 'logo_arweave');
  });

  it('lowercases the name so mixed-case input still resolves', async () => {
    // PDAs are derived from the lowercased name; a non-normalizing resolver
    // would derive the wrong PDA and fail to find the record.
    const readable = await makeReadable('LOGO_Arweave');

    const result = await readable.resolveArNSName({ name: 'LOGO_Arweave' });

    assert.equal(result.txId, TARGET_TX);
    assert.equal(
      result.name,
      'logo_arweave',
      'name is normalized to lowercase',
    );
  });

  it('splits on the first underscore (matches on-chain splitn(2, "_"))', async () => {
    // "a_b_c" → undername "a", base "b_c". makeReadable derives the PDAs with
    // that split; if the resolver split differently it would miss the record.
    const readable = await makeReadable('a_b_c');

    const result = await readable.resolveArNSName({ name: 'a_b_c' });

    assert.equal(result.txId, TARGET_TX);
  });

  it('throws when the undername has no record on the ANT', async () => {
    const readable = await makeReadable('missing_arweave', {
      hasRecord: false,
    });

    await assert.rejects(
      () => readable.resolveArNSName({ name: 'missing_arweave' }),
      /missing_arweave/,
    );
  });
});
