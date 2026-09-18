/**
 * The ArNS gateway-operator discount (ario-arns `try_apply_gateway_discount`).
 *
 * The program only discounts a purchase that carries the gateway's PDA, and it
 * REJECTS the purchase if that gateway does not qualify. These tests pin the
 * SDK's eligibility check to the program's, check that every purchase path
 * attaches the gateway exactly when it qualifies, and that funding plans are
 * sized to the discounted total the program checks them against.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  AccountRole,
  type Address,
  type Instruction,
  address,
  createSolanaRpc,
  generateKeyPairSigner,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/kit';

import {
  ArioArnsInstruction,
  getBuyNameFromFundingPlanInstructionDataDecoder,
  getBuyReturnedNameFromFundingPlanInstructionDataDecoder,
  getExtendLeaseFromFundingPlanInstructionDataDecoder,
  identifyArioArnsInstruction,
} from '@ar.io/solana-contracts/arns';
import {
  type Gateway as GarGatewayAccount,
  GatewayStatus,
  Protocol,
  getGatewayDecoder,
  getGatewayEncoder,
} from '@ar.io/solana-contracts/gar';
import {
  GATEWAY_DISCOUNT_MIN_TENURE_SECONDS,
  OPERATOR_DISCOUNT_INTENTS,
  applyGatewayOperatorDiscount,
  gatewayDiscountIneligibility,
} from './gateway-discount.js';
import { SolanaARIOReadable } from './io-readable.js';
import { SolanaARIOWriteable } from './io-writeable.js';
import { getGatewayPDA } from './pda.js';
import { estimateCompiledTxSize } from './send.js';

const ZERO = address('11111111111111111111111111111111');
const OPERATOR = address('GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const STALE_KEY = address('GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
const V1_1_0 = { major: 1, minor: 1, patch: 0 };
const V1_2_0 = { major: 1, minor: 2, patch: 0 };

/** Seconds; the gateway started exactly one tenure period before this. */
const NOW = 2_000_000_000n;
const START = NOW - GATEWAY_DISCOUNT_MIN_TENURE_SECONDS;
const COST = 12_500_000_000n;

function addressFor(n: number): Address {
  return getAddressDecoder().decode(new Uint8Array(32).fill(n + 1));
}

type GatewayOpts = {
  operator?: Address;
  operationsAddress?: Address;
  version?: { major: number; minor: number; patch: number };
  status?: GatewayStatus;
  startTimestamp?: bigint;
  passedEpochs?: number;
  totalEpochs?: number;
};

function encodeGateway(o: GatewayOpts = {}): Uint8Array {
  const operator = o.operator ?? OPERATOR;
  return getGatewayEncoder().encode({
    operator,
    label: 'lbl',
    fqdn: 'gw.example',
    port: 443,
    protocol: Protocol.Https,
    properties: '',
    note: '',
    operatorStake: 20_000_000_000n,
    totalDelegatedStake: 0n,
    status: o.status ?? GatewayStatus.Joined,
    startTimestamp: o.startTimestamp ?? START,
    leaveTimestamp: null,
    leaveEpochDuration: 0n,
    stats: {
      passedEpochs: o.passedEpochs ?? 0,
      failedEpochs: 0,
      totalEpochs: o.totalEpochs ?? 0,
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
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      minDelegationAmount: 0n,
      allowlistEnabled: false,
      pendingDelegateRewardShareRatio: null,
      delegationDisabledAt: null,
    },
    registryIndex: { index: 0, _reserved: 0 },
    observerAddress: operator,
    cumulativeRewardPerToken: 0n,
    bump: 254,
    version: o.version ?? V1_2_0,
    operationsAddress: o.operationsAddress ?? operator,
  });
}

function gateway(o: GatewayOpts = {}): GarGatewayAccount {
  return getGatewayDecoder().decode(encodeGateway(o));
}

// ---------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------

describe('applyGatewayOperatorDiscount', () => {
  it('matches the program vectors (pricing.rs tests)', () => {
    assert.equal(applyGatewayOperatorDiscount(1000n), 800n);
    assert.equal(
      applyGatewayOperatorDiscount(12_500_000_000n),
      10_000_000_000n,
    );
  });

  it('floors the discount, not the result', () => {
    // 7 * 200_000 / 1e6 = 1.4 → discount 1 → 6
    assert.equal(applyGatewayOperatorDiscount(7n), 6n);
    assert.equal(applyGatewayOperatorDiscount(4n), 4n);
  });

  it('is exact beyond Number precision', () => {
    const big = 2n ** 60n + 3n;
    assert.equal(
      applyGatewayOperatorDiscount(big),
      big - (big * 200_000n) / 1_000_000n,
    );
  });
});

describe('OPERATOR_DISCOUNT_INTENTS', () => {
  it('covers the ArNS purchases and excludes primary names (ario-core)', () => {
    for (const intent of [
      'Buy-Name',
      'Buy-Record',
      'Extend-Lease',
      'Increase-Undername-Limit',
      'Upgrade-Name',
    ] as const) {
      assert.ok(OPERATOR_DISCOUNT_INTENTS.has(intent), intent);
    }
    assert.equal(OPERATOR_DISCOUNT_INTENTS.has('Primary-Name-Request'), false);
  });
});

describe('gatewayDiscountIneligibility', () => {
  it('accepts the operator at exactly the tenure and pass-rate thresholds', () => {
    // (1 + 8) * 1e6 / (1 + 9) = 900_000
    const gw = gateway({ passedEpochs: 8, totalEpochs: 9 });
    assert.equal(gatewayDiscountIneligibility(gw, OPERATOR, NOW), undefined);
  });

  it('rejects one second short of the tenure', () => {
    assert.equal(
      gatewayDiscountIneligibility(gateway(), OPERATOR, NOW - 1n),
      'tenure',
    );
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ startTimestamp: NOW + 10n }),
        OPERATOR,
        NOW,
      ),
      'tenure',
    );
  });

  it('floors the pass rate as the program does', () => {
    // (1 + 7) * 1e6 / (1 + 9) = 800_000
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ passedEpochs: 7, totalEpochs: 9 }),
        OPERATOR,
        NOW,
      ),
      'performance',
    );
    // (1 + 898) * 1e6 / (1 + 999) = 899_000 — just under
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ passedEpochs: 898, totalEpochs: 999 }),
        OPERATOR,
        NOW,
      ),
      'performance',
    );
  });

  it('rejects a leaving gateway', () => {
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ status: GatewayStatus.Leaving }),
        OPERATOR,
        NOW,
      ),
      'not-joined',
    );
  });

  it('honours the operations address only from 1.2.0 and never the zero key', async () => {
    const delegate = (await generateKeyPairSigner()).address;
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ operationsAddress: delegate }),
        delegate,
        NOW,
      ),
      undefined,
    );
    // Below 1.2.0 the field is stale tail bytes (contracts #142).
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ version: V1_1_0, operationsAddress: STALE_KEY }),
        STALE_KEY,
        NOW,
      ),
      'not-authorised',
    );
    assert.equal(
      gatewayDiscountIneligibility(
        gateway({ operationsAddress: ZERO }),
        ZERO,
        NOW,
      ),
      'not-authorised',
    );
    assert.equal(
      gatewayDiscountIneligibility(gateway(), delegate, NOW),
      'not-authorised',
    );
  });
});

// ---------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------

const MINT = addressFor(1);
const TREASURY = addressFor(2);
const STAKE_POOL = addressFor(3);
const FUNDING_SOURCE = addressFor(4);
const WITHDRAWAL_COUNTER = addressFor(5);
const INITIATOR_BYTES = new Uint8Array(32).fill(7);
const ANT = addressFor(7);

class StubWriteable extends SolanaARIOWriteable {
  sent: Instruction[][] = [];
  planCosts: bigint[] = [];

  constructor(
    signer: Awaited<ReturnType<typeof generateKeyPairSigner>>,
    private readonly gateways: Map<string, GarGatewayAccount>,
    rpc: object = {},
  ) {
    super({
      rpc: rpc as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as any,
      signer,
    });
    // Private helpers that would otherwise read chain state.
    const self = this as any;
    self.getArnsConfig = async () => ({ mint: MINT, treasury: TREASURY });
    self.getGarConfig = async () => ({
      mint: MINT,
      stakeTokenAccount: STAKE_POOL,
      protocolTokenAccount: TREASURY,
    });
    self._buildMigrateArnsRecordIxIfNeeded = async () => [];
    self._buildSyncAttributesIxIfOwner = async () => undefined;
    self._simulateTokenCost = async () => COST;
    self._resolveFundingPlan = async (_params: unknown, cost: bigint) => {
      this.planCosts.push(cost);
      return {
        sources: [{ kind: 'balance', amount: cost }],
        gatewayPerSource: [undefined],
        residueDelegationIndexes: [],
        hasBalanceSource: true,
      };
    };
    self._materializeFundingPlan = async () => ({
      remainingAccounts: [
        { address: FUNDING_SOURCE, role: AccountRole.WRITABLE },
      ],
      withdrawalCounter: WITHDRAWAL_COUNTER,
      residueVaultCount: 0,
    });
  }

  get gar(): Address {
    return this.garProgram;
  }

  protected async fetchGatewayAccount(
    pda: Address,
  ): Promise<GarGatewayAccount | null> {
    return this.gateways.get(pda) ?? null;
  }

  protected async getClusterUnixTimestampSeconds(): Promise<number> {
    return Number(NOW);
  }

  protected async sendTransaction(
    instructions: Instruction[],
  ): Promise<string> {
    this.sent.push(instructions);
    return `sig-${this.sent.length}`;
  }
}

async function stubWith(
  signer: Awaited<ReturnType<typeof generateKeyPairSigner>>,
  entries: Array<[Address, GarGatewayAccount]>,
  rpc?: object,
): Promise<{ w: StubWriteable; pdaOf: (op: Address) => Promise<Address> }> {
  const map = new Map<string, GarGatewayAccount>();
  const w = new StubWriteable(signer, map, rpc);
  const pdaOf = async (op: Address) => (await getGatewayPDA(op, w.gar))[0];
  for (const [op, gw] of entries) map.set(await pdaOf(op), gw);
  return { w, pdaOf };
}

function arnsIx(sent: Instruction[][], kind: ArioArnsInstruction) {
  const all = sent.flat();
  const found = all.find((ix) => {
    try {
      return identifyArioArnsInstruction(ix as any) === kind;
    } catch {
      return false;
    }
  });
  assert.ok(found, `expected a ${ArioArnsInstruction[kind]} instruction`);
  return found as Instruction & {
    accounts: { address: Address; role: AccountRole }[];
    data: Uint8Array;
  };
}

describe('buyRecord operator discount', () => {
  it('attaches the signer’s own gateway when it qualifies (balance)', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    await w.buyRecord({ name: 'discounted', type: 'permabuy', processId: ANT });
    const ix = arnsIx(w.sent, ArioArnsInstruction.BuyName);
    const last = ix.accounts[ix.accounts.length - 1];
    assert.equal(last.address, await pdaOf(signer.address));
    assert.equal(last.role, AccountRole.READONLY);
  });

  it('attaches nothing when the signer has no qualifying gateway', async () => {
    const signer = await generateKeyPairSigner();
    const young = await stubWith(signer, [
      [
        signer.address,
        gateway({ operator: signer.address, startTimestamp: NOW }),
      ],
    ]);
    const none = await stubWith(signer, []);
    const withGw = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    for (const s of [young, none, withGw]) {
      await s.w.buyRecord({ name: 'x', type: 'permabuy', processId: ANT });
    }
    const len = (s: typeof young) =>
      arnsIx(s.w.sent, ArioArnsInstruction.BuyName).accounts.length;
    assert.equal(len(young), len(none));
    assert.equal(len(withGw), len(none) + 1);
  });

  it('lets an operations address claim through the named gateway', async () => {
    const delegate = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(delegate, [
      [OPERATOR, gateway({ operationsAddress: delegate.address })],
    ]);
    await w.buyRecord({
      name: 'delegated',
      type: 'lease',
      years: 1,
      processId: ANT,
      discountGatewayAddress: OPERATOR,
    });
    const ix = arnsIx(w.sent, ArioArnsInstruction.BuyName);
    assert.equal(
      ix.accounts[ix.accounts.length - 1].address,
      await pdaOf(OPERATOR),
    );
  });

  it('refuses an explicit gateway that does not qualify, sending nothing', async () => {
    const delegate = await generateKeyPairSigner();
    const stale = await stubWith(delegate, [
      [
        OPERATOR,
        gateway({ version: V1_1_0, operationsAddress: delegate.address }),
      ],
    ]);
    await assert.rejects(
      () =>
        stale.w.buyRecord({
          name: 'x',
          type: 'permabuy',
          processId: ANT,
          discountGatewayAddress: OPERATOR,
        }),
      /does not qualify.*neither its operator nor its operations address/,
    );
    const missing = await stubWith(delegate, []);
    await assert.rejects(
      () =>
        missing.w.buyRecord({
          name: 'x',
          type: 'permabuy',
          processId: ANT,
          discountGatewayAddress: OPERATOR,
        }),
      /No gateway found/,
    );
    assert.equal(stale.w.sent.length + missing.w.sent.length, 0);
  });

  it('funding plan: sized to the discounted cost, gateway first, count 1', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    await w.buyRecord({
      name: 'planned',
      type: 'permabuy',
      processId: ANT,
      fundFrom: 'any',
    });
    assert.deepEqual(w.planCosts, [applyGatewayOperatorDiscount(COST)]);
    const ix = arnsIx(w.sent, ArioArnsInstruction.BuyNameFromFundingPlan);
    const data = getBuyNameFromFundingPlanInstructionDataDecoder().decode(
      ix.data,
    );
    assert.equal(data.discountAccountCount, 1);
    assert.equal(data.sources[0].amount, applyGatewayOperatorDiscount(COST));
    const [first, second] = ix.accounts.slice(-2);
    assert.equal(first.address, await pdaOf(signer.address));
    assert.equal(first.role, AccountRole.READONLY);
    assert.equal(second.address, FUNDING_SOURCE);
  });

  it('funding plan without a discount: full cost, count 0, sources only', async () => {
    const signer = await generateKeyPairSigner();
    const { w } = await stubWith(signer, []);
    await w.buyRecord({
      name: 'planned',
      type: 'permabuy',
      processId: ANT,
      fundFrom: 'any',
    });
    assert.deepEqual(w.planCosts, [COST]);
    const ix = arnsIx(w.sent, ArioArnsInstruction.BuyNameFromFundingPlan);
    const data = getBuyNameFromFundingPlanInstructionDataDecoder().decode(
      ix.data,
    );
    assert.equal(data.discountAccountCount, 0);
    assert.equal(ix.accounts[ix.accounts.length - 1].address, FUNDING_SOURCE);
    assert.notEqual(
      ix.accounts[ix.accounts.length - 2].address,
      FUNDING_SOURCE,
    );
  });
});

describe('manage operations operator discount', () => {
  it('extendLease from balance and from operator stake attach the gateway', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    const pda = await pdaOf(signer.address);
    await w.extendLease({ name: 'n', years: 1 });
    await w.extendLease({
      name: 'n',
      years: 1,
      fundFrom: 'stakes',
      gatewayAddress: signer.address,
      fundAsOperator: true,
    });
    const balance = arnsIx([w.sent[0]], ArioArnsInstruction.ExtendLease);
    const stake = arnsIx(
      [w.sent[1]],
      ArioArnsInstruction.ExtendLeaseFromOperatorStake,
    );
    for (const ix of [balance, stake]) {
      const last = ix.accounts[ix.accounts.length - 1];
      assert.equal(last.address, pda);
      assert.equal(last.role, AccountRole.READONLY);
    }
  });

  it('extendLease funding plan carries the discount count and total', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    await w.extendLease({ name: 'n', years: 2, fundFrom: 'plan' });
    assert.deepEqual(w.planCosts, [applyGatewayOperatorDiscount(COST)]);
    const ix = arnsIx(w.sent, ArioArnsInstruction.ExtendLeaseFromFundingPlan);
    const data = getExtendLeaseFromFundingPlanInstructionDataDecoder().decode(
      ix.data,
    );
    assert.equal(data.discountAccountCount, 1);
    const [first, second] = ix.accounts.slice(-2);
    assert.equal(first.address, await pdaOf(signer.address));
    assert.equal(second.address, FUNDING_SOURCE);
  });

  it('upgradeRecord and increaseUndernameLimit attach nothing for a non-operator', async () => {
    const signer = await generateKeyPairSigner();
    const plain = await stubWith(signer, []);
    const op = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    for (const s of [plain, op]) {
      await s.w.upgradeRecord({ name: 'n' });
      await s.w.increaseUndernameLimit({ name: 'n', increaseCount: 5 });
    }
    for (const kind of [
      ArioArnsInstruction.UpgradeName,
      ArioArnsInstruction.IncreaseUndernameLimit,
    ]) {
      const a = arnsIx(plain.w.sent, kind).accounts;
      const b = arnsIx(op.w.sent, kind).accounts;
      assert.equal(b.length, a.length + 1, ArioArnsInstruction[kind]);
      assert.deepEqual(b.slice(0, a.length), a);
    }
  });
});

describe('buyReturnedName operator discount', () => {
  function returnedNameRpc(name: string) {
    // The SDK reads only [disc][u32 len][name][32][initiator 32].
    const nameBytes = Buffer.from(name);
    const data = Buffer.alloc(8 + 4 + nameBytes.length + 32 + 32 + 32);
    data.writeUInt32LE(nameBytes.length, 8);
    nameBytes.copy(data, 12);
    data.set(INITIATOR_BYTES, 12 + nameBytes.length + 32);
    return {
      getAccountInfo: () => ({
        send: async () => ({
          context: { slot: 0n },
          value: {
            data: [data.toString('base64'), 'base64'],
            executable: false,
            lamports: 1n,
            owner: ZERO,
            space: BigInt(data.length),
          },
        }),
      }),
    };
  }

  it('balance path attaches the gateway; plan path sets the count', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(
      signer,
      [[signer.address, gateway({ operator: signer.address })]],
      returnedNameRpc('returned'),
    );
    const pda = await pdaOf(signer.address);
    await w.buyReturnedName({
      name: 'returned',
      type: 'permabuy',
      processId: ANT,
    });
    const balance = arnsIx([w.sent[0]], ArioArnsInstruction.BuyReturnedName);
    assert.equal(balance.accounts[balance.accounts.length - 1].address, pda);

    await w.buyReturnedName({
      name: 'returned',
      type: 'permabuy',
      processId: ANT,
      fundFrom: 'plan',
      sources: [{ kind: 'balance', amount: 1n }],
    });
    const plan = arnsIx(
      [w.sent[1]],
      ArioArnsInstruction.BuyReturnedNameFromFundingPlan,
    );
    const data =
      getBuyReturnedNameFromFundingPlanInstructionDataDecoder().decode(
        plan.data,
      );
    assert.equal(data.discountAccountCount, 1);
    const [first, second] = plan.accounts.slice(-2);
    assert.equal(first.address, pda);
    assert.equal(second.address, FUNDING_SOURCE);
  });

  it('the largest single-source purchase still fits one transaction', async () => {
    // Returned name funded from a delegation, with the record migration and
    // the Attributes sync bundled — the heaviest single-source flow, measured
    // at 1,161 bytes with the discount. Funding plans grow ~33 bytes per source
    // and are not covered here.
    const signer = await generateKeyPairSigner();
    const name = 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklm';
    const { w } = await stubWith(
      signer,
      [[signer.address, gateway({ operator: signer.address })]],
      returnedNameRpc(name),
    );
    const self = w as any;
    self._buildSyncAttributesIxIfOwner = async (n: string) =>
      self._buildSyncAttributesIxFor(n, ANT);
    self._buildMigrateArnsRecordIxIfNeeded = async () => [
      {
        programAddress: addressFor(40),
        accounts: [
          { address: addressFor(41), role: AccountRole.WRITABLE },
          { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
          { address: addressFor(42), role: AccountRole.READONLY },
        ],
        data: new Uint8Array(8),
      },
    ];
    await w.buyReturnedName({
      name,
      type: 'permabuy',
      processId: ANT,
      fundFrom: 'stakes',
      gatewayAddress: OPERATOR,
    });
    arnsIx(w.sent, ArioArnsInstruction.BuyReturnedNameFromDelegation);
    const size = estimateCompiledTxSize({ signer, instructions: w.sent[0] });
    assert.ok(size <= 1232, `took ${size} bytes`);
  });
});

// ---------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------

describe('getCostDetails operator discount', () => {
  function readableWith(
    gateways: Map<string, Uint8Array>,
    tokenCost: number,
  ): SolanaARIOReadable {
    const r = new SolanaARIOReadable({
      rpc: {} as ReturnType<typeof createSolanaRpc>,
    });
    const self = r as any;
    self.getTokenCost = async () => tokenCost;
    self.getGasEstimate = async () => undefined;
    self.getClusterUnixTimestampSeconds = async () => Number(NOW);
    self.getCachedAccount = async (pda: Address) => {
      const data = gateways.get(pda);
      return data ? { exists: true, data } : { exists: false };
    };
    return r;
  }

  it('quotes the program’s exact discount for a qualifying operator', async () => {
    const pda = (await getGatewayPDA(OPERATOR))[0];
    const r = readableWith(new Map([[pda, encodeGateway()]]), 12_500_000_003);
    const res = await r.getCostDetails({
      intent: 'Buy-Name',
      name: 'n',
      fromAddress: OPERATOR,
    });
    // 12_500_000_003 * 0.2 = 2_500_000_000.6 → 2_500_000_000
    assert.equal(res.discounts.length, 1);
    assert.equal(res.discounts[0].discountTotal, 2_500_000_000);
    assert.equal(res.tokenCost, 10_000_000_003);
  });

  it('never discounts a primary-name request', async () => {
    const pda = (await getGatewayPDA(OPERATOR))[0];
    const r = readableWith(new Map([[pda, encodeGateway()]]), 1_000_000);
    const res = await r.getCostDetails({
      intent: 'Primary-Name-Request',
      name: 'n',
      fromAddress: OPERATOR,
    });
    assert.deepEqual(res.discounts, []);
    assert.equal(res.tokenCost, 1_000_000);
  });

  it('quotes an operations address only through the named, migrated gateway', async () => {
    const delegate = (await generateKeyPairSigner()).address;
    const pda = (await getGatewayPDA(OPERATOR))[0];
    const migrated = readableWith(
      new Map([[pda, encodeGateway({ operationsAddress: delegate })]]),
      1_000_000,
    );
    const quote = (r: SolanaARIOReadable, gw?: Address) =>
      r.getCostDetails({
        intent: 'Extend-Lease',
        name: 'n',
        years: 1,
        fromAddress: delegate,
        discountGatewayAddress: gw,
      });
    assert.equal((await quote(migrated, OPERATOR)).tokenCost, 800_000);
    // Without naming the gateway, the delegate's own (non-existent) gateway is used.
    assert.equal((await quote(migrated)).tokenCost, 1_000_000);

    const stale = readableWith(
      new Map([
        [pda, encodeGateway({ version: V1_1_0, operationsAddress: delegate })],
      ]),
      1_000_000,
    );
    assert.equal((await quote(stale, OPERATOR)).tokenCost, 1_000_000);
  });

  it('does not quote a discount the program would refuse', async () => {
    const pda = (await getGatewayPDA(OPERATOR))[0];
    const r = readableWith(
      new Map([[pda, encodeGateway({ passedEpochs: 7, totalEpochs: 9 })]]),
      1_000_000,
    );
    const res = await r.getCostDetails({
      intent: 'Buy-Name',
      name: 'n',
      fromAddress: OPERATOR,
    });
    assert.deepEqual(res.discounts, []);
  });
});

describe('oversized transactions drop the discount instead of failing', () => {
  // The discount adds one account (~33 bytes). A multi-source funding plan can
  // already sit within that of the 1232-byte limit, so attaching it would turn
  // a purchase that lands today into one that fails. Charging full price is
  // strictly better, so it must be dropped — measured band for a buy plan is 6
  // per-source accounts (1229 -> 1262).
  const NAME = 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklm';

  /** A stub whose funding plan carries `n` per-source accounts. */
  async function planStub(
    signer: Awaited<ReturnType<typeof generateKeyPairSigner>>,
    n: number,
    withGateway: boolean,
  ): Promise<StubWriteable> {
    const { w } = await stubWith(
      signer,
      withGateway
        ? [[signer.address, gateway({ operator: signer.address })]]
        : [],
    );
    (w as any)._materializeFundingPlan = async () => ({
      remainingAccounts: Array.from({ length: n }, (_, i) => ({
        address: addressFor(30 + i),
        role: AccountRole.WRITABLE,
      })),
      withdrawalCounter: WITHDRAWAL_COUNTER,
      residueVaultCount: 0,
    });
    return w;
  }

  const buy = (w: StubWriteable) =>
    w.buyRecord({
      name: NAME,
      type: 'permabuy',
      processId: ANT,
      fundFrom: 'any',
    });

  it('buyRecord: keeps the purchase, at full price', async () => {
    const signer = await generateKeyPairSigner();
    // Calibrate: the largest plan that fits WITHOUT the discount. Adding the
    // discount's one account to that plan must overflow, because each account
    // costs ~33 bytes and the next size up already exceeds the limit.
    let fits = 0;
    for (let n = 1; n <= 14; n++) {
      const w = await planStub(signer, n, false);
      await buy(w);
      const size = estimateCompiledTxSize({ signer, instructions: w.sent[0] });
      if (size <= 1232) fits = n;
      else break;
    }
    assert.ok(fits > 0, 'expected some plan size to fit');

    const w = await planStub(signer, fits, true);
    await buy(w);
    const ix = arnsIx(w.sent, ArioArnsInstruction.BuyNameFromFundingPlan);
    const data = getBuyNameFromFundingPlanInstructionDataDecoder().decode(
      ix.data,
    );
    assert.equal(
      data.discountAccountCount,
      0,
      `the discount should have been dropped at ${fits} accounts`,
    );
    assert.equal(
      data.sources[0].amount,
      COST,
      'and the plan re-sized to the undiscounted cost',
    );
    // Resolved twice: once with the discount, once without.
    assert.deepEqual(w.planCosts, [applyGatewayOperatorDiscount(COST), COST]);
    const size = estimateCompiledTxSize({ signer, instructions: w.sent[0] });
    assert.ok(size <= 1232, `sent ${size} bytes`);
  });

  it('keeps the discount when it still fits', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(signer, [
      [signer.address, gateway({ operator: signer.address })],
    ]);
    await w.buyRecord({
      name: 'short',
      type: 'permabuy',
      processId: ANT,
      fundFrom: 'any',
    });
    const ix = arnsIx(w.sent, ArioArnsInstruction.BuyNameFromFundingPlan);
    const data = getBuyNameFromFundingPlanInstructionDataDecoder().decode(
      ix.data,
    );
    assert.equal(data.discountAccountCount, 1);
    assert.equal(
      ix.accounts[ix.accounts.length - 2].address,
      await pdaOf(signer.address),
    );
    assert.deepEqual(w.planCosts, [applyGatewayOperatorDiscount(COST)]);
  });
});

describe('returned-name stake auto-pick', () => {
  // A delegation that covers the discounted price but not the full one.
  const FULL = 1_000_000;
  const HELD = 900_000n;

  function discoveryRpc(delegator: Address) {
    const row = Buffer.alloc(108);
    row.set(new Uint8Array(32).fill(9), 8); // gateway
    row.set(Buffer.from(getAddressEncoder().encode(delegator)), 40);
    row.writeBigUInt64LE(HELD, 72);
    return {
      getAccountInfo: () => ({
        send: async () => ({ context: { slot: 0n }, value: null }),
      }),
      getMultipleAccounts: (addresses: Address[]) => ({
        send: async () => ({
          context: { slot: 0n },
          value: addresses.map(() => null),
        }),
      }),
      getProgramAccounts: (
        _program: Address,
        config: { filters: Array<{ memcmp?: { offset: bigint } }> },
      ) => ({
        send: async () =>
          config.filters[0]?.memcmp?.offset === 40n
            ? [
                {
                  pubkey: addressFor(60),
                  account: { data: [row.toString('base64'), 'base64'] },
                },
              ]
            : [],
      }),
    };
  }

  it('sizes the pick to the discounted price when the discount applies', async () => {
    const signer = await generateKeyPairSigner();
    const { w, pdaOf } = await stubWith(
      signer,
      [],
      discoveryRpc(signer.address),
    );
    const self = w as any;
    self.getTokenCost = async () => FULL;
    const params = {
      name: 'n',
      type: 'permabuy' as const,
      fundFrom: 'stakes' as const,
    };

    const withDiscount = await self._autoPickReturnedNameStakeSource(
      params,
      await pdaOf(signer.address),
    );
    assert.equal(withDiscount?.kind, 'delegation');
    assert.equal(withDiscount?.available, HELD);

    const without = await self._autoPickReturnedNameStakeSource(
      params,
      undefined,
    );
    assert.equal(without, null);
  });
});
