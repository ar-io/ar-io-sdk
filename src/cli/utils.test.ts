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

import {
  buyAntStateFromOptions,
  fundingPlanFromOptions,
  requiredAddressFromOptions,
  withdrawalIdFromOptions,
} from './utils.js';

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
        gateway: 'GFGaZZWRT1PwKwFw2NkkyMhsRU6qSsxHmJThN7swUe1N',
      },
    ]);
    const out = fundingPlanFromOptions({ fundingPlanJson: json });
    assert.equal(out![0].kind, 'operatorStake');
    assert.equal(
      out![0].gateway,
      'GFGaZZWRT1PwKwFw2NkkyMhsRU6qSsxHmJThN7swUe1N',
    );
  });

  it('rejects a gateway that is not valid base58', () => {
    assert.throws(
      () =>
        fundingPlanFromOptions({
          // 'O' is not in the base58 alphabet.
          fundingPlanJson:
            '[{"kind":"delegation","amount":"100","gateway":"OpGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"}]',
        }),
      /is not a valid base58 Solana address/,
    );
  });

  it('rejects an amount above u64 max', () => {
    const overU64 = (1n << 64n).toString(); // 2^64, one past the max
    assert.throws(
      () =>
        fundingPlanFromOptions({
          fundingPlanJson: `[{"kind":"balance","amount":"${overU64}"}]`,
        }),
      /exceeds u64 max/,
    );
  });

  it('accepts an amount at exactly u64 max', () => {
    const u64Max = ((1n << 64n) - 1n).toString();
    const out = fundingPlanFromOptions({
      fundingPlanJson: `[{"kind":"balance","amount":"${u64Max}"}]`,
    });
    assert.equal(out![0].amount, (1n << 64n) - 1n);
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

describe('withdrawalIdFromOptions', () => {
  it('returns undefined when the flag is unset', () => {
    assert.equal(withdrawalIdFromOptions({}), undefined);
  });

  it('parses a valid decimal id', () => {
    assert.equal(withdrawalIdFromOptions({ withdrawalId: '42' }), 42n);
  });

  it('accepts the u64 max', () => {
    const u64Max = ((1n << 64n) - 1n).toString();
    assert.equal(
      withdrawalIdFromOptions({ withdrawalId: u64Max }),
      (1n << 64n) - 1n,
    );
  });

  it('rejects a value above u64 max', () => {
    assert.throws(
      () => withdrawalIdFromOptions({ withdrawalId: (1n << 64n).toString() }),
      /outside u64 range/,
    );
  });

  it('rejects a negative value', () => {
    assert.throws(
      () => withdrawalIdFromOptions({ withdrawalId: '-1' }),
      /outside u64 range/,
    );
  });

  it('rejects a non-integer string', () => {
    assert.throws(
      () => withdrawalIdFromOptions({ withdrawalId: 'abc' }),
      /not a valid u64 integer/,
    );
  });
});

describe('requiredAddressFromOptions', () => {
  it('mentions --private-key when no address source is provided', () => {
    assert.throws(
      () => requiredAddressFromOptions({}),
      /--address, --wallet-file, or --private-key/,
    );
  });
});

describe('buyAntStateFromOptions', () => {
  it('returns undefined when no metadata flags are supplied', () => {
    assert.equal(buyAntStateFromOptions({}), undefined);
  });

  it('maps --transaction-id and --target onto the @ target', () => {
    assert.deepEqual(buyAntStateFromOptions({ transactionId: 'tx1' }), {
      transactionId: 'tx1',
    });
    // --target is accepted as an alias for the @ record's tx id.
    assert.deepEqual(buyAntStateFromOptions({ target: 'tx2' }), {
      transactionId: 'tx2',
    });
  });

  it('maps ticker/description/keywords/logo through', () => {
    assert.deepEqual(
      buyAntStateFromOptions({
        ticker: 'BLOG',
        description: 'hi',
        keywords: ['a', 'b'],
        logo: 'logotx',
      }),
      {
        ticker: 'BLOG',
        description: 'hi',
        keywords: ['a', 'b'],
        logo: 'logotx',
      },
    );
  });

  it('parses --target-protocol arweave/ipfs (and numeric) to 0/1', () => {
    assert.equal(
      buyAntStateFromOptions({ targetProtocol: 'arweave' })?.targetProtocol,
      0,
    );
    assert.equal(
      buyAntStateFromOptions({ targetProtocol: 'ipfs' })?.targetProtocol,
      1,
    );
    assert.equal(
      buyAntStateFromOptions({ targetProtocol: '1' })?.targetProtocol,
      1,
    );
  });

  it('throws on an invalid --target-protocol', () => {
    assert.throws(
      () => buyAntStateFromOptions({ targetProtocol: 'https' }),
      /--target-protocol must be/,
    );
  });

  it('does not set TTL (not settable at mint)', () => {
    const state = buyAntStateFromOptions({ transactionId: 'tx1' });
    assert.ok(state && !('ttlSeconds' in state));
  });
});
