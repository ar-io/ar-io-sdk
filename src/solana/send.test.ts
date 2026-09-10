import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { address, generateKeyPairSigner } from '@solana/kit';
import { reclaimLookupTablesForSigner, sendAndConfirm } from './send.js';

/**
 * A blockhash is only valid for ~150 blocks (~60s) from ISSUE, not from send.
 * `sendAndConfirm` right-sizes the compute-unit limit with a full
 * `simulateTransaction` round trip, so taking the lifetime blockhash before
 * that simulation hands the signed transaction a window already partly spent.
 * On mainnet this expired an observer's `save_observations` by exactly one
 * block, losing that epoch's observation and reward.
 *
 * These tests pin the ordering: the blockhash that ends up on the signed
 * message must be fetched AFTER the simulation.
 */

const MEMO = address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Two distinct, valid-looking blockhashes so we can tell which one was used.
const BLOCKHASH_BEFORE_SIM = '11111111111111111111111111111111';
const BLOCKHASH_AFTER_SIM = '22222222222222222222222222222222';

function makeRpc() {
  const calls: string[] = [];
  let blockhashCalls = 0;
  return {
    calls,
    rpc: {
      getLatestBlockhash: () => ({
        send: async () => {
          calls.push('getLatestBlockhash');
          blockhashCalls++;
          return {
            value: {
              blockhash:
                blockhashCalls === 1
                  ? BLOCKHASH_BEFORE_SIM
                  : BLOCKHASH_AFTER_SIM,
              lastValidBlockHeight: 100n,
            },
          };
        },
      }),
      simulateTransaction: () => ({
        send: async () => {
          calls.push('simulateTransaction');
          return { value: { err: null, unitsConsumed: 5000n, logs: [] } };
        },
      }),
      getRecentPrioritizationFees: () => ({
        send: async () => {
          calls.push('getRecentPrioritizationFees');
          return [];
        },
      }),
    } as never,
  };
}

async function runSend(rpc: never) {
  const signer = await generateKeyPairSigner();
  // No real network: the confirmation factory needs subscriptions, so it throws
  // and we assert on what happened up to that point.
  await assert.rejects(
    sendAndConfirm({
      rpc,
      rpcSubscriptions: undefined as never,
      signer,
      instructions: [
        { programAddress: MEMO, accounts: [], data: new Uint8Array([1]) },
      ],
    }),
  );
}

describe('sendAndConfirm blockhash lifetime', () => {
  it('fetches the signing blockhash AFTER the compute-unit simulation', async () => {
    const { rpc, calls } = makeRpc();
    await runSend(rpc);

    const firstSim = calls.indexOf('simulateTransaction');
    assert.ok(firstSim >= 0, 'expected a simulateTransaction call');

    const blockhashAfterSim = calls
      .slice(firstSim)
      .indexOf('getLatestBlockhash');
    assert.ok(
      blockhashAfterSim >= 0,
      `expected a getLatestBlockhash after simulateTransaction, got order: ${calls.join(' -> ')}`,
    );
  });

  it('still fetches a blockhash before simulating (the message must compile)', async () => {
    const { rpc, calls } = makeRpc();
    await runSend(rpc);

    const firstBlockhash = calls.indexOf('getLatestBlockhash');
    const firstSim = calls.indexOf('simulateTransaction');
    assert.ok(
      firstBlockhash >= 0 && firstBlockhash < firstSim,
      `expected a getLatestBlockhash before simulateTransaction, got order: ${calls.join(' -> ')}`,
    );
  });

  it('does not re-fetch when no simulation runs (autoComputeUnitLimit off)', async () => {
    const { rpc, calls } = makeRpc();
    const signer = await generateKeyPairSigner();
    await assert.rejects(
      sendAndConfirm({
        rpc,
        rpcSubscriptions: undefined as never,
        signer,
        instructions: [
          { programAddress: MEMO, accounts: [], data: new Uint8Array([1]) },
        ],
        autoComputeUnitLimit: false,
      }),
    );

    // NB: a `simulateTransaction` still shows up here — `logSimulationDiagnostics`
    // re-simulates in the catch block once the send fails. What matters is that
    // no SECOND blockhash was fetched: with sizing off, nothing consumed the
    // validity window before signing, so the extra round trip is pure cost.
    assert.equal(
      calls.filter((c) => c === 'getLatestBlockhash').length,
      1,
      `expected exactly one blockhash fetch, got order: ${calls.join(' -> ')}`,
    );
  });
});

/**
 * `reclaimLookupTablesForSigner` discovers the ephemeral ALTs it should clean
 * up by replaying the signer's own transaction history. Two separate hazards
 * meet in that one read.
 *
 * 1. Solana's transaction-v1 rollout (SIMD-0296 size ceiling, SIMD-0385
 *    format, mainnet at epoch 1035). `getTransaction` answers a client that
 *    declares only `maxSupportedTransactionVersion: 0` with JSON-RPC -32015
 *    for every v1 transaction in range.
 * 2. What the scan does when a read fails. Reporting zero reclaimable tables
 *    because the RPC was rate-limiting is indistinguishable from "nothing to
 *    clean up", and hides unreclaimed rent indefinitely — the same
 *    phantom-empty failure fixed in funding-source discovery, whose ruling
 *    was that being told zero when the truth is unknown is never acceptable.
 *
 * So: transient failures are retried and then SURFACED; only a permanently
 * unreadable single signature is skipped, and it is logged when it is.
 */

// Valid base58 addresses; the stub RPC only ever compares them as strings.
const TABLE_A = 'AddressLookupTab1e1111111111111111111111111';
const TABLE_B = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/** Permanent for one signature: this client cannot decode that version. */
const V1_UNSUPPORTED = Object.assign(
  new Error(
    'Transaction version (1) is not supported by the requesting client. ' +
      'Please try the request again with the following configuration ' +
      'parameter: "maxSupportedTransactionVersion": 1',
  ),
  { code: -32015 },
);

/** Transient: exactly what a public RPC returns under a 500-signature scan. */
const RATE_LIMITED = new Error('HTTP error (429): Too Many Requests');

/** Keep the retry backoff out of the test runtime. */
const FAST_RETRY = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 };

/** A `getTransaction` response carrying one address-table lookup. */
function txWithTable(accountKey: string) {
  return {
    transaction: { message: { addressTableLookups: [{ accountKey }] } },
  };
}

/**
 * Stub RPC. A `transactions` entry may be a value, an Error to throw, or a
 * function of the attempt number so a test can fail once and then succeed.
 */
function makeReclaimRpc(transactions: Record<string, unknown>) {
  const configs: Record<string, unknown>[] = [];
  const attempts: Record<string, number> = {};
  const signatures = Object.keys(transactions);
  return {
    configs,
    attempts,
    rpc: {
      getSignaturesForAddress: () => ({
        send: async () => signatures.map((signature) => ({ signature })),
      }),
      getTransaction: (signature: string, config: Record<string, unknown>) => ({
        send: async () => {
          configs.push(config);
          attempts[signature] = (attempts[signature] ?? 0) + 1;
          const entry = transactions[signature];
          const resolved =
            typeof entry === 'function'
              ? (entry as (n: number) => unknown)(attempts[signature])
              : entry;
          if (resolved instanceof Error) throw resolved;
          return resolved;
        },
      }),
      getSlot: () => ({ send: async () => 1000n }),
      // Every discovered candidate reads back as already-closed, so the
      // reclaim loop short-circuits and no transaction is ever sent.
      getAccountInfo: () => ({ send: async () => ({ value: null }) }),
    } as never,
  };
}

describe('reclaimLookupTablesForSigner history scan', () => {
  it('declares transaction-v1 support on getTransaction', async () => {
    const signer = await generateKeyPairSigner();
    const { rpc, configs } = makeReclaimRpc({ sigA: txWithTable(TABLE_A) });

    await reclaimLookupTablesForSigner({
      rpc,
      rpcSubscriptions: undefined as never,
      signer,
      allowedEntryOwners: [MEMO],
      retryOptions: FAST_RETRY,
    });

    assert.equal(configs.length, 1, 'expected one getTransaction call');
    assert.equal(
      configs[0].maxSupportedTransactionVersion,
      1,
      'declaring only v0 earns JSON-RPC -32015 on every v1 transaction',
    );
  });

  it('skips a permanently unreadable signature without losing the others', async () => {
    const signer = await generateKeyPairSigner();
    const { rpc } = makeReclaimRpc({
      sigA: txWithTable(TABLE_A),
      sigUnreadable: V1_UNSUPPORTED,
      sigB: txWithTable(TABLE_B),
    });

    const result = await reclaimLookupTablesForSigner({
      rpc,
      rpcSubscriptions: undefined as never,
      signer,
      allowedEntryOwners: [MEMO],
      retryOptions: FAST_RETRY,
    });

    assert.equal(result.scannedSignatures, 3);
    assert.equal(
      result.candidates,
      2,
      'the tables on either side of the failure must still be discovered',
    );
  });

  it('does not retry a permanent failure', async () => {
    const signer = await generateKeyPairSigner();
    const { rpc, attempts } = makeReclaimRpc({ sigA: V1_UNSUPPORTED });

    await reclaimLookupTablesForSigner({
      rpc,
      rpcSubscriptions: undefined as never,
      signer,
      allowedEntryOwners: [MEMO],
      retryOptions: FAST_RETRY,
    });

    assert.equal(attempts.sigA, 1, 'a -32015 is not worth a second attempt');
  });

  it('retries a transient failure and recovers', async () => {
    const signer = await generateKeyPairSigner();
    const { rpc, attempts } = makeReclaimRpc({
      sigA: (n: number) => (n === 1 ? RATE_LIMITED : txWithTable(TABLE_A)),
    });

    const result = await reclaimLookupTablesForSigner({
      rpc,
      rpcSubscriptions: undefined as never,
      signer,
      allowedEntryOwners: [MEMO],
      retryOptions: FAST_RETRY,
    });

    assert.equal(attempts.sigA, 2, 'expected one retry after the 429');
    assert.equal(result.candidates, 1, 'the table must survive the retry');
  });

  it("classifies post-exhaustion failures with the caller's own predicate", async () => {
    const signer = await generateKeyPairSigner();
    const { rpc, attempts } = makeReclaimRpc({ sigA: V1_UNSUPPORTED });

    // -32015 is permanent by the default heuristic. A caller who knows their
    // RPC better can say otherwise, and withRetry honours that — so the
    // post-exhaustion branch must honour it too. Classifying with the default
    // here would retry the error as transient and then skip it as permanent,
    // silently truncating the candidate set.
    await assert.rejects(
      reclaimLookupTablesForSigner({
        rpc,
        rpcSubscriptions: undefined as never,
        signer,
        allowedEntryOwners: [MEMO],
        retryOptions: { ...FAST_RETRY, isRetryable: () => true },
      }),
      /Refusing to report zero reclaimable tables/,
    );
    assert.equal(
      attempts.sigA,
      FAST_RETRY.maxAttempts,
      'the caller predicate should have driven the retries too',
    );
  });

  it('THROWS rather than reporting zero when a transient failure persists', async () => {
    const signer = await generateKeyPairSigner();
    const { rpc } = makeReclaimRpc({
      sigA: txWithTable(TABLE_A),
      sigRateLimited: RATE_LIMITED,
    });

    // Reporting `candidates: 0` here would read as "nothing to reclaim" while
    // the rent of every table this signer created keeps sitting there.
    await assert.rejects(
      reclaimLookupTablesForSigner({
        rpc,
        rpcSubscriptions: undefined as never,
        signer,
        allowedEntryOwners: [MEMO],
        retryOptions: FAST_RETRY,
      }),
      (err: Error) => {
        assert.match(err.message, /Refusing to report zero reclaimable tables/);
        assert.equal((err.cause as Error)?.message, RATE_LIMITED.message);
        return true;
      },
    );
  });
});
