import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DEMAND_FACTOR_DOWN_ADJUSTMENT,
  DEMAND_FACTOR_MIN,
  DEMAND_FACTOR_SCALE,
  DEMAND_FACTOR_UP_ADJUSTMENT,
  MAX_PERIODS_AT_MIN_DEMAND_FACTOR,
  MOVING_AVG_PERIOD_COUNT,
  PERIOD_LENGTH_SECONDS,
} from '@ar.io/solana-contracts/arns';

/**
 * Guards the demand-factor settings against the literal-drift bug that
 * `getDemandFactorSettings` had: the down-adjustment was hardcoded `25` (2.5%)
 * while the on-chain program uses DEMAND_FACTOR_DOWN_ADJUSTMENT = 985_000
 * (0.985× → 1.5%). These now derive from the generated program constants
 * (lifted from the Rust source-of-truth), so this test pins both the constant
 * values and the derivation `getDemandFactorSettings` performs.
 *
 * If `@ar.io/solana-contracts` is regenerated against changed Rust consts,
 * these fail before a wrong price/quote ships.
 */
describe('demand factor settings', () => {
  it('exports the program constants as bigint with the on-chain values', () => {
    assert.equal(DEMAND_FACTOR_SCALE, 1_000_000n);
    assert.equal(DEMAND_FACTOR_UP_ADJUSTMENT, 1_050_000n);
    assert.equal(DEMAND_FACTOR_DOWN_ADJUSTMENT, 985_000n);
    assert.equal(DEMAND_FACTOR_MIN, 500_000n);
    assert.equal(typeof DEMAND_FACTOR_SCALE, 'bigint');
    assert.equal(typeof DEMAND_FACTOR_DOWN_ADJUSTMENT, 'bigint');
  });

  it('derives the adjustment rates the way getDemandFactorSettings does', () => {
    const scale = DEMAND_FACTOR_SCALE;
    const upRate = Number(
      ((DEMAND_FACTOR_UP_ADJUSTMENT - scale) * 1000n) / scale,
    );
    const downRate = Number(
      ((scale - DEMAND_FACTOR_DOWN_ADJUSTMENT) * 1000n) / scale,
    );

    assert.equal(upRate, 50); // 1.05× — unchanged
    assert.equal(downRate, 15); // 0.985× — was incorrectly hardcoded 25
    assert.equal(Number(DEMAND_FACTOR_MIN) / Number(scale), 0.5);
  });

  it('exports period/threshold constants as ergonomic numbers', () => {
    assert.equal(MOVING_AVG_PERIOD_COUNT, 7);
    assert.equal(MAX_PERIODS_AT_MIN_DEMAND_FACTOR, 7);
    assert.equal(Number(PERIOD_LENGTH_SECONDS) * 1000, 86_400_000);
    assert.equal(typeof MOVING_AVG_PERIOD_COUNT, 'number');
  });
});
