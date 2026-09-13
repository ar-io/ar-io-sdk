import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/kit';

import { SolanaARIOWriteable } from './io-writeable.js';
import { getGatewayPDA } from './pda.js';

const dec = getAddressDecoder();
const enc = getAddressEncoder();

function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}

const GAR = pk(7);

/**
 * Synthetic GatewayRegistry account.
 *
 * Layout: 8 disc + 32 authority + 4 count + 4 pad, then GatewaySlot[] at 48
 * with a 56-byte stride (address 32 + composite 8 + start 8 + status 1 +
 * delegated_at_tally 1 + padding 6).
 *
 * `slots` may contain nulls, which are written as the zero address — the
 * on-chain representation of a slot vacated by `finalize_gone`. `count` may be
 * set BELOW slots.length to model the live count having fallen behind an
 * epoch's frozen `active_gateway_count`.
 */
function buildRegistry(slots: (Address | null)[], count?: number): Buffer {
  const HEAD = 48;
  const STRIDE = 56;
  const buf = Buffer.alloc(HEAD + STRIDE * (slots.length + 4));
  buf.writeUInt32LE(count ?? slots.length, 40);
  slots.forEach((a, i) => {
    if (a) Buffer.from(enc.encode(a)).copy(buf, HEAD + i * STRIDE);
  });
  return buf;
}

function client(registry: Buffer | null): any {
  const value = registry
    ? {
        data: [registry.toString('base64'), 'base64'],
        executable: false,
        lamports: 1n,
        owner: pk(200),
        rentEpoch: 0n,
        space: BigInt(registry.length),
      }
    : null;
  const rpc = {
    getAccountInfo: () => ({
      send: async () => ({ context: { slot: 1n }, value }),
    }),
  };
  return new SolanaARIOWriteable({
    rpc,
    rpcSubscriptions: {},
    signer: { address: pk(99) },
    coreProgramId: pk(1),
    garProgramId: GAR,
    arnsProgramId: pk(2),
    antProgramId: pk(3),
  } as never);
}

describe('getRegistryGatewayPDAs — zeroed-slot coverage (D4)', () => {
  // Both tally_weights and distribute_epoch iterate `remaining_accounts` and,
  // for a slot whose address is the default pubkey, do `idx += 1; continue` —
  // which CONSUMES one remaining account. Omitting those accounts starves the
  // loop: the body never runs, the cursor is written back unchanged, and the
  // transaction SUCCEEDS. Mainnet epoch 542 and staging 817 both stalled this
  // way, looking healthy in transaction history.

  it('covers the zeroed tail when registry.count < slotCap', async () => {
    // The mainnet-542 shape: count fell to 3 while the epoch's frozen
    // active_gateway_count is still 6.
    const c = client(buildRegistry([pk(10), pk(11), pk(12)], 3));
    const out = await c.getRegistryGatewayPDAs(0, 30, 6);
    assert.equal(out.length, 6, 'must cover cursor..activeGatewayCount');
    const [g10, g11, g12] = await Promise.all([
      getGatewayPDA(pk(10), GAR),
      getGatewayPDA(pk(11), GAR),
      getGatewayPDA(pk(12), GAR),
    ]);
    assert.deepEqual(out.slice(0, 3), [g10[0], g11[0], g12[0]]);
    assert.deepEqual(out.slice(3), [GAR, GAR, GAR], 'tail must be fillers');
  });

  it('emits a filler for an INTERIOR zeroed slot, not just the tail', async () => {
    // The subtler half: a hole anywhere in the range starves the loop just as
    // effectively as a missing tail.
    const c = client(buildRegistry([pk(10), null, pk(12)], 3));
    const out = await c.getRegistryGatewayPDAs(0, 30, 3);
    assert.equal(out.length, 3);
    const [g10] = await getGatewayPDA(pk(10), GAR);
    const [g12] = await getGatewayPDA(pk(12), GAR);
    assert.deepEqual(out, [g10, GAR, g12]);
  });

  it('honours startIndex and batchSize', async () => {
    const c = client(buildRegistry([pk(10), pk(11), pk(12), pk(13)], 4));
    const out = await c.getRegistryGatewayPDAs(1, 2, 4);
    const [g11] = await getGatewayPDA(pk(11), GAR);
    const [g12] = await getGatewayPDA(pk(12), GAR);
    assert.deepEqual(out, [g11, g12]);
  });

  it('falls back to registry.count when slotCap is omitted', async () => {
    // Back-compat for callers that do not pass a cap. This is the OLD
    // behaviour, and is only correct while count and activeGatewayCount agree.
    const c = client(buildRegistry([pk(10), pk(11), pk(12)], 3));
    const out = await c.getRegistryGatewayPDAs(0, 30);
    assert.equal(out.length, 3);
  });

  it('returns nothing when the cursor is already at the cap', async () => {
    const c = client(buildRegistry([pk(10), pk(11)], 2));
    assert.deepEqual(await c.getRegistryGatewayPDAs(2, 30, 2), []);
  });

  it('returns [] when the registry account does not exist', async () => {
    const c = client(null);
    assert.deepEqual(await c.getRegistryGatewayPDAs(0, 30, 5), []);
  });
});
