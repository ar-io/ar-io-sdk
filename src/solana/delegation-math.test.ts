import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { REWARD_PRECISION } from './constants.js';
import { computeLiveDelegationBalance } from './delegation-math.js';

describe('computeLiveDelegationBalance', () => {
  it('returns the raw amount when there is no accumulator delta', () => {
    const live = computeLiveDelegationBalance({
      delegatedStake: 10_000_000_000, // 10k ARIO
      rewardDebt: 1234n,
      cumulativeRewardPerToken: 1234n,
    });
    assert.equal(live, 10_000_000_000);
  });

  it('returns the raw amount when delegated stake is zero', () => {
    const live = computeLiveDelegationBalance({
      delegatedStake: 0,
      rewardDebt: 0n,
      cumulativeRewardPerToken: 5_000_000_000_000_000_000n,
    });
    assert.equal(live, 0);
  });

  it('returns the raw amount when accumulator is behind the debt (no underflow)', () => {
    // Should never happen in practice (accumulator is monotonically increasing
    // per gateway), but the helper must short-circuit instead of producing a
    // negative pending value.
    const live = computeLiveDelegationBalance({
      delegatedStake: 10_000_000_000,
      rewardDebt: 100n,
      cumulativeRewardPerToken: 50n,
    });
    assert.equal(live, 10_000_000_000);
  });

  it('compounds a one-epoch reward correctly (10 ARIO stake, 10% rate)', () => {
    // If the per-share accumulator advanced by `0.1 * REWARD_PRECISION`,
    // a 10 ARIO stake should accrue 1 ARIO of pending rewards.
    const delegatedStake = 10_000_000; // 10 ARIO in mARIO
    const rewardDebt = 0n;
    const cumulativeRewardPerToken = REWARD_PRECISION / 10n; // 0.1 per share
    const live = computeLiveDelegationBalance({
      delegatedStake,
      rewardDebt,
      cumulativeRewardPerToken,
    });
    assert.equal(live, 11_000_000); // 10 + 1 ARIO
  });

  it('handles a non-zero rewardDebt snapshot', () => {
    // Delegate already settled at `0.5 * REWARD_PRECISION`. Gateway now at
    // `0.7 * REWARD_PRECISION`. Pending delta is 0.2 per share. With 100 ARIO
    // staked the delegate is owed 20 ARIO.
    const live = computeLiveDelegationBalance({
      delegatedStake: 100_000_000, // 100 ARIO
      rewardDebt: REWARD_PRECISION / 2n,
      cumulativeRewardPerToken: (REWARD_PRECISION * 7n) / 10n,
    });
    assert.equal(live, 120_000_000); // 100 + 20 ARIO
  });

  it('matches the on-chain quotient/remainder split on large multipliers', () => {
    // delta * amount exceeds u128 if done naively. The helper splits into
    // quotient/remainder to preserve precision. Verify the same number is
    // produced regardless of representation: with delta = 1e18 (exactly
    // REWARD_PRECISION), per-share rate is 1.0, so pending == amount.
    const live = computeLiveDelegationBalance({
      delegatedStake: 500_000_000_000, // 500k ARIO
      rewardDebt: 0n,
      cumulativeRewardPerToken: REWARD_PRECISION,
    });
    // amount + amount * (1.0) = 2 * amount
    assert.equal(live, 1_000_000_000_000); // 1M ARIO
  });

  it('saturates at u64::MAX rather than overflowing', () => {
    // Pathological inputs that would overflow u64. The helper caps live at
    // u64::MAX = 18_446_744_073_709_551_615. Number representation past
    // 2^53 loses precision but the cap behavior is what we're verifying.
    const live = computeLiveDelegationBalance({
      delegatedStake: Number.MAX_SAFE_INTEGER,
      rewardDebt: 0n,
      cumulativeRewardPerToken: REWARD_PRECISION * 1_000_000n,
    });
    // Should be capped at u64::MAX (representable as a Number, lossily).
    const U64_MAX = Number((1n << 64n) - 1n);
    assert.equal(live, U64_MAX);
  });
});
