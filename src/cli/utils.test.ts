/**
 * Unit tests for CLI argument parsers.
 *
 * Currently covers `fundingPlanFromOptions` — the parser for the
 * `--funding-plan-json` flag. Verifies the multi-gateway shape (per-source
 * `gateway` field) is accepted on `delegation` / `operatorStake` sources and
 * rejected on `balance` / `withdrawal`.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { fundingPlanFromOptions } from './utils.js';

describe('fundingPlanFromOptions', () => {
  it('returns undefined when the flag is unset', () => {
    assert.equal(fundingPlanFromOptions({}), undefined);
  });

  it('parses a single balance source', () => {
    const out = fundingPlanFromOptions({
      fundingPlanJson: '[{"kind":"balance","amount":"100"}]',
    });
    assert.deepEqual(out, [{ kind: 'balance', amount: 100n }]);
  });

  it('parses multi-gateway delegation plan with per-source gateway', () => {
    const json = JSON.stringify([
      {
        kind: 'delegation',
        amount: '100',
        gateway: 'GwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      {
        kind: 'delegation',
        amount: '50',
        gateway: 'GwBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      },
    ]);
    const out = fundingPlanFromOptions({ fundingPlanJson: json });
    assert.equal(out!.length, 2);
    assert.equal(out![0].kind, 'delegation');
    assert.equal(out![0].amount, 100n);
    assert.equal(
      out![0].gateway,
      'GwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    assert.equal(
      out![1].gateway,
      'GwBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    );
  });

  it('parses operatorStake source with gateway', () => {
    const json = JSON.stringify([
      {
        kind: 'operatorStake',
        amount: '500',
        gateway: 'OpGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      },
    ]);
    const out = fundingPlanFromOptions({ fundingPlanJson: json });
    assert.equal(out![0].kind, 'operatorStake');
    assert.equal(
      out![0].gateway,
      'OpGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    );
  });

  it('rejects gateway field on balance source', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson:
            '[{"kind":"balance","amount":"100","gateway":"Gw..."}]',
        }),
      /gateway is only valid for kind 'delegation' or 'operatorStake'/,
    );
  });

  it('rejects gateway field on withdrawal source', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson:
            '[{"kind":"withdrawal","amount":"100","gateway":"Gw..."}]',
        }),
      /gateway is only valid for kind 'delegation' or 'operatorStake'/,
    );
  });

  it('rejects non-string gateway field', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson:
            '[{"kind":"delegation","amount":"100","gateway":123}]',
        }),
      /gateway must be a base58 Solana address/,
    );
  });

  it('rejects unknown kind', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson: '[{"kind":"bogus","amount":"100"}]',
        }),
      /kind must be one of/,
    );
  });

  it('rejects malformed JSON', () => {
    assert.throws(
      () => fundingPlanFromOptions({ fundingPlanJson: '{not-json' }),
      /not valid JSON/,
    );
  });

  it('rejects non-array root', () => {
    assert.throws(
      () => fundingPlanFromOptions({ fundingPlanJson: '{"kind":"balance"}' }),
      /must be a JSON array/,
    );
  });

  it('rejects non-positive amount', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson: '[{"kind":"balance","amount":"0"}]',
        }),
      /amount must be > 0/,
    );
  });

  it('rejects amount that is not a u64 string', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson: '[{"kind":"balance","amount":"abc"}]',
        }),
      /not a valid u64/,
    );
  });
});
