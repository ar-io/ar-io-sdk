import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  type Instruction,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getAddressDecoder,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit';

import { selectCompoundableDelegations } from './delegation-math.js';
import { MAX_COMPOUND_BATCH, SolanaARIOWriteable } from './io-writeable.js';

// Solana's hard transaction-size limit (raw bytes). A versioned tx over this is
// rejected by the RPC ("VersionedTransaction too large") and never lands.
const MAX_TX_BYTES = 1232;

const dec = getAddressDecoder();
function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}

// REWARD_PRECISION = 1e18: pending = stake * (cum - debt) / 1e18.
const PREC = 10n ** 18n;
const joined = (cum: bigint) => ({
  cumulativeRewardPerToken: cum,
  status: 'joined',
});
const leaving = (cum: bigint) => ({
  cumulativeRewardPerToken: cum,
  status: 'leaving',
});
const del = (
  gateway: string,
  delegator: string,
  stake: number,
  debt: bigint,
) => ({
  gateway,
  delegator,
  delegatedStake: stake,
  rewardDebt: debt,
});

describe('selectCompoundableDelegations', () => {
  it('includes pending delegations and computes the pending amount', () => {
    const gateways = new Map([['gwA', joined(PREC / 100n)]]); // 0.01 reward-per-token
    const out = selectCompoundableDelegations(
      [del('gwA', 'd1', 1_000_000, 0n)],
      gateways,
    );
    assert.equal(out.length, 1);
    assert.deepEqual(
      { g: out[0].gatewayAddress, d: out[0].delegatorAddress },
      { g: 'gwA', d: 'd1' },
    );
    // pending = 1_000_000 * (1e16) / 1e18 = 10_000
    assert.equal(out[0].pendingRewards, 10_000);
  });

  it('skips delegations whose gateway is LEAVING (claim path, not compound)', () => {
    const out = selectCompoundableDelegations(
      [del('gwA', 'd1', 1_000_000, 0n)],
      new Map([['gwA', leaving(PREC)]]),
    );
    assert.equal(out.length, 0);
  });

  it('skips delegations whose gateway is missing/unreadable', () => {
    const out = selectCompoundableDelegations(
      [del('ghost', 'd1', 1_000_000, 0n)],
      new Map(),
    );
    assert.equal(out.length, 0);
  });

  it('skips already-settled delegations (reward_debt == accumulator)', () => {
    const out = selectCompoundableDelegations(
      [del('gwA', 'd1', 1_000_000, PREC)],
      new Map([['gwA', joined(PREC)]]),
    );
    assert.equal(out.length, 0);
  });

  it('respects minPendingRewards (filters dust that would only bump reward_debt)', () => {
    const gateways = new Map([['gwA', joined(PREC / 1_000_000n)]]); // pending = 1 mARIO
    const dels = [del('gwA', 'd1', 1_000_000, 0n)];
    assert.equal(selectCompoundableDelegations(dels, gateways, 0).length, 1);
    assert.equal(selectCompoundableDelegations(dels, gateways, 1).length, 0); // 1 is not > 1
  });
});

/**
 * Captures the instructions handed to `sendTransaction` instead of sending —
 * the compound/demand-factor instruction builders are pure (PDA derivation +
 * encoding, no RPC), so we can assert their shape without a cluster.
 */
class TestWriteable extends SolanaARIOWriteable {
  sent: Array<{ ixs: Instruction[]; cu?: number }> = [];
  constructor() {
    super({
      rpc: {} as never,
      rpcSubscriptions: {} as never,
      signer: { address: pk(99) } as never,
    } as never);
  }
  protected async sendTransaction(
    instructions: Instruction[],
    computeUnitLimit?: number,
  ): Promise<string> {
    this.sent.push({ ixs: instructions, cu: computeUnitLimit });
    return 'tx-stub';
  }
}

describe('compoundDelegationRewards', () => {
  it('builds a single compound instruction and sends one tx', async () => {
    const w = new TestWriteable();
    const r = await w.compoundDelegationRewards({
      gateway: pk(1),
      delegator: pk(2),
    });
    assert.equal(r.id, 'tx-stub');
    assert.equal(w.sent.length, 1);
    assert.equal(w.sent[0].ixs.length, 1);
  });
});

describe('compoundDelegationRewardsBatch', () => {
  it('throws on an empty delegation list', async () => {
    const w = new TestWriteable();
    await assert.rejects(() => w.compoundDelegationRewardsBatch([]), /empty/);
  });

  it('builds one instruction per delegation in a SINGLE transaction', async () => {
    const w = new TestWriteable();
    const r = await w.compoundDelegationRewardsBatch([
      { gateway: pk(1), delegator: pk(2) },
      { gateway: pk(1), delegator: pk(3) }, // same gateway, different delegate
      { gateway: pk(4), delegator: pk(5) },
    ]);
    assert.equal(r.id, 'tx-stub');
    assert.equal(w.sent.length, 1, 'a single transaction');
    assert.equal(w.sent[0].ixs.length, 3, 'one instruction per delegation');
  });

  it('a full MAX_COMPOUND_BATCH batch fits the 1232-byte tx limit (worst case: all-distinct gateways)', async () => {
    const w = new TestWriteable();
    // Worst case for tx size: every delegation a distinct gateway, so no account
    // dedup shrinks the message. This is the shape that wedged epoch progression
    // on staging-V2 — a full batch of 12 overflows the 1232B raw limit and threw
    // in the post-distribution tail before create_epoch, so the cranker never
    // advanced. The cap must keep a full batch sendable.
    const dels = Array.from({ length: MAX_COMPOUND_BATCH }, (_, i) => ({
      gateway: pk(100 + i * 3),
      delegator: pk(101 + i * 3),
    }));
    await w.compoundDelegationRewardsBatch(dels);
    assert.equal(w.sent.length, 1, 'a single transaction');

    // Compile the captured instructions into a real wire transaction and measure
    // it, mirroring how `sendTransaction` builds the v0 tx.
    const wire = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(pk(99), tx),
      (tx) =>
        setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash('11111111111111111111111111111111'),
            lastValidBlockHeight: 0n,
          },
          tx,
        ),
      (tx) => appendTransactionMessageInstructions(w.sent[0].ixs, tx),
      (tx) => getBase64EncodedWireTransaction(compileTransaction(tx)),
    );
    const bytes = Buffer.from(wire, 'base64').length;
    assert.ok(
      bytes <= MAX_TX_BYTES,
      `a full compound batch of ${MAX_COMPOUND_BATCH} compiled to ${bytes}B, ` +
        `exceeding Solana's ${MAX_TX_BYTES}-byte tx limit`,
    );
  });
});

describe('updateDemandFactor', () => {
  it('builds an update_demand_factor instruction and sends one tx', async () => {
    const w = new TestWriteable();
    const r = await w.updateDemandFactor();
    assert.equal(r.id, 'tx-stub');
    assert.equal(w.sent.length, 1);
    assert.equal(w.sent[0].ixs.length, 1);
  });
});
