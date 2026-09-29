import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  AccountRole,
  type Address,
  type Instruction,
  getAddressDecoder,
} from '@solana/kit';

import { getAdminSetRewardRatiosInstructionDataDecoder } from '@ar.io/solana-contracts/gar';
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

  // `rpc` is injectable so a test can model an endpoint that reports the slot
  // a transaction executed in. The default bare stub exercises the opposite
  // case: an RPC that cannot, which is what forces the unpinned re-read path.
  constructor(rpc: unknown = {}) {
    super({
      rpc: rpc as never,
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
    // Return a COPY. The real implementation decodes a fresh object per call;
    // handing out the live fixture lets a caller alias harness state, which
    // silently breaks before/after comparisons.
    const e = this.epochs[i];
    return e ? { ...e } : null;
  }
  async getRegistryGatewayPDAs(
    start: number,
    n: number,
    cap?: number,
  ): Promise<Address[]> {
    this.calls.push(`batch:${start}:${n}`);
    // Honour the cap the way the real implementation does: the range is bounded
    // by the epoch's frozen activeGatewayCount, not by the live registry count.
    const end = Math.min(start + n, cap ?? Number.MAX_SAFE_INTEGER);
    const len = Math.max(0, Math.min(n, 5, end - start));
    return Array.from({ length: len }, (_, k) => pk(start + k + 10));
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
    // Advance the cursor the way the chain does — one slot per supplied
    // remaining_account. Without this the mock can never satisfy the D4a
    // progress assertion, and worse, it would mask the very defect that
    // assertion exists to catch (a tx that succeeds while advancing nothing).
    const e = this.epochs[p.epochIndex];
    if (e) {
      e.tallyIndex = Math.min(
        e.activeGatewayCount,
        e.tallyIndex + p.gatewayAccounts.length,
      );
      if (e.tallyIndex >= e.activeGatewayCount) e.weightsTallied = 1;
    }
    return { id: 'tx-tally' };
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async distributeEpoch(p: any): Promise<any> {
    this.calls.push(`distribute:${p.gatewayAccounts.length}`);
    const e = this.epochs[p.epochIndex];
    if (e) {
      e.distributionIndex = Math.min(
        e.activeGatewayCount,
        e.distributionIndex + p.gatewayAccounts.length,
      );
      if (e.distributionIndex >= e.activeGatewayCount) e.rewardsDistributed = 1;
    }
    return { id: 'tx-distribute' };
  }
  closeEpochError: Error | null = null;
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
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
  // filterLiveObservations stub — mirrors the SDK's stale-ghost guard without
  // touching RPC. Default is identity (every candidate is live); a test sets
  // `liveObservers[i]` to simulate getProgramAccounts returning already-closed
  // (stale-index) ghosts.
  liveObservers: Record<number, Address[]> | null = null;
  protected async filterLiveObservations(
    epochIndex: number,
    observers: string[],
  ): Promise<string[]> {
    this.calls.push(`filterLive:${epochIndex}:${observers.length}`);
    if (this.liveObservers === null) return observers;
    return this.liveObservers[epochIndex] ?? [];
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
  // The real one re-reads each candidate's PDAs to drop closed accounts
  // before the atomic batch; these tests stub the RPC and cover sequencing,
  // so keep every candidate. `compound-sweep.test.ts` covers the filter.
  protected async revalidateCompoundEntries<T>(entries: T[]): Promise<T[]> {
    return entries;
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

  // --- ArNS lifecycle steps: leases past grace (→ auction) and leases past
  // grace+auction (→ closed directly). Both default empty so every pre-existing
  // test keeps its old behaviour. ---
  pruneableToReturned: Array<{
    pubkey: Address;
    name: string;
    endTimestamp: bigint;
  }> = [];
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getPruneableToReturnedRecords(): Promise<any> {
    this.calls.push('getPruneableToReturned');
    return this.pruneableToReturned;
  }
  /** Name whose `pruneNameToReturned` should throw, for partial-drain tests. */
  pruneToReturnedFailOn?: string;
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async pruneNameToReturned(p: any): Promise<any> {
    this.calls.push(`pruneToReturned:${p.name}`);
    if (this.pruneToReturnedFailOn === p.name) {
      throw new Error(`boom:${p.name}`);
    }
    return { id: 'tx-prune-to-returned' };
  }

  expiredArns: Array<{
    pubkey: Address;
    name: string;
    endTimestamp: bigint;
  }> = [];
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getExpiredArnsRecords(): Promise<any> {
    this.calls.push('getExpiredArns');
    return this.expiredArns;
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async pruneExpiredNames(p: any): Promise<any> {
    this.calls.push(`pruneExpired:${p.arnsRecords.length}`);
    return { id: 'tx-prune-expired' };
  }

  // --- Gateway lifecycle stubs (finalize_gone + delegate claims). Both default
  // empty so every pre-existing test keeps its old behaviour. ---
  finalizable: Address[] = [];
  finalizableError: Error | null = null;
  /** Operators whose finalize_gone always fails. */
  finalizeFails = new Set<string>();
  async getFinalizableGoneGateways(
    _now: number,
  ): Promise<Array<{ pubkey: Address; operator: Address }>> {
    this.calls.push('getFinalizable');
    if (this.finalizableError) throw this.finalizableError;
    return this.finalizable.map((operator) => ({ pubkey: operator, operator }));
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async finalizeGone(p: any): Promise<any> {
    this.calls.push(`finalize:${p.gateway}`);
    if (this.finalizeFails.has(p.gateway)) {
      throw new Error('LatestEpochUnfinished');
    }
    return { id: `tx-finalize-${p.gateway}` };
  }

  claimable: Array<{
    gateway: Address;
    delegator: Address;
    amount: bigint;
    reason: 'leaving' | 'disabled';
  }> = [];
  /** `${gateway}/${delegator}` pairs whose claim always fails. */
  claimFails = new Set<string>();
  payerLamports = 10_000_000_000n;
  /** Lamports each successful claim costs the payer (Withdrawal rent). */
  claimCostLamports = 0n;
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async getClaimableDelegations(): Promise<any> {
    this.calls.push('getClaimable');
    return this.claimable;
  }
  /** 1-based balance read that throws, for RPC-failure tests. */
  payerLamportsFailOn?: number;
  private payerLamportsReads = 0;
  protected async getPayerLamports(): Promise<bigint> {
    this.payerLamportsReads++;
    if (this.payerLamportsReads === this.payerLamportsFailOn) {
      throw new Error('getBalance: 429 Too Many Requests');
    }
    return this.payerLamports;
  }
  private claim(
    kind: string,
    p: { gatewayAddress: string; delegatorAddress?: string },
  ) {
    const key = `${p.gatewayAddress}/${p.delegatorAddress}`;
    this.calls.push(`${kind}:${key}`);
    if (this.claimFails.has(key)) throw new Error(`claim failed ${key}`);
    this.payerLamports -= this.claimCostLamports;
    return { id: `tx-${kind}` };
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async claimDelegateFromLeavingGateway(p: any): Promise<any> {
    return this.claim('claimLeaving', p);
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stubs
  async claimDelegateFromDisabledGateway(p: any): Promise<any> {
    return this.claim('claimDisabled', p);
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

  it('closes only the LIVE observers, dropping stale-index ghosts', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 3, observationsClosed: 0 });
    // getProgramAccounts (getEpochObservers) returns 3 — but its index is stale.
    c.epochObservers[2] = [pk(1), pk(2), pk(3)];
    // Only pk(1) still exists on-chain; pk(2)/pk(3) were already closed.
    c.liveObservers = { 2: [pk(1)] };
    const r = await c.crankEpochStep({ now: 1900, epochRetention: 7 });
    assert.equal(r.action, 'close_observation');
    assert.ok(
      c.calls.includes('closeObservations:2:1'),
      'closes only the 1 live observer',
    );
    assert.ok(
      !c.calls.includes('closeObservations:2:3'),
      'never builds the doomed 3-wide batch that would revert AccountNotInitialized',
    );
  });

  it('does NOT attempt a close (no wedge) when every candidate is a stale ghost', async () => {
    const c = new TestCranker();
    setup(c, { observationsSubmitted: 3, observationsClosed: 0 });
    c.epochObservers[2] = [pk(1), pk(2), pk(3)];
    c.liveObservers = { 2: [] }; // all already closed; the counter is just stale
    const r = await c.crankEpochStep({ now: 1900, epochRetention: 7 });
    assert.ok(
      !c.calls.some((x) => x.startsWith('closeObservations:')),
      'must not submit a close_observations tx that would revert + wedge',
    );
    assert.ok(
      !c.calls.some((x) => x.startsWith('close:')),
      'must not attempt close_epoch with the counter still open',
    );
    assert.notEqual(
      r.action,
      'close_observation',
      'falls through to create-next instead of retrying a doomed batch',
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

// --- direct test of the REAL filterLiveObservations (the stale-ghost guard) ---
//
// Exercises the actual PDA-derive → getMultipleAccounts → `.exists` filter (not
// the TestCranker stub), with a mock RPC whose per-index existence we control.
function existenceRpc(exists: boolean[]) {
  return {
    getMultipleAccounts: (addrs: unknown[]) => ({
      send: async () => ({
        value: addrs.map((_a, i) =>
          exists[i]
            ? {
                data: ['', 'base64'],
                executable: false,
                lamports: 1n,
                owner: '11111111111111111111111111111111',
                rentEpoch: 0n,
                space: 0n,
              }
            : null,
        ),
      }),
    }),
  };
}

class LiveFilterHarness extends SolanaARIOWriteable {
  constructor(rpc: any) {
    super({
      rpc,
      rpcSubscriptions: {} as never,
      signer: { address: pk(99) } as never,
    } as never);
  }
  run(epochIndex: number, observers: string[]): Promise<string[]> {
    return this.filterLiveObservations(epochIndex, observers);
  }
}

describe('filterLiveObservations (stale getProgramAccounts ghost guard)', () => {
  it('keeps only observers whose Observation PDA still exists on a fresh read', async () => {
    const h = new LiveFilterHarness(existenceRpc([true, false, true]));
    const live = await h.run(5, [pk(1), pk(2), pk(3)]);
    assert.deepEqual(live, [pk(1), pk(3)]);
  });

  it('returns [] without any RPC call for an empty candidate set', async () => {
    let called = false;
    const rpc = {
      getMultipleAccounts: () => {
        called = true;
        return { send: async () => ({ value: [] }) };
      },
    };
    const h = new LiveFilterHarness(rpc as never);
    assert.deepEqual(await h.run(5, []), []);
    assert.equal(called, false, 'empty candidate set must not hit the RPC');
  });
});

// =========================================================================
// Built-instruction ABI (contracts ar-io-solana-contracts#116)
// =========================================================================
//
// The lifecycle tests above stub `closeObservations`, so they never build a
// real instruction. These tests exercise the REAL builders through a
// capturing `sendTransaction` override and assert the exact on-chain account
// list a cranker submits — the surface the observer / cranker follow-up has
// to match.

const SIGNER = pk(99); // the fee-paying caller (matches TestCranker's signer)
const OBSERVER_A = pk(7);
const OBSERVER_B = pk(8);

// A minimal but real `TransactionSigner`: Codama's account-meta factory only
// emits a *signer* meta (role WRITABLE_SIGNER / READONLY_SIGNER, with a
// `.signer` field) when the account value passes `isTransactionSigner` — i.e.
// carries at least one signing method. A bare `{ address }` is silently
// downgraded to a non-signer, so the stub must expose the signing surface.
const signerStub = {
  address: SIGNER,
  signTransactions: async () => [],
  signAndSendTransactions: async () => [],
};

/** Builds instructions but captures them instead of sending. */
class CaptureWriteable extends SolanaARIOWriteable {
  captured: Instruction[] = [];
  constructor() {
    super({
      rpc: {} as never,
      rpcSubscriptions: {} as never,
      signer: signerStub as never,
    } as never);
  }
  // Capture built instructions instead of sending them.
  protected async sendTransaction(
    instructions: Instruction[],
  ): Promise<string> {
    this.captured.push(...instructions);
    return 'captured-sig';
  }
}

describe('close_observation — rent routes to the observer, not the caller', () => {
  it('closeObservation builds [epoch, observation, observer, caller] with the observer as rent recipient', async () => {
    const c = new CaptureWriteable();
    await c.closeObservation({ epochIndex: 2, observer: OBSERVER_A });

    assert.equal(c.captured.length, 1);
    const accounts = c.captured[0].accounts ?? [];
    assert.equal(accounts.length, 4, 'no legacy `payer` account — 4 accounts');

    const [, , observer, caller] = accounts;
    // observer (index 2): the observation's recorded observer, writable, NON-signer.
    assert.equal(observer.address, OBSERVER_A);
    assert.equal(observer.role, AccountRole.WRITABLE);
    assert.ok(!('signer' in observer), 'observer must not sign');
    // caller (index 3): the fee-paying signer.
    assert.equal(caller.address, SIGNER);
    assert.equal(caller.role, AccountRole.WRITABLE_SIGNER);
    assert.ok('signer' in caller, 'caller must be the signer');
    // rent goes to the observer, which is distinct from the caller.
    assert.notEqual(observer.address, caller.address);
  });

  it('closeObservations emits one ix per observer, each routing rent to that observer', async () => {
    const c = new CaptureWriteable();
    await c.closeObservations({
      epochIndex: 2,
      observers: [OBSERVER_A, OBSERVER_B],
    });

    assert.equal(c.captured.length, 2);
    const [ixA, ixB] = c.captured;
    // ix[0]: rent → OBSERVER_A, signed by the caller.
    assert.equal(ixA.accounts?.[2].address, OBSERVER_A);
    assert.equal(ixA.accounts?.[3].address, SIGNER);
    // ix[1]: rent → OBSERVER_B, signed by the caller.
    assert.equal(ixB.accounts?.[2].address, OBSERVER_B);
    assert.equal(ixB.accounts?.[3].address, SIGNER);
  });
});

describe('adminSetRewardRatios — authority-signed epoch reward-split setter', () => {
  it('builds [epochSettings(writable), authority(signer)] carrying both u64 ratios', async () => {
    const c = new CaptureWriteable();
    await c.adminSetRewardRatios({
      gatewayRewardRatio: 900_000,
      observerRewardRatio: 100_000,
    });

    assert.equal(c.captured.length, 1);
    const ix = c.captured[0];
    const accounts = ix.accounts ?? [];
    assert.equal(accounts.length, 2);

    const [epochSettings, authority] = accounts;
    assert.equal(epochSettings.role, AccountRole.WRITABLE);
    assert.ok(!('signer' in epochSettings), 'epochSettings must not sign');
    assert.equal(authority.address, SIGNER);
    assert.equal(authority.role, AccountRole.READONLY_SIGNER);
    assert.ok('signer' in authority, 'authority must be the signer');

    // The instruction data carries both ratios as u64.
    const decoded = getAdminSetRewardRatiosInstructionDataDecoder().decode(
      ix.data,
    );
    assert.equal(decoded.gatewayRewardRatio, 900_000n);
    assert.equal(decoded.observerRewardRatio, 100_000n);
  });

  it('accepts bigint ratios and round-trips them through the encoder', async () => {
    const c = new CaptureWriteable();
    await c.adminSetRewardRatios({
      gatewayRewardRatio: 750_000n,
      observerRewardRatio: 250_000n,
    });
    const decoded = getAdminSetRewardRatiosInstructionDataDecoder().decode(
      c.captured[0].data,
    );
    assert.equal(decoded.gatewayRewardRatio, 750_000n);
    assert.equal(decoded.observerRewardRatio, 250_000n);
  });
});

describe('crankEpochStep — ArNS lease lifecycle (prune_name_to_returned / prune_expired_names)', () => {
  const leases = (n: number, tag = 40) =>
    Array.from({ length: n }, (_, i) => ({
      pubkey: pk(tag + i),
      name: `lease${i}`,
      endTimestamp: 0n,
    }));
  const returned = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      pubkey: pk(20 + i),
      name: `ret${i}`,
      returnedAt: 0n,
    }));

  // Live epoch parked in the observation window — the dominant idle state.
  const liveWaiting = (c: TestCranker) => {
    c.settings = { ...baseSettings };
    c.epochs[0] = { ...liveEpoch, rewardsDistributed: 0, endTimestamp: 9999 };
  };
  // Fully-distributed epoch, before the next one is due — the tail window.
  const tail = (c: TestCranker) => {
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1000 };
    c.compoundable = [];
    c.dfPeriod = { currentPeriod: 2, periodZeroStartTimestamp: 0 };
  };

  it('converts past-grace leases into returned-name auctions', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(3);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_name_to_returned');
    assert.equal(r.txId, 'tx-prune-to-returned');
    // one name per tx, but the whole backlog drains within the default budget
    assert.deepEqual(r.progress, { index: 3, total: 3 });
    assert.ok(c.calls.includes('pruneToReturned:lease0'));
    assert.ok(c.calls.includes('pruneToReturned:lease2'));
  });

  it('drains up to pruneToReturnedTxsPerCycle names per scan', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(25);
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      pruneToReturnedTxsPerCycle: 4,
    });
    assert.deepEqual(r.progress, { index: 4, total: 25 });
    assert.equal(
      c.calls.filter((x) => x.startsWith('pruneToReturned:')).length,
      4,
    );
  });

  it('defaults to 10 txs per scan', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(25);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.deepEqual(r.progress, { index: 10, total: 25 });
    // a clean budget-bounded drain must NOT look like a failure
    assert.equal(r.partialFailureReason, undefined);
  });

  it('scans getPruneableToReturnedRecords once per drain, not once per name', async () => {
    // The scan is a getProgramAccounts over every ArnsRecord; re-running it per
    // name would make draining a backlog quadratic in RPC cost.
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(10);
    await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(
      c.calls.filter((x) => x === 'getPruneableToReturned').length,
      1,
    );
  });

  it('reports partial progress when a later name fails mid-drain', async () => {
    // The deadline is per-name, so one unconvertible record must not forfeit
    // the whole cycle — the names already converted still count.
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(5);
    c.pruneToReturnedFailOn = 'lease2';
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_name_to_returned');
    assert.deepEqual(r.progress, { index: 2, total: 5 });
    // the caller must be able to tell a bounded drain from a broken one
    assert.match(String(r.partialFailureReason), /boom:lease2/);
    // stopped at the failure rather than ploughing on
    assert.ok(!c.calls.includes('pruneToReturned:lease3'));
  });

  it('rethrows when the very first name fails, so the step still surfaces errors', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(5);
    c.pruneToReturnedFailOn = 'lease0';
    await assert.rejects(
      () => c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 }),
      /boom:lease0/,
    );
  });

  it('never submits fewer than one tx even with a zero/negative budget', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(5);
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      pruneToReturnedTxsPerCycle: 0,
    });
    assert.deepEqual(r.progress, { index: 1, total: 5 });
  });

  it('prioritises prune_name_to_returned over both cleanup steps', async () => {
    // All three have work. The to-returned step is the only time-sensitive one:
    // miss the auction window and the auction is lost permanently.
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(1);
    c.expiredReturned = returned(5);
    c.expiredArns = leases(5, 60);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_name_to_returned');
    assert.ok(!c.calls.some((x) => x.startsWith('pruneReturned')));
    assert.ok(!c.calls.some((x) => x.startsWith('pruneExpired')));
  });

  it('closes past-auction leases once the earlier steps have nothing to do', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = [];
    c.expiredReturned = [];
    c.expiredArns = leases(4, 60);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_expired_names');
    assert.equal(r.txId, 'tx-prune-expired');
    assert.deepEqual(r.progress, { index: 4, total: 4 });
    assert.ok(c.calls.includes('pruneExpired:4'));
  });

  it('caps the expired-name batch at 26 (the 1232-byte tx ceiling)', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredArns = leases(100, 60);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_expired_names');
    assert.deepEqual(r.progress, { index: 26, total: 100 });
    assert.ok(c.calls.includes('pruneExpired:26'));
  });

  it('honours a smaller pruneExpiredBatchSize but never exceeds 26', async () => {
    const small = new TestCranker();
    liveWaiting(small);
    small.expiredArns = leases(100, 60);
    const r1 = await small.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      pruneExpiredBatchSize: 5,
    });
    assert.deepEqual(r1.progress, { index: 5, total: 100 });

    const big = new TestCranker();
    liveWaiting(big);
    big.expiredArns = leases(100, 60);
    const r2 = await big.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      pruneExpiredBatchSize: 250, // oversized caller value must be clamped
    });
    assert.deepEqual(r2.progress, { index: 26, total: 100 });
  });

  it('enablePruneToReturned:false leaves past-grace leases alone', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(3);
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      enablePruneToReturned: false,
    });
    assert.equal(r.action, 'idle');
    assert.ok(!c.calls.some((x) => x.startsWith('pruneToReturned')));
  });

  it('enablePruneExpired:false leaves past-auction leases alone', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.expiredArns = leases(3, 60);
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      enablePruneExpired: false,
    });
    assert.equal(r.action, 'idle');
    assert.ok(!c.calls.some((x) => x.startsWith('pruneExpired')));
  });

  it('throttles each scan independently so neither starves the other', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = leases(1);
    c.expiredArns = leases(3, 60);
    // default 60s throttle: first call scans + converts
    const r1 = await c.crankEpochStep({ now: 5000 });
    assert.equal(r1.action, 'prune_name_to_returned');
    const toReturnedScans = c.calls.filter(
      (x) => x === 'getPruneableToReturned',
    ).length;
    // immediate second call → to-returned scan throttled; must not re-scan
    const r2 = await c.crankEpochStep({ now: 5000 });
    assert.equal(
      c.calls.filter((x) => x === 'getPruneableToReturned').length,
      toReturnedScans,
      'throttled step must not re-scan within its window',
    );
    // ...while the expired step, on its own independent clock, is still free to
    // run this tick. That independence is the whole point: the to-returned
    // step's throttle must not starve the cleanup steps behind it.
    assert.equal(r2.action, 'prune_expired_names');
    // Third call: every scan is now inside its own window → genuinely idle.
    const r3 = await c.crankEpochStep({ now: 5000 });
    assert.equal(r3.action, 'idle');
  });

  it('also runs the lifecycle in the post-distribution tail', async () => {
    const c = new TestCranker();
    tail(c);
    c.pruneableToReturned = leases(2);
    const r = await c.crankEpochStep({ now: 1200, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_name_to_returned');
    assert.ok(c.calls.includes('pruneToReturned:lease0'));
  });

  it('idles when the whole ArNS lifecycle is clear', async () => {
    const c = new TestCranker();
    liveWaiting(c);
    c.pruneableToReturned = [];
    c.expiredReturned = [];
    c.expiredArns = [];
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'idle');
    assert.equal(r.reason, 'waiting_for_observations');
  });
});

describe('D4a — a distribute/tally that advances nothing must fail loudly', () => {
  // The defect these guard against is a SUCCESSFUL transaction. When the
  // supplied remaining_accounts do not cover the slots the on-chain loop needs
  // (registry.count having fallen below the epoch's frozen activeGatewayCount),
  // the loop body never runs, the cursor is written back unchanged, and the tx
  // confirms with no error. Mainnet epoch 542 and staging epoch 817 both sat
  // this way, looking healthy in transaction logs.
  const stuck: EpochRaw = {
    ...liveEpoch,
    activeGatewayCount: 647,
    distributionIndex: 633,
    weightsTallied: 1,
    prescriptionsDone: 1,
    rewardsDistributed: 0,
    endTimestamp: 1090,
  };

  it('throws when distribute leaves the cursor unmoved', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    // Simulate the silent no-op: the tx "succeeds" but advances nothing.
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    c.distributeEpoch = async (): Promise<any> => ({ id: 'tx-noop' });
    await assert.rejects(
      () => c.crankEpochStep({ now: 2000 }),
      /distribute of epoch 0 did not advance: cursor still 633\/647/,
    );
  });

  it('throws when tally leaves the cursor unmoved', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck, weightsTallied: 0, tallyIndex: 100 };
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    c.tallyWeights = async (): Promise<any> => ({ id: 'tx-noop' });
    await assert.rejects(
      () => c.crankEpochStep({ now: 2000 }),
      /tally of epoch 0 did not advance: cursor still 100\/647/,
    );
  });

  it('does NOT throw when the cursor advances normally', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    const r = await c.crankEpochStep({ now: 2000 });
    assert.equal(r.action, 'distribute');
  });

  // Regression: mainnet epoch 545 (2026-09-16) raised 17 of these alarms in 27
  // minutes against transactions that had all succeeded and paid rewards out —
  // the writes landed and the reads lagged behind them. An alarm that fires on
  // healthy work teaches operators to ignore the one error that means a human
  // must intervene, so a read must be known to reflect the write before its
  // answer is treated as evidence.
  it('tolerates a stale post-write read instead of reporting a stall', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    const preWrite = { ...stuck };
    let reads = 0;
    const real = c.getEpochRaw.bind(c);
    c.getEpochRaw = async (i: number, cfg?: any): Promise<any> => {
      reads += 1;
      // Read 1 is the tick's own state read. Read 2 is the post-write re-read,
      // answered by a replica still behind the slot that executed the write.
      if (reads === 2) return { ...preWrite };
      return real(i, cfg);
    };
    const r = await c.crankEpochStep({ now: 2000, cursorRereadDelayMs: 0 });
    assert.equal(r.action, 'distribute');
    assert.ok(
      reads >= 3,
      `expected a re-read after the stale answer, got ${reads}`,
    );
  });

  it('still throws when every re-read shows the cursor unmoved', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    c.distributeEpoch = async (): Promise<any> => ({ id: 'tx-noop' });
    let reads = 0;
    const real = c.getEpochRaw.bind(c);
    c.getEpochRaw = async (i: number, cfg?: any): Promise<any> => {
      reads += 1;
      return real(i, cfg);
    };
    await assert.rejects(
      () =>
        c.crankEpochStep({
          now: 2000,
          cursorRereadDelayMs: 0,
          cursorRereadAttempts: 3,
        }),
      /distribute of epoch 0 did not advance: cursor still 633\/647/,
    );
    // 1 tick read + 3 re-reads: the guard keeps its teeth, it just stops
    // convicting on a single possibly-stale sample.
    assert.equal(reads, 4);
  });

  it('pins the post-write read to the slot that executed the tx', async () => {
    const c = new TestCranker({
      getSignatureStatuses: () => ({
        send: async () => ({ value: [{ slot: 12345n }] }),
      }),
    });
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    const seen: (bigint | undefined)[] = [];
    const real = c.getEpochRaw.bind(c);
    c.getEpochRaw = async (i: number, cfg?: any): Promise<any> => {
      seen.push(cfg?.minContextSlot);
      return real(i, cfg);
    };
    const r = await c.crankEpochStep({ now: 2000, cursorRereadDelayMs: 0 });
    assert.equal(r.action, 'distribute');
    // A pinned read cannot be stale, so exactly one is taken.
    assert.deepEqual(seen, [undefined, 12345n]);
  });

  it('still fails loudly when a pinned read shows no movement', async () => {
    const c = new TestCranker({
      getSignatureStatuses: () => ({
        send: async () => ({ value: [{ slot: 12345n }] }),
      }),
    });
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    c.distributeEpoch = async (): Promise<any> => ({ id: 'tx-noop' });
    await assert.rejects(
      () => c.crankEpochStep({ now: 2000, cursorRereadDelayMs: 0 }),
      /distribute of epoch 0 did not advance: cursor still 633\/647/,
    );
  });

  it('never falls back to an unpinned read once the slot is known', async () => {
    // An unpinned read here would return the pre-write cursor — the exact
    // stale answer pinning exists to reject — and the assertion would then
    // report a stall that never happened, reintroducing the bug.
    const c = new TestCranker({
      getSignatureStatuses: () => ({
        send: async () => ({ value: [{ slot: 12345n }] }),
      }),
    });
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    const seen: (bigint | undefined)[] = [];
    const real = c.getEpochRaw.bind(c);
    c.getEpochRaw = async (i: number, cfg?: any): Promise<any> => {
      seen.push(cfg?.minContextSlot);
      // A non-retryable failure keeps this test fast: withRetry gives up on the
      // first attempt, reaching the same exhaustion path a persistent -32016
      // arrives at once its budget runs out.
      if (cfg?.minContextSlot !== undefined) throw new Error('rpc unavailable');
      return real(i, cfg);
    };
    await assert.rejects(
      () => c.crankEpochStep({ now: 2000, cursorRereadDelayMs: 0 }),
      /could not verify the post-write cursor for epoch 0/,
    );
    // The tick's own state read, then the pinned attempt — and nothing after.
    assert.deepEqual(seen, [undefined, 12345n]);
  });

  // getEpochRaw reports BOTH a missing account and a failed decode as null. A
  // null reaching assertCursorAdvanced collapses to the pre-write cursor, so an
  // empty read would be convicted as a stall — the same false alarm by a
  // different route.
  it('reports a freshness failure when every re-read comes back empty', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    let reads = 0;
    const real = c.getEpochRaw.bind(c);
    c.getEpochRaw = async (i: number, cfg?: any): Promise<any> => {
      reads += 1;
      // The tick's own state read succeeds; every post-write re-read is empty.
      return reads === 1 ? real(i, cfg) : null;
    };
    await assert.rejects(
      () =>
        c.crankEpochStep({
          now: 2000,
          cursorRereadDelayMs: 0,
          cursorRereadAttempts: 2,
        }),
      (err: Error) =>
        /could not verify the post-write cursor for epoch 0/.test(
          err.message,
        ) && !/did not advance/.test(err.message),
    );
  });

  it('reports a freshness failure when the pinned read comes back empty', async () => {
    const c = new TestCranker({
      getSignatureStatuses: () => ({
        send: async () => ({ value: [{ slot: 12345n }] }),
      }),
    });
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    const real = c.getEpochRaw.bind(c);
    c.getEpochRaw = async (i: number, cfg?: any): Promise<any> =>
      cfg?.minContextSlot === undefined ? real(i, cfg) : null;
    await assert.rejects(
      () => c.crankEpochStep({ now: 2000, cursorRereadDelayMs: 0 }),
      (err: Error) =>
        /could not verify the post-write cursor for epoch 0/.test(
          err.message,
        ) && !/did not advance/.test(err.message),
    );
  });

  it('caps the batch range by activeGatewayCount, not registry.count', async () => {
    const c = new TestCranker();
    let sawCap: number | undefined;
    const orig = c.getRegistryGatewayPDAs.bind(c);
    c.getRegistryGatewayPDAs = async (
      sIdx: number,
      n: number,
      cap?: number,
    ) => {
      sawCap = cap;
      return orig(sIdx, n, cap);
    };
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...stuck };
    await c.crankEpochStep({ now: 2000 });
    assert.equal(sawCap, 647);
  });
});

describe('crankEpochStep — finalize departed gateways between epochs (ADR-0036)', () => {
  // Epoch 2 is distributed and epoch 3 is due (nextEpochStart = 1300): the only
  // window in which finalize_gone can succeed.
  function inWindow(): TestCranker {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1300 };
    return c;
  }
  const count = (c: TestCranker, prefix: string) =>
    c.calls.filter((x) => x.startsWith(prefix)).length;

  it('finalizes eligible gateways after distribution, BEFORE creating the next epoch', async () => {
    const c = inWindow();
    c.finalizable = [pk(5), pk(6)];
    const first = await c.crankEpochStep({ now: 1400 });
    assert.equal(first.action, 'finalize_gone');
    assert.equal(first.epochIndex, 2);
    assert.deepEqual(first.progress, { index: 2, total: 2 });
    assert.equal(first.partialFailureReason, undefined);
    assert.ok(
      !c.calls.includes('createEpoch'),
      'create must wait for finalize',
    );

    const second = await c.crankEpochStep({ now: 1400 });
    assert.equal(second.action, 'create');
    assert.equal(count(c, 'finalize:'), 2);
    assert.ok(
      c.calls.indexOf('createEpoch') > c.calls.lastIndexOf(`finalize:${pk(6)}`),
    );
  });

  it('an always-failing gateway is tried twice, then the next epoch is still created', async () => {
    const c = inWindow();
    c.finalizable = [pk(5)];
    c.finalizeFails.add(pk(5) as string);
    const results = [];
    for (let i = 0; i < 6; i++) {
      const r = await c.crankEpochStep({ now: 1400 });
      results.push(r);
      if (r.action === 'create') break;
    }
    assert.deepEqual(
      results.map((r) => r.action),
      ['finalize_gone', 'finalize_gone', 'create'],
    );
    assert.equal(count(c, 'finalize:'), 2);
    assert.match(
      results[0].partialFailureReason ?? '',
      /LatestEpochUnfinished/,
    );
    // Consecutive results must differ so a caller's no-progress guard doesn't
    // end its drain before create.
    assert.notDeepEqual(results[0].progress, results[1].progress);
  });

  it('a failure does not stop the rest of the batch', async () => {
    const c = inWindow();
    c.finalizable = [pk(5), pk(6), pk(7)];
    c.finalizeFails.add(pk(6) as string);
    const r = await c.crankEpochStep({ now: 1400 });
    assert.equal(r.action, 'finalize_gone');
    assert.equal(r.txId, `tx-finalize-${pk(7)}`);
    assert.deepEqual(r.progress, { index: 2, total: 3 });
    assert.ok(r.partialFailureReason);
  });

  it('never finalizes during the observation window or before distribution completes', async () => {
    const live = new TestCranker();
    live.settings = { ...baseSettings, currentEpochIndex: 1 };
    live.epochs[0] = {
      ...liveEpoch,
      rewardsDistributed: 0,
      endTimestamp: 9999,
    };
    live.finalizable = [pk(5)];
    assert.equal((await live.crankEpochStep({ now: 5000 })).action, 'idle');

    const undistributed = new TestCranker();
    undistributed.settings = { ...baseSettings, currentEpochIndex: 1 };
    undistributed.epochs[0] = {
      ...liveEpoch,
      rewardsDistributed: 0,
      endTimestamp: 1000,
    };
    undistributed.finalizable = [pk(5)];
    assert.equal(
      (await undistributed.crankEpochStep({ now: 5000 })).action,
      'distribute',
    );

    for (const c of [live, undistributed]) {
      assert.equal(count(c, 'getFinalizable'), 0);
      assert.equal(count(c, 'finalize:'), 0);
    }
  });

  it('scans once per window, batches per step, and caps the window at finalizeGoneMaxPerEpoch', async () => {
    const c = inWindow();
    c.finalizable = [pk(5), pk(6), pk(7), pk(8), pk(9)];
    const opts = {
      now: 1400,
      finalizeGoneTxsPerStep: 2,
      finalizeGoneMaxPerEpoch: 3,
    };
    const a = await c.crankEpochStep(opts);
    const b = await c.crankEpochStep(opts);
    const d = await c.crankEpochStep(opts);
    assert.deepEqual(a.progress, { index: 2, total: 3 });
    assert.deepEqual(b.progress, { index: 1, total: 1 });
    assert.equal(d.action, 'create');
    assert.equal(count(c, 'getFinalizable'), 1);
    assert.equal(count(c, 'finalize:'), 3);
  });

  it('rescans in the next window', async () => {
    const c = inWindow();
    c.finalizable = [pk(5)];
    await c.crankEpochStep({ now: 1400 }); // finalize
    await c.crankEpochStep({ now: 1400 }); // create 3
    c.settings = { ...c.settings, currentEpochIndex: 4 };
    c.epochs[3] = { ...liveEpoch, endTimestamp: 1400 };
    c.finalizable = [pk(6)];
    const r = await c.crankEpochStep({ now: 1500 });
    assert.equal(r.action, 'finalize_gone');
    assert.equal(r.epochIndex, 3);
    assert.ok(c.calls.includes(`finalize:${pk(6)}`));
    assert.equal(count(c, 'getFinalizable'), 2);
  });

  it('a discovery failure does not block creating the next epoch', async () => {
    const c = inWindow();
    c.finalizableError = new Error('429');
    assert.equal((await c.crankEpochStep({ now: 1400 })).action, 'create');
  });

  it('enableFinalizeGone:false never finalizes', async () => {
    const c = inWindow();
    c.finalizable = [pk(5)];
    const r = await c.crankEpochStep({ now: 1400, enableFinalizeGone: false });
    assert.equal(r.action, 'create');
    assert.equal(count(c, 'getFinalizable'), 0);
  });
});

describe('crankEpochStep — claim delegations out of leaving / disabled gateways', () => {
  function observing(): TestCranker {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 };
    c.epochs[0] = { ...liveEpoch, rewardsDistributed: 0, endTimestamp: 9999 };
    return c;
  }
  const leaving = {
    gateway: pk(5),
    delegator: pk(6),
    amount: 10n,
    reason: 'leaving' as const,
  };
  const disabled = {
    gateway: pk(7),
    delegator: pk(8),
    amount: 20n,
    reason: 'disabled' as const,
  };

  it("claims each delegation on the delegate's behalf with the matching instruction", async () => {
    const c = observing();
    c.claimable = [leaving, disabled];
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'claim_delegate');
    assert.deepEqual(r.progress, { index: 2, total: 2 });
    assert.equal(r.partialFailureReason, undefined);
    assert.ok(c.calls.includes(`claimLeaving:${pk(5)}/${pk(6)}`));
    assert.ok(c.calls.includes(`claimDisabled:${pk(7)}/${pk(8)}`));
    assert.ok(!c.calls.includes(`claimDisabled:${pk(5)}/${pk(6)}`));
    assert.ok(!c.calls.includes(`claimLeaving:${pk(7)}/${pk(8)}`));
  });

  it('a failing claim does not stop the rest, and is reported', async () => {
    const c = observing();
    c.claimable = [leaving, disabled];
    c.claimFails.add(`${pk(5)}/${pk(6)}`);
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'claim_delegate');
    assert.deepEqual(r.progress, { index: 1, total: 2 });
    assert.match(r.partialFailureReason ?? '', /claim leaving/);
  });

  it('permanently failing claims cannot starve the rest of the backlog', async () => {
    const c = observing();
    // 3 failing claims fill a budget of 3; the 4th is healthy.
    const failing = [pk(20), pk(21), pk(22)].map((d) => ({
      ...leaving,
      delegator: d,
    }));
    const healthy = { ...leaving, delegator: pk(23) };
    c.claimable = [...failing, healthy];
    for (const f of failing) c.claimFails.add(`${f.gateway}/${f.delegator}`);
    const opts = {
      now: 5000,
      pruneScanIntervalMs: 0,
      delegateSweepTxsPerCycle: 3,
    };
    const first = await c.crankEpochStep(opts);
    assert.deepEqual(first.progress, { index: 0, total: 4 });
    const second = await c.crankEpochStep(opts);
    assert.equal(second.progress?.index, 1);
    assert.ok(c.calls.includes(`claimLeaving:${pk(5)}/${pk(23)}`));
  });

  it('checks the payer floor before EVERY claim and reports the pause', async () => {
    const c = observing();
    c.claimable = [leaving, disabled, { ...leaving, delegator: pk(9) }];
    c.payerLamports = 1_000n;
    c.claimCostLamports = 300n;
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      delegateSweepMinPayerLamports: 500n,
    });
    // 1000 → 700 → 400: the third claim would start below the floor.
    assert.deepEqual(r.progress, { index: 2, total: 3 });
    assert.match(
      r.partialFailureReason ?? '',
      /below delegateSweepMinPayerLamports/,
    );
  });

  it('a failed balance read stops the sweep but still reports the claims already sent', async () => {
    const c = observing();
    c.claimable = [leaving, disabled, { ...leaving, delegator: pk(9) }];
    c.payerLamportsFailOn = 2;
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'claim_delegate');
    assert.equal(r.txId, 'tx-claimLeaving');
    assert.deepEqual(r.progress, { index: 1, total: 3 });
    assert.match(
      r.partialFailureReason ?? '',
      /could not read signer balance: .*429/,
    );
    assert.equal(c.calls.filter((x) => x.startsWith('claim')).length, 1);
  });

  it('a failed balance read before any claim reports instead of throwing', async () => {
    const c = observing();
    c.claimable = [leaving];
    c.payerLamportsFailOn = 1;
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'claim_delegate');
    assert.deepEqual(r.progress, { index: 0, total: 1 });
    assert.match(r.partialFailureReason ?? '', /could not read signer balance/);
  });

  it('with the default floor, a signer under 0.5 SOL claims nothing', async () => {
    const c = observing();
    c.claimable = [leaving];
    c.payerLamports = 499_999_999n;
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.deepEqual(r.progress, { index: 0, total: 1 });
    assert.equal(c.calls.filter((x) => x.startsWith('claim')).length, 0);
  });

  it('is throttled by pruneScanIntervalMs, so a paused sweep lets the step go idle', async () => {
    const c = observing();
    c.claimable = [leaving];
    c.payerLamports = 0n;
    const first = await c.crankEpochStep({ now: 5000 });
    assert.equal(first.action, 'claim_delegate');
    const second = await c.crankEpochStep({ now: 5000 });
    assert.equal(second.action, 'idle');
    assert.equal(second.reason, 'waiting_for_observations');
    assert.equal(c.calls.filter((x) => x === 'getClaimable').length, 1);
  });

  it('never claims in the post-distribution tail, so create_epoch is not delayed', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 3 };
    c.epochs[2] = { ...liveEpoch, endTimestamp: 1300 };
    c.claimable = [leaving];
    const r = await c.crankEpochStep({ now: 1400, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'create');
    assert.equal(c.calls.filter((x) => x === 'getClaimable').length, 0);
  });

  it('yields to the ArNS lease lifecycle, which has deadlines', async () => {
    const c = observing();
    c.claimable = [leaving];
    c.pruneableToReturned = [
      { pubkey: pk(40), name: 'late', endTimestamp: 1n },
    ];
    const r = await c.crankEpochStep({ now: 5000, pruneScanIntervalMs: 0 });
    assert.equal(r.action, 'prune_name_to_returned');
    assert.equal(c.calls.filter((x) => x === 'getClaimable').length, 0);
  });

  it('enableDelegateSweep:false never claims', async () => {
    const c = observing();
    c.claimable = [leaving];
    const r = await c.crankEpochStep({
      now: 5000,
      pruneScanIntervalMs: 0,
      enableDelegateSweep: false,
    });
    assert.equal(r.action, 'idle');
    assert.equal(c.calls.filter((x) => x === 'getClaimable').length, 0);
  });
});
