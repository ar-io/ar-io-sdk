import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/kit';

import { SolanaARIOReadable } from './io-readable.js';
import { getGatewayPDA, getGatewayRegistryPDA } from './pda.js';

/**
 * `getGateways` windowing (#716). With no `sortBy` and no `filters`, the
 * reader fetches only the requested page instead of every gateway. These
 * tests pin that the window returns exactly what the full scan returns
 * (items, totalItems, hasMore, nextCursor) over a registry with vacated
 * slots, that sorted/filtered calls still take the full scan, and that the
 * window really does fetch less.
 *
 * The full-scan reference is `getGateways({ ...params, filters: {} })`: an
 * empty filter object matches every item, so it is the unfiltered result
 * computed by the full scan.
 */

const dec = getAddressDecoder();
const enc = getAddressEncoder();

function pk(tag: number): Address {
  const u = new Uint8Array(32);
  u[0] = tag & 0xff;
  u[1] = (tag >> 8) & 0xff;
  u[31] = 0x2a;
  return dec.decode(u);
}

const GAR = pk(7);
const OWNER = pk(200);

// Real GatewayRegistry size: 8 disc + 40 header + 3000 * 56 slots + 8 tail.
const REGISTRY_SIZE = 8 + 32 + 4 + 4 + 56 * 3000 + 3 + 5;
// Pre-ADR-0030 Gateway account size.
const GATEWAY_SIZE = 964;

/** Registry with `null` slots written as the zero address (vacated). */
function buildRegistry(slots: (Address | null)[]): Buffer {
  const buf = Buffer.alloc(REGISTRY_SIZE);
  buf.writeUInt32LE(slots.length, 40);
  slots.forEach((a, i) => {
    if (a) Buffer.from(enc.encode(a)).copy(buf, 48 + i * 56);
  });
  return buf;
}

/**
 * Minimal valid 1.1.0 Gateway account (layout as in deserialize.test.ts),
 * with the operator and operator stake set so rows are distinguishable.
 */
function buildGateway(operator: Address, operatorStake: bigint): Buffer {
  const buf = Buffer.alloc(GATEWAY_SIZE);
  let off = 8;
  Buffer.from(enc.encode(operator)).copy(buf, off);
  off += 32;
  const str = () => {
    buf.writeUInt32LE(1, off);
    buf.writeUInt8(0x61, off + 4);
    off += 5;
  };
  str(); // label
  str(); // fqdn
  buf.writeUInt16LE(443, off);
  off += 2;
  buf.writeUInt8(1, off); // protocol
  off += 1;
  str(); // properties
  str(); // note
  buf.writeBigUInt64LE(operatorStake, off);
  off += 8;
  off += 8; // total_delegated_stake
  off += 1; // status Joined
  off += 8; // start_timestamp
  off += 1; // leave_timestamp None
  off += 8; // leave_epoch_duration
  off += 22; // stats
  off += 56; // weights
  buf.writeUInt8(1, off); // allow_delegated_staking
  off += 1;
  buf.writeUInt16LE(1000, off);
  off += 2;
  off += 8; // min_delegated_stake
  off += 1; // allowlist_enabled
  off += 1; // pending ratio None
  off += 1; // delegation_disabled_at None
  off += 5; // registry_index
  off += 32; // observer
  off += 16; // cumulative_reward_per_token
  buf.writeUInt8(255, off); // bump
  off += 1;
  buf.writeUInt8(1, off); // version 1.1.0
  buf.writeUInt8(1, off + 1);
  return buf;
}

type Counts = {
  getAccountInfo: number;
  getMultipleAccounts: number;
  gatewayAccountsRequested: number;
  bytes: number;
  fullRegistryReads: number;
};

function accountValue(data: Buffer) {
  return {
    data: [data.toString('base64'), 'base64'] as const,
    executable: false,
    lamports: 1_000_000n,
    owner: OWNER,
    rentEpoch: 0n,
    space: BigInt(data.length),
  };
}

/**
 * Registry of `size` slots, with `holes` indices vacated. Returns the stub
 * client, the call/byte counters, and the operators in registry order.
 */
async function fixture(opts: {
  size: number;
  holes: number[];
  /** Operators whose Gateway PDA is absent (closed) on chain. */
  missing?: number[];
}) {
  const slots: (Address | null)[] = [];
  for (let i = 0; i < opts.size; i++) {
    slots.push(opts.holes.includes(i) ? null : pk(1000 + i));
  }
  const registry = buildRegistry(slots);
  const [registryPda] = await getGatewayRegistryPDA(GAR);

  const gatewayByPda = new Map<string, Buffer>();
  await Promise.all(
    slots.map(async (op, i) => {
      if (op === null || opts.missing?.includes(i)) return;
      const [pda] = await getGatewayPDA(op, GAR);
      gatewayByPda.set(pda, buildGateway(op, BigInt(1_000_000 + i)));
    }),
  );

  const counts: Counts = {
    getAccountInfo: 0,
    getMultipleAccounts: 0,
    gatewayAccountsRequested: 0,
    bytes: 0,
    fullRegistryReads: 0,
  };
  const rpc = {
    getAccountInfo: (
      addr: Address,
      cfg?: { dataSlice?: { offset: number; length: number } },
    ) => ({
      send: async () => {
        counts.getAccountInfo++;
        if (addr !== registryPda) return { context: { slot: 1n }, value: null };
        let data = registry;
        if (cfg?.dataSlice) {
          const { offset, length } = cfg.dataSlice;
          data = registry.subarray(offset, offset + length);
        } else {
          counts.fullRegistryReads++;
        }
        counts.bytes += data.length;
        return { context: { slot: 1n }, value: accountValue(data) };
      },
    }),
    getMultipleAccounts: (addrs: Address[]) => ({
      send: async () => {
        counts.getMultipleAccounts++;
        counts.gatewayAccountsRequested += addrs.length;
        return {
          context: { slot: 1n },
          value: addrs.map((a) => {
            const data = gatewayByPda.get(a);
            if (!data) return null;
            counts.bytes += data.length;
            return accountValue(data);
          }),
        };
      },
    }),
  };

  const client = new SolanaARIOReadable({
    rpc: rpc as never,
    coreProgramId: pk(1),
    garProgramId: GAR,
    arnsProgramId: pk(2),
    antProgramId: pk(3),
  });
  const reset = () => {
    for (const k of Object.keys(counts) as (keyof Counts)[]) counts[k] = 0;
  };
  const operators = slots.filter((s): s is Address => s !== null) as string[];
  return { client, counts, reset, operators };
}

describe('getGateways windowed read (#716)', () => {
  it('matches the full scan page by page over a registry with vacated slots', async () => {
    // 230 slots, 7 of them vacated (first, last, interior, adjacent pair),
    // so 223 gateways: three pages at limit 100, and page boundaries that
    // fall on and around vacated slots at other limits.
    const { client, operators } = await fixture({
      size: 230,
      holes: [0, 1, 50, 99, 100, 101, 229],
    });
    assert.equal(operators.length, 223);

    for (const limit of [100, 37, 223, 500]) {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const windowed = await client.getGateways({ limit, cursor });
        const full = await client.getGateways({ limit, cursor, filters: {} });
        assert.deepStrictEqual(
          windowed,
          full,
          `limit=${limit} cursor=${cursor}`,
        );
        assert.equal(windowed.totalItems, 223, 'vacated slots are not counted');
        seen.push(...windowed.items.map((g) => g.gatewayAddress));
        cursor = windowed.nextCursor;
        pages++;
      } while (cursor !== undefined);
      assert.equal(pages, Math.ceil(223 / limit));
      assert.deepEqual(seen, operators, 'every gateway once, registry order');
    }
  });

  it('matches the full scan for edge cursors and parameters', async () => {
    const { client } = await fixture({ size: 12, holes: [3, 4, 11] });
    const cases = [
      {},
      ...Array.from({ length: 10 }, (_, i) => ({
        cursor: String(i),
        limit: 1,
      })),
      { cursor: '9' },
      { cursor: '8', limit: 1 },
      { cursor: '20' },
      { cursor: '-3', limit: 5 },
      { cursor: 'abc' },
      { limit: 0 },
      { sortOrder: 'desc' as const, limit: 4 },
    ];
    for (const params of cases) {
      assert.deepStrictEqual(
        await client.getGateways(params),
        await client.getGateways({ ...params, filters: {} }),
        JSON.stringify(params),
      );
    }
  });

  it('matches the full scan on an empty registry and a missing registry', async () => {
    const { client } = await fixture({ size: 0, holes: [] });
    assert.deepStrictEqual(
      await client.getGateways(),
      await client.getGateways({ filters: {} }),
    );
    const allHoles = await fixture({ size: 4, holes: [0, 1, 2, 3] });
    const res = await allHoles.client.getGateways({ limit: 2 });
    assert.equal(res.totalItems, 0);
    assert.deepStrictEqual(
      res,
      await allHoles.client.getGateways({ limit: 2, filters: {} }),
    );
  });

  it('fetches only the window: header, slot addresses, one page of gateways', async () => {
    const { client, counts, reset } = await fixture({
      size: 620,
      holes: [5, 300, 619],
    });

    reset();
    await client.getGateways({ limit: 10, filters: {} });
    const full = { ...counts };

    reset();
    const page = await client.getGateways({ limit: 10, cursor: '200' });
    const windowed = { ...counts };

    assert.equal(page.items.length, 10);
    assert.equal(windowed.fullRegistryReads, 0, 'registry read by dataSlice');
    assert.equal(windowed.getAccountInfo, 2, 'header + slot addresses');
    assert.equal(windowed.getMultipleAccounts, 1);
    assert.equal(windowed.gatewayAccountsRequested, 10);
    assert.equal(
      windowed.bytes,
      48 + 620 * 56 + 10 * GATEWAY_SIZE,
      'header + slots up to count + the 10 gateways',
    );

    // The full scan reads the whole registry and every gateway.
    assert.equal(full.fullRegistryReads, 1);
    assert.equal(full.gatewayAccountsRequested, 617);
    assert.equal(full.bytes, REGISTRY_SIZE + 617 * GATEWAY_SIZE);
    assert.ok(
      full.bytes / windowed.bytes > 15,
      `expected a large reduction, got ${full.bytes} -> ${windowed.bytes}`,
    );
  });

  it('keeps the chunk-of-100 batching for large windows', async () => {
    const { client, counts, reset } = await fixture({ size: 260, holes: [] });
    reset();
    const res = await client.getGateways({ limit: 250 });
    assert.equal(res.items.length, 250);
    assert.equal(counts.getMultipleAccounts, 3);
    assert.equal(counts.gatewayAccountsRequested, 250);
  });

  it('takes the full scan whenever sortBy or filters are present', async () => {
    const { client, counts, reset } = await fixture({ size: 30, holes: [2] });
    for (const params of [
      {
        limit: 5,
        sortBy: 'operatorStake' as const,
        sortOrder: 'desc' as const,
      },
      { limit: 5, filters: { status: 'joined' } },
      { limit: 5, filters: {} },
    ]) {
      reset();
      const res = await client.getGateways(params as never);
      assert.equal(counts.fullRegistryReads, 1, JSON.stringify(params));
      assert.equal(counts.gatewayAccountsRequested, 29, JSON.stringify(params));
      assert.equal(res.totalItems, 29);
    }
    // And the sort is actually applied on that path.
    const sorted = await client.getGateways({
      limit: 3,
      sortBy: 'operatorStake',
      sortOrder: 'desc',
    });
    assert.deepEqual(
      sorted.items.map((g) => g.operatorStake),
      [1_000_029, 1_000_028, 1_000_027],
    );
  });

  it('falls back to the full scan when a gateway in the window is missing', async () => {
    // A slot whose Gateway PDA is gone (e.g. finalized between the two reads)
    // would make the windowed index disagree with the full scan, which drops
    // it. The window notices and defers to the full scan.
    const { client, counts, reset } = await fixture({
      size: 20,
      holes: [4],
      missing: [6],
    });
    // Slot 6 is the sixth address (slot 4 is vacated), so limit 6 puts it
    // inside the window.
    reset();
    const res = await client.getGateways({ limit: 6 });
    assert.equal(counts.fullRegistryReads, 1, 'fell back to the full scan');
    assert.deepStrictEqual(
      res,
      await client.getGateways({ limit: 6, filters: {} }),
    );
    assert.deepEqual(
      res.items.map((g) => g.gatewayAddress),
      [pk(1000), pk(1001), pk(1002), pk(1003), pk(1005), pk(1007)],
    );
    assert.equal(res.totalItems, 18);
  });
});
