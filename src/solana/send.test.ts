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
 * up by replaying the signer's own transaction history. That read is the one
 * place in the SDK exposed to Solana's transaction-v1 rollout (SIMD-0296 size
 * ceiling, SIMD-0385 format, mainnet at epoch 1035): `getTransaction` answers
 * a client that declares only `maxSupportedTransactionVersion: 0` with
 * JSON-RPC -32015 for every v1 transaction in the range.
 *
 * Two independent guards, because either alone still loses the rent:
 * declaring v1 keeps the common case working, and per-signature error
 * handling keeps ONE unreadable entry from aborting a 500-signature scan.
 */

// Valid base58 addresses; the stub RPC only ever compares them as strings.
const TABLE_A = 'AddressLookupTab1e1111111111111111111111111';
const TABLE_B = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

const V1_UNSUPPORTED = Object.assign(
  new Error(
    'Transaction version (1) is not supported by the requesting client. ' +
      'Please try the request again with the following configuration ' +
      'parameter: "maxSupportedTransactionVersion": 1',
  ),
  { code: -32015 },
);

/** A `getTransaction` response carrying one address-table lookup. */
function txWithTable(accountKey: string) {
  return {
    transaction: { message: { addressTableLookups: [{ accountKey }] } },
  };
}

function makeReclaimRpc(transactions: Record<string, unknown>) {
  const configs: Record<string, unknown>[] = [];
  const signatures = Object.keys(transactions);
  return {
    configs,
    rpc: {
      getSignaturesForAddress: () => ({
        send: async () => signatures.map((signature) => ({ signature })),
      }),
      getTransaction: (signature: string, config: Record<string, unknown>) => ({
        send: async () => {
          configs.push(config);
          const entry = transactions[signature];
          if (entry instanceof Error) throw entry;
          return entry;
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
    });

    assert.equal(configs.length, 1, 'expected one getTransaction call');
    assert.equal(
      configs[0].maxSupportedTransactionVersion,
      1,
      'declaring only v0 earns JSON-RPC -32015 on every v1 transaction',
    );
  });

  it('skips an unreadable signature instead of aborting the pass', async () => {
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
    });

    assert.equal(result.scannedSignatures, 3);
    assert.equal(
      result.candidates,
      2,
      'the tables on either side of the failure must still be discovered',
    );
  });

  it('reports zero candidates rather than throwing when every read fails', async () => {
    const signer = await generateKeyPairSigner();
    const { rpc } = makeReclaimRpc({
      sigA: V1_UNSUPPORTED,
      sigB: V1_UNSUPPORTED,
    });

    const result = await reclaimLookupTablesForSigner({
      rpc,
      rpcSubscriptions: undefined as never,
      signer,
      allowedEntryOwners: [MEMO],
    });

    assert.deepEqual(
      {
        deactivated: result.deactivated,
        closed: result.closed,
        candidates: result.candidates,
      },
      { deactivated: 0, closed: 0, candidates: 0 },
    );
  });
});
