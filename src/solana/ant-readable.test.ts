import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { address } from '@solana/kit';
import bs58 from 'bs58';

import { Logger } from '../common/logger.js';
import { SolanaANTReadable } from './ant-readable.js';

/**
 * These tests assert the *request shape* of the batched ANT reads — i.e. how
 * many RPC round trips each method issues — using a call-counting stub rpc.
 * The stub returns "account does not exist" for everything, so the methods
 * resolve empty (or throw on a required-but-missing account), but the call
 * counts are exactly what we care about for the batching work.
 */
type Counts = { gpa: number; gai: number; gma: number; gmaAccts: number };

function countingRpc(counts: Counts) {
  return {
    // getProgramAccounts (used by getRecords)
    getProgramAccounts: () => ({
      send: async () => {
        counts.gpa++;
        return [];
      },
    }),
    // getAccountInfo (single-account fetchEncodedAccount)
    getAccountInfo: () => ({
      send: async () => {
        counts.gai++;
        return { value: null };
      },
    }),
    // getMultipleAccounts (batched fetchEncodedAccounts)
    getMultipleAccounts: (addrs: unknown[]) => ({
      send: async () => {
        counts.gma++;
        counts.gmaAccts += addrs.length;
        return { value: addrs.map(() => null) };
      },
    }),
  };
}

// Deterministic, distinct 32-byte base58 mints (valid addresses; not on-curve
// is fine — we never hit the network).
function mint(n: number): string {
  return bs58.encode(Buffer.alloc(32, n));
}

function makeAnt(counts: Counts, processId: string) {
  return new SolanaANTReadable({
    // biome-ignore lint/suspicious/noExplicitAny: minimal stub rpc for counting
    rpc: countingRpc(counts) as any,
    processId,
    logger: new Logger({ level: 'none' }),
  });
}

describe('SolanaANTReadable request batching', () => {
  it('getANTSummaries batches 3 PDAs/mint into ceil(3N/100) getMultipleAccounts calls', async () => {
    const counts: Counts = { gpa: 0, gai: 0, gma: 0, gmaAccts: 0 };
    const ant = makeAnt(counts, mint(1));

    const mints = Array.from({ length: 10 }, (_, i) => mint(i + 1));
    const summaries = await ant.getANTSummaries(mints);

    // 10 mints × 3 PDAs (config + controllers + apex) = 30 ≤ 100 → 1 batch.
    assert.equal(counts.gma, 1, 'one getMultipleAccounts call for 10 mints');
    assert.equal(counts.gmaAccts, 30, '30 accounts requested in the batch');
    assert.equal(counts.gpa, 0, 'no getProgramAccounts (no record scans)');
    assert.equal(counts.gai, 0, 'no single-account reads');
    // All stubbed as non-existent → empty result.
    assert.deepEqual(summaries, {});
  });

  it('getANTSummaries chunks >100 accounts across multiple calls', async () => {
    const counts: Counts = { gpa: 0, gai: 0, gma: 0, gmaAccts: 0 };
    const ant = makeAnt(counts, mint(1));

    const mints = Array.from({ length: 40 }, (_, i) => mint(i + 1));
    await ant.getANTSummaries(mints);

    // 40 × 3 = 120 PDAs → ceil(120/100) = 2 getMultipleAccounts calls.
    assert.equal(counts.gma, 2);
    assert.equal(counts.gmaAccts, 120);
  });

  it('getANTStates loads N ANTs in ceil(2N/100) batches + 1 program-wide record scan', async () => {
    const counts: Counts = { gpa: 0, gai: 0, gma: 0, gmaAccts: 0 };
    const ant = makeAnt(counts, mint(1));

    const mints = Array.from({ length: 10 }, (_, i) => mint(i + 1));
    await ant.getANTStates(mints);

    // 10 mints × 2 (config + controllers) = 20 ≤ 100 → 1 getMultipleAccounts.
    assert.equal(counts.gma, 1, 'config+controllers in one batch');
    assert.equal(counts.gmaAccts, 20);
    // One program-wide getProgramAccounts for records (metadata skipped).
    assert.equal(counts.gpa, 1, 'single grouped record scan for all mints');
  });

  it('getANTStates chunks config+controllers but keeps one record scan', async () => {
    const counts: Counts = { gpa: 0, gai: 0, gma: 0, gmaAccts: 0 };
    const ant = makeAnt(counts, mint(1));

    const mints = Array.from({ length: 60 }, (_, i) => mint(i + 1));
    await ant.getANTStates(mints);

    // 60 × 2 = 120 PDAs → 2 getMultipleAccounts; still ONE record scan.
    assert.equal(counts.gma, 2);
    assert.equal(counts.gpa, 1);
  });

  it('getRecords skips the metadata scan by default (1 gPA), includes it on request (2)', async () => {
    const counts: Counts = { gpa: 0, gai: 0, gma: 0, gmaAccts: 0 };
    const ant = makeAnt(counts, mint(1));

    await ant.getRecords();
    assert.equal(counts.gpa, 1, 'records only — metadata scan skipped');

    counts.gpa = 0;
    await ant.getRecords({ includeMetadata: true });
    assert.equal(counts.gpa, 2, 'records + metadata scans');
  });

  it('getState batches config+controllers into one getMultipleAccounts (not two reads)', async () => {
    const counts: Counts = { gpa: 0, gai: 0, gma: 0, gmaAccts: 0 };
    const ant = makeAnt(counts, mint(1));

    // Config account is required → getState rejects on the missing-account
    // stub, but the batched read has already fired by then.
    await assert.rejects(() => ant.getState());
    assert.equal(counts.gma, 1, 'config + controllers fetched in one batch');
    assert.equal(counts.gmaAccts, 2);
    assert.equal(counts.gpa, 1, 'records scanned once (metadata skipped)');
    assert.equal(counts.gai, 0, 'no single-account reads');
  });
});

// ---------------------------------------------------------------------------
// Chunk ordering under bounded concurrency
//
// getANTSummaries and getANTStates read each mint's accounts POSITIONALLY out
// of the flattened batch result (`accounts[i * 3]`, `accounts[i * 2]`). Once
// the 100-account chunks stopped being awaited one-at-a-time, chunk completion
// order stopped matching request order — so if the flattening ever followed
// completion order instead of input order, one ANT's config would silently be
// attributed to another mint. These tests make the chunks finish out of order
// on purpose and assert every mint still gets its own data back.
// ---------------------------------------------------------------------------

const antMint = (n: number) => bs58.encode(Buffer.alloc(32, n));

/**
 * Stub whose chunk responses resolve in REVERSE order (the later the chunk,
 * the sooner it settles), and which echoes the requested PDA back so each
 * decoded account can be traced to the mint it was derived from.
 */
function outOfOrderChunkRpc(
  counts: { gma: number },
  configFor: (pda: string) => unknown | null,
) {
  let chunkIndex = 0;
  return {
    getProgramAccounts: () => ({ send: async () => [] }),
    getAccountInfo: () => ({ send: async () => ({ value: null }) }),
    getMultipleAccounts: (addrs: unknown[]) => {
      const myIndex = chunkIndex++;
      return {
        send: async () => {
          counts.gma++;
          // Later chunks return first.
          await new Promise((r) =>
            setTimeout(r, Math.max(0, 30 - myIndex * 10)),
          );
          return {
            value: (addrs as string[]).map((a) => configFor(a)),
          };
        },
      };
    },
  };
}

describe('ANT bulk reads — chunk ordering', () => {
  it('keeps each mint matched to its own accounts across several chunks', async () => {
    // 60 mints x 3 PDAs = 180 accounts = 2 chunks of <=100.
    const mints = Array.from({ length: 60 }, (_, i) => antMint(i + 1));
    const counts = { gma: 0 };

    // Map every derived PDA back to its owning mint so we can detect a
    // cross-wired result rather than merely a missing one.
    const { getAntConfigPDA, getAntControllersPDA, getAntRecordPDA } =
      await import('./pda.js');
    const { ARIO_ANT_PROGRAM_ID } = await import('./constants.js');
    const pdaToMint = new Map<string, { mint: string; kind: string }>();
    for (const m of mints) {
      const mintAddr = address(m);
      const [cfg] = await getAntConfigPDA(mintAddr, ARIO_ANT_PROGRAM_ID);
      const [ctrl] = await getAntControllersPDA(mintAddr, ARIO_ANT_PROGRAM_ID);
      const [apex] = await getAntRecordPDA(mintAddr, '@', ARIO_ANT_PROGRAM_ID);
      pdaToMint.set(String(cfg), { mint: m, kind: 'config' });
      pdaToMint.set(String(ctrl), { mint: m, kind: 'controllers' });
      pdaToMint.set(String(apex), { mint: m, kind: 'apex' });
    }

    const { getAntConfigEncoder, getAntControllersEncoder } = await import(
      '@ar.io/solana-contracts/ant'
    );
    const cfgEncoder = getAntConfigEncoder();
    const ctrlEncoder = getAntControllersEncoder();
    const wrap = (bytes: Uint8Array) => ({
      data: [Buffer.from(bytes).toString('base64'), 'base64'],
      executable: false,
      lamports: 1n,
      owner: address(mints[0]),
      rentEpoch: 0n,
      space: BigInt(bytes.length),
    });

    /** Return the account type that actually belongs at each derived PDA. */
    const configFor = (pda: string) => {
      const entry = pdaToMint.get(pda);
      if (!entry) return null;
      const mintStr = entry.mint;
      if (entry.kind === 'apex') return null; // apex record is optional
      if (entry.kind === 'controllers')
        return wrap(
          ctrlEncoder.encode({
            mint: address(mintStr),
            controllers: [],
            bump: 255,
            version: { major: 1, minor: 0, patch: 0 },
          }) as Uint8Array,
        );
      // The name encodes its mint, so a cross-wired result is visible.
      return wrap(
        cfgEncoder.encode({
          mint: address(mintStr),
          name: `name-for-${mintStr.slice(0, 8)}`,
          ticker: 'ANT',
          logo: '',
          description: '',
          keywords: [],
          lastKnownOwner: address(mintStr),
          bump: 255,
          version: { major: 1, minor: 0, patch: 0 },
        }) as Uint8Array,
      );
    };

    const ant = new SolanaANTReadable({
      rpc: outOfOrderChunkRpc(counts, configFor) as never,
      processId: mints[0],
      logger: new Logger({ level: 'none' }),
    });

    const summaries = await ant.getANTSummaries(mints);

    assert.ok(counts.gma >= 2, 'should have taken more than one chunk');
    assert.equal(
      Object.keys(summaries).length,
      60,
      'every mint should be present',
    );
    for (const m of mints) {
      assert.equal(
        summaries[m]?.name,
        `name-for-${m.slice(0, 8)}`,
        `mint ${m.slice(0, 8)} got another mint's config — chunks were flattened in completion order`,
      );
    }
  });
});
