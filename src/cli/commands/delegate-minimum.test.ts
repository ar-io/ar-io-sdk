/**
 * The CLI's delegate-stake minimum pre-check, against the on-chain rule.
 *
 * `ario-gar`'s `delegate_stake` applies the gateway minimum only when
 * `delegation.amount == 0`, so a delegator who already holds stake there may
 * add any amount above zero. The CLI enforced the minimum on every deposit and
 * so refused, before sending anything, a top-up the program accepts: a wallet
 * holding 3,773.9 ARIO at a gateway whose minimum is 500 could not add 250.
 *
 * `delegationMeetsMinimum` covers that scenario and its boundaries.
 * `isExistingStakeOn` covers which rows earn the exemption: only a live stake
 * row on the target gateway. A vault row is a pending withdrawal, and a
 * delegator who has withdrawn everything reads `delegation.amount == 0` on
 * chain, so treating one as existing would wave through an amount the program
 * still rejects — the same mistake as the bug above, pointing the other way.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { Delegation } from '../../types/io.js';
import {
  delegationMeetsMinimum,
  isExistingStakeOn,
} from './gatewayWriteCommands.js';

// The reported mainnet case, in mARIO.
const GATEWAY_MIN = 500_000_000;
const TOP_UP = 250_000_000;

describe('delegationMeetsMinimum', () => {
  it('allows an existing delegator below the gateway minimum', () => {
    assert.equal(
      delegationMeetsMinimum({
        amount: TOP_UP,
        effectiveMin: GATEWAY_MIN,
        standing: 'existing',
      }),
      true,
    );
  });

  it('rejects a new delegator below the gateway minimum', () => {
    assert.equal(
      delegationMeetsMinimum({
        amount: TOP_UP,
        effectiveMin: GATEWAY_MIN,
        standing: 'new',
      }),
      false,
    );
  });

  it('allows a new delegator at exactly the minimum', () => {
    assert.equal(
      delegationMeetsMinimum({
        amount: GATEWAY_MIN,
        effectiveMin: GATEWAY_MIN,
        standing: 'new',
      }),
      true,
    );
  });

  it('rejects zero whatever the standing', () => {
    // `require!(amount > 0, GarError::InvalidAmount)` is unconditional on
    // chain, so the exemption must not reach down to zero.
    for (const standing of ['existing', 'new', 'unknown'] as const) {
      assert.equal(
        delegationMeetsMinimum({
          amount: 0,
          effectiveMin: GATEWAY_MIN,
          standing,
        }),
        false,
        `zero should be rejected for standing=${standing}`,
      );
    }
  });

  it('rejects a negative amount', () => {
    assert.equal(
      delegationMeetsMinimum({
        amount: -1,
        effectiveMin: GATEWAY_MIN,
        standing: 'existing',
      }),
      false,
    );
  });

  it('treats an unknown standing like existing, so a lookup failure cannot block a legitimate top-up', () => {
    // The two failure directions are not symmetric: refusing an existing
    // delegator blocks them entirely, while allowing a sub-minimum new
    // delegation costs a fee and is caught on chain.
    assert.equal(
      delegationMeetsMinimum({
        amount: TOP_UP,
        effectiveMin: GATEWAY_MIN,
        standing: 'unknown',
      }),
      true,
    );
  });

  it('is not a resulting-total rule', () => {
    // Under "resulting total >= minimum" an existing delegator holding less
    // than a newly-raised minimum would still be blocked — the exact case the
    // on-chain exemption exists for. Holding 100 against a minimum of 500 and
    // adding 1 must be allowed.
    assert.equal(
      delegationMeetsMinimum({
        amount: 1,
        effectiveMin: GATEWAY_MIN,
        standing: 'existing',
      }),
      true,
    );
  });
});

describe('isExistingStakeOn', () => {
  const TARGET = 'CNdAuzg212FoUtUR9SzsUgiqNBrm8datEmLUGT6zB6ZP';
  const OTHER = '89fNiiwgpFSPHKuqfNUkgYTYjtAJAhyqHjXmgXeppGpf';

  const stake = (over: Partial<Delegation> = {}): Delegation =>
    ({
      type: 'stake',
      gatewayAddress: TARGET,
      delegationId: '7M5nX2NWJUJYiSJLv3gSEnJNhnmFZPMPgmSZexx3omZy',
      startTimestamp: 1_700_000_000_000,
      balance: 3_845_604_203,
      ...over,
    }) as Delegation;

  it('counts a live stake row on the target gateway', () => {
    assert.equal(isExistingStakeOn(stake(), TARGET), true);
  });

  it('ignores a stake row on a different gateway', () => {
    assert.equal(
      isExistingStakeOn(stake({ gatewayAddress: OTHER }), TARGET),
      false,
    );
  });

  it('ignores a vault row, which is a pending withdrawal and not stake', () => {
    // The program reads `delegation.amount`. A delegator mid-withdrawal can
    // hold a vault while that field is zero, so a vault must not confer the
    // exemption.
    assert.equal(
      isExistingStakeOn(
        stake({ type: 'vault', vaultId: 1, endTimestamp: 1_800_000_000_000 }),
        TARGET,
      ),
      false,
    );
  });

  it('ignores a fully withdrawn stake row', () => {
    assert.equal(isExistingStakeOn(stake({ balance: 0 }), TARGET), false);
  });
});
