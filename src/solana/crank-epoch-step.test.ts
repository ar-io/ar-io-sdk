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
  async closeEpoch(p: any): Promise<any> {
    this.calls.push(`close:${p.epochIndex}`);
    return { id: 'tx-close' };
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

  it('idle waiting_for_epoch when the current epoch account is missing', async () => {
    const c = new TestCranker();
    c.settings = { ...baseSettings, currentEpochIndex: 1 }; // target 0, not present
    const r = await c.crankEpochStep({ now: 1500 });
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
    const r = await c.crankEpochStep({ now: 1500, batchSize: 30 });
    assert.equal(r.action, 'tally');
    assert.deepEqual(r.progress, { index: 0, total: 10 });
    assert.ok(c.calls.includes('batch:0:30'));
    assert.ok(c.calls.some((x) => x.startsWith('tally:')));
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
});
