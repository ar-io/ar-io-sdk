import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { REWARD_PRECISION } from './constants.js';
import { computeLiveDelegationBalance } from './delegation-math.js';
import {
  deserializeDelegation,
  deserializeGateway,
  deserializeGatewayWithAccumulator,
} from './deserialize.js';

/**
 * Synthetic-byte round-trip tests for the two accumulator-related deserializers
 * that we updated to surface `reward_debt` (Delegation) and
 * `cumulative_reward_per_token` (Gateway). These tests pin the byte offsets at
 * which we extract those u128 fields — if the on-chain struct layout ever
 * moves, these fail before the math goes wrong in production.
 *
 * The buffer constants mirror the on-chain struct definitions in
 * `programs/ario-gar/src/state/mod.rs` (`Delegation` at line 441 and `Gateway`
 * at line 182 of that file). When the struct layout changes, both this test
 * and the deserializer need to move in lockstep.
 */

const U64_LO_MASK = (1n << 64n) - 1n;

function writeU128LE(buf: Buffer, off: number, val: bigint): void {
  buf.writeBigUInt64LE(val & U64_LO_MASK, off);
  buf.writeBigUInt64LE(val >> 64n, off + 8);
}

describe('deserializeDelegation (synthetic round-trip)', () => {
  // Delegation layout:
  //   8  disc
  //   32 gateway: Pubkey
  //   32 delegator: Pubkey
  //   8  amount: u64
  //   8  start_timestamp: i64
  //   16 reward_debt: u128
  //   1  bump: u8
  //   3  version: SchemaVersion (major, minor, patch)
  const DELEGATION_SIZE = 8 + 32 + 32 + 8 + 8 + 16 + 1 + 3;

  it('extracts amount, startTimestamp, and rewardDebt at the expected offsets', () => {
    const buf = Buffer.alloc(DELEGATION_SIZE);
    // 8 disc, 32 gateway, 32 delegator — leave as zeroes
    buf.writeBigUInt64LE(10_000_000_000n, 72); // amount = 10,000 ARIO
    buf.writeBigInt64LE(1_700_000_000n, 80); // start_timestamp
    writeU128LE(buf, 88, 500_000_000_000_000_000n); // reward_debt = 0.5 * REWARD_PRECISION
    buf.writeUInt8(255, 104); // bump

    const result = deserializeDelegation(buf);

    assert.equal(result.delegatedStake, 10_000_000_000);
    assert.equal(result.startTimestamp, 1_700_000_000);
    assert.equal(result.rewardDebt, 500_000_000_000_000_000n);
  });

  it('handles a zero-reward-debt fresh delegation', () => {
    const buf = Buffer.alloc(DELEGATION_SIZE);
    buf.writeBigUInt64LE(1_000_000n, 72); // 1 ARIO
    buf.writeBigInt64LE(0n, 80);
    writeU128LE(buf, 88, 0n);

    const result = deserializeDelegation(buf);

    assert.equal(result.delegatedStake, 1_000_000);
    assert.equal(result.rewardDebt, 0n);
  });

  it('round-trips through computeLiveDelegationBalance to the expected live value', () => {
    // 100 ARIO staked, last settled at reward_debt = 0.5 * REWARD_PRECISION.
    // Gateway's accumulator is now at REWARD_PRECISION (1.0), so delta = 0.5
    // → pending = 100 * 0.5 = 50 ARIO → live = 150 ARIO.
    const buf = Buffer.alloc(DELEGATION_SIZE);
    buf.writeBigUInt64LE(100_000_000n, 72); // 100 ARIO
    buf.writeBigInt64LE(0n, 80);
    writeU128LE(buf, 88, REWARD_PRECISION / 2n); // reward_debt = 0.5

    const del = deserializeDelegation(buf);
    const live = computeLiveDelegationBalance({
      delegatedStake: del.delegatedStake,
      rewardDebt: del.rewardDebt,
      cumulativeRewardPerToken: REWARD_PRECISION, // gateway at 1.0
    });

    assert.equal(live, 150_000_000); // 150 ARIO in mARIO
  });
});

describe('deserializeGateway (synthetic round-trip — cumulativeRewardPerToken)', () => {
  /**
   * Build a minimal but valid Gateway buffer. Uses 1-character placeholders
   * for the variable-length strings so all subsequent offsets are computable.
   * Caller passes the values for `cumulative_reward_per_token` (the field we
   * care about validating) and any other fields they want to assert on.
   */
  function buildGatewayBuffer(opts: {
    operatorStake: bigint;
    totalDelegatedStake: bigint;
    cumulativeRewardPerToken: bigint;
    // GATEWAY_VERSION 1.1.0 GatewaySettings2 additions (Fix #6/#7). Omitted = None.
    pendingDelegateRewardShareRatio?: number; // raw u16 (e.g. 5000 = 50%)
    delegationDisabledAt?: bigint; // unix seconds
  }): Buffer {
    // Option<u16> = 1 tag (+2 if Some); Option<i64> = 1 tag (+8 if Some)
    const pendingBytes =
      opts.pendingDelegateRewardShareRatio === undefined ? 1 : 3;
    const disabledBytes = opts.delegationDisabledAt === undefined ? 1 : 9;
    // We use 1-char placeholders ("a") for label/fqdn/properties/note to keep
    // the math obvious. Each string contributes 4 (length prefix) + 1 (content).
    const STRING_BYTES = 4 + 1; // 4 length prefix + 1 char
    const SIZE =
      8 + // disc
      32 + // operator
      STRING_BYTES + // label = "a"
      STRING_BYTES + // fqdn = "a"
      2 + // port
      1 + // protocolIdx
      STRING_BYTES + // properties = "a"
      STRING_BYTES + // note = "a"
      8 + // operator_stake
      8 + // total_delegated_stake
      1 + // status
      8 + // start_timestamp
      1 + // leave_timestamp Option discriminator (None = 0, no payload)
      8 + // leave_epoch_duration
      4 * 5 + // stats: passed/failed/total/prescribed/observed epoch counts (u32 each)
      1 + // stats: failed_consecutive (u8)
      1 + // stats: passed_consecutive (u8)
      8 * 7 + // weights: 6 published u64 + weights_epoch u64
      1 + // allow_delegated_staking
      2 + // delegate_reward_share_ratio
      8 + // min_delegated_stake
      1 + // allowlist_enabled
      pendingBytes + // pending_delegate_reward_share_ratio: Option<u16> (Fix #7)
      disabledBytes + // delegation_disabled_at: Option<i64> (Fix #6)
      4 + // registry_index.index
      1 + // registry_index._reserved
      32 + // observer_address
      16 + // cumulative_reward_per_token
      1 + // bump
      3; // version: SchemaVersion (major, minor, patch)

    const buf = Buffer.alloc(SIZE);
    let off = 8 + 32; // skip disc + operator

    // label "a"
    buf.writeUInt32LE(1, off);
    off += 4;
    buf.writeUInt8(0x61, off);
    off += 1;
    // fqdn "a"
    buf.writeUInt32LE(1, off);
    off += 4;
    buf.writeUInt8(0x61, off);
    off += 1;
    // port (u16) + protocolIdx (u8)
    buf.writeUInt16LE(443, off);
    off += 2;
    buf.writeUInt8(1, off);
    off += 1; // https
    // properties "a"
    buf.writeUInt32LE(1, off);
    off += 4;
    buf.writeUInt8(0x61, off);
    off += 1;
    // note "a"
    buf.writeUInt32LE(1, off);
    off += 4;
    buf.writeUInt8(0x61, off);
    off += 1;
    // operator_stake (u64)
    buf.writeBigUInt64LE(opts.operatorStake, off);
    off += 8;
    // total_delegated_stake (u64)
    buf.writeBigUInt64LE(opts.totalDelegatedStake, off);
    off += 8;
    // status (u8) — Joined = 0
    buf.writeUInt8(0, off);
    off += 1;
    // start_timestamp (i64)
    buf.writeBigInt64LE(0n, off);
    off += 8;
    // leave_timestamp Option<i64> — None
    buf.writeUInt8(0, off);
    off += 1;
    // leave_epoch_duration (i64) — skipped by deserializer but layout still consumed
    buf.writeBigInt64LE(0n, off);
    off += 8;
    // stats: 5 u32 + 2 u8 = 22 bytes — leave zeroes
    off += 22;
    // weights: 7 u64 = 56 bytes — leave zeroes
    off += 56;
    // allow_delegated_staking (bool)
    buf.writeUInt8(1, off);
    off += 1;
    // delegate_reward_share_ratio (u16) — pre-scale value, e.g. 10 means 10*100=1000 in basis-of-RATE_SCALE
    buf.writeUInt16LE(1000, off);
    off += 2;
    // min_delegated_stake (u64)
    buf.writeBigUInt64LE(0n, off);
    off += 8;
    // allowlist_enabled (bool)
    buf.writeUInt8(0, off);
    off += 1;
    // pending_delegate_reward_share_ratio: Option<u16> (Fix #7)
    if (opts.pendingDelegateRewardShareRatio === undefined) {
      buf.writeUInt8(0, off);
      off += 1;
    } else {
      buf.writeUInt8(1, off);
      off += 1;
      buf.writeUInt16LE(opts.pendingDelegateRewardShareRatio, off);
      off += 2;
    }
    // delegation_disabled_at: Option<i64> (Fix #6)
    if (opts.delegationDisabledAt === undefined) {
      buf.writeUInt8(0, off);
      off += 1;
    } else {
      buf.writeUInt8(1, off);
      off += 1;
      buf.writeBigInt64LE(opts.delegationDisabledAt, off);
      off += 8;
    }
    // registry_index.index (u32) + _reserved (u8)
    buf.writeUInt32LE(0, off);
    off += 4;
    buf.writeUInt8(0, off);
    off += 1;
    // observer_address (32 raw bytes) — leave zero
    off += 32;
    // cumulative_reward_per_token (u128 LE) — THE FIELD UNDER TEST
    writeU128LE(buf, off, opts.cumulativeRewardPerToken);
    off += 16;
    // bump (u8)
    buf.writeUInt8(255, off);
    off += 1;
    // version: SchemaVersion { major, minor, patch } — 3 bytes
    off += 3;

    assert.equal(off, SIZE, 'buffer build size mismatch');
    return buf;
  }

  it('extracts cumulativeRewardPerToken at the expected offset', () => {
    const buf = buildGatewayBuffer({
      operatorStake: 30_000_000_000n,
      totalDelegatedStake: 5_000_000_000n,
      cumulativeRewardPerToken: 750_000_000_000_000_000n, // 0.75 * REWARD_PRECISION
    });
    const gw = deserializeGatewayWithAccumulator(buf);

    assert.equal(gw.operatorStake, 30_000_000_000);
    assert.equal(gw.totalDelegatedStake, 5_000_000_000);
    assert.equal(gw.settings.delegateRewardShareRatio, 10);
    assert.equal(gw.cumulativeRewardPerToken, 750_000_000_000_000_000n);
  });

  it('handles a fresh gateway (zero accumulator)', () => {
    const buf = buildGatewayBuffer({
      operatorStake: 20_000_000_000n,
      totalDelegatedStake: 0n,
      cumulativeRewardPerToken: 0n,
    });
    const gw = deserializeGatewayWithAccumulator(buf);
    assert.equal(gw.cumulativeRewardPerToken, 0n);
  });

  it('preserves large u128 accumulator values without truncation', () => {
    // Pick a value with non-zero bits in both halves of the u128 — catches a
    // little-endian half-swap bug if either reader/writer is wrong.
    const big = (123n << 64n) | 456n;
    const buf = buildGatewayBuffer({
      operatorStake: 0n,
      totalDelegatedStake: 0n,
      cumulativeRewardPerToken: big,
    });
    const gw = deserializeGatewayWithAccumulator(buf);
    assert.equal(gw.cumulativeRewardPerToken, big);
  });

  it('reads GatewaySettings2 1.1.0 fields (None) and keeps later offsets aligned', () => {
    // Both Option fields absent (the common case). The layout grew by 2 bytes
    // (two None tags), so cumulativeRewardPerToken must still land correctly.
    const buf = buildGatewayBuffer({
      operatorStake: 20_000_000_000n,
      totalDelegatedStake: 7_000_000_000n,
      cumulativeRewardPerToken: 500_000_000_000_000_000n,
    });
    const gw = deserializeGatewayWithAccumulator(buf);
    assert.equal(gw.cumulativeRewardPerToken, 500_000_000_000_000_000n);
    assert.equal(gw.settings.pendingDelegateRewardShareRatio, undefined);
    assert.equal(gw.settings.delegationDisabledAt, undefined);
  });

  it('surfaces pending ratio + disabled timestamp (Some) without shifting later fields', () => {
    // Fix #6/#7: a staged reward-share change (5000 bp = 50%) and a disable
    // timestamp. The Some payloads widen GatewaySettings2 by 10 bytes; the
    // accumulator after `settings` must still decode correctly.
    const buf = buildGatewayBuffer({
      operatorStake: 20_000_000_000n,
      totalDelegatedStake: 9_000_000_000n,
      cumulativeRewardPerToken: 750_000_000_000_000_000n,
      pendingDelegateRewardShareRatio: 5000, // 50% in basis points
      delegationDisabledAt: 1_700_000_000n,
    });
    const gw = deserializeGatewayWithAccumulator(buf);
    assert.equal(gw.settings.pendingDelegateRewardShareRatio, 50); // 5000 / 100
    assert.equal(gw.settings.delegationDisabledAt, 1_700_000_000);
    // Critical: the layout after `settings` stays aligned.
    assert.equal(gw.cumulativeRewardPerToken, 750_000_000_000_000_000n);
  });

  it('public deserializeGateway does NOT expose cumulativeRewardPerToken', () => {
    // Regression guard for CodeRabbit finding: bigint must not leak through
    // the public Gateway shape (it's not JSON-serializable, would crash
    // `JSON.stringify` on getGateway() results).
    const buf = buildGatewayBuffer({
      operatorStake: 1_000n,
      totalDelegatedStake: 0n,
      cumulativeRewardPerToken: 999n,
    });
    const gw = deserializeGateway(buf);
    assert.equal(
      (gw as Record<string, unknown>).cumulativeRewardPerToken,
      undefined,
      'public deserializeGateway must not include the u128 accumulator',
    );
    // And JSON.stringify must succeed (would throw on a bigint field).
    assert.doesNotThrow(() => JSON.stringify(gw));
  });
});
