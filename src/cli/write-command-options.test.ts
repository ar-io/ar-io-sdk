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
import { describe, it } from 'node:test';
import { program } from 'commander';

// Imported for its side effects: every `makeCommand` call registers onto
// commander's `program` singleton. `cli.ts` only calls `program.parse()` when
// argv[1] looks like the CLI entrypoint, so importing it here is inert.
import './cli.js';
import { gatewayMetadataFromOptions } from './commands/gatewayOperationsCommands.js';
import { saveObservations } from './commands/gatewayWriteCommands.js';
import {
  allowDelegatedStakingFromOption,
  cliFallbackUrl,
  gatewaySettingsFromOptions,
  stringArrayFromOptions,
} from './utils.js';

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

describe('ADR-0030 / ADR-0031 commands', () => {
  const expected: Record<string, string[]> = {
    'update-operations-address': ['--operations-address'],
    'update-gateway-metadata': [
      '--gateway-address',
      '--label',
      '--note',
      '--properties',
      '--fqdn',
      '--port',
      '--protocol',
    ],
    'migrate-gateway': ['--gateway'],
    'migrate-gateways': ['--gateways', '--batch-size'],
    'transfer-epoch-settings-authority': ['--new-authority'],
  };

  for (const [name, flags] of Object.entries(expected)) {
    it(`${name} registers its flags and --skip-confirmation`, () => {
      const registered = flagsFor(name);
      for (const flag of [...flags, '--skip-confirmation']) {
        assert.ok(registered.includes(flag), `${name} is missing ${flag}`);
      }
    });
  }

  it('describes --gateway accurately on migrate-gateway', () => {
    const command = program.commands.find(
      (c) => c.name() === 'migrate-gateway',
    );
    const option = command?.options.find((o) => o.long === '--gateway');
    assert.ok(option !== undefined, 'migrate-gateway must register --gateway');
    assert.doesNotMatch(option.description, /prune|finalize/i);
  });

  it('describes --gateway-address accurately on update-gateway-metadata', () => {
    // The shared `gatewayAddress` option is worded for funding ArNS purchases
    // from stakes; the metadata command must not show that help text.
    const command = program.commands.find(
      (c) => c.name() === 'update-gateway-metadata',
    );
    const option = command?.options.find((o) => o.long === '--gateway-address');
    assert.ok(
      option !== undefined,
      'update-gateway-metadata must register --gateway-address',
    );
    assert.doesNotMatch(option.description, /fund/i);
  });
});

describe('gatewayMetadataFromOptions', () => {
  it('parses port and protocol and passes strings through', () => {
    assert.deepEqual(
      gatewayMetadataFromOptions({
        gatewayAddress: 'op',
        fqdn: 'gw.example.com',
        port: '8443',
        protocol: 'http',
      }),
      {
        gatewayAddress: 'op',
        label: undefined,
        note: undefined,
        properties: undefined,
        fqdn: 'gw.example.com',
        port: 8443,
        protocol: 'http',
      },
    );
  });

  it('rejects an invalid port or protocol', () => {
    assert.throws(
      () => gatewayMetadataFromOptions({ port: '70000' }),
      /--port/,
    );
    assert.throws(() => gatewayMetadataFromOptions({ port: '1.5' }), /--port/);
    assert.throws(
      () => gatewayMetadataFromOptions({ protocol: 'ftp' }),
      /--protocol/,
    );
  });

  it('requires at least one metadata field (--gateway-address alone is not enough)', () => {
    assert.throws(
      () => gatewayMetadataFromOptions({ gatewayAddress: 'op' }),
      /No metadata provided/,
    );
  });
});

// #629: `--allow-delegated-staking false` landed a gateway with delegation
// enabled, and `--auto-stake` was a no-op flag for a deprecated field.
describe('gateway staking flags (#629)', () => {
  const parseFlags = (name: string, argv: string[]) => {
    const command = program.commands.find((c) => c.name() === name);
    assert.ok(command !== undefined, `command '${name}' is not registered`);
    for (const key of Object.keys(command.opts())) {
      command.setOptionValue(key, undefined);
    }
    const { operands } = command.parseOptions(argv);
    return { opts: command.opts(), operands };
  };

  for (const name of ['join-network', 'update-gateway-settings']) {
    it(`${name} no longer registers --auto-stake`, () => {
      assert.ok(!flagsFor(name).includes('--auto-stake'));
    });

    it(`${name} keeps the value passed to --allow-delegated-staking`, () => {
      const off = parseFlags(name, ['--allow-delegated-staking', 'false']);
      assert.equal(off.opts.allowDelegatedStaking, 'false');
      assert.deepEqual(off.operands, []);
      assert.equal(
        gatewaySettingsFromOptions(off.opts).allowDelegatedStaking,
        false,
      );

      const bare = parseFlags(name, ['--allow-delegated-staking']);
      assert.equal(
        gatewaySettingsFromOptions(bare.opts).allowDelegatedStaking,
        true,
      );

      const unset = parseFlags(name, []);
      assert.equal(
        gatewaySettingsFromOptions(unset.opts).allowDelegatedStaking,
        undefined,
      );
    });
  }

  it('accepts only true or false', () => {
    assert.equal(allowDelegatedStakingFromOption('true'), true);
    assert.equal(allowDelegatedStakingFromOption('false'), false);
    assert.equal(allowDelegatedStakingFromOption(true), true);
    assert.equal(allowDelegatedStakingFromOption(undefined), undefined);
    assert.throws(
      () => allowDelegatedStakingFromOption('no'),
      /--allow-delegated-staking must be true or false/,
    );
  });
});

// A failing --rpc-url used to route the command at PUBLIC MAINNET, because
// the breaker's fallback answered mainnet for any URL without "devnet" in it.
describe('CLI RPC fallback stays on the same cluster', () => {
  it('has no fallback for a local validator', () => {
    for (const url of [
      'http://localhost:8899',
      'http://127.0.0.1:8899',
      'http://0.0.0.0:8899',
    ]) {
      assert.equal(cliFallbackUrl(url), undefined, url);
    }
  });

  it('has no fallback for a host that does not name its cluster', () => {
    assert.equal(cliFallbackUrl('https://rpc.example.com'), undefined);
    assert.equal(cliFallbackUrl('https://my-node.internal:8899'), undefined);
    assert.equal(cliFallbackUrl('not a url'), undefined);
  });

  it('falls back to the matching public RPC when the cluster is named', () => {
    assert.equal(
      cliFallbackUrl('https://api.devnet.solana.com'),
      'https://api.devnet.solana.com',
    );
    assert.equal(
      cliFallbackUrl('https://sneaky.devnet.rpcpool.com'),
      'https://api.devnet.solana.com',
    );
    assert.equal(
      cliFallbackUrl('https://x.mainnet.rpcpool.com'),
      'https://api.mainnet-beta.solana.com',
    );
  });
});

// `gatewaySettingsFromOptions` used to return all 10 keys with `undefined`
// values, so "did the operator set anything?" checks could never fire.
describe('gatewaySettingsFromOptions omits unset keys', () => {
  it('returns an empty object when nothing is set', () => {
    assert.deepEqual(gatewaySettingsFromOptions({}), {});
    assert.equal(Object.keys(gatewaySettingsFromOptions({})).length, 0);
  });

  it('keeps only what was passed', () => {
    assert.deepEqual(gatewaySettingsFromOptions({ observerAddress: 'obs' }), {
      observerAddress: 'obs',
    });
    assert.deepEqual(
      gatewaySettingsFromOptions({ label: 'gw', port: '8443' }),
      { label: 'gw', port: 8443 },
    );
  });

  it('keeps an explicit false', () => {
    assert.deepEqual(
      gatewaySettingsFromOptions({ allowDelegatedStaking: 'false' }),
      { allowDelegatedStaking: false },
    );
  });
});
