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
    totalDelegatedStake: 0n,
    status,
    startTimestamp: 0n,
    leaveTimestamp: null,
    leaveEpochDuration: 0n,
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
      allowDelegatedStaking: false,
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
  it('returns only gateways with status === Gone', async () => {
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
      'only Gone gateways are eligible for finalize_gone GC',
    );
    assert.equal(out[0].pubkey, ADDR_C);
    assert.equal(out[0].operator, PUBKEY_3);
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
