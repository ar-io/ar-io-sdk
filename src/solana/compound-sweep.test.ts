import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  GatewayStatus,
  Protocol,
  getDelegationEncoder,
  getGatewayEncoder,
} from '@ar.io/solana-contracts/gar';
import { type Address, address, getAddressDecoder } from '@solana/kit';

import { MAX_COMPOUND_BATCH, SolanaARIOWriteable } from './io-writeable.js';

const dec = getAddressDecoder();
function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[1] = (tag >> 8) & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}

type Entry = { gateway: string; delegator: string };

/**
 * Drives `maybeCompoundStep` with the RPC boundary stubbed, counting the
 * whole-program discovery scans the way issue #755 measured them.
 *
 * `compoundDelegationRewardsBatch` settles what it is given, so a sweep that
 * re-discovers sees the shrinking list a real cranker would.
 */
class SweepWriteable extends SolanaARIOWriteable {
  /** Each call is two `getProgramAccounts` scans in the real reader. */
  discoveries = 0;
  sent: Entry[][] = [];
  pending: Array<{
    gatewayAddress: string;
    delegatorAddress: string;
    pendingRewards: number;
  }> = [];
  /** Delegators whose Delegation PDA has been closed under us. */
  closed = new Set<string>();

  constructor() {
    super({
      rpc: {} as never,
      rpcSubscriptions: {} as never,
      signer: { address: pk(999) } as never,
    } as never);
  }

  // biome-ignore lint/suspicious/noExplicitAny: test stub
  async getDelegationsToCompound(): Promise<any> {
    this.discoveries++;
    return this.pending.filter((p) => !this.closed.has(p.delegatorAddress));
  }

  protected async revalidateCompoundEntries(
    entries: Entry[],
  ): Promise<Entry[]> {
    if (this.filterError) throw this.filterError;
    return entries.filter((e) => !this.closed.has(e.delegator));
  }

  /** Set to make the next send throw, as a dropped tx would. */
  sendError?: Error;
  /** Set to make re-validation throw, as a transient RPC failure would. */
  filterError?: Error;

  // biome-ignore lint/suspicious/noExplicitAny: test stub
  async compoundDelegationRewardsBatch(batch: Entry[]): Promise<any> {
    if (this.sendError) throw this.sendError;
    this.sent.push(batch);
    const settled = new Set(batch.map((b) => b.delegator));
    this.pending = this.pending.filter((p) => !settled.has(p.delegatorAddress));
    return { id: `tx-${this.sent.length}` };
  }

  step(epochIndex = 5) {
    return (
      this as unknown as {
        maybeCompoundStep: (
          min: number,
          epoch: number,
        ) => Promise<{
          action?: string;
          txId?: string;
          partialFailureReason?: string;
          progress?: { index: number; total: number };
        } | null>;
      }
    ).maybeCompoundStep(0, epochIndex);
  }

  load(n: number) {
    this.pending = Array.from({ length: n }, (_, i) => ({
      gatewayAddress: pk(1000 + i * 2),
      delegatorAddress: pk(1001 + i * 2),
      pendingRewards: 1_000,
    }));
  }

  /** Run to completion, as a cranker ticking until there is no work left. */
  async drain(maxTicks = 500) {
    let ticks = 0;
    while (ticks++ < maxTicks) {
      if ((await this.step()) === null) return ticks;
    }
    throw new Error('drain did not terminate');
  }
}

describe('compound sweep: discovery is per epoch, not per tick', () => {
  /**
   * The headline of #755: draining 600 delegations six at a time ran the
   * discovery on every tick — 101 discoveries, 202 whole-program scans, about
   * 100MB — to select six 32-byte pubkey pairs each time.
   */
  it('drains a large backlog on two discoveries instead of one per batch', async () => {
    const w = new SweepWriteable();
    w.load(600);

    const ticks = await w.drain();

    assert.equal(w.sent.length, 100, '600 / 6 = 100 batches');
    assert.equal(
      ticks,
      101,
      'one tick per batch, plus the tick that finds none',
    );
    assert.equal(
      w.discoveries,
      2,
      'one discovery to build the sweep, one to confirm it is empty',
    );
  });

  /**
   * The point of the whole change: once a sweep is done, later ticks in the
   * same epoch must cost nothing. Most ticks in the post-distribution window
   * are these.
   */
  it('stops scanning entirely once the sweep is settled', async () => {
    const w = new SweepWriteable();
    w.load(12);

    await w.drain();
    const afterDrain = w.discoveries;

    for (let i = 0; i < 10; i++) {
      assert.equal(await w.step(), null, 'still reports no work');
    }

    assert.equal(w.discoveries, afterDrain, 'ten idle ticks, zero scans');
  });

  it('rediscovers for the next epoch even after settling', async () => {
    const w = new SweepWriteable();
    w.load(6);
    await w.drain();
    const afterDrain = w.discoveries;

    w.load(6);
    const next = await w.step(6);

    assert.ok(next, 'the new epoch found work');
    assert.equal(w.discoveries, afterDrain + 1);
  });

  it('compounds every candidate exactly once', async () => {
    const w = new SweepWriteable();
    w.load(20);
    const all = w.pending.map((p) => p.delegatorAddress);

    await w.drain();

    const seen = w.sent.flat().map((e) => e.delegator);
    assert.equal(seen.length, 20);
    assert.deepEqual([...new Set(seen)].sort(), [...all].sort());
  });

  it('never exceeds the batch cap', async () => {
    const w = new SweepWriteable();
    w.load(31);

    await w.drain();

    for (const batch of w.sent) {
      assert.ok(
        batch.length <= MAX_COMPOUND_BATCH,
        `batch of ${batch.length} exceeds the cap`,
      );
    }
    assert.equal(w.sent.length, 6, 'ceil(31 / 6)');
  });

  it('reports no work with a single discovery', async () => {
    const w = new SweepWriteable();

    assert.equal(await w.step(), null);
    assert.equal(w.discoveries, 1);
    assert.equal(w.sent.length, 0);
  });

  /**
   * A cached list must not outlive the distribution that created it: the next
   * epoch's `distribute_epoch` advances the accumulator and makes everything
   * compoundable again.
   */
  it('discards the sweep when the epoch advances', async () => {
    const w = new SweepWriteable();
    w.load(6);

    await w.step(5);
    assert.equal(w.discoveries, 1);

    w.load(6);
    await w.step(6);
    assert.equal(w.discoveries, 2, 'a new epoch rediscovers');
  });

  it('keeps consuming the cached sweep within one epoch', async () => {
    const w = new SweepWriteable();
    w.load(18);

    await w.step(5);
    await w.step(5);
    await w.step(5);

    assert.equal(w.discoveries, 1, 'three batches, one discovery');
    assert.equal(w.sent.length, 3);
  });

  /** Discovery-time count, so it does not shrink under a competing cranker. */
  it('reports progress against the count discovered', async () => {
    const w = new SweepWriteable();
    w.load(20);

    const first = await w.step();
    const second = await w.step();

    assert.equal(first?.progress?.total, 20);
    assert.equal(second?.progress?.total, 20);
    assert.equal(first?.progress?.index, MAX_COMPOUND_BATCH);
    // The second step is what separates a counting index from one pinned at
    // the batch size: the broken version reports MAX_COMPOUND_BATCH here too.
    assert.equal(second?.progress?.index, 2 * MAX_COMPOUND_BATCH);
  });
});

describe('compound sweep: stale entries cannot wedge it', () => {
  /**
   * The hazard a cached list introduces. `delegation` and `gateway` are Anchor
   * `Account<'info, _>`, so a closed PDA raises `AccountNotInitialized` and
   * reverts all six instructions — and re-serving the same doomed six every
   * tick is the wedge `closeObservations` already documents.
   */
  it('drops entries whose accounts are gone and still advances', async () => {
    const w = new SweepWriteable();
    w.load(12);
    // The first batch's worth are closed after discovery.
    for (const p of w.pending.slice(0, MAX_COMPOUND_BATCH)) {
      w.closed.add(p.delegatorAddress);
    }

    const result = await w.step();

    assert.ok(result, 'the step still did work');
    assert.equal(w.sent.length, 1);
    assert.equal(w.sent[0].length, MAX_COMPOUND_BATCH);
    for (const e of w.sent[0]) {
      assert.ok(!w.closed.has(e.delegator), 'a dead entry was sent');
    }
  });

  it('reports no work when every candidate is gone, without looping', async () => {
    const w = new SweepWriteable();
    w.load(9);
    for (const p of w.pending) w.closed.add(p.delegatorAddress);

    assert.equal(await w.step(), null);
    assert.equal(w.sent.length, 0, 'nothing was sent');
  });

  it('drains a backlog that is dying underneath it', async () => {
    const w = new SweepWriteable();
    w.load(30);
    // Every third candidate is closed between discovery and its batch.
    w.pending.forEach((p, i) => {
      if (i % 3 === 0) w.closed.add(p.delegatorAddress);
    });

    await w.drain();

    const seen = w.sent.flat().map((e) => e.delegator);
    assert.equal(seen.length, 20, 'the 20 live candidates compounded');
    for (const d of seen) assert.ok(!w.closed.has(d));
  });

  /**
   * An exhausted sweep re-discovers once before reporting no work, so a
   * discovery that raced a lagging `getProgramAccounts` index heals on the
   * next tick instead of stalling the epoch.
   */
  it('re-discovers once when the sweep empties', async () => {
    const w = new SweepWriteable();
    w.load(6);

    await w.step(); // consumes all six
    assert.equal(w.discoveries, 1);

    // Work that the first discovery missed.
    w.load(6);
    const second = await w.step();

    assert.ok(second, 'the refill found the missed work');
    assert.equal(w.discoveries, 2);
    assert.equal(w.sent.length, 2);
  });
});

/**
 * The stubs above replace `filterLiveCompoundEntries`, so exercise the real
 * one against a fake RPC. This is the part that has to be right: it is what
 * stops one closed PDA reverting a whole batch.
 */
describe('revalidateCompoundEntries', () => {
  /**
   * The real implementation, against encoded accounts rather than a stub — it
   * is what stops one closed PDA reverting a batch, and what stops a cached
   * entry being sent after it stopped qualifying.
   */
  const OPERATOR = address('GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');
  const DELEGATOR = address('De1egatorAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  const PREC = 10n ** 18n;

  const gatewayBytes = (status: GatewayStatus, cumulative: bigint) =>
    getGatewayEncoder().encode({
      operator: OPERATOR,
      label: 'lbl',
      fqdn: 'gw.example',
      port: 443,
      protocol: Protocol.Https,
      properties: '',
      note: '',
      operatorStake: 1_000n,
      totalDelegatedStake: 100n,
      status,
      startTimestamp: 0n,
      leaveTimestamp: status === GatewayStatus.Leaving ? 1n : null,
      leaveEpochDuration: 0n,
      stats: {
        passedEpochs: 0,
        failedEpochs: 0,
        totalEpochs: 0,
        prescribedEpochs: 0,
        observedEpochs: 0,
        failedConsecutive: 0,
        passedConsecutive: 0,
      },
      weights: {
        stakeWeight: 0n,
        tenureWeight: 0n,
        gatewayPerformanceRatio: 0n,
        observerPerformanceRatio: 0n,
        compositeWeight: 0n,
        normalizedCompositeWeight: 0n,
        weightsEpoch: 0n,
      },
      settings: {
        allowDelegatedStaking: true,
        delegateRewardShareRatio: 0,
        minDelegationAmount: 0n,
        allowlistEnabled: false,
        pendingDelegateRewardShareRatio: null,
        delegationDisabledAt: null,
      },
      registryIndex: { index: 0, _reserved: 0 },
      observerAddress: OPERATOR,
      cumulativeRewardPerToken: cumulative,
      bump: 250,
      version: { major: 1, minor: 2, patch: 0 },
      operationsAddress: OPERATOR,
    });

  const delegationBytes = (amount: bigint, rewardDebt: bigint) =>
    getDelegationEncoder().encode({
      gateway: OPERATOR,
      delegator: DELEGATOR,
      amount,
      startTimestamp: 1n,
      rewardDebt,
      bump: 254,
      version: { major: 1, minor: 0, patch: 0 },
    });

  /**
   * Extends the real class, NOT the sweep stub — the stub overrides the very
   * method under test here.
   */
  class RealWriteable extends SolanaARIOWriteable {
    constructor(rpc: unknown) {
      super({
        rpc: rpc as never,
        rpcSubscriptions: {} as never,
        signer: { address: pk(999) } as never,
      } as never);
    }
  }

  /** Serves the delegation PDA first, the gateway second — the filter's order. */
  const writeableWith = (
    delegation: Uint8Array | null,
    gateway: Uint8Array | null,
  ) => {
    const rpc = {
      getMultipleAccounts: (addresses: string[]) => ({
        send: async () => ({
          context: { slot: 1n },
          value: addresses.map((_a, i) => {
            const bytes = i % 2 === 0 ? delegation : gateway;
            return bytes === null
              ? null
              : {
                  data: [Buffer.from(bytes).toString('base64'), 'base64'] as [
                    string,
                    string,
                  ],
                  executable: false,
                  lamports: 1n,
                  owner: OPERATOR,
                  rentEpoch: 0n,
                  space: BigInt(bytes.length),
                };
          }),
        }),
      }),
    };
    return new RealWriteable(rpc);
  };

  const run = (w: SolanaARIOWriteable, min = 0) =>
    (
      w as unknown as {
        revalidateCompoundEntries: (
          e: Entry[],
          min: number,
        ) => Promise<Entry[]>;
      }
    ).revalidateCompoundEntries(
      [{ gateway: OPERATOR, delegator: DELEGATOR }],
      min,
    );

  it('keeps an entry that still has pending rewards', async () => {
    const w = writeableWith(
      delegationBytes(1_000_000n, 0n),
      gatewayBytes(GatewayStatus.Joined, PREC / 100n),
    );

    assert.equal((await run(w)).length, 1);
  });

  it('drops an entry whose delegation account is gone', async () => {
    const w = writeableWith(
      null,
      gatewayBytes(GatewayStatus.Joined, PREC / 100n),
    );

    assert.deepEqual(await run(w), []);
  });

  /**
   * Both accounts gate the instruction, so a missing gateway must drop the
   * entry too — checking only the delegation would still revert the batch.
   */
  it('drops an entry whose gateway account is gone', async () => {
    const w = writeableWith(delegationBytes(1_000_000n, 0n), null);

    assert.deepEqual(await run(w), []);
  });

  /**
   * Another cranker settled it, or the delegator added stake (which settles
   * first). Harmless on chain, but it spends a fee to do nothing.
   */
  it('drops an entry already settled since discovery', async () => {
    const cumulative = PREC / 100n;
    const w = writeableWith(
      delegationBytes(1_000_000n, cumulative), // reward_debt caught up
      gatewayBytes(GatewayStatus.Joined, cumulative),
    );

    assert.deepEqual(await run(w), []);
  });

  /**
   * The uncached path filtered `leaving` gateways as policy, routing them to
   * the claim path. Re-running the predicate keeps that rather than diverging.
   */
  it('drops an entry whose gateway left since discovery', async () => {
    const w = writeableWith(
      delegationBytes(1_000_000n, 0n),
      gatewayBytes(GatewayStatus.Leaving, PREC / 100n),
    );

    assert.deepEqual(await run(w), []);
  });

  it('honours the minimum pending threshold', async () => {
    const w = writeableWith(
      delegationBytes(1_000_000n, 0n),
      gatewayBytes(GatewayStatus.Joined, PREC / 1_000_000n),
    );

    assert.equal((await run(w, 0)).length, 1, 'qualifies with no minimum');
    assert.deepEqual(
      await run(w, 1_000_000),
      [],
      'dropped under a high minimum',
    );
  });

  it('asks nothing for an empty list', async () => {
    const w = new RealWriteable({});
    const out = await (
      w as unknown as {
        revalidateCompoundEntries: (
          e: Entry[],
          min: number,
        ) => Promise<Entry[]>;
      }
    ).revalidateCompoundEntries([], 0);

    assert.deepEqual(out, []);
  });
});

/**
 * Both the observer (`epoch-cranker.ts`) and ar-io-cranker
 * (`state-machine.ts`) end their drain when a step reports the same action and
 * the same progress twice running, and their comments say they rely on the
 * compound step to move one of the two numbers. The old shape pinned `index`
 * at the batch size and let a freshly scanned `total` shrink; a cached sweep
 * makes `total` constant, so `index` has to advance instead.
 *
 * Getting this wrong does not fail anything in this repo — it silently caps a
 * drain at two batches, which on a 33-batch mainnet boundary delays every
 * epoch rollover by roughly 15-20 minutes.
 */
describe('compound sweep: progress advances so a drain does not stop', () => {
  const fingerprint = (
    r: {
      action?: string;
      progress?: { index: number; total: number };
    } | null,
  ) => `${r?.action}:${r?.progress?.index}/${r?.progress?.total}`;

  it('reports a different fingerprint on every consecutive batch', async () => {
    const w = new SweepWriteable();
    w.load(30);

    const seen: string[] = [];
    for (let i = 0; i < 5; i++) seen.push(fingerprint(await w.step()));

    assert.equal(w.sent.length, 5, 'five batches ran');
    assert.equal(
      new Set(seen).size,
      seen.length,
      `consecutive steps repeated a progress fingerprint: ${seen.join(', ')}`,
    );
  });

  it('counts up to the number discovered', async () => {
    const w = new SweepWriteable();
    w.load(20);

    const first = await w.step();
    const second = await w.step();
    const third = await w.step();

    assert.deepEqual(first?.progress, { index: 6, total: 20 });
    assert.deepEqual(second?.progress, { index: 12, total: 20 });
    assert.deepEqual(third?.progress, { index: 18, total: 20 });
  });

  it('keeps advancing across a whole drain', async () => {
    const w = new SweepWriteable();
    w.load(60);

    const seen: string[] = [];
    for (;;) {
      const r = await w.step();
      if (r === null) break;
      seen.push(fingerprint(r));
    }

    assert.equal(seen.length, 10);
    assert.equal(new Set(seen).size, 10, 'every step was distinguishable');
  });
});

describe('compound sweep: failures never hold up epoch creation', () => {
  /**
   * An error thrown here ends the caller's drain before `create_epoch`, so a
   * transient failure would delay the next epoch. The steps around this one
   * report failures instead of throwing; this now does too.
   */
  it('reports a failed send instead of throwing', async () => {
    const w = new SweepWriteable();
    w.load(12);
    w.sendError = new Error('blockhash not found');

    const r = await w.step();

    assert.equal(r?.action, 'compound');
    assert.match(r?.partialFailureReason ?? '', /blockhash not found/);
    assert.equal(r?.txId, undefined, 'no transaction id for a failed send');
  });

  it('reports a failed re-validation instead of throwing', async () => {
    const w = new SweepWriteable();
    w.load(12);
    w.filterError = new Error('429 rate limited');

    const r = await w.step();

    assert.equal(r?.action, 'compound');
    assert.match(r?.partialFailureReason ?? '', /429 rate limited/);
    assert.equal(w.sent.length, 0, 'nothing was sent');
  });

  /**
   * A failed batch stays dropped rather than being re-served: its rewards are
   * still in the accumulator and compound on the next epoch's sweep, where
   * re-serving a batch that just failed risks the wedge this design avoids.
   */
  it('advances past a failed batch rather than retrying it', async () => {
    const w = new SweepWriteable();
    w.load(12);
    const doomed = w.pending
      .slice(0, MAX_COMPOUND_BATCH)
      .map((p) => p.delegatorAddress);

    w.sendError = new Error('dropped');
    await w.step();
    w.sendError = undefined;
    await w.step();

    assert.equal(w.sent.length, 1, 'the second batch went out');
    for (const e of w.sent[0]) {
      assert.ok(
        !doomed.includes(e.delegator),
        'the failed batch was served again',
      );
    }
  });

  it('still reports progress that advances when a batch fails', async () => {
    const w = new SweepWriteable();
    w.load(18);
    w.sendError = new Error('dropped');

    const first = await w.step();
    const second = await w.step();

    assert.notEqual(
      `${first?.progress?.index}/${first?.progress?.total}`,
      `${second?.progress?.index}/${second?.progress?.total}`,
      'two failed batches must still look like progress to the drain guard',
    );
  });
});
