import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAdminReconcileDelegatedStakeInstructionDataDecoder,
  getAdminResyncSupplyCountersInstructionDataDecoder,
} from '@ar.io/solana-contracts/gar';
/**
 * ADR-0037 admin instructions — `admin_reconcile_delegated_stake` and
 * `admin_resync_supply_counters`.
 *
 * These correct the delegated-stake over-count the AO import left behind: each
 * gateway's counter was written from AO's total, but `Delegation` accounts were
 * only created for delegators who had a Solana address, so `counter −
 * Σ Delegation.amount` is invariant under every other instruction and cannot
 * reach zero on its own.
 *
 * Two properties are worth pinning here, because getting either wrong is
 * silent rather than loud:
 *
 *   - the Delegation PDAs must ride as READ-ONLY remaining accounts, in the
 *     caller's order and complete. The program sums exactly what it is handed;
 *     completeness is enforced by `expectedRemoved`, which is only meaningful
 *     if the caller derived it from an independent (genesis) snapshot.
 *   - the resync is a COMPARE-AND-SWAP: four arguments, expected/new per
 *     counter. Dropping or transposing the `new*` values would write the wrong
 *     figure while still being accepted.
 */
import {
  AccountRole,
  type Address,
  type Instruction,
  getAddressDecoder,
} from '@solana/kit';

import { ARIO_GAR_PROGRAM_ID } from './constants.js';
import { SolanaARIOWriteable } from './io-writeable.js';
import { getGarSettingsPDA, getGatewayPDA } from './pda.js';

const dec = getAddressDecoder();
function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}
const SIGNER = pk(99);

/** Captures instructions without touching the network. */
class Capture extends SolanaARIOWriteable {
  captured: Instruction[] = [];
  computeUnitLimits: (number | undefined)[] = [];
  constructor() {
    super({
      rpc: {} as never,
      rpcSubscriptions: {} as never,
      signer: { address: SIGNER } as never,
    } as never);
  }
  protected async sendTransaction(
    ixs: Instruction[],
    computeUnitLimit?: number,
  ): Promise<string> {
    this.captured.push(...ixs);
    this.computeUnitLimits.push(computeUnitLimit);
    return 'tx-stub';
  }
}

const OPERATOR = pk(1);
const DELEGATIONS = [pk(20), pk(21), pk(22)];

describe('ADR-0037 — admin_reconcile_delegated_stake', () => {
  it('appends every Delegation PDA as a READ-ONLY remaining account, in order', async () => {
    const c = new Capture();
    await c.adminReconcileDelegatedStake({
      gatewayOperator: OPERATOR,
      delegations: DELEGATIONS,
      expectedCounter: 17_500_000_000n,
      expectedRemoved: 7_500_000_000n,
    });

    const accounts = c.captured[0].accounts ?? [];
    const [settingsPda] = await getGarSettingsPDA(ARIO_GAR_PROGRAM_ID);
    const [gatewayPda] = await getGatewayPDA(OPERATOR, ARIO_GAR_PROGRAM_ID);

    // Declared accounts first, in the program's order.
    assert.equal(accounts[0].address, settingsPda);
    assert.equal(accounts[0].role, AccountRole.WRITABLE);
    assert.equal(accounts[1].address, gatewayPda);
    assert.equal(accounts[1].role, AccountRole.WRITABLE);
    assert.equal(accounts[2].address, SIGNER, 'the authority signs');

    // Then the proof set, complete and in the caller's order.
    const trailing = accounts.slice(3);
    assert.deepEqual(
      trailing.map((a) => a.address),
      DELEGATIONS,
      'every delegation must be forwarded, in the order given — the program sums exactly what it is handed',
    );
    for (const a of trailing) {
      assert.equal(
        a.role,
        AccountRole.READONLY,
        'delegations are read-only proof; marking them writable would demand a signature the caller does not have',
      );
    }
  });

  it('encodes the counter and the removal as given, without reordering them', async () => {
    const c = new Capture();
    // Deliberately distinct values: transposing them would still "work".
    await c.adminReconcileDelegatedStake({
      gatewayOperator: OPERATOR,
      delegations: DELEGATIONS,
      expectedCounter: 17_500_000_000n,
      expectedRemoved: 7_500_000_000n,
    });

    const data = getAdminReconcileDelegatedStakeInstructionDataDecoder().decode(
      c.captured[0].data as Uint8Array,
    );
    assert.equal(data.expectedCounter, 17_500_000_000n);
    assert.equal(data.expectedRemoved, 7_500_000_000n);
  });

  it('accepts number as well as bigint for both amounts', async () => {
    const c = new Capture();
    await c.adminReconcileDelegatedStake({
      gatewayOperator: OPERATOR,
      delegations: [DELEGATIONS[0]],
      expectedCounter: 100,
      expectedRemoved: 25,
    });
    const data = getAdminReconcileDelegatedStakeInstructionDataDecoder().decode(
      c.captured[0].data as Uint8Array,
    );
    assert.equal(data.expectedCounter, 100n);
    assert.equal(data.expectedRemoved, 25n);
  });

  it('emits a valid instruction when the gateway has no delegations left', async () => {
    // The whole counter is phantom — the shape ADR-0037 exists to correct.
    const c = new Capture();
    await c.adminReconcileDelegatedStake({
      gatewayOperator: OPERATOR,
      delegations: [],
      expectedCounter: 10_000_000_000n,
      expectedRemoved: 10_000_000_000n,
    });
    const accounts = c.captured[0].accounts ?? [];
    assert.equal(
      accounts.length,
      3,
      'no delegations means no trailing accounts, not a malformed instruction',
    );
  });

  it('raises the compute budget with the number of delegations', async () => {
    const few = new Capture();
    await few.adminReconcileDelegatedStake({
      gatewayOperator: OPERATOR,
      delegations: [DELEGATIONS[0]],
      expectedCounter: 1n,
      expectedRemoved: 1n,
    });

    const many = new Capture();
    await many.adminReconcileDelegatedStake({
      gatewayOperator: OPERATOR,
      delegations: Array.from({ length: 50 }, (_, i) => pk(100 + i)),
      expectedCounter: 1n,
      expectedRemoved: 1n,
    });

    const fewCu = few.computeUnitLimits[0] ?? 0;
    const manyCu = many.computeUnitLimits[0] ?? 0;
    assert.ok(
      manyCu > fewCu,
      `a 50-delegation reconcile must request more CU than a 1-delegation one (${manyCu} vs ${fewCu})`,
    );
    assert.ok(
      manyCu <= 1_400_000,
      'and must stay within Solana’s per-transaction ceiling',
    );
  });
});

describe('ADR-0037 — admin_resync_supply_counters', () => {
  it('passes all four compare-and-swap arguments, unswapped', async () => {
    const c = new Capture();
    // Four mutually distinct values, so any transposition is detectable.
    await c.adminResyncSupplyCounters({
      expectedStaked: 1_000n,
      newStaked: 2_000n,
      expectedDelegated: 3_000n,
      newDelegated: 4_000n,
    });

    const data = getAdminResyncSupplyCountersInstructionDataDecoder().decode(
      c.captured[0].data as Uint8Array,
    );
    assert.equal(data.expectedStaked, 1_000n);
    assert.equal(data.newStaked, 2_000n);
    assert.equal(data.expectedDelegated, 3_000n);
    assert.equal(
      data.newDelegated,
      4_000n,
      'expected/new must not be collapsed or swapped — the program uses expected* as a CAS guard and writes new*',
    );
  });

  it('targets the settings PDA and signs with the authority', async () => {
    const c = new Capture();
    await c.adminResyncSupplyCounters({
      expectedStaked: 1n,
      newStaked: 1n,
      expectedDelegated: 1n,
      newDelegated: 1n,
    });

    const accounts = c.captured[0].accounts ?? [];
    const [settingsPda] = await getGarSettingsPDA(ARIO_GAR_PROGRAM_ID);
    assert.equal(accounts[0].address, settingsPda);
    assert.equal(accounts[0].role, AccountRole.WRITABLE);
    assert.equal(accounts[1].address, SIGNER);
    assert.equal(
      accounts.length,
      2,
      'resync carries no remaining accounts — it proves nothing on-chain, the caller proved it off-chain',
    );
  });
});
