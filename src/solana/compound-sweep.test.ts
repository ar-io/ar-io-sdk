import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, getAddressDecoder } from '@solana/kit';

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

  protected async filterLiveCompoundEntries(
    entries: Entry[],
  ): Promise<Entry[]> {
    return entries.filter((e) => !this.closed.has(e.delegator));
  }

  // biome-ignore lint/suspicious/noExplicitAny: test stub
  async compoundDelegationRewardsBatch(batch: Entry[]): Promise<any> {
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
        ) => Promise<{ progress?: { index: number; total: number } } | null>;
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
describe('filterLiveCompoundEntries', () => {
  class RealFilterWriteable extends SolanaARIOWriteable {
    /** Addresses the fake RPC reports as existing. */
    live = new Set<string>();
    /** Every key the filter asked about, in order. */
    asked: string[] = [];
    calls = 0;

    constructor() {
      super({
        rpc: {
          getMultipleAccounts: (addresses: string[]) => ({
            send: async () => {
              this.calls++;
              this.asked.push(...addresses);
              return {
                context: { slot: 1n },
                value: addresses.map((a) =>
                  this.live.has(a)
                    ? {
                        data: ['', 'base64'] as [string, string],
                        executable: false,
                        lamports: 1n,
                        owner: pk(1),
                        rentEpoch: 0n,
                        space: 0n,
                      }
                    : null,
                ),
              };
            },
          }),
        } as never,
        rpcSubscriptions: {} as never,
        signer: { address: pk(999) } as never,
      } as never);
    }

    run(entries: Entry[]) {
      return (
        this as unknown as {
          filterLiveCompoundEntries: (e: Entry[]) => Promise<Entry[]>;
        }
      ).filterLiveCompoundEntries(entries);
    }

    /** Mark both PDAs of each entry as existing. */
    async makeLive(entries: Entry[]) {
      const probe = new RealFilterWriteable();
      await probe.run(entries);
      for (const a of probe.asked) this.live.add(a);
    }
  }

  const entry = (n: number): Entry => ({
    gateway: pk(2000 + n * 2),
    delegator: pk(2001 + n * 2),
  });

  it('keeps an entry whose delegation and gateway both exist', async () => {
    const w = new RealFilterWriteable();
    const entries = [entry(1), entry(2)];
    await w.makeLive(entries);

    assert.deepEqual(await w.run(entries), entries);
  });

  it('drops an entry whose accounts are missing', async () => {
    const w = new RealFilterWriteable();
    const kept = entry(3);
    await w.makeLive([kept]);

    assert.deepEqual(await w.run([entry(4), kept, entry(5)]), [kept]);
  });

  /**
   * Both accounts gate the instruction, so either one missing must drop the
   * entry — checking only the delegation would still let a closed gateway
   * revert the batch.
   */
  it('drops an entry when only one of the two accounts exists', async () => {
    const w = new RealFilterWriteable();
    const e = entry(6);
    await w.makeLive([e]);
    // Forget the second of its two keys: the gateway.
    const probe = new RealFilterWriteable();
    await probe.run([e]);
    w.live.delete(probe.asked[1]);

    assert.deepEqual(await w.run([e]), []);
  });

  it('asks once, for two keys per entry', async () => {
    const w = new RealFilterWriteable();
    const entries = [entry(7), entry(8), entry(9)];
    await w.makeLive(entries);
    w.asked = [];
    w.calls = 0;

    await w.run(entries);

    assert.equal(w.calls, 1, 'one getMultipleAccounts, not one per entry');
    assert.equal(w.asked.length, 6, 'delegation + gateway for each');
  });

  it('asks nothing for an empty list', async () => {
    const w = new RealFilterWriteable();

    assert.deepEqual(await w.run([]), []);
    assert.equal(w.calls, 0);
  });
});
