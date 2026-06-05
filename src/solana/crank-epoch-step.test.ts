import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, getAddressDecoder } from '@solana/kit';

import { SolanaARIOWriteable } from './io-writeable.js';

const dec = getAddressDecoder();
function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}
function invalidGatewayError(): Error {
  return Object.assign(new Error('Transaction simulation failed'), {
    context: {
      logs: [
        'Program log: AnchorError occurred. Error Code: InvalidGatewayAccount. Error Number: 6049. Error Message: Invalid gateway account.',
      ],
    },
  });
}

// EpochSettings stub: genesis=1000, duration=100 → nextEpochStart = 1000 + idx*100
type Settings = {
  enabled: boolean;
  currentEpochIndex: number;
  genesisTimestamp: number;
  epochDuration: number;
  prescribedObserverCount: number;
};
type EpochRaw = {
  tallyIndex: number;
  distributionIndex: number;
  weightsTallied: number;
  prescriptionsDone: number;
  rewardsDistributed: number;
  observationsSubmitted: number;
  observationsClosed: number;
  activeGatewayCount: number;
  endTimestamp: number;
};

class TestCranker extends SolanaARIOWriteable {
  calls: string[] = [];
  settings!: Settings;
  epochs: Record<number, EpochRaw> = {};
  predicted: Address[] = [pk(1), pk(2), pk(3)];
  // returns an Error to throw on the given (1-based) prescribe attempt, else null
  prescribeError: (attempt: number) => Error | null = () => null;
  private prescribeAttempts = 0;

  constructor() {
    super({
      rpc: {} as never,
      rpcSubscriptions: {} as never,
      signer: { address: pk(99) } as never,
    } as never);
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getEpochSettingsFull(): Promise<any> {
    this.calls.push('settings');
    return this.settings;
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getEpochRaw(i: number): Promise<any> {
    this.calls.push(`getEpochRaw:${i}`);
    return this.epochs[i] ?? null;
  }
  async getRegistryGatewayPDAs(start: number, n: number): Promise<Address[]> {
    this.calls.push(`batch:${start}:${n}`);
    return Array.from({ length: Math.min(n, 5) }, (_, k) => pk(start + k + 10));
  }
  async getAllRegistryGatewayPDAs(): Promise<Address[]> {
    this.calls.push('getAllRegistryGatewayPDAs'); // must NEVER be called by crankEpochStep
    return [];
  }
  async getPredictedObserverPDAs(i: number): Promise<Address[]> {
    this.calls.push(`predict:${i}`);
    return this.predicted;
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async createEpoch(): Promise<any> {
    this.calls.push('createEpoch');
    return { id: 'tx-create' };
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async tallyWeights(p: any): Promise<any> {
    this.calls.push(`tally:${p.gatewayAccounts.length}`);
    return { id: 'tx-tally' };
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async distributeEpoch(p: any): Promise<any> {
    this.calls.push(`distribute:${p.gatewayAccounts.length}`);
    return { id: 'tx-distribute' };
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  closeEpochError: Error | null = null;
  async closeEpoch(p: any): Promise<any> {
    this.calls.push(`close:${p.epochIndex}`);
    if (this.closeEpochError) throw this.closeEpochError;
    return { id: 'tx-close' };
  }
  // Observation-close stubs — close_observations must run before close_epoch.
  epochObservers: Record<number, Address[]> = {};
  async getEpochObservers(i: number): Promise<Address[]> {
    this.calls.push(`getEpochObservers:${i}`);
    return this.epochObservers[i] ?? [];
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async closeObservations(p: any): Promise<any> {
    this.calls.push(`closeObservations:${p.epochIndex}:${p.observers.length}`);
    return { id: 'tx-close-obs' };
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async prescribeEpoch(p: any): Promise<any> {
    this.prescribeAttempts++;
    this.calls.push(
      `prescribe:${p.gatewayAccounts.length}:nameReg=${p.nameRegistryAccount ? 'y' : 'n'}`,
    );
    const e = this.prescribeError(this.prescribeAttempts);
    if (e) throw e;
    return { id: 'tx-prescribe' };
  }

  // --- Lazy-state maintenance stubs (compound + demand factor). Defaults make
  // the idle tail a no-op so the lifecycle tests above are unaffected. ---
  compoundable: Array<{
    gatewayAddress: Address;
    delegatorAddress: Address;
    pendingRewards: number;
  }> = [];
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getDelegationsToCompound(): Promise<any> {
    this.calls.push('getCompoundable');
    return this.compoundable;
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async compoundDelegationRewardsBatch(b: any[]): Promise<any> {
    this.calls.push(`compound:${b.length}`);
    return { id: 'tx-compound' };
  }
  dfPeriod: { currentPeriod: number; periodZeroStartTimestamp: number } | null =
    null;
  async getDemandFactorPeriodState(): Promise<{
    currentPeriod: number;
    periodZeroStartTimestamp: number;
  } | null> {
    this.calls.push('dfState');
    return this.dfPeriod;
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async updateDemandFactor(): Promise<any> {
    this.calls.push('updateDemandFactor');
    return { id: 'tx-df' };
  }

  // --- Returned-name prune stubs. Default [] makes the prune step a no-op so
  // the lifecycle tests above are unaffected. ---
  expiredReturned: Array<{
    pubkey: Address;
    name: string;
    returnedAt: bigint;
  }> = [];
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getExpiredReturnedNames(): Promise<any> {
    this.calls.push('getExpiredReturned');
    return this.expiredReturned;
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async pruneReturnedNames(p: any): Promise<any> {
    this.calls.push(`pruneReturned:${p.returnedNames.length}`);
    return { id: 'tx-prune-returned' };
  }
}

const baseSettings: Settings = {
  enabled: true,
  currentEpochIndex: 1,
  genesisTimestamp: 1000,
  epochDuration: 100,
  prescribedObserverCount: 50,
};
const liveEpoch: EpochRaw = {
  tallyIndex: 0,
  distributionIndex: 0,
  weightsTallied: 1,
  prescriptionsDone: 1,
  rewardsDistributed: 1,
  observationsSubmitted: 0,
  observationsClosed: 0,
  activeGatewayCount: 10,
  endTimestamp: 1090,
};

describe('crankEpochStep', () => {
  it('idle when epochs disabled', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, enabled: false };
    assert.deepEqual(await c.crankEpochStep(), {
      action: 'idle',
      reason: 'epochs_disabled',
    });
  });

  it('idle waiting_for_genesis before genesis (no epochs yet)', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 0 };
    const r = await c.crankEpochStep({ now: 500 });
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'waiting_for_genesis');
  });

  it('creates epoch 0 once genesis passes', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 0 };
    const r = await c.crankEpochStep({ now: 1500 });
    assert.equal(r.action, 'create');
    assert.equal(r.epochIndex, 0);
    assert.equal(r.txId, 'tx-create');
  });

  it('creates epoch[currentIndex] on a continuity cold start (live epoch missing, started)', async () => {
    // AO→Solana cutover: admin_set_current_epoch_index jumped currentIndex to
    // N>0 with NO prior epochs on-chain, so the "live" epoch (currentIndex-1)
    // was never created. Create epoch[currentIndex] directly once its start has
    // passed — the old code idled 'waiting_for_epoch' here forever (deadlock).
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 }; // target 0 absent; epoch 1 start = 1100
    const r = await c.crankEpochStep({ now: 1500 });
    assert.equal(r.action, 'create');
    assert.equal(r.epochIndex, 1);
    assert.equal(r.txId, 'tx-create');
  });

  it('idle waiting_for_epoch on a cold start before the epoch start arrives', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 }; // epoch 1 start = 1100
    const r = await c.crankEpochStep({ now: 1050 }); // before 1100
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'waiting_for_epoch');
  });

  it('tallies a batch when weights not tallied', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = {
      ...liveEpoch,
      weightsTallied: 0,
      tallyIndex: 0,
      activeGatewayCount: 10,
    };
    // batchSize 30 is capped to the tx-size-safe 18 for lifecycle batches.
    const r = await c.crankEpochStep({ now: 1500, batchSize: 30 });
    assert.equal(r.action, 'tally');
    assert.deepEqual(r.progress, { index: 0, total: 10 });
    assert.ok(
      c.calls.includes('batch:0:18'),
      'oversized batchSize must be capped to 18',
    );
    assert.ok(c.calls.some((x) => x.startsWith('tally:')));
  });

  it('caps the lifecycle batch at 18 (distribute too) regardless of opts', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = {
      ...liveEpoch,
      rewardsDistributed: 0,
      distributionIndex: 40,
      activeGatewayCount: 667,
      endTimestamp: 1000,
    };
    await c.crankEpochStep({ now: 5000, batchSize: 100 });
    assert.ok(
      c.calls.includes('batch:40:18'),
      'distribute batch must be capped to 18',
    );
  });

  it('tallies with an empty batch when activeGatewayCount is 0', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, weightsTallied: 0, activeGatewayCount: 0 };
    const r = await c.crankEpochStep({ now: 1500 });
    assert.equal(r.action, 'tally');
    assert.ok(c.calls.includes('tally:0'));
    assert.ok(!c.calls.some((x) => x.startsWith('batch:')));
  });

  it('prescribes using PREDICTED observers and NEVER getAllRegistryGatewayPDAs', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, weightsTallied: 1, prescriptionsDone: 0 };
    const r = await c.crankEpochStep({ now: 1500 });
    assert.equal(r.action, 'prescribe');
    assert.ok(c.calls.includes('predict:0'));
    assert.ok(c.calls.includes('prescribe:3:nameReg=y')); // auto-derived NameRegistry
    assert.ok(
      !c.calls.includes('getAllRegistryGatewayPDAs'),
      'must not pass the whole registry',
    );
  });

  it('disables name prescription when nameRegistryAccount=null', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, weightsTallied: 1, prescriptionsDone: 0 };
    await c.crankEpochStep({ now: 1500, nameRegistryAccount: null });
    assert.ok(c.calls.includes('prescribe:3:nameReg=n'));
  });

  it('re-predicts and retries once on InvalidGatewayAccount', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, weightsTallied: 1, prescriptionsDone: 0 };
    c.prescribeError = (attempt) =>
      attempt === 1 ? invalidGatewayError() : null;
    const r = await c.crankEpochStep({ now: 1500 });
    assert.equal(r.action, 'prescribe');
    assert.equal(c.calls.filter((x) => x === 'predict:0').length, 2); // re-predicted
    assert.equal(c.calls.filter((x) => x.startsWith('prescribe:')).length, 2);
  });

  it('propagates a non-InvalidGatewayAccount prescribe error (no retry)', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, weightsTallied: 1, prescriptionsDone: 0 };
    c.prescribeError = () => new Error('some other program error');
    await assert.rejects(
      () => c.crankEpochStep({ now: 1500 }),
      /some other program error/,
    );
    assert.equal(c.calls.filter((x) => x.startsWith('prescribe:')).length, 1); // no retry
  });

  it('idle waiting_for_observations before the epoch ends', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, rewardsDistributed: 0, endTimestamp: 9999 };
    const r = await c.crankEpochStep({ now: 5000 });
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'waiting_for_observations');
  });

  it('distributes a batch after the epoch ends', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = {
      ...liveEpoch,
      rewardsDistributed: 0,
      distributionIndex: 0,
      activeGatewayCount: 10,
      endTimestamp: 1000,
    };
    const r = await c.crankEpochStep({ now: 5000 });
    assert.equal(r.action, 'distribute');
    assert.deepEqual(r.progress, { index: 0, total: 10 });
  });

  it('closes a distributed epoch past retention', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 10 }; // target 9
    c.epochs[9] = { ...liveEpoch, endTimestamp: 1000 };
    c.epochs[2] = { ...liveEpoch }; // closeTarget = 9 - 7
    const r = await c.crankEpochStep({ now: 1900, epochRetention: 7 }); // < nextEpochStart 2000
    assert.equal(r.action, 'close');
    assert.equal(r.epochIndex, 2);
  });

  it('creates the next epoch when current is done and start has passed', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 }; // target 2 (< retention, no close)
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    const r = await c.crankEpochStep({ now: 1400 }); // nextEpochStart = 1300
    assert.equal(r.action, 'create');
    assert.equal(r.epochIndex, 3);
  });

  it('idle epoch_complete when done but next epoch start has not arrived', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    const r = await c.crankEpochStep({ now: 1200 }); // < nextEpochStart 1300
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'epoch_complete');
  });

  // --- Lazy-state maintenance steps in the idle tail ---

  it('compounds pending delegate rewards in the idle tail', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    c.compoundable = [
      { gatewayAddress: pk(1), delegatorAddress: pk(2), pendingRewards: 100 },
    ];
    const r = await c.crankEpochStep({ now: 1200 }); // epoch_complete window
    assert.equal(r.action, 'compound');
    assert.equal(r.txId, 'tx-compound');
    assert.ok(c.calls.includes('compound:1'));
  });

  it('skips compounding when enableCompound is false', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    c.compoundable = [
      { gatewayAddress: pk(1), delegatorAddress: pk(2), pendingRewards: 100 },
    ];
    const r = await c.crankEpochStep({ now: 1200, enableCompound: false });
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'epoch_complete');
    assert.ok(!c.calls.some((x) => x.startsWith('compound:')));
  });

  it('rolls the demand factor in the idle tail when its period elapsed (preempts create)', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    c.compoundable = []; // nothing to compound
    c.dfPeriod = { currentPeriod: 1, periodZeroStartTimestamp: 0 };
    // now in demand-factor period 2 (>= 86400) — also >= nextEpochStart, so this
    // proves the roll preempts create-next.
    const r = await c.crankEpochStep({ now: 90_000 });
    assert.equal(r.action, 'update_demand_factor');
    assert.equal(r.txId, 'tx-df');
    assert.ok(!c.calls.includes('createEpoch'));
  });

  it('does not roll the demand factor within the same period', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    c.compoundable = [];
    c.dfPeriod = { currentPeriod: 2, periodZeroStartTimestamp: 0 }; // already period 2
    const r = await c.crankEpochStep({ now: 90_000 }); // still period 2
    assert.notEqual(r.action, 'update_demand_factor');
    assert.ok(!c.calls.includes('updateDemandFactor'));
  });

  it('compound takes precedence over demand-factor roll and create-next', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    c.compoundable = [
      { gatewayAddress: pk(1), delegatorAddress: pk(2), pendingRewards: 5 },
    ];
    c.dfPeriod = { currentPeriod: 1, periodZeroStartTimestamp: 0 }; // also due
    const r = await c.crankEpochStep({ now: 90_000 }); // create + df also due
    assert.equal(r.action, 'compound');
    assert.ok(!c.calls.includes('updateDemandFactor'));
    assert.ok(!c.calls.includes('createEpoch'));
  });
});

describe('crankEpochStep — returned-name pruning', () => {
  const expired = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      pubkey: pk(20 + i),
      name: `name${i}`,
      returnedAt: 0n,
    }));

  // Live epoch parked in the observation window (now < endTimestamp), rewards
  // not yet distributed — the dominant idle state where staging epochs sit.
  const liveWaiting = (c: TestCranker) => {
    c.settings = { ...baseSettings };
    c.epochs[0] = { ...liveEpoch, rewardsDistributed: 0, endTimestamp: 9999 };
  };

  it('prunes expired returned names during the observation window', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredReturned = expired(3);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_returned_names');
    assert.equal(r.txId, 'tx-prune-returned');
    assert.deepEqual(r.progress, { index: 3, total: 3 });
    assert.ok(c.calls.includes('pruneReturned:3'));
  });

  it('does NOT consult config.next_returned_names_prune_timestamp (scans directly)', async () => {
    // The harness has no getArnsConfigRaw stub; if the step tried to gate on the
    // config timestamp it would blow up. Reaching prune proves it scans direct.
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredReturned = expired(1);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_returned_names');
  });

  it('caps the prune batch at pruneBatchSize and reports total', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredReturned = expired(20);
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      pruneBatchSize: 5,
    });
    assert.equal(r.action, 'prune_returned_names');
    assert.deepEqual(r.progress, { index: 5, total: 20 });
    assert.ok(c.calls.includes('pruneReturned:5'));
  });

  it('idles waiting_for_observations when nothing is expired', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredReturned = [];
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'waiting_for_observations');
  });

  it('enablePrune:false skips pruning even with expired names', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredReturned = expired(3);
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      enablePrune: false,
    });
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'waiting_for_observations');
    assert.ok(!c.calls.some((x) => x.startsWith('pruneReturned')));
  });

  it('throttles the scan by pruneScanIntervalMs (no re-scan within the window)', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredReturned = expired(3);
    const r1 = await c.crankEpochStep({ now: 5000 }); // default 60s; first call scans
    assert.equal(r1.action, 'prune_returned_names');
    const scansAfterFirst = c.calls.filter(
      (x) => x === 'getExpiredReturned',
    ).length;
    const r2 = await c.crankEpochStep({ now: 5000 }); // immediate → throttled
    assert.equal(r2.action, 'idle');
    assert.equal(r2.reason, 'waiting_for_observations');
    assert.equal(
      c.calls.filter((x) => x === 'getExpiredReturned').length,
      scansAfterFirst,
      'second call within the throttle window must not re-scan',
    );
  });

  it('prunes in the post-distribution tail (obs window passed, next epoch not started)', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, endTimestamp: 1000 }; // fully distributed
    c.expiredReturned = expired(2);
    // now >= endTimestamp(1000) → past obs; now < nextEpochStart(1100) → no create.
    const r = await c.crankEpochStep({ now: 1050, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_returned_names');
    assert.deepEqual(r.progress, { index: 2, total: 2 });
  });
});

describe('crankEpochStep — close observations before close_epoch', () => {
  // currentEpochIndex 10 → live target 9, retention 7 → closeTarget 2.
  // nextEpochStart = genesis(1000) + 10*duration(100) = 2000.
  const setup = (c: TestCranker, closeTargetEpoch: Partial<EpochRaw>) => {
    c.settings = { ...baseSettings, currentEpochIndex: 10 };
    c.epochs[9] = { ...liveEpoch, endTimestamp: 1000 };
    c.epochs[2] = { ...liveEpoch, ...closeTargetEpoch };
  };

  it('closes observations (not the epoch) when the retention target has open observations', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 3, observationsClosed: 0 });
    c.epochObservers[2] = [pk(1), pk(2), pk(3)];
    const r = await c.crankEpochStep({ now: 1900, epochRetention: 7 });
    assert.equal(r.action, 'close_observation');
    assert.equal(r.epochIndex, 2);
    assert.deepEqual(r.progress, { index: 3, total: 3 });
    assert.ok(c.calls.includes('closeObservations:2:3'));
    assert.ok(
      !c.calls.some((x) => x.startsWith('close:')),
      'must NOT call close_epoch while observations are open',
    );
  });

  it('caps the observation-close batch at 8', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 20, observationsClosed: 0 });
    c.epochObservers[2] = Array.from({ length: 20 }, (_, i) => pk(i + 1));
    const r = await c.crankEpochStep({ now: 1900, epochRetention: 7 });
    assert.equal(r.action, 'close_observation');
    assert.deepEqual(r.progress, { index: 8, total: 20 });
    assert.ok(c.calls.includes('closeObservations:2:8'));
  });

  it('closes the epoch once observations are fully closed', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 3, observationsClosed: 3 });
    const r = await c.crankEpochStep({ now: 1900, epochRetention: 7 });
    assert.equal(r.action, 'close');
    assert.equal(r.epochIndex, 2);
    assert.ok(!c.calls.some((x) => x.startsWith('closeObservations')));
  });

  it('does NOT wedge when close_epoch fails — falls through to create-next', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 0, observationsClosed: 0 });
    c.closeEpochError = new Error('EpochObservationsNotClosed');
    // now >= nextEpochStart(2000) → create-next must fire instead of wedging.
    const r = await c.crankEpochStep({ now: 5000, epochRetention: 7 });
    assert.equal(r.action, 'create');
    assert.ok(c.calls.includes('createEpoch'));
  });

  it('does not wedge on an orphaned observation counter (submitted>closed, no PDAs)', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 1, observationsClosed: 0 });
    c.epochObservers[2] = []; // counter says open but no PDA exists to close
    const r = await c.crankEpochStep({ now: 5000, epochRetention: 7 });
    assert.notEqual(r.action, 'close_observation');
    assert.notEqual(r.action, 'close');
    assert.equal(r.action, 'create'); // progression continues
  });
});
