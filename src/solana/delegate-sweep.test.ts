/**
 * The delegate sweep: discovery (`getClaimableDelegations`) and the claim a
 * cranker sends on a delegate's behalf (`claimDelegateFromLeavingGateway` with
 * `delegatorAddress`). The crank-step wiring is covered in
 * crank-epoch-step.test.ts.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  type Instruction,
  address,
  createSolanaRpc,
  generateKeyPairSigner,
  getAddressDecoder,
} from '@solana/kit';

import {
  DELEGATION_DISCRIMINATOR,
  GATEWAY_DISCRIMINATOR,
  GatewayStatus,
  Protocol,
  getDelegationEncoder,
  getGatewayEncoder,
  parseClaimDelegateFromDisabledGatewayInstruction,
  parseClaimDelegateFromLeavingGatewayInstruction,
} from '@ar.io/solana-contracts/gar';
import { SolanaARIOReadable } from './io-readable.js';
import { SolanaARIOWriteable } from './io-writeable.js';
import {
  getDelegationPDA,
  getGarSettingsPDA,
  getGatewayPDA,
  getWithdrawalCounterPDA,
  getWithdrawalPDA,
} from './pda.js';

const VERSION = { major: 1, minor: 2, patch: 0 };
const LEAVING_GW = address('GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const DISABLED_GW = address('GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
const OPEN_GW = address('GatewayCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');
const DELEGATOR_1 = address('De1egatorAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const DELEGATOR_2 = address('De1egatorBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');

function gatewayBytes(
  operator: Address,
  status: GatewayStatus,
  allowDelegatedStaking: boolean,
): Uint8Array {
  return getGatewayEncoder().encode({
    operator,
    label: 'lbl',
    fqdn: 'gw.example',
    port: 443,
    protocol: Protocol.Https,
    properties: '',
    note: '',
    operatorStake: 1_000n,
    totalDelegatedStake: 100n,
    status,
    startTimestamp: 0n,
    leaveTimestamp: status === GatewayStatus.Leaving ? 1n : null,
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
      allowDelegatedStaking,
      delegateRewardShareRatio: 0,
      minDelegationAmount: 0n,
      allowlistEnabled: false,
      pendingDelegateRewardShareRatio: null,
      delegationDisabledAt: null,
    },
    registryIndex: { index: 0, _reserved: 0 },
    observerAddress: operator,
    cumulativeRewardPerToken: 0n,
    bump: 250,
    version: VERSION,
    operationsAddress: operator,
  });
}

function delegationBytes(
  gateway: Address,
  delegator: Address,
  amount: bigint,
): Uint8Array {
  return getDelegationEncoder().encode({
    gateway,
    delegator,
    amount,
    startTimestamp: 1n,
    rewardDebt: 0n,
    bump: 254,
    version: { major: 0, minor: 0, patch: 0 },
  });
}

/** Answers getProgramAccounts by the discriminator filter, like the real RPC. */
function stubRpc(byDiscriminator: Map<string, Uint8Array[]>): unknown {
  return {
    getProgramAccounts: (
      _program: Address,
      opts: { filters: Array<{ memcmp: { bytes: string } }> },
    ) => ({
      send: async () => {
        const disc = opts.filters[0].memcmp.bytes;
        const rows = byDiscriminator.get(disc) ?? [];
        return rows.map((bytes, i) => ({
          pubkey: getAddressDecoder().decode(new Uint8Array(32).fill(i + 1)),
          account: { data: [Buffer.from(bytes).toString('base64'), 'base64'] },
        }));
      },
    }),
  };
}
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

describe('SolanaARIOReadable.getClaimableDelegations', () => {
  it('returns non-zero delegations on Leaving and delegation-disabled Joined gateways only', async () => {
    const rpc = stubRpc(
      new Map([
        [
          b64(GATEWAY_DISCRIMINATOR as Uint8Array),
          [
            gatewayBytes(LEAVING_GW, GatewayStatus.Leaving, true),
            gatewayBytes(DISABLED_GW, GatewayStatus.Joined, false),
            gatewayBytes(OPEN_GW, GatewayStatus.Joined, true),
          ],
        ],
        [
          b64(DELEGATION_DISCRIMINATOR as Uint8Array),
          [
            delegationBytes(LEAVING_GW, DELEGATOR_1, 500n),
            delegationBytes(LEAVING_GW, DELEGATOR_2, 0n), // rejected on-chain
            delegationBytes(DISABLED_GW, DELEGATOR_1, 700n),
            delegationBytes(OPEN_GW, DELEGATOR_2, 900n), // still delegating
          ],
        ],
      ]),
    );
    const r = new SolanaARIOReadable({
      rpc: rpc as ReturnType<typeof createSolanaRpc>,
    });
    const out = await r.getClaimableDelegations();
    assert.deepEqual(
      out.map((d) => [d.gateway, d.delegator, d.amount, d.reason]),
      [
        [LEAVING_GW, DELEGATOR_1, 500n, 'leaving'],
        [DISABLED_GW, DELEGATOR_1, 700n, 'disabled'],
      ],
    );
  });

  it('a Leaving gateway with delegation disabled is still claimed as leaving', async () => {
    const rpc = stubRpc(
      new Map([
        [
          b64(GATEWAY_DISCRIMINATOR as Uint8Array),
          [gatewayBytes(LEAVING_GW, GatewayStatus.Leaving, false)],
        ],
        [
          b64(DELEGATION_DISCRIMINATOR as Uint8Array),
          [delegationBytes(LEAVING_GW, DELEGATOR_1, 5n)],
        ],
      ]),
    );
    const r = new SolanaARIOReadable({
      rpc: rpc as ReturnType<typeof createSolanaRpc>,
    });
    const out = await r.getClaimableDelegations();
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, 'leaving');
  });
});

class CaptureWriteable extends SolanaARIOWriteable {
  sent: Instruction[][] = [];
  protected async sendTransaction(
    instructions: Instruction[],
  ): Promise<string> {
    this.sent.push(instructions);
    return 'sig';
  }
  get program(): Address {
    return this.garProgram;
  }
}

/** getAccountInfo stub: the withdrawal counter for `owner` holds `nextId`. */
function counterRpc(counterPda: Address, nextId: bigint): unknown {
  const data = Buffer.alloc(8 + 32 + 8 + 1 + 3);
  data.writeBigUInt64LE(nextId, 40);
  return {
    getAccountInfo: (addr: Address) => ({
      send: async () => ({
        value:
          addr === counterPda
            ? {
                data: [data.toString('base64'), 'base64'],
                executable: false,
                lamports: 1n,
                owner: address('11111111111111111111111111111111'),
                space: BigInt(data.length),
              }
            : null,
      }),
    }),
  };
}

describe('claimDelegateFromLeavingGateway — cranking on a delegate’s behalf', () => {
  it("routes the claim to the DELEGATOR's delegation and next withdrawal; the signer only pays", async () => {
    const signer = await generateKeyPairSigner();
    const probe = new CaptureWriteable({
      rpc: {} as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });
    const program = probe.program;
    const [counterPda] = await getWithdrawalCounterPDA(DELEGATOR_1, program);
    const w = new CaptureWriteable({
      rpc: counterRpc(counterPda, 7n) as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });

    await w.claimDelegateFromLeavingGateway({
      gatewayAddress: LEAVING_GW,
      delegatorAddress: DELEGATOR_1,
    });

    const ix = w.sent[0].find((i) => i.programAddress === program);
    assert.ok(ix);
    const parsed = parseClaimDelegateFromLeavingGatewayInstruction(
      ix as Parameters<
        typeof parseClaimDelegateFromLeavingGatewayInstruction
      >[0],
    );
    const a = parsed.accounts;
    assert.equal(
      a.gateway.address,
      (await getGatewayPDA(LEAVING_GW, program))[0],
    );
    assert.equal(
      a.delegation.address,
      (await getDelegationPDA(LEAVING_GW, DELEGATOR_1, program))[0],
    );
    assert.equal(a.withdrawalCounter.address, counterPda);
    assert.equal(
      a.withdrawal.address,
      (await getWithdrawalPDA(DELEGATOR_1, 7n, program))[0],
    );
    assert.equal(a.delegator.address, DELEGATOR_1);
    assert.equal(a.payer.address, signer.address);
    // The generated builder derives `settings` under the placeholder program
    // id; on a real cluster that account doesn't exist (3012).
    assert.equal(a.settings.address, (await getGarSettingsPDA(program))[0]);
  });

  it('defaults to a self-claim by the signer', async () => {
    const signer = await generateKeyPairSigner();
    const w = new CaptureWriteable({
      rpc: counterRpc(
        address('11111111111111111111111111111111'),
        0n,
      ) as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });
    await w.claimDelegateFromLeavingGateway({ gatewayAddress: LEAVING_GW });
    const ix = w.sent[0].find((i) => i.programAddress === w.program);
    const a = parseClaimDelegateFromLeavingGatewayInstruction(
      ix as Parameters<
        typeof parseClaimDelegateFromLeavingGatewayInstruction
      >[0],
    ).accounts;
    assert.equal(a.delegator.address, signer.address);
    assert.equal(
      a.delegation.address,
      (await getDelegationPDA(LEAVING_GW, signer.address, w.program))[0],
    );
    assert.equal(
      a.withdrawal.address,
      (await getWithdrawalPDA(signer.address, 0n, w.program))[0],
    );
  });
});

describe('claimDelegateFromDisabledGateway — accounts', () => {
  it("uses the configured program's GAR settings and the delegator's PDAs", async () => {
    const signer = await generateKeyPairSigner();
    const probe = new CaptureWriteable({
      rpc: {} as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });
    const program = probe.program;
    const [counterPda] = await getWithdrawalCounterPDA(DELEGATOR_2, program);
    const w = new CaptureWriteable({
      rpc: counterRpc(counterPda, 3n) as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });
    await w.claimDelegateFromDisabledGateway({
      gatewayAddress: DISABLED_GW,
      delegatorAddress: DELEGATOR_2,
    });
    const ix = w.sent[0].find((i) => i.programAddress === program);
    const a = parseClaimDelegateFromDisabledGatewayInstruction(
      ix as Parameters<
        typeof parseClaimDelegateFromDisabledGatewayInstruction
      >[0],
    ).accounts;
    assert.equal(a.settings.address, (await getGarSettingsPDA(program))[0]);
    assert.equal(
      a.delegation.address,
      (await getDelegationPDA(DISABLED_GW, DELEGATOR_2, program))[0],
    );
    assert.equal(
      a.withdrawal.address,
      (await getWithdrawalPDA(DELEGATOR_2, 3n, program))[0],
    );
    assert.equal(a.delegator.address, DELEGATOR_2);
    assert.equal(a.payer.address, signer.address);
  });
});
