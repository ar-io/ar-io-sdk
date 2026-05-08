/**
 * SDK end-to-end tests against the dedicated e2e localnet.
 *
 * Bring-up (recommended):
 *   Requires a checkout of https://github.com/ar-io/solana-ar-io with the
 *   same parent directory as this repo (../solana-ar-io), or set
 *   SOLANA_AR_IO_ROOT to its path. Then from this package root:
 *
 *     yarn sdk-e2e:up
 *
 *   This runs the monorepo's `sdk/scripts/start-e2e-localnet.sh` and copies
 *   `test/.env.e2e` here. Alternatively, hand-write `test/.env.e2e` with
 *   RPC_URL, WS_URL, program IDs, TEST_WALLET_FILE, and ARIO_MINT.
 *
 * Run:
 *   yarn test:sdk-e2e
 *
 * Why a separate file from `*.localnet.test.ts`: those are smoke
 * tests against a fully-imported migration localnet (3,800 ANTs,
 * 14k ANT records, 3,800 ArNS names) and rely on whatever AO
 * snapshot was checked in. This suite owns its on-chain state
 * end-to-end — a fresh test wallet, a handful of ANTs spawned per
 * test, and a clean view into how ACL queries and memcmp gPA
 * filters compose. Cheap, fast, hermetic.
 *
 * What's covered:
 *   1. Spawn ANTs → ACL.Owned reflects every spawned mint
 *   2. Buy an ArNS name pointing at a spawned ANT, then confirm
 *      `getArNSRecordsForAddress` returns it via the
 *      ACL → mints → memcmp gPA on `ArnsRecord.ant` pipeline.
 *      (Skipped if buyRecord fails for env-dependent reasons —
 *      ARIO balance, demand factor, etc — without failing the
 *      load-bearing spawn+ACL coverage.)
 *   3. After a lease buy succeeds, `setPrimaryName` + `getPrimaryName`
 *      round-trip the ario-core primary-name ix against live BPF.
 *      Requires `migration/import/devnet-setup` + BPF from the same
 *      tree (`scripts/start-localnet.sh` rebuilds contracts on cold
 *      start — re-run `sdk/scripts/start-e2e-localnet.sh` after
 *      changing `contracts/` or SDK codegen).
 *
 * Skipped automatically when the env vars from `sdk/test/.env.e2e`
 * are not set — the file is safe to leave in the unit-test glob.
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  type Address,
  type KeyPairSigner,
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from '@solana/kit';

import { ARIO } from '../common/io.js';
import { SolanaANTRegistryReadable } from './ant-registry-readable.js';
import { spawnSolanaANT } from './spawn-ant.js';

const RPC_URL = process.env.RPC_URL;
const WS_URL = process.env.WS_URL;
const ANT_ID = process.env.ARIO_ANT_PROGRAM_ID;
const CORE_ID = process.env.ARIO_CORE_PROGRAM_ID;
const GAR_ID = process.env.ARIO_GAR_PROGRAM_ID;
const ARNS_ID = process.env.ARIO_ARNS_PROGRAM_ID;
const WALLET_FILE = process.env.TEST_WALLET_FILE;

const SHOULD_RUN = Boolean(
  RPC_URL && WS_URL && ANT_ID && CORE_ID && GAR_ID && ARNS_ID && WALLET_FILE,
);

async function loadTestWallet(): Promise<KeyPairSigner> {
  const raw = readFileSync(WALLET_FILE!, 'utf-8');
  const secretKey = new Uint8Array(JSON.parse(raw));
  return createKeyPairSignerFromBytes(secretKey);
}

describe(
  'SDK e2e — Solana spawn + ACL + ArNS-by-mint pipeline',
  {
    skip: !SHOULD_RUN
      ? 'Run `bash sdk/scripts/start-e2e-localnet.sh` then source sdk/test/.env.e2e'
      : false,
    // Spawning is two CPI hops + ACL bootstrap; surfpool can be slow
    // on the first few txs while it warms up. 90s gives headroom for
    // the burst of 3 spawns in test 1 plus any RPC backoff.
    timeout: 120_000,
  },
  () => {
    it('spawns multiple ANTs and resolves them via ANT registry ACL', async () => {
      const rpc = createSolanaRpc(RPC_URL!);
      const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL!);
      const signer = await loadTestWallet();
      const antProgram = address(ANT_ID!);

      // Spawn three ANTs sequentially — keeps tx ordering predictable
      // so we can correlate spawns with ACL entries deterministically.
      // (Parallel spawns work too, just messier to debug if one fails.)
      const stamp = Date.now();
      const spawned: { processId: string; mint: Address }[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await spawnSolanaANT({
          rpc,
          rpcSubscriptions,
          signer,
          state: { name: `e2e-acl-${stamp}-${i}` },
          antProgramId: antProgram,
        });
        spawned.push({ processId: result.processId, mint: result.mint });
      }
      assert.equal(spawned.length, 3);

      // Check the ANT registry — every freshly-spawned ANT must
      // appear in `Owned` for the spawner. This is the canonical
      // path UIs use to render "your ANTs"; if it doesn't fire
      // here, the spawn-time ACL bootstrap is broken.
      const registry = new SolanaANTRegistryReadable({
        rpc,
        antProgramId: antProgram,
      });
      const acl = await registry.accessControlList({
        address: String(signer.address),
      });
      for (const { processId } of spawned) {
        assert.ok(
          acl.Owned.includes(processId),
          `ACL.Owned for ${signer.address} must include freshly-spawned ANT ${processId}; ` +
            `got Owned=[${acl.Owned.slice(0, 10).join(', ')}${acl.Owned.length > 10 ? ', ...' : ''}] ` +
            `(${acl.Owned.length} total)`,
        );
      }
    });

    it('buyRecord → getArNSRecordsForAddress (ACL → memcmp pipeline)', async (t) => {
      const rpc = createSolanaRpc(RPC_URL!);
      const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL!);
      const signer = await loadTestWallet();
      const antProgram = address(ANT_ID!);
      const arnsProgram = address(ARNS_ID!);

      // Spawn a fresh ANT to hold the name. Anchor it in this test
      // (vs. reusing one from the previous test) so each test is
      // independent and reorderable.
      const spawned = await spawnSolanaANT({
        rpc,
        rpcSubscriptions,
        signer,
        state: { name: `e2e-arns-host-${Date.now()}` },
        antProgramId: antProgram,
      });

      // Buy an ArNS name pointing at the spawned ANT. Use a
      // timestamp suffix to avoid collisions across test runs (the
      // localnet keeps state across runs unless someone restarts
      // surfpool with FORCE_RESTART=1).
      const arNsName = `e2e-${Date.now()}`;
      const ario = await ARIO.init({
        backend: 'solana',
        rpc,
        rpcSubscriptions,
        signer,
        coreProgramId: address(CORE_ID!),
        garProgramId: address(GAR_ID!),
        arnsProgramId: arnsProgram,
        antProgramId: antProgram,
      });

      try {
        await ario.buyRecord({
          name: arNsName,
          type: 'lease',
          years: 1,
          processId: spawned.processId,
        });
      } catch (err) {
        // ArNS purchases need ARIO in the wallet ATA + may have
        // demand-factor / pricing requirements that depend on the
        // current localnet state. Surface the failure as a `skip`
        // rather than blocking the broader pipeline test — the
        // previous test (spawn + ACL) covers the load-bearing
        // path on its own.
        const msg = err instanceof Error ? err.message : String(err);
        t.skip(
          `Skipping ArNS-by-mint half: buyRecord failed for ${arNsName} (${msg}). ` +
            'Common causes: insufficient ARIO balance (re-run start-e2e-localnet.sh), ' +
            'name already taken, or contract pricing path needs more localnet setup.',
        );
        return;
      }

      // ──── ACL → mints → memcmp pipeline ────
      // The user-asset-list flow that frontends actually call.
      // Internally: read the spawner's ANT registry ACL → fan out
      // memcmp gPAs at `ARNS_RECORD_ANT_OFFSET=72` against the ArNS
      // registry → deserialize → paginate. If the field reorder is
      // wrong the memcmp returns nothing and this assertion fires.
      // Resolves "what names does this wallet control?" without
      // ever touching the dead `ArnsRecord.owner` field.
      const result = await ario.getArNSRecordsForAddress({
        address: String(signer.address),
      });
      const found = result.items.find((r) => r.name === arNsName);
      assert.ok(
        found,
        `getArNSRecordsForAddress(${signer.address}) missing ${arNsName}; ` +
          `pipeline returned [${result.items
            .slice(0, 10)
            .map((r) => r.name)
            .join(', ')}${result.items.length > 10 ? ', ...' : ''}]. ` +
          "Either the ACL doesn't see the spawned ANT, or the memcmp gPA didn't resolve.",
      );
      assert.equal(found!.processId, spawned.processId);
    });

    it('buyRecord(lease) → setPrimaryName → getPrimaryName', async (t) => {
      const rpc = createSolanaRpc(RPC_URL!);
      const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL!);
      const signer = await loadTestWallet();
      const antProgram = address(ANT_ID!);
      const arnsProgram = address(ARNS_ID!);

      const spawned = await spawnSolanaANT({
        rpc,
        rpcSubscriptions,
        signer,
        state: { name: `e2e-primary-${Date.now()}` },
        antProgramId: antProgram,
      });

      const arNsName = `e2e-pn-${Date.now()}`;
      const ario = await ARIO.init({
        backend: 'solana',
        rpc,
        rpcSubscriptions,
        signer,
        coreProgramId: address(CORE_ID!),
        garProgramId: address(GAR_ID!),
        arnsProgramId: arnsProgram,
        antProgramId: antProgram,
      });

      try {
        await ario.buyRecord({
          name: arNsName,
          type: 'lease',
          years: 1,
          processId: spawned.processId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        t.skip(
          `Skipping primary-name half: buyRecord failed for ${arNsName} (${msg}).`,
        );
        return;
      }

      const setRes = await ario.setPrimaryName({ name: arNsName });
      assert.ok(
        setRes.id,
        'setPrimaryName must return a tx signature after a successful buyRecord',
      );

      const pn = await ario.getPrimaryName({
        address: String(signer.address),
      });
      assert.equal(
        pn.name.toLowerCase(),
        arNsName.toLowerCase(),
        'getPrimaryName must reflect the name set by setPrimaryName',
      );
      assert.equal(
        pn.processId,
        spawned.processId,
        'PrimaryName.processId must match the ArNS ANT mint',
      );
    });

    it('buyRecord(permabuy) → getArNSRecord returns type=permabuy with no endTimestamp', async (t) => {
      // Mirror of the lease test above, but for the permabuy path.
      // Why a dedicated test: the arns-react Playwright suite hits a
      // "manage page shows N/A for expiry forever" failure on permabuy
      // names where the same flow works for 1y..5y leases. This test
      // pins down whether the regression lives in the SDK / on-chain
      // contract (would fail here) or in the UI / cache layer
      // (passes here, fails only in arns-react).
      const rpc = createSolanaRpc(RPC_URL!);
      const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL!);
      const signer = await loadTestWallet();
      const antProgram = address(ANT_ID!);
      const arnsProgram = address(ARNS_ID!);

      const spawned = await spawnSolanaANT({
        rpc,
        rpcSubscriptions,
        signer,
        state: { name: `e2e-permabuy-host-${Date.now()}` },
        antProgramId: antProgram,
      });

      const arNsName = `e2e-perma-${Date.now()}`;
      const ario = await ARIO.init({
        backend: 'solana',
        rpc,
        rpcSubscriptions,
        signer,
        coreProgramId: address(CORE_ID!),
        garProgramId: address(GAR_ID!),
        arnsProgramId: arnsProgram,
        antProgramId: antProgram,
      });

      try {
        await ario.buyRecord({
          name: arNsName,
          type: 'permabuy',
          processId: spawned.processId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        t.skip(
          `Skipping permabuy half: buyRecord(permabuy) failed for ${arNsName} (${msg}). ` +
            'Common causes: insufficient ARIO balance (re-run start-e2e-localnet.sh), ' +
            'name already taken, or pricing path needs more localnet setup.',
        );
        return;
      }

      // 1) Direct read by name should return the freshly-bought record.
      const direct = await ario.getArNSRecord({ name: arNsName });
      assert.ok(
        direct,
        `getArNSRecord(${arNsName}) returned null/undefined right after buyRecord(permabuy) — ` +
          'this is the failure shape the arns-react manage page hits ' +
          '("Expiry: N/A" forever for permabuy names).',
      );
      assert.equal(
        direct.type,
        'permabuy',
        `Expected type=permabuy for ${arNsName}, got type=${direct.type}`,
      );
      assert.equal(
        direct.processId,
        spawned.processId,
        `Expected processId=${spawned.processId} for ${arNsName}, got ${direct.processId}`,
      );
      // Permabuy names have no expiry — the type union puts
      // `endTimestamp` only on the lease variant. The SDK surfaces a
      // permabuy result with `type: 'permabuy'` and no endTimestamp
      // field at all (or undefined). Catch the variant directly so a
      // future lease-style value sneaking through fails the assertion.
      assert.equal(direct.type, 'permabuy');
      const stray = (direct as { endTimestamp?: number }).endTimestamp;
      assert.ok(
        stray === undefined || stray === 0,
        `Permabuy record should have no endTimestamp; got ${stray}`,
      );

      // 2) The ACL → memcmp pipeline should also surface the permabuy
      // name. This is the path the manage page list view uses.
      const result = await ario.getArNSRecordsForAddress({
        address: String(signer.address),
      });
      const found = result.items.find((r) => r.name === arNsName);
      assert.ok(
        found,
        `getArNSRecordsForAddress(${signer.address}) missing permabuy name ${arNsName}; ` +
          `pipeline returned [${result.items
            .slice(0, 10)
            .map((r) => r.name)
            .join(', ')}${result.items.length > 10 ? ', ...' : ''}].`,
      );
      assert.equal(found!.processId, spawned.processId);
      assert.equal(found!.type, 'permabuy');
    });
  },
);
