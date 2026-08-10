/**
 * Unit tests for `SolanaARIOReadable.getPruneableToReturnedRecords`.
 *
 * This helper selects a BAND, not a threshold: leases past their grace period
 * but still inside their return-auction window. Both edges matter.
 *
 *   |<-- active -->|<-- grace 14d -->|<-- auction 14d -->|<-- past auction -->|
 *                                    ^^^^^^^^^^^^^^^^^^^
 *                                    only this band qualifies
 *
 * Getting the upper edge wrong is the expensive mistake: feeding a past-auction
 * record to `prune_name_to_returned` mints it a *fresh* 50x-premium auction it
 * is not entitled to, instead of closing it via `prune_expired_names`.
 *
 * Unlike the helpers in prune-discovery.test.ts, this one needs a two-step rpc
 * dance (ArnsConfig fetch for grace/auction, then the record scan), so the stub
 * below answers both getAccountInfo and getProgramAccounts.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address } from '@solana/kit';

import {
  PurchaseType,
  getArnsConfigEncoder,
  getArnsRecordEncoder,
} from '@ar.io/solana-contracts/arns';
import { SolanaARIOReadable } from './io-readable.js';

const PUBKEY_1 = 'GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
const PUBKEY_2 = 'GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address;
const PUBKEY_3 = 'GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as Address;
const OWNER = '11111111111111111111111111111111' as Address;

const VERSION = { major: 1, minor: 0, patch: 0 };
const DAY = 86_400;
const GRACE = 14 * DAY;
const AUCTION = 14 * DAY;

function configBytes(): Uint8Array {
  return getArnsConfigEncoder().encode({
    authority: OWNER,
    mint: OWNER,
    treasury: OWNER,
    gracePeriodSeconds: GRACE,
    returnAuctionDurationSeconds: AUCTION,
    maxLeaseLengthYears: 5,
    totalNamesRegistered: 0,
    nextRecordsPruneTimestamp: 0,
    nextReturnedNamesPruneTimestamp: 0,
    migrationActive: false,
    migrationAuthority: OWNER,
    bump: 255,
    version: VERSION,
  }) as Uint8Array;
}

/** A lease record ending at `end`, or a permabuy when `end` is null. */
function recordBytes(name: string, end: number | null): Uint8Array {
  return getArnsRecordEncoder().encode({
    nameHash: new Uint8Array(32),
    owner: OWNER,
    ant: OWNER,
    purchaseType: end === null ? PurchaseType.Permabuy : PurchaseType.Lease,
    startTimestamp: 0,
    endTimestamp: end === null ? null : end,
    undernameLimit: 10,
    purchasePrice: 0,
    bump: 255,
    name,
    version: VERSION,
  }) as Uint8Array;
}

/** Stub rpc answering the config fetch AND the record scan. */
function stubRpc(rows: Array<{ pubkey: Address; bytes: Uint8Array }>): unknown {
  const cfg = Buffer.from(configBytes()).toString('base64');
  return {
    getAccountInfo: () => ({
      send: async () => ({
        value: {
          data: [cfg, 'base64'] as readonly [string, string],
          executable: false,
          lamports: 1_000_000n,
          owner: OWNER,
          rentEpoch: 0n,
          space: BigInt(configBytes().length),
        },
      }),
    }),
    getProgramAccounts: () => ({
      send: async () =>
        rows.map(({ pubkey, bytes }) => ({
          pubkey,
          account: {
            data: [
              Buffer.from(bytes).toString('base64'),
              'base64',
            ] as readonly [string, string],
          },
        })),
    }),
  };
}

function reader(rows: Array<{ pubkey: Address; bytes: Uint8Array }>) {
  return new SolanaARIOReadable({ rpc: stubRpc(rows) } as never);
}

describe('getPruneableToReturnedRecords — band selection', () => {
  const NOW = 1_000_000_000;

  it('includes a lease past grace but still inside the auction window', async () => {
    // ended GRACE + 1 day ago → 13 days of auction window left
    const end = NOW - GRACE - DAY;
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('inband', end) },
    ]).getPruneableToReturnedRecords(NOW);
    assert.equal(r.length, 1);
    assert.equal(r[0].name, 'inband');
    assert.equal(r[0].pubkey, PUBKEY_1);
  });

  it('excludes a lease past grace+auction (belongs to prune_expired_names)', async () => {
    // This is the expensive false positive: pruning it to returned would mint
    // an unearned 50x auction instead of closing the record.
    const end = NOW - GRACE - AUCTION - DAY;
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('pastauction', end) },
    ]).getPruneableToReturnedRecords(NOW);
    assert.deepEqual(r, []);
  });

  it('excludes a lease still inside its grace period', async () => {
    const end = NOW - DAY; // expired 1d ago, owner can still extend
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('ingrace', end) },
    ]).getPruneableToReturnedRecords(NOW);
    assert.deepEqual(r, []);
  });

  it('excludes an active (unexpired) lease', async () => {
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('active', NOW + 30 * DAY) },
    ]).getPruneableToReturnedRecords(NOW);
    assert.deepEqual(r, []);
  });

  it('excludes permabuy records, which never expire', async () => {
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('permabuy', null) },
    ]).getPruneableToReturnedRecords(NOW);
    assert.deepEqual(r, []);
  });

  it('is inclusive at the grace edge and exclusive at the auction edge', async () => {
    // exactly at end+grace  → eligible (end + grace <= now)
    // exactly at end+grace+auction → NOT eligible (now < end + grace + auction)
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('graceEdge', NOW - GRACE) },
      {
        pubkey: PUBKEY_2,
        bytes: recordBytes('auctionEdge', NOW - GRACE - AUCTION),
      },
    ]).getPruneableToReturnedRecords(NOW);
    assert.deepEqual(
      r.map((x) => x.name),
      ['graceEdge'],
    );
  });

  it('returns every in-band record and skips undecodable rows', async () => {
    const end = NOW - GRACE - DAY;
    const r = await reader([
      { pubkey: PUBKEY_1, bytes: recordBytes('a', end) },
      { pubkey: PUBKEY_2, bytes: new Uint8Array([1, 2, 3]) }, // garbage
      { pubkey: PUBKEY_3, bytes: recordBytes('b', end) },
    ]).getPruneableToReturnedRecords(NOW);
    assert.deepEqual(
      r.map((x) => x.name),
      ['a', 'b'],
    );
  });
});
