import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getEpochSettingsEncoder } from '@ar.io/solana-contracts/gar';
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
