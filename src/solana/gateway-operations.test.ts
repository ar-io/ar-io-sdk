/**
 * ADR-0030 / ADR-0031 client support.
 *
 * The program (ario-gar, contracts #129 + #142) only honours a gateway's
 * `operations_address` once the account is at schema 1.2.0: below that the
 * field decodes from stale tail bytes (30 of 620 mainnet gateways had them).
 * These tests pin the SDK to the same rule, and check what each new write
 * method actually puts on the wire.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import {
  type Address,
  type Blockhash,
  type Instruction,
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressDecoder,
  getTransactionSize,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit';

import {
  ArioGarInstruction,
  type Gateway as GarGatewayAccount,
  GatewayStatus,
  Protocol,
  getGatewayDecoder,
  getGatewayEncoder,
  identifyArioGarInstruction,
  parseTransferEpochSettingsAuthorityInstruction,
  parseUpdateGatewayMetadataInstruction,
  parseUpdateOperationsAddressInstruction,
} from '@ar.io/solana-contracts/gar';
import {
  OPERATIONS_ADDRESS_SINCE,
  deserializeGateway,
  isOperationsAddressSet,
} from './deserialize.js';
import { SolanaARIOReadable } from './io-readable.js';
import {
  MIGRATE_GATEWAYS_BATCH_SIZE,
  MIGRATE_GATEWAYS_MAX_BATCH_SIZE,
  SolanaARIOWriteable,
} from './io-writeable.js';
import { getEpochSettingsPDA, getGatewayPDA } from './pda.js';

const ZERO = address('11111111111111111111111111111111');
const OPERATOR = address('GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const STALE_KEY = address('GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
const DELEGATE = address('GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');

/** A distinct, valid address per `n` (0..254). */
function addressFor(n: number): Address {
  return getAddressDecoder().decode(new Uint8Array(32).fill(n + 1));
}

const V1_1_0 = { major: 1, minor: 1, patch: 0 };
const V1_2_0 = { major: 1, minor: 2, patch: 0 };

function encodeGateway(opts: {
  operator: Address;
  version: { major: number; minor: number; patch: number };
  operationsAddress: Address;
}): Uint8Array {
  return getGatewayEncoder().encode({
    operator: opts.operator,
    label: 'lbl',
    fqdn: 'gw.example',
    port: 443,
    protocol: Protocol.Https,
    properties: '',
    note: '',
    operatorStake: 20_000_000_000n,
    totalDelegatedStake: 0n,
    status: GatewayStatus.Joined,
    startTimestamp: 0n,
    leaveTimestamp: null,
    leaveEpochDuration: 0n,
    stats: {
      passedEpochs: 0,
      failedEpochs: 0,
      totalEpochs: 0,
      prescribedEpochs: 0,
      observedEpochs: 0,
      failedConsecutive: 0,
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
      pendingDelegateRewardShareRatio: null,
      delegationDisabledAt: null,
    },
    registryIndex: { index: 0, _reserved: 0 },
    observerAddress: opts.operator,
    cumulativeRewardPerToken: 0n,
    bump: 254,
    version: opts.version,
    // For a pre-1.2.0 version this models stale tail bytes: the decoder reads
    // them into the field even though the program never wrote it.
    operationsAddress: opts.operationsAddress,
  });
}

function gatewayAccount(
  version: { major: number; minor: number; patch: number },
  operationsAddress: Address,
): GarGatewayAccount {
  return getGatewayDecoder().decode(
    encodeGateway({ operator: OPERATOR, version, operationsAddress }),
  );
}

// ---------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------

describe('isOperationsAddressSet', () => {
  it('is true from 1.2.0 on and false below it', () => {
    assert.deepEqual(OPERATIONS_ADDRESS_SINCE, V1_2_0);
    const below = [
      { major: 0, minor: 0, patch: 0 },
      { major: 1, minor: 0, patch: 0 },
      { major: 1, minor: 1, patch: 0 },
      { major: 1, minor: 1, patch: 9 },
    ];
    const atOrAbove = [
      { major: 1, minor: 2, patch: 0 },
      { major: 1, minor: 2, patch: 1 },
      { major: 1, minor: 3, patch: 0 },
      { major: 2, minor: 0, patch: 0 },
    ];
    for (const v of below) assert.equal(isOperationsAddressSet(v), false);
    for (const v of atOrAbove) assert.equal(isOperationsAddressSet(v), true);
  });
});

describe('deserializeGateway operationsAddress', () => {
  it('omits it below 1.2.0 even when the tail bytes decode as a real key', () => {
    const gw = deserializeGateway(
      Buffer.from(
        encodeGateway({
          operator: OPERATOR,
          version: V1_1_0,
          operationsAddress: STALE_KEY,
        }),
      ),
    );
    assert.equal(gw.operator, OPERATOR);
    assert.equal(gw.operationsAddress, undefined);
    assert.equal('operationsAddress' in gw, false);
  });

  it('exposes it from 1.2.0', () => {
    const gw = deserializeGateway(
      Buffer.from(
        encodeGateway({
          operator: OPERATOR,
          version: V1_2_0,
          operationsAddress: DELEGATE,
        }),
      ),
    );
    assert.equal(gw.operationsAddress, DELEGATE);
  });

  it('never exposes the zero address', () => {
    const gw = deserializeGateway(
      Buffer.from(
        encodeGateway({
          operator: OPERATOR,
          version: V1_2_0,
          operationsAddress: ZERO,
        }),
      ),
    );
    assert.equal(gw.operationsAddress, undefined);
  });
});

describe('SolanaARIOReadable.getUnmigratedGatewayAddresses', () => {
  function readableOver(rows: Uint8Array[]): SolanaARIOReadable {
    const send = async () =>
      rows.map((bytes, i) => ({
        pubkey: addressFor(100 + i),
        account: {
          data: [Buffer.from(bytes).toString('base64'), 'base64'] as const,
        },
      }));
    return new SolanaARIOReadable({
      rpc: {
        getProgramAccounts: () => ({ send }),
      } as unknown as ReturnType<typeof createSolanaRpc>,
    });
  }

  it('returns only operators below 1.2.0', async () => {
    const r = readableOver([
      encodeGateway({
        operator: OPERATOR,
        version: V1_1_0,
        operationsAddress: STALE_KEY,
      }),
      encodeGateway({
        operator: DELEGATE,
        version: V1_2_0,
        operationsAddress: DELEGATE,
      }),
    ]);
    assert.deepEqual(await r.getUnmigratedGatewayAddresses(), [OPERATOR]);
  });

  it('reads a raw pre-ADR-0030 account: 964 bytes, stamped 1.1.0, stale tail', async () => {
    // The shape every live gateway has before migration. The 1.4.0 codec
    // reads operationsAddress from the 32 bytes after `version`; a real
    // account always has them, because its content is far shorter than the
    // 964 bytes it is allocated (largest live gateway: 467 bytes).
    const content = encodeGateway({
      operator: OPERATOR,
      version: V1_1_0,
      operationsAddress: ZERO,
    }).slice(0, -32); // the previous layout ends at `version`
    const legacy = new Uint8Array(964);
    legacy.set(content, 0);
    legacy.set([0xfd, 0x01, 0x01, 0x00], content.length); // leftover bytes
    assert.ok(
      964 - content.length >= 32,
      `legacy content is ${content.length} bytes; the codec needs 32 after it`,
    );

    const r = readableOver([legacy]);
    assert.deepEqual(await r.getUnmigratedGatewayAddresses(), [OPERATOR]);
  });

  it('fails loudly on an account it cannot decode', async () => {
    const r = readableOver([new Uint8Array(40)]);
    await assert.rejects(() => r.getUnmigratedGatewayAddresses());
  });
});

// ---------------------------------------------------------------
// Writes
// ---------------------------------------------------------------

class StubWriteable extends SolanaARIOWriteable {
  sent: Instruction[][] = [];
  fetches = 0;
  failOnBatch: number | undefined;

  constructor(
    signer: Awaited<ReturnType<typeof generateKeyPairSigner>>,
    private readonly accounts: Map<string, GarGatewayAccount>,
    private readonly unmigrated: Address[] = [],
  ) {
    super({
      rpc: {} as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as any,
      signer,
    });
  }

  get program(): Address {
    return this.garProgram;
  }

  protected async fetchGatewayAccount(
    gateway: Address,
  ): Promise<GarGatewayAccount | null> {
    this.fetches++;
    return this.accounts.get(gateway) ?? null;
  }

  async getUnmigratedGatewayAddresses(): Promise<Address[]> {
    return this.unmigrated;
  }

  protected async sendTransaction(
    instructions: Instruction[],
  ): Promise<string> {
    if (this.failOnBatch === this.sent.length) {
      throw new Error('simulated rpc failure');
    }
    this.sent.push(instructions);
    return `sig-${this.sent.length}`;
  }
}

async function writeableAs(
  signer: Awaited<ReturnType<typeof generateKeyPairSigner>>,
  operator: Address,
  account: GarGatewayAccount | null,
  unmigrated: Address[] = [],
): Promise<StubWriteable> {
  const map = new Map<string, GarGatewayAccount>();
  const probe = new StubWriteable(signer, map, unmigrated);
  if (account !== null) {
    const [pda] = await getGatewayPDA(operator, probe.program);
    map.set(pda, account);
  }
  return probe;
}

function kinds(ixs: Instruction[]): ArioGarInstruction[] {
  return ixs.map((ix) =>
    identifyArioGarInstruction(
      ix as Parameters<typeof identifyArioGarInstruction>[0],
    ),
  );
}

describe('SolanaARIOWriteable.updateOperationsAddress', () => {
  it('prepends migrate_gateway for a gateway below 1.2.0', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(
      signer,
      signer.address,
      gatewayAccount(V1_1_0, STALE_KEY),
    );
    await w.updateOperationsAddress({ operationsAddress: DELEGATE });

    assert.equal(w.sent.length, 1, 'one transaction');
    const [ixs] = w.sent;
    assert.deepEqual(kinds(ixs), [
      ArioGarInstruction.MigrateGateway,
      ArioGarInstruction.UpdateOperationsAddress,
    ]);

    const [gatewayPda] = await getGatewayPDA(signer.address, w.program);
    for (const ix of ixs) assert.equal(ix.programAddress, w.program);
    // migrate_gateway: operator, gateway, payer, system program
    assert.equal(ixs[0].accounts?.[0].address, signer.address);
    assert.equal(ixs[0].accounts?.[1].address, gatewayPda);
    assert.equal(ixs[0].accounts?.[2].address, signer.address);

    const parsed = parseUpdateOperationsAddressInstruction(ixs[1] as any);
    assert.equal(parsed.accounts.gateway.address, gatewayPda);
    assert.equal(parsed.accounts.operator.address, signer.address);
    assert.equal(parsed.data.newOperationsAddress, DELEGATE);
  });

  it('sends only the rotation for a migrated gateway', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(
      signer,
      signer.address,
      gatewayAccount(V1_2_0, signer.address),
    );
    await w.updateOperationsAddress({ operationsAddress: DELEGATE });
    assert.deepEqual(kinds(w.sent[0]), [
      ArioGarInstruction.UpdateOperationsAddress,
    ]);
  });

  it('allows revoking back to the operator once migrated', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(
      signer,
      signer.address,
      gatewayAccount(V1_2_0, DELEGATE),
    );
    await w.updateOperationsAddress({ operationsAddress: signer.address });
    const parsed = parseUpdateOperationsAddressInstruction(w.sent[0][0] as any);
    assert.equal(parsed.data.newOperationsAddress, signer.address);
  });

  it('refuses a no-op rotation instead of sending a doomed transaction', async () => {
    const signer = await generateKeyPairSigner();
    const migrated = await writeableAs(
      signer,
      signer.address,
      gatewayAccount(V1_2_0, DELEGATE),
    );
    await assert.rejects(
      () => migrated.updateOperationsAddress({ operationsAddress: DELEGATE }),
      /already this gateway's operations address/,
    );

    // Below 1.2.0 the stale tail is NOT the current value: the migration
    // sets the operator, so asking for the operator is the no-op...
    const unmigrated = await writeableAs(
      signer,
      signer.address,
      gatewayAccount(V1_1_0, STALE_KEY),
    );
    await assert.rejects(
      () =>
        unmigrated.updateOperationsAddress({
          operationsAddress: signer.address,
        }),
      /already this gateway's operations address/,
    );
    // ...while asking for the stale key is a real change and is sent.
    await unmigrated.updateOperationsAddress({ operationsAddress: STALE_KEY });
    assert.equal(migrated.sent.length, 0);
    assert.equal(unmigrated.sent.length, 1);
  });

  it('refuses the zero address and a missing gateway', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(
      signer,
      signer.address,
      gatewayAccount(V1_2_0, signer.address),
    );
    await assert.rejects(
      () => w.updateOperationsAddress({ operationsAddress: ZERO }),
      /zero address/,
    );
    const none = await writeableAs(signer, signer.address, null);
    await assert.rejects(
      () => none.updateOperationsAddress({ operationsAddress: DELEGATE }),
      /no gateway found/,
    );
    assert.equal(w.sent.length + none.sent.length, 0);
  });
});

describe('SolanaARIOWriteable.updateGatewayMetadata', () => {
  it('as the operator: no pre-read, only the given fields are Some', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(signer, signer.address, null);
    await w.updateGatewayMetadata({
      fqdn: 'new.example.com',
      port: 8443,
      protocol: 'http',
    });
    assert.equal(w.fetches, 0, 'the operator path needs no account read');

    const [gatewayPda] = await getGatewayPDA(signer.address, w.program);
    const parsed = parseUpdateGatewayMetadataInstruction(w.sent[0][0] as any);
    assert.equal(parsed.programAddress, w.program);
    assert.equal(parsed.accounts.operator.address, signer.address);
    assert.equal(parsed.accounts.gateway.address, gatewayPda);
    assert.equal(parsed.accounts.signer.address, signer.address);
    assert.deepEqual(parsed.data.fqdn, {
      __option: 'Some',
      value: 'new.example.com',
    });
    assert.deepEqual(parsed.data.port, { __option: 'Some', value: 8443 });
    assert.deepEqual(parsed.data.protocol, {
      __option: 'Some',
      value: Protocol.Http,
    });
    assert.deepEqual(parsed.data.label, { __option: 'None' });
    assert.deepEqual(parsed.data.properties, { __option: 'None' });
    assert.deepEqual(parsed.data.note, { __option: 'None' });
  });

  it('as the operations address of a migrated gateway', async () => {
    const delegate = await generateKeyPairSigner();
    const w = await writeableAs(
      delegate,
      OPERATOR,
      gatewayAccount(V1_2_0, delegate.address),
    );
    await w.updateGatewayMetadata({ gatewayAddress: OPERATOR, label: 'x' });
    const [gatewayPda] = await getGatewayPDA(OPERATOR, w.program);
    const parsed = parseUpdateGatewayMetadataInstruction(w.sent[0][0] as any);
    assert.equal(parsed.accounts.operator.address, OPERATOR);
    assert.equal(parsed.accounts.gateway.address, gatewayPda);
    assert.equal(parsed.accounts.signer.address, delegate.address);
  });

  it('refuses a key that only appears in an un-migrated stale tail', async () => {
    // The exact case the program fix (contracts #142) closes: the stale bytes
    // decode as this signer, but the program ignores them below 1.2.0.
    const stale = await generateKeyPairSigner();
    const w = await writeableAs(
      stale,
      OPERATOR,
      gatewayAccount(V1_1_0, stale.address),
    );
    await assert.rejects(
      () => w.updateGatewayMetadata({ gatewayAddress: OPERATOR, label: 'x' }),
      /has not been migrated/,
    );
    assert.equal(w.sent.length, 0);
  });

  it('refuses a signer that is neither operator nor operations address', async () => {
    const stranger = await generateKeyPairSigner();
    const w = await writeableAs(
      stranger,
      OPERATOR,
      gatewayAccount(V1_2_0, DELEGATE),
    );
    await assert.rejects(
      () => w.updateGatewayMetadata({ gatewayAddress: OPERATOR, note: 'x' }),
      /neither the operator nor the operations address/,
    );
    assert.equal(w.sent.length, 0);
  });

  it('refuses an update with no fields', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(signer, signer.address, null);
    await assert.rejects(() => w.updateGatewayMetadata({}), /at least one of/);
  });
});

describe('SolanaARIOWriteable.migrateGateway(s)', () => {
  it('migrates one gateway and refuses one already migrated', async () => {
    const payer = await generateKeyPairSigner();
    const w = await writeableAs(payer, OPERATOR, gatewayAccount(V1_1_0, ZERO));
    await w.migrateGateway({ gatewayAddress: OPERATOR });
    assert.deepEqual(kinds(w.sent[0]), [ArioGarInstruction.MigrateGateway]);
    assert.equal(w.sent[0][0].accounts?.[0].address, OPERATOR);
    assert.equal(w.sent[0][0].accounts?.[2].address, payer.address);

    const done = await writeableAs(
      payer,
      OPERATOR,
      gatewayAccount(V1_2_0, OPERATOR),
    );
    await assert.rejects(
      () => done.migrateGateway({ gatewayAddress: OPERATOR }),
      /already migrated/,
    );
  });

  function operators(n: number): Address[] {
    return Array.from({ length: n }, (_, i) => addressFor(i));
  }

  it('batches every un-migrated gateway by default', async () => {
    const payer = await generateKeyPairSigner();
    const all = operators(19);
    const w = await writeableAs(payer, OPERATOR, null, all);
    const result = await w.migrateGateways();

    assert.equal(MIGRATE_GATEWAYS_BATCH_SIZE, 8);
    assert.deepEqual(
      w.sent.map((ixs) => ixs.length),
      [8, 8, 3],
    );
    assert.deepEqual(result.migrated, all);
    assert.deepEqual(result.signatures, ['sig-1', 'sig-2', 'sig-3']);
    const sentOperators = w.sent.flat().map((ix) => ix.accounts?.[0].address);
    assert.deepEqual(sentOperators, all);
  });

  it('stops at the first failed batch and reports progress', async () => {
    const payer = await generateKeyPairSigner();
    const all = operators(19);
    const w = await writeableAs(payer, OPERATOR, null);
    w.failOnBatch = 1;
    await assert.rejects(
      () => w.migrateGateways({ gatewayAddresses: all }),
      /after 8 of 19 gateways were migrated: simulated rpc failure/,
    );
    assert.equal(w.sent.length, 1);
  });

  it('rejects a batch size too large for one transaction', async () => {
    const payer = await generateKeyPairSigner();
    const w = await writeableAs(payer, OPERATOR, null);
    await assert.rejects(
      () =>
        w.migrateGateways({
          gatewayAddresses: operators(20),
          batchSize: MIGRATE_GATEWAYS_MAX_BATCH_SIZE + 1,
        }),
      /exceeds 12/,
    );
    assert.equal(w.sent.length, 0);
    await w.migrateGateways({
      gatewayAddresses: operators(20),
      batchSize: MIGRATE_GATEWAYS_MAX_BATCH_SIZE,
    });
    assert.deepEqual(
      w.sent.map((ixs) => ixs.length),
      [12, 8],
    );
  });

  it('rejects a non-positive batch size', async () => {
    const payer = await generateKeyPairSigner();
    const w = await writeableAs(payer, OPERATOR, null);
    await assert.rejects(
      () => w.migrateGateways({ gatewayAddresses: [OPERATOR], batchSize: 0 }),
      /positive integer/,
    );
  });

  it('batch sizes match the 1232-byte transaction limit', async () => {
    const payer = await generateKeyPairSigner();
    const sizeOf = async (n: number): Promise<number> => {
      const w = await writeableAs(payer, OPERATOR, null);
      await w.migrateGateways({
        gatewayAddresses: operators(n),
        batchSize: n > 12 ? 12 : n,
      });
      const ixs = w.sent.flat().slice(0, n);
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(payer, m),
        (m) =>
          setTransactionMessageLifetimeUsingBlockhash(
            {
              blockhash: '11111111111111111111111111111111' as Blockhash,
              lastValidBlockHeight: 0n,
            },
            m,
          ),
        (m) =>
          appendTransactionMessageInstructions(
            [
              // Same two compute-budget instructions sendAndConfirm prepends;
              // both are fixed-size, so the values do not affect the length.
              getSetComputeUnitLimitInstruction({ units: 1_400_000 }),
              getSetComputeUnitPriceInstruction({ microLamports: 2_000_000n }),
              ...ixs,
            ],
            m,
          ),
      );
      return getTransactionSize(compileTransaction(message));
    };
    // Every assert.ok here carries an explicit message: without one, node's
    // assert parses the call-site source to build a message, which stalls
    // under the tsx loader and turns a failure into a whole-file timeout.
    const atDefault = await sizeOf(MIGRATE_GATEWAYS_BATCH_SIZE);
    assert.ok(
      atDefault <= 1232,
      `default batch (${MIGRATE_GATEWAYS_BATCH_SIZE}) takes ${atDefault} bytes`,
    );
    const atMax = await sizeOf(MIGRATE_GATEWAYS_MAX_BATCH_SIZE);
    assert.ok(
      atMax <= 1232,
      `max batch (${MIGRATE_GATEWAYS_MAX_BATCH_SIZE}) takes ${atMax} bytes`,
    );
    const overMax = await sizeOf(MIGRATE_GATEWAYS_MAX_BATCH_SIZE + 1);
    assert.ok(
      overMax > 1232,
      `MIGRATE_GATEWAYS_MAX_BATCH_SIZE must be the largest batch that fits; ${MIGRATE_GATEWAYS_MAX_BATCH_SIZE + 1} takes only ${overMax} bytes`,
    );
  });
});

describe('SolanaARIOWriteable.transferEpochSettingsAuthority', () => {
  it('targets EpochSettings with the signer as the current authority', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(signer, OPERATOR, null);
    await w.transferEpochSettingsAuthority({ newAuthority: DELEGATE });
    const [epochSettings] = await getEpochSettingsPDA(w.program);
    const parsed = parseTransferEpochSettingsAuthorityInstruction(
      w.sent[0][0] as any,
    );
    assert.equal(parsed.programAddress, w.program);
    assert.equal(parsed.accounts.epochSettings.address, epochSettings);
    assert.equal(parsed.accounts.authority.address, signer.address);
    assert.equal(parsed.data.newAuthority, DELEGATE);
  });

  it('refuses the zero address', async () => {
    const signer = await generateKeyPairSigner();
    const w = await writeableAs(signer, OPERATOR, null);
    await assert.rejects(
      () => w.transferEpochSettingsAuthority({ newAuthority: ZERO }),
      /zero address/,
    );
    assert.equal(w.sent.length, 0);
  });
});
