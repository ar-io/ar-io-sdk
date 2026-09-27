/**
 * The accounts the delegate-claim builders put on the wire. Both let the
 * generated client fill in GAR `settings`, which it derives under the
 * placeholder program id — an account that exists on no cluster.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  type Instruction,
  address,
  createSolanaRpc,
  generateKeyPairSigner,
} from '@solana/kit';

import {
  parseClaimDelegateFromDisabledGatewayInstruction,
  parseClaimDelegateFromLeavingGatewayInstruction,
} from '@ar.io/solana-contracts/gar';
import { SolanaARIOWriteable } from './io-writeable.js';
import {
  getDelegationPDA,
  getGarSettingsPDA,
  getGatewayPDA,
  getWithdrawalCounterPDA,
  getWithdrawalPDA,
} from './pda.js';

const LEAVING_GW = address('GatewayAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const DISABLED_GW = address('GatewayBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
const DELEGATOR_2 = address('De1egatorBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');

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

describe('claimDelegateFromLeavingGateway — accounts', () => {
  it("uses the configured program's GAR settings and the signer's PDAs", async () => {
    const signer = await generateKeyPairSigner();
    const probe = new CaptureWriteable({
      rpc: {} as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });
    const program = probe.program;
    const [counterPda] = await getWithdrawalCounterPDA(signer.address, program);
    const w = new CaptureWriteable({
      rpc: counterRpc(counterPda, 4n) as ReturnType<typeof createSolanaRpc>,
      rpcSubscriptions: {} as never,
      signer,
    });
    await w.claimDelegateFromLeavingGateway({ gatewayAddress: LEAVING_GW });
    const ix = w.sent[0].find((i) => i.programAddress === program);
    const a = parseClaimDelegateFromLeavingGatewayInstruction(
      ix as Parameters<
        typeof parseClaimDelegateFromLeavingGatewayInstruction
      >[0],
    ).accounts;
    // The generated builder derives `settings` under the placeholder program
    // id; on a real cluster that account doesn't exist (3012).
    assert.equal(a.settings.address, (await getGarSettingsPDA(program))[0]);
    assert.equal(
      a.withdrawal.address,
      (await getWithdrawalPDA(signer.address, 4n, program))[0],
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
