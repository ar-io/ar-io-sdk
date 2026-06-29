import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import bs58 from 'bs58';

import { Logger } from '../common/logger.js';
import type { ANTRecord } from '../types/ant.js';
import type { ArNSNameData } from '../types/io.js';
import { SolanaARIOReadable } from './io-readable.js';
import type { SolanaRpc } from './types.js';

function b58(seed: number): string {
  return bs58.encode(Buffer.alloc(32, seed));
}

const PROCESS_ID = b58(7);
const TARGET_TX = b58(99);

function arnsRecord(): ArNSNameData {
  return {
    processId: PROCESS_ID,
    startTimestamp: 0,
    type: 'permabuy',
    undernameLimit: 10,
    purchasePrice: 0,
  } as ArNSNameData;
}

function antRecord(overrides: Partial<ANTRecord> = {}): ANTRecord {
  return {
    transactionId: TARGET_TX,
    ttlSeconds: 900,
    priority: 2,
    ...overrides,
  } as ANTRecord;
}

/**
 * Stub the two RPC-backed reads (`getArNSRecord` + the ANT record fetch) so the
 * test exercises ONLY the resolver's own logic: undername parsing, the
 * record→resolution mapping, and missing-record handling. The ANT fetch itself
 * is covered by SolanaANTReadable's own tests.
 */
class StubReadable extends SolanaARIOReadable {
  calls: { processId: string; undername: string }[] = [];
  constructor(private readonly record: ANTRecord | undefined) {
    super({
      // Stub rpc — never used; all RPC-backed reads are overridden below.
      rpc: {} as unknown as SolanaRpc,
      logger: new Logger({ level: 'none' }),
    });
  }

  async getArNSRecord(): Promise<ArNSNameData> {
    return arnsRecord();
  }

  protected async resolveAntRecord(
    processId: string,
    undername: string,
  ): Promise<ANTRecord | undefined> {
    this.calls.push({ processId, undername });
    return this.record;
  }
}

describe('SolanaARIOReadable.resolveArNSName', () => {
  it('returns the ANT record target as txId for an apex name', async () => {
    const readable = new StubReadable(antRecord());

    const result = await readable.resolveArNSName({ name: 'ardrive' });

    assert.equal(
      result.txId,
      TARGET_TX,
      'txId should be the ANT record target',
    );
    assert.equal(result.processId, PROCESS_ID);
    assert.equal(result.type, 'permabuy');
    assert.equal(result.undernameLimit, 10);
    // apex undername lookup
    assert.deepEqual(readable.calls, [
      { processId: PROCESS_ID, undername: '@' },
    ]);
  });

  it('passes through the record TTL and priority instead of hardcoding them', async () => {
    const readable = new StubReadable(
      antRecord({ ttlSeconds: 900, priority: 2 }),
    );

    const result = await readable.resolveArNSName({ name: 'ardrive' });

    assert.equal(
      result.ttlSeconds,
      900,
      'ttlSeconds should come from the record',
    );
    assert.equal(result.priority, 2, 'priority should come from the record');
  });

  it('resolves an undername to its own ANT record and returns the full name', async () => {
    const readable = new StubReadable(antRecord());

    const result = await readable.resolveArNSName({ name: 'logo_ardrive' });

    assert.equal(
      result.name,
      'logo_ardrive',
      'returns the full requested name',
    );
    assert.equal(result.txId, TARGET_TX);
    assert.deepEqual(readable.calls, [
      { processId: PROCESS_ID, undername: 'logo' },
    ]);
  });

  it('parses a multi-segment undername (everything before the base name)', async () => {
    const readable = new StubReadable(antRecord());

    await readable.resolveArNSName({ name: 'a_b_ardrive' });

    assert.deepEqual(readable.calls, [
      { processId: PROCESS_ID, undername: 'a_b' },
    ]);
  });

  it('throws when the undername has no record on the ANT', async () => {
    const readable = new StubReadable(undefined);

    await assert.rejects(
      () => readable.resolveArNSName({ name: 'missing_ardrive' }),
      /missing_ardrive/,
    );
  });
});
