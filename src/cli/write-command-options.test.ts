/**
 * Regression tests for gateway-operator write commands.
 *
 * Both cases below were found by driving a real (non-privileged) gateway
 * operator wallet through the full lifecycle against a deployed cluster:
 *
 *   1. `leave-network`, `instant-withdrawal` and `cancel-withdrawal` never
 *      registered `--skip-confirmation`. `assertConfirmationPrompt` honours
 *      `options.skipConfirmation` internally, but commander rejected the flag
 *      as an unknown option before the handler ever saw it — so all three were
 *      impossible to run non-interactively.
 *
 *   2. `save-observations` required a non-empty `--failed-gateways`, which made
 *      the healthy case — an observer reporting that every gateway passed —
 *      unsubmittable from the CLI.
 *
 * The first suite inspects the commander registration that `cli.ts` actually
 * performs rather than re-deriving the option lists here, so it fails if a
 * command is registered with the wrong list.
 */

import { strict as assert } from 'node:assert';
import { program } from 'commander';
import { describe, it } from 'node:test';

// Imported for its side effects: every `makeCommand` call registers onto
// commander's `program` singleton. `cli.ts` only calls `program.parse()` when
// argv[1] looks like the CLI entrypoint, so importing it here is inert.
import './cli.js';
import { saveObservations } from './commands/gatewayWriteCommands.js';
import { stringArrayFromOptions } from './utils.js';

const flagsFor = (name: string): string[] => {
  const command = program.commands.find((c) => c.name() === name);
  assert.ok(command !== undefined, `command '${name}' is not registered`);
  return command.options.map((o) => o.long ?? o.short ?? '');
};

describe('gateway write commands accept --skip-confirmation', () => {
  for (const name of [
    'leave-network',
    'instant-withdrawal',
    'cancel-withdrawal',
    // Already correct — pinned so a refactor of the shared option lists cannot
    // silently drop them.
    'join-network',
    'claim-withdrawal',
    'save-observations',
  ]) {
    it(`${name} registers the flag`, () => {
      assert.ok(
        flagsFor(name).includes('--skip-confirmation'),
        `${name} must register --skip-confirmation or it cannot be automated`,
      );
    });
  }

  it('leaves the read-only vault command without write flags', () => {
    // `addressAndVaultIdOptions` is shared with get-vault, so the write flags
    // have to be composed at the call site rather than added to that list.
    assert.ok(!flagsFor('get-vault').includes('--skip-confirmation'));
  });
});

describe('save-observations failed-gateways parsing', () => {
  it('treats an omitted --failed-gateways as an all-pass report', () => {
    assert.deepEqual(stringArrayFromOptions({}, 'failedGateways') ?? [], []);
  });

  it('does not reject an all-pass report at argument parsing', async () => {
    // No wallet is configured, so this is expected to fail — but it must get
    // past argument parsing first. Pre-fix it threw
    // '--failedGateways is required' and never reached the signer.
    const err = await saveObservations({
      skipConfirmation: true,
      transactionId: 'a'.repeat(43),
    } as Parameters<typeof saveObservations>[0]).then(
      () => undefined,
      (e: Error) => e,
    );
    assert.ok(err !== undefined, 'expected a failure without a wallet');
    assert.doesNotMatch(
      err.message,
      /failedGateways is required/,
      'an omitted failure list must mean "all passed", not a usage error',
    );
  });

  it('still parses an explicit failure list', () => {
    assert.deepEqual(
      stringArrayFromOptions({ failedGateways: ['a', 'b'] }, 'failedGateways'),
      ['a', 'b'],
    );
  });
});
