/**
 * Unit tests for the SolanaARIOReadable prune-discovery surface.
 *
 * Each helper uses the shape:
 *   1. `getProgramAccounts(programId, { filters: [discriminator, ...] })`
 *   2. Decode bytes via the codama-generated decoder
 *   3. Apply a pure filter predicate
 *
 * These tests stub the rpc layer and inject pre-encoded account bytes,
 * exercising the decode + filter pipeline end-to-end without standing
 * up Surfpool. The codama encoders are the same ones the on-chain
 * program uses, so this also validates wire-format parity for the
 * subset of accounts the helpers touch.
 *
 * Coverage target: 9 discovery helpers + getArnsConfigRaw on
 * SolanaARIOReadable. The remaining 2 (`getExpiredArnsRecords`,
 * `getExpiredReturnedNames`) need a 2-step rpc dance (config fetch +
 * account scan) and are exercised by the localnet smoke instead.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { type Address, address, createSolanaRpc } from '@solana/kit';

import {
  getPrimaryNameRequestEncoder,
  getVaultEncoder,
} from '@ar.io/solana-contracts/core';
import {
  GatewayStatus,
  Protocol,
  getDelegationEncoder,
  getGatewayEncoder,
  getWithdrawalEncoder,
} from '@ar.io/solana-contracts/gar';
import { ARIO_GAR_PROGRAM_ID } from './constants.js';
import { SolanaARIOReadable } from './io-readable.js';

// ---------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------

const ADDR_A = '11111111111111111111111111111111' as Address;
const ADDR_B = '22222222222222222222222222222222' as Address;
const ADDR_C = '33333333333333333333333333333333' as Address;
// 44-char base58 strings that decode to exactly 32 bytes — same fixture
// pattern as funding-plan.test.ts.
const PUBKEY_1 = 'GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
const PUBKEY_2 = 'GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address;
const PUBKEY_3 = 'GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as Address;

const VERSION = { major: 0, minor: 0, patch: 0 };

/**
 * Build a minimal stub rpc that returns canned `getProgramAccounts`
 * results. The helpers under test are agnostic to which programId they
 * scan — we only validate the response shape downstream.
 */
function stubRpcReturning(
  rows: Array<{ pubkey: Address; bytes: Uint8Array }>,
): unknown {
  const send = async () =>
    rows.map(({ pubkey, bytes }) => ({
      pubkey,
      account: {
        data: [Buffer.from(bytes).toString('base64'), 'base64'] as readonly [
          string,
          string,
        ],
      },
    }));
  return {
    getProgramAccounts: () => ({ send }),
    // Some helpers (getArnsConfigRaw, getExpiredArnsRecords) call
    // fetchEncodedAccount under the hood, which uses getAccountInfo.
    // Tests that don't exercise those skip the stub.
    getAccountInfo: () => ({ send: async () => ({ value: null }) }),
  };
}

function buildReadable(rpc: unknown): SolanaARIOReadable {
  return new SolanaARIOReadable({
    rpc: rpc as ReturnType<typeof createSolanaRpc>,
  });
}

// ---------------------------------------------------------------
// Delegation: getEmptyDelegations filters amount === 0n
// ---------------------------------------------------------------

describe('SolanaARIOReadable.getEmptyDelegations', () => {
  it('returns only delegations with amount === 0', async () => {
    const enc = getDelegationEncoder();
    const empty = enc.encode({
      gateway: PUBKEY_1,
      delegator: PUBKEY_2,
      amount: 0n,
      startTimestamp: 1_000n,
      rewardDebt: 0n,
      bump: 254,
      version: VERSION,
    });
    const nonEmpty = enc.encode({
      gateway: PUBKEY_1,
      delegator: PUBKEY_3,
      amount: 12345n,
      startTimestamp: 1_000n,
      rewardDebt: 0n,
      bump: 254,
      version: VERSION,
    });
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: empty },
      { pubkey: ADDR_B, bytes: nonEmpty },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getEmptyDelegations();
    assert.equal(out.length, 1, 'only the amount=0 row should survive');
    assert.equal(out[0].pubkey, ADDR_A);
    assert.equal(out[0].gateway, PUBKEY_1);
    assert.equal(out[0].delegator, PUBKEY_2);
  });

  it('returns empty array when nothing matches', async () => {
    const enc = getDelegationEncoder();
    const nonEmpty = enc.encode({
      gateway: PUBKEY_1,
      delegator: PUBKEY_2,
      amount: 999n,
      startTimestamp: 1_000n,
      rewardDebt: 0n,
      bump: 254,
      version: VERSION,
    });
    const rpc = stubRpcReturning([{ pubkey: ADDR_A, bytes: nonEmpty }]);
    const r = buildReadable(rpc);

    const out = await r.getEmptyDelegations();
    assert.equal(out.length, 0);
  });
});

// ---------------------------------------------------------------
// Withdrawal: getDrainedWithdrawals filters amount === 0n
// ---------------------------------------------------------------

describe('SolanaARIOReadable.getDrainedWithdrawals', () => {
  it('returns only withdrawals with amount === 0', async () => {
    const enc = getWithdrawalEncoder();
    const drained = enc.encode({
      owner: PUBKEY_1,
      withdrawalId: 7n,
      gateway: PUBKEY_2,
      amount: 0n,
      createdAt: 100n,
      availableAt: 200n,
      isDelegate: false,
      isExitVault: false,
      isProtected: false,
      bump: 253,
      version: VERSION,
    });
    const live = enc.encode({
      owner: PUBKEY_1,
      withdrawalId: 8n,
      gateway: PUBKEY_2,
      amount: 1_000_000n,
      createdAt: 100n,
      availableAt: 200n,
      isDelegate: true,
      isExitVault: false,
      isProtected: false,
      bump: 253,
      version: VERSION,
    });
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: drained },
      { pubkey: ADDR_B, bytes: live },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getDrainedWithdrawals();
    assert.equal(out.length, 1);
    assert.equal(out[0].pubkey, ADDR_A);
    assert.equal(out[0].owner, PUBKEY_1);
    assert.equal(out[0].withdrawalId, 7n);
  });
});

// ---------------------------------------------------------------
// Vault: getExpiredVaults filters endTimestamp <= now
// ---------------------------------------------------------------

describe('SolanaARIOReadable.getExpiredVaults', () => {
  it('returns vaults whose endTimestamp <= now', async () => {
    const enc = getVaultEncoder();
    const expired = enc.encode({
      owner: PUBKEY_1,
      vaultId: 1n,
      amount: 100n,
      startTimestamp: 0n,
      endTimestamp: 500n,
      controller: null,
      revocable: false,
      bump: 252,
      version: VERSION,
    });
    const future = enc.encode({
      owner: PUBKEY_1,
      vaultId: 2n,
      amount: 100n,
      startTimestamp: 0n,
      endTimestamp: 9_999_999n,
      controller: null,
      revocable: false,
      bump: 252,
      version: VERSION,
    });
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: expired },
      { pubkey: ADDR_B, bytes: future },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getExpiredVaults(/* now */ 1_000);
    assert.equal(out.length, 1);
    assert.equal(out[0].pubkey, ADDR_A);
    assert.equal(out[0].vaultId, 1n);
    assert.equal(out[0].endTimestamp, 500n);
  });

  it('exact-equality endTimestamp === now is treated as expired', async () => {
    const enc = getVaultEncoder();
    const exact = enc.encode({
      owner: PUBKEY_1,
      vaultId: 9n,
      amount: 1n,
      startTimestamp: 0n,
      endTimestamp: 1_000n,
      controller: null,
      revocable: false,
      bump: 252,
      version: VERSION,
    });
    const rpc = stubRpcReturning([{ pubkey: ADDR_A, bytes: exact }]);
    const r = buildReadable(rpc);

    const out = await r.getExpiredVaults(1_000);
    assert.equal(out.length, 1, 'endTimestamp === now boundary is inclusive');
  });
});

// ---------------------------------------------------------------
// Vault: getVaults surfaces the NUMERIC vaultId (not the PDA address).
// Regression guard — releaseVault/revokeVault do BigInt(vaultId) to derive
// the PDA, so a pubkey here makes every release/revoke throw.
// ---------------------------------------------------------------

describe('SolanaARIOReadable.getVaults', () => {
  it('returns numeric vaultId in `vaultId` and the PDA in `cursorId`', async () => {
    const enc = getVaultEncoder();
    const bytes = enc.encode({
      owner: PUBKEY_1,
      vaultId: 27n,
      amount: 2_961_491_000_000n,
      startTimestamp: 1_000n,
      endTimestamp: 2_000n,
      controller: null,
      revocable: false,
      bump: 252,
      version: VERSION,
    });
    const rpc = stubRpcReturning([{ pubkey: ADDR_A, bytes }]);
    const r = buildReadable(rpc);

    const { items } = await r.getVaults({ limit: 10 });
    assert.equal(items.length, 1);
    // The numeric id BigInt() can parse — NOT the base58 PDA.
    assert.equal(items[0].vaultId, '27');
    assert.doesNotThrow(() => BigInt(items[0].vaultId));
    // The PDA address is preserved separately for keys/links.
    assert.equal(items[0].cursorId, ADDR_A);
    assert.equal(items[0].address, PUBKEY_1);
    assert.equal(items[0].balance, 2_961_491_000_000);
  });
});

// ---------------------------------------------------------------
// PrimaryNameRequest: getExpiredPrimaryNameRequests filters expiresAt <= now
// ---------------------------------------------------------------

describe('SolanaARIOReadable.getExpiredPrimaryNameRequests', () => {
  it('returns requests whose expiresAt <= now', async () => {
    const enc = getPrimaryNameRequestEncoder();
    const expired = enc.encode({
      initiator: PUBKEY_1,
      name: 'oldname',
      createdAt: 0n,
      expiresAt: 100n,
      bump: 251,
      version: VERSION,
    });
    const future = enc.encode({
      initiator: PUBKEY_2,
      name: 'futurename',
      createdAt: 0n,
      expiresAt: 9_999_999n,
      bump: 251,
      version: VERSION,
    });
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: expired },
      { pubkey: ADDR_B, bytes: future },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getExpiredPrimaryNameRequests(/* now */ 1_000);
    assert.equal(out.length, 1);
    assert.equal(out[0].pubkey, ADDR_A);
    assert.equal(out[0].initiator, PUBKEY_1);
  });
});

// ---------------------------------------------------------------
// Gateway: getDeficientGateways + getGoneGateways filter on status + stats
// ---------------------------------------------------------------

function makeGatewayBytes(
  operator: Address,
  status: GatewayStatus,
  failedConsecutive: number,
  opts: {
    allowDelegatedStaking?: boolean;
    totalDelegatedStake?: bigint;
    leaveTimestamp?: bigint | null;
    leaveEpochDuration?: bigint;
  } = {},
): Uint8Array {
  const enc = getGatewayEncoder();
  return enc.encode({
    operator,
    label: 'lbl',
    fqdn: 'gw.example',
    port: 443,
    protocol: Protocol.Https,
    properties: '',
    note: '',
    operatorStake: 1_000n,
    totalDelegatedStake: opts.totalDelegatedStake ?? 0n,
    status,
    startTimestamp: 0n,
    leaveTimestamp: opts.leaveTimestamp ?? null,
    leaveEpochDuration: opts.leaveEpochDuration ?? 0n,
    stats: {
      passedEpochs: 0,
      failedEpochs: failedConsecutive,
      totalEpochs: failedConsecutive,
      prescribedEpochs: 0,
      observedEpochs: 0,
      failedConsecutive,
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
      allowDelegatedStaking: opts.allowDelegatedStaking ?? false,
      delegateRewardShareRatio: 0,
      minDelegationAmount: 0n,
      allowlistEnabled: false,
      // GATEWAY_VERSION 1.1.0 GatewaySettings2 additions (Fix #6/#7); None.
      pendingDelegateRewardShareRatio: null,
      delegationDisabledAt: null,
    },
    registryIndex: { index: 0, _reserved: 0 },
    observerAddress: operator,
    cumulativeRewardPerToken: 0n,
    bump: 250,
    version: VERSION,
  });
}

describe('SolanaARIOReadable.getDeficientGateways', () => {
  it('returns Joined gateways with failedConsecutive >= threshold', async () => {
    const deficient = makeGatewayBytes(PUBKEY_1, GatewayStatus.Joined, 30);
    const healthy = makeGatewayBytes(PUBKEY_2, GatewayStatus.Joined, 5);
    const goneFailing = makeGatewayBytes(PUBKEY_3, GatewayStatus.Gone, 99);
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: deficient },
      { pubkey: ADDR_B, bytes: healthy },
      { pubkey: ADDR_C, bytes: goneFailing },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getDeficientGateways(30);
    assert.equal(
      out.length,
      1,
      'only Joined+failedConsecutive>=30 should match (Gone gateways excluded)',
    );
    assert.equal(out[0].pubkey, ADDR_A);
    assert.equal(out[0].operator, PUBKEY_1);
    assert.equal(out[0].failedConsecutive, 30);
  });

  it('respects custom threshold', async () => {
    const at5 = makeGatewayBytes(PUBKEY_1, GatewayStatus.Joined, 5);
    const at10 = makeGatewayBytes(PUBKEY_2, GatewayStatus.Joined, 10);
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: at5 },
      { pubkey: ADDR_B, bytes: at10 },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getDeficientGateways(7);
    assert.equal(out.length, 1);
    assert.equal(out[0].failedConsecutive, 10);
  });
});

describe('SolanaARIOReadable.getGoneGateways', () => {
  it('returns only gateways with status === Leaving (Gone never persists)', async () => {
    const joined = makeGatewayBytes(PUBKEY_1, GatewayStatus.Joined, 0);
    const leaving = makeGatewayBytes(PUBKEY_2, GatewayStatus.Leaving, 0);
    const gone = makeGatewayBytes(PUBKEY_3, GatewayStatus.Gone, 0);
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: joined },
      { pubkey: ADDR_B, bytes: leaving },
      { pubkey: ADDR_C, bytes: gone },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getGoneGateways();
    assert.equal(
      out.length,
      1,
      'Leaving is the finalize_gone-eligible state; Gone is set+closed in one ix and never observed',
    );
    assert.equal(out[0].pubkey, ADDR_B);
    assert.equal(out[0].operator, PUBKEY_2);
  });
});

describe('SolanaARIOReadable.getLeavingGateways', () => {
  it('is an alias for getGoneGateways — returns only Leaving gateways', async () => {
    const joined = makeGatewayBytes(PUBKEY_1, GatewayStatus.Joined, 0);
    const leaving = makeGatewayBytes(PUBKEY_2, GatewayStatus.Leaving, 0);
    const gone = makeGatewayBytes(PUBKEY_3, GatewayStatus.Gone, 0);
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: joined },
      { pubkey: ADDR_B, bytes: leaving },
      { pubkey: ADDR_C, bytes: gone },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getLeavingGateways();
    assert.equal(out.length, 1);
    assert.equal(out[0].pubkey, ADDR_B);
    assert.equal(out[0].operator, PUBKEY_2);
  });
});

describe('SolanaARIOReadable.getFinalizableGoneGateways', () => {
  // On-chain seconds. finalize_gone window =
  //   leaveTimestamp + GATEWAY_LEAVE_PERIOD (90d) + 7 * max(leaveEpochDuration, epoch_duration).
  // The stubbed rpc has no epoch-settings account, so getEpochSettings() throws
  // and the method falls back to currentEpochDuration = 0 (snapshot-only window).
  const NOW = 1_700_000_000;
  const LEAVE_PERIOD = 7_776_000; // 90 days
  const DAY = 86_400;

  it('includes a Leaving gateway past the full 90d window with no delegations', async () => {
    const joined = makeGatewayBytes(PUBKEY_1, GatewayStatus.Joined, 0);
    const eligible = makeGatewayBytes(PUBKEY_2, GatewayStatus.Leaving, 0, {
      leaveTimestamp: BigInt(NOW - LEAVE_PERIOD - 100), // window fully elapsed
      leaveEpochDuration: 0n,
      totalDelegatedStake: 0n,
    });
    const r = buildReadable(
      stubRpcReturning([
        { pubkey: ADDR_A, bytes: joined },
        { pubkey: ADDR_B, bytes: eligible },
      ]),
    );

    const out = await r.getFinalizableGoneGateways(NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0].pubkey, ADDR_B);
    assert.equal(out[0].operator, PUBKEY_2);
  });

  it('treats exactly leaveTimestamp + 90d (epochDuration 0) as eligible (boundary)', async () => {
    const atBoundary = makeGatewayBytes(PUBKEY_1, GatewayStatus.Leaving, 0, {
      leaveTimestamp: BigInt(NOW - LEAVE_PERIOD),
      leaveEpochDuration: 0n,
      totalDelegatedStake: 0n,
    });
    const r = buildReadable(
      stubRpcReturning([{ pubkey: ADDR_A, bytes: atBoundary }]),
    );
    assert.equal((await r.getFinalizableGoneGateways(NOW)).length, 1);
  });

  it('excludes a recently-left gateway still inside the 90d window (the LeaveWindowNotExpired case)', async () => {
    // Left 1000s ago — far short of the 90d cooldown. This is the production
    // scenario the leaveTimestamp-only filter wrongly admitted.
    const recent = makeGatewayBytes(PUBKEY_1, GatewayStatus.Leaving, 0, {
      leaveTimestamp: BigInt(NOW - 1000),
      leaveEpochDuration: BigInt(DAY),
      totalDelegatedStake: 0n,
    });
    const r = buildReadable(
      stubRpcReturning([{ pubkey: ADDR_A, bytes: recent }]),
    );
    assert.deepEqual(await r.getFinalizableGoneGateways(NOW), []);
  });

  it('accounts for the 7*epoch_duration term — past 90d but not past 90d + 7 epochs is NOT eligible', async () => {
    // 100s past the 90d mark, but 7 * 1-day epochs (7 days) has not elapsed →
    // finalize_gone would still revert, so it must be excluded. This is the
    // case the original leaveTimestamp-only filter got wrong.
    const within7Epochs = makeGatewayBytes(PUBKEY_1, GatewayStatus.Leaving, 0, {
      leaveTimestamp: BigInt(NOW - LEAVE_PERIOD - 100),
      leaveEpochDuration: BigInt(DAY), // 7 * 86400 = 7 days >> 100s remaining
      totalDelegatedStake: 0n,
    });
    const r = buildReadable(
      stubRpcReturning([{ pubkey: ADDR_A, bytes: within7Epochs }]),
    );
    assert.deepEqual(await r.getFinalizableGoneGateways(NOW), []);
  });

  it('excludes a Leaving gateway that still holds delegated stake', async () => {
    const stillDelegated = makeGatewayBytes(
      PUBKEY_1,
      GatewayStatus.Leaving,
      0,
      {
        leaveTimestamp: BigInt(NOW - LEAVE_PERIOD - 100), // window elapsed
        leaveEpochDuration: 0n,
        totalDelegatedStake: 5_000n,
      },
    );
    const r = buildReadable(
      stubRpcReturning([{ pubkey: ADDR_A, bytes: stillDelegated }]),
    );
    assert.deepEqual(await r.getFinalizableGoneGateways(NOW), []);
  });

  it('excludes a Leaving gateway with no leaveTimestamp set', async () => {
    const noWindow = makeGatewayBytes(PUBKEY_1, GatewayStatus.Leaving, 0, {
      leaveTimestamp: null,
      totalDelegatedStake: 0n,
    });
    const r = buildReadable(
      stubRpcReturning([{ pubkey: ADDR_A, bytes: noWindow }]),
    );
    assert.deepEqual(await r.getFinalizableGoneGateways(NOW), []);
  });

  it('excludes Joined gateways regardless of timestamps', async () => {
    const joined = makeGatewayBytes(PUBKEY_1, GatewayStatus.Joined, 0, {
      leaveTimestamp: BigInt(NOW - LEAVE_PERIOD - 100),
      totalDelegatedStake: 0n,
    });
    const r = buildReadable(
      stubRpcReturning([{ pubkey: ADDR_A, bytes: joined }]),
    );
    assert.deepEqual(await r.getFinalizableGoneGateways(NOW), []);
  });
});

describe('SolanaARIOReadable.getDisabledGatewaysWithDelegatedStake', () => {
  it('returns only Joined gateways with delegation disabled AND stake > 0', async () => {
    // Disabled + has stake → eligible for the cranker sweep.
    const disabledWithStake = makeGatewayBytes(
      PUBKEY_1,
      GatewayStatus.Joined,
      0,
      {
        allowDelegatedStaking: false,
        totalDelegatedStake: 5_000_000_000n,
      },
    );
    // Disabled but already drained → nothing to crank.
    const disabledNoStake = makeGatewayBytes(
      PUBKEY_2,
      GatewayStatus.Joined,
      0,
      {
        allowDelegatedStaking: false,
        totalDelegatedStake: 0n,
      },
    );
    // Enabled with stake → not a target (delegation still allowed).
    const enabledWithStake = makeGatewayBytes(
      PUBKEY_3,
      GatewayStatus.Joined,
      0,
      {
        allowDelegatedStaking: true,
        totalDelegatedStake: 9_000_000_000n,
      },
    );
    // Leaving with disabled+stake → handled by the leaving-gateway sweep, not here.
    const leavingDisabled = makeGatewayBytes(
      PUBKEY_1,
      GatewayStatus.Leaving,
      0,
      {
        allowDelegatedStaking: false,
        totalDelegatedStake: 1_000_000_000n,
      },
    );
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: disabledWithStake },
      { pubkey: ADDR_B, bytes: disabledNoStake },
      { pubkey: ADDR_C, bytes: enabledWithStake },
      { pubkey: ADDR_A, bytes: leavingDisabled },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getDisabledGatewaysWithDelegatedStake();
    assert.equal(
      out.length,
      1,
      'only Joined + delegation-disabled + stake>0 gateways need the disabled sweep',
    );
    assert.equal(out[0].pubkey, ADDR_A);
    assert.equal(out[0].operator, PUBKEY_1);
    assert.equal(out[0].totalDelegatedStake, 5_000_000_000n);
  });
});

// ---------------------------------------------------------------
// Resilience: malformed bytes don't crash discovery
// ---------------------------------------------------------------

describe('Discovery helpers gracefully skip undecodable rows', () => {
  it('getEmptyDelegations skips a row whose bytes are too short', async () => {
    const enc = getDelegationEncoder();
    const valid = enc.encode({
      gateway: PUBKEY_1,
      delegator: PUBKEY_2,
      amount: 0n,
      startTimestamp: 1_000n,
      rewardDebt: 0n,
      bump: 254,
      version: VERSION,
    });
    const truncated = valid.subarray(0, 16); // half a Delegation
    const rpc = stubRpcReturning([
      { pubkey: ADDR_A, bytes: valid },
      { pubkey: ADDR_B, bytes: truncated },
    ]);
    const r = buildReadable(rpc);

    const out = await r.getEmptyDelegations();
    // Malformed row is skipped silently — partial results > total failure.
    assert.equal(out.length, 1);
    assert.equal(out[0].pubkey, ADDR_A);
  });
});
