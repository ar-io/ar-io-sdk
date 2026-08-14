import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { address, generateKeyPairSigner } from '@solana/kit';
import { sendAndConfirm } from './send.js';

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
