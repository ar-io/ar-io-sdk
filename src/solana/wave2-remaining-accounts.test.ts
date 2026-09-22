import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getEpochSettingsEncoder,
  getGatewayEncoder,
} from '@ar.io/solana-contracts/gar';
/**
 * Wave 2 (ADR-0034 / ADR-0036 / ADR-0037) trailing-account contracts.
 *
 * Each of these three instructions gains a required account, appended as a
 * TRAILING entry so one client works against both the pre- and post-upgrade
 * program. **The ORDER is load-bearing**, because the old program reads
 * `remaining_accounts` positionally:
 *
 *   - `create_epoch` reads position 0 as the ADR-0029 rent receipt. Put the
 *     previous Epoch there instead and it is handed to
 *     `init_epoch_rent_receipt`, which rejects it — stalling epoch creation
 *     network-wide until the upgrade lands.
 *   - `finalize_gone` reads position 0 as the swapped Gateway PDA.
 *
 * Nothing else pins that ordering, so these tests exist to make a future
 * reorder fail loudly rather than in production.
 */
import {
  AccountRole,
  type Address,
  type Instruction,
  getAddressDecoder,
} from '@solana/kit';

import { ARIO_GAR_PROGRAM_ID } from './constants.js';
import { SolanaARIOWriteable } from './io-writeable.js';
import {
  getEpochPDA,
  getEpochRentReceiptPDA,
  getGarSettingsPDA,
  getGatewayPDA,
} from './pda.js';

const dec = getAddressDecoder();
function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}
const SIGNER = pk(99);

/** Complete EpochSettings bytes carrying a chosen currentEpochIndex. */
function epochSettingsBytes(currentEpochIndex: bigint): Uint8Array {
  return getEpochSettingsEncoder().encode({
    authority: SIGNER,
    epochDuration: 86_400n,
    prescribedObserverCount: 50,
    prescribedNameCount: 2,
    minObserverStake: 0n,
    slashRate: 0,
    enabled: true,
    currentEpochIndex,
    genesisTimestamp: 0n,
    tenureWeightDuration: 0n,
    maxTenureWeight: 4n,
    gatewayRewardRatio: 900_000n,
    observerRewardRatio: 100_000n,
    missedObservationPenaltyRate: 250_000n,
    maxRewardRate: 1_000n,
    minRewardRate: 500n,
    rewardDecayStartEpoch: 365n,
    rewardDecayLastEpoch: 547n,
    maxConsecutiveFailures: 30,
    failedGatewaySlashRate: 1_000_000n,
    disableAt: 0n,
    bump: 255,
    version: { major: 1, minor: 0, patch: 0 },
  });
}

/** Captures instructions and serves canned account data by address. */
class Capture extends SolanaARIOWriteable {
  captured: Instruction[] = [];
  constructor(accounts: Record<string, Uint8Array>) {
    super({
      rpc: {
        getAccountInfo: (addr: string) => ({
          send: async () => {
            const data = accounts[addr];
            return data === undefined
              ? { value: null }
              : {
                  value: {
                    data: [Buffer.from(data).toString('base64'), 'base64'],
                    owner: ARIO_GAR_PROGRAM_ID,
                    lamports: 1n,
                    executable: false,
                    rentEpoch: 0n,
                  },
                };
          },
        }),
      } as never,
      rpcSubscriptions: {} as never,
      signer: { address: SIGNER } as never,
    } as never);
  }
  protected async sendTransaction(ixs: Instruction[]): Promise<string> {
    this.captured.push(...ixs);
    return 'tx-stub';
  }
}

/**
 * `createEpoch` also loads GatewaySettings for the treasury account. That is
 * unrelated to the ordering under test, so stub it rather than encode the whole
 * settings struct.
 */
function withStubbedGarConfig(c: Capture): Capture {
  (
    c as unknown as { getGarConfig: () => Promise<Record<string, unknown>> }
  ).getGarConfig = async () => ({
    protocolTokenAccount: pk(50),
    stakeTokenAccount: pk(51),
    mint: pk(52),
  });
  return c;
}

describe('ADR-0037 — compound_delegation_rewards appends settings LAST', () => {
  it('appends the gar settings PDA as a trailing writable account', async () => {
    const c = new Capture({});
    await c.compoundDelegationRewards({ gateway: pk(1), delegator: pk(2) });

    const accounts = c.captured[0].accounts ?? [];
    const [settingsPda] = await getGarSettingsPDA(ARIO_GAR_PROGRAM_ID);

    const last = accounts[accounts.length - 1];
    assert.equal(
      last.address,
      settingsPda,
      'settings must be the LAST account — Anchor treats trailing accounts as remaining_accounts, which is what makes this work against both programs',
    );
    assert.equal(last.role, AccountRole.WRITABLE, 'settings is mutated');
  });
});

describe('ADR-0034 — create_epoch appends the previous Epoch AFTER the receipt', () => {
  it('orders [rent receipt, previous Epoch] and never the reverse', async () => {
    const [epochSettingsPda] = await (
      await import('./pda.js')
    ).getEpochSettingsPDA(ARIO_GAR_PROGRAM_ID);
    const c = withStubbedGarConfig(
      new Capture({ [epochSettingsPda]: epochSettingsBytes(7n) }),
    );
    await c.createEpoch();

    const accounts = c.captured[0].accounts ?? [];
    const [receiptPda] = await getEpochRentReceiptPDA(7, ARIO_GAR_PROGRAM_ID);
    const [prevEpochPda] = await getEpochPDA(6, ARIO_GAR_PROGRAM_ID);

    const receiptIdx = accounts.findIndex((a) => a.address === receiptPda);
    const prevIdx = accounts.findIndex((a) => a.address === prevEpochPda);

    assert.ok(receiptIdx >= 0, 'rent receipt must be present');
    assert.ok(prevIdx >= 0, 'previous Epoch must be present');
    assert.ok(
      receiptIdx < prevIdx,
      'RECEIPT MUST COME FIRST — the pre-ADR-0034 program reads position 0 as the receipt',
    );
    assert.equal(
      accounts[prevIdx].role,
      AccountRole.READONLY,
      'previous Epoch is only read',
    );
  });

  it('omits the previous Epoch at index 0, which has no predecessor', async () => {
    const [epochSettingsPda] = await (
      await import('./pda.js')
    ).getEpochSettingsPDA(ARIO_GAR_PROGRAM_ID);
    const c = withStubbedGarConfig(
      new Capture({ [epochSettingsPda]: epochSettingsBytes(0n) }),
    );
    await c.createEpoch();

    const accounts = c.captured[0].accounts ?? [];
    const [receiptPda] = await getEpochRentReceiptPDA(0, ARIO_GAR_PROGRAM_ID);
    assert.ok(
      accounts.some((a) => a.address === receiptPda),
      'receipt is still supplied at index 0',
    );
    // Any Epoch PDA for a "previous" index cannot exist; assert we added none
    // beyond the receipt by checking the trailing account IS the receipt.
    const last = accounts[accounts.length - 1];
    assert.equal(
      last.address,
      receiptPda,
      'no previous-Epoch account may be appended at index 0',
    );
  });
});

/** A Gateway at a chosen registry slot. Only the slot index matters here. */
function gatewayBytes(operator: Address, registryIndex: number): Uint8Array {
  return getGatewayEncoder().encode({
    operator,
    label: 'test',
    fqdn: 'example.com',
    port: 443,
    protocol: 1,
    properties: '',
    note: '',
    operatorStake: 20_000_000_000n,
    totalDelegatedStake: 0n,
    status: 1,
    startTimestamp: 0n,
    leaveTimestamp: null,
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
      allowDelegatedStaking: false,
      delegateRewardShareRatio: 0,
      minDelegationAmount: 0n,
      allowlistEnabled: false,
      pendingDelegateRewardShareRatio: 0,
      delegationDisabledAt: null,
    },
    registryIndex: { index: registryIndex, reserved: 0 },
    observerAddress: operator,
    cumulativeRewardPerToken: 0n,
    bump: 255,
    version: { major: 1, minor: 2, patch: 0 },
    operationsAddress: operator,
  } as never);
}

/** finalize_gone with a controllable registry + epoch state. */
class GoneCapture extends Capture {
  constructor(
    accounts: Record<string, Uint8Array>,
    private registry: string[],
  ) {
    super(accounts);
  }
  protected async getRegistryGatewayAddresses(): Promise<string[]> {
    return this.registry;
  }
}

describe('ADR-0036 — finalize_gone appends the latest Epoch AFTER the swapped gateway', () => {
  const GONE = pk(10);
  const LAST = pk(11);

  it('orders [swapped gateway, latest Epoch] when a swap is required', async () => {
    const [gonePda] = await getGatewayPDA(GONE, ARIO_GAR_PROGRAM_ID);
    const [epochSettingsPda] = await (
      await import('./pda.js')
    ).getEpochSettingsPDA(ARIO_GAR_PROGRAM_ID);
    // GONE sits at slot 0 and is NOT the last slot, so the last slot's gateway
    // (LAST) must be swapped down into it.
    const c = new GoneCapture(
      {
        [gonePda]: gatewayBytes(GONE, 0),
        [epochSettingsPda]: epochSettingsBytes(9n),
      },
      [GONE, LAST],
    );
    await c.finalizeGone({ gateway: GONE });

    const accounts = c.captured[0].accounts ?? [];
    const [swappedPda] = await getGatewayPDA(LAST, ARIO_GAR_PROGRAM_ID);
    const [latestEpochPda] = await getEpochPDA(8, ARIO_GAR_PROGRAM_ID);

    const swappedIdx = accounts.findIndex((a) => a.address === swappedPda);
    const epochIdx = accounts.findIndex((a) => a.address === latestEpochPda);

    assert.ok(swappedIdx >= 0, 'swapped gateway must be present');
    assert.ok(epochIdx >= 0, 'latest Epoch must be present');
    assert.ok(
      swappedIdx < epochIdx,
      'SWAPPED GATEWAY MUST COME FIRST — the pre-ADR-0036 program reads position 0 as the swapped gateway',
    );
    assert.equal(accounts[swappedIdx].role, AccountRole.WRITABLE);
    assert.equal(accounts[epochIdx].role, AccountRole.READONLY);
  });

  it('appends only the latest Epoch when the gateway IS the last slot', async () => {
    const [gonePda] = await getGatewayPDA(GONE, ARIO_GAR_PROGRAM_ID);
    const [epochSettingsPda] = await (
      await import('./pda.js')
    ).getEpochSettingsPDA(ARIO_GAR_PROGRAM_ID);
    // GONE is the ONLY gateway, so it is the last slot — no swap needed.
    const c = new GoneCapture(
      {
        [gonePda]: gatewayBytes(GONE, 0),
        [epochSettingsPda]: epochSettingsBytes(9n),
      },
      [GONE],
    );
    await c.finalizeGone({ gateway: GONE });

    const accounts = c.captured[0].accounts ?? [];
    const [latestEpochPda] = await getEpochPDA(8, ARIO_GAR_PROGRAM_ID);
    const last = accounts[accounts.length - 1];
    assert.equal(
      last.address,
      latestEpochPda,
      'the latest Epoch is still required in the no-swap case',
    );
  });

  it('appends no Epoch when none has ever been created', async () => {
    const [gonePda] = await getGatewayPDA(GONE, ARIO_GAR_PROGRAM_ID);
    const [epochSettingsPda] = await (
      await import('./pda.js')
    ).getEpochSettingsPDA(ARIO_GAR_PROGRAM_ID);
    const c = new GoneCapture(
      {
        [gonePda]: gatewayBytes(GONE, 0),
        [epochSettingsPda]: epochSettingsBytes(0n), // index 0 => no epoch exists
      },
      [GONE],
    );
    await c.finalizeGone({ gateway: GONE });

    const accounts = c.captured[0].accounts ?? [];
    // Only the 4 declared accounts; nothing trailing.
    assert.equal(
      accounts.length,
      4,
      'no trailing accounts when there is no epoch and no swap',
    );
  });
});

describe('ADR-0037 — the compound BATCH puts settings on every instruction', () => {
  it('appends settings to each instruction, not just the first', async () => {
    const c = new Capture({});
    await c.compoundDelegationRewardsBatch([
      { gateway: pk(1), delegator: pk(2) },
      { gateway: pk(1), delegator: pk(3) },
      { gateway: pk(4), delegator: pk(5) },
    ]);

    const [settingsPda] = await getGarSettingsPDA(ARIO_GAR_PROGRAM_ID);
    assert.equal(c.captured.length, 3);
    for (const [i, ix] of c.captured.entries()) {
      const accounts = ix.accounts ?? [];
      assert.equal(
        accounts[accounts.length - 1].address,
        settingsPda,
        `instruction ${i} must carry settings — a batch that settles rewards on only the first delegation would drift the supply counter for the rest`,
      );
    }
  });
});
