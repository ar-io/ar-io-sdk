import Arweave from 'arweave';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AoANTRecord, AoANTRecordEntry } from '../../src/types/ant.js';
import { parseAntRecords } from '../../src/utils/ao.js';
import {
  getCurrentBlockUnixTimestampMs,
  pruneTags,
} from '../../src/utils/arweave.js';

describe('pruneTags', () => {
  it('should remove tags with undefined values', () => {
    const tags = [
      { name: 'Tag1', value: 'value1' },
      { name: 'Tag2', value: undefined },
      { name: 'Tag3', value: 'value3' },
      { name: 'Tag4', value: undefined },
    ];

    const prunedTags = pruneTags(tags);

    assert.deepEqual(prunedTags, [
      { name: 'Tag1', value: 'value1' },
      { name: 'Tag3', value: 'value3' },
    ]);
  });

  it('should return empty array when all tags have undefined values', () => {
    const tags = [
      { name: 'Tag1', value: undefined },
      { name: 'Tag2', value: undefined },
    ];

    const prunedTags = pruneTags(tags);

    assert.deepEqual(prunedTags, []);
  });

  it('should return same array when no tags have undefined values', () => {
    const tags = [
      { name: 'Tag1', value: 'value1' },
      { name: 'Tag2', value: 'value2' },
    ];

    const prunedTags = pruneTags(tags);

    assert.deepEqual(prunedTags, tags);
  });

  it('should return empty array with no tags', () => {
    const tags: { name: string; value: string | undefined }[] = [];
    const prunedTags = pruneTags(tags);
    assert.deepEqual(prunedTags, []);
  });
});

describe('getCurrentBlockUnixTimestamp', () => {
  it('should return the current block timestamp', async () => {
    const arweave = Arweave.init({});
    // cheap way to check the returned timestamp is within the boundaries of the async call
    const minTimestamp = Date.now();
    const timestamp = await getCurrentBlockUnixTimestampMs(arweave);
    const maxTimestamp = Date.now();
    assert.ok(timestamp >= minTimestamp);
    assert.ok(timestamp <= maxTimestamp);
  });
});

describe('ANT', () => {
  it('should parse and sort records from an ANT', () => {
    const recordMap: Record<string, AoANTRecord> = {
      zed: {
        transactionId: ''.padEnd(43, '1'),
        ttlSeconds: 3600,
      },
      ['@']: { transactionId: ''.padEnd(43, '1'), ttlSeconds: 3600 },
    };

    const recordList: AoANTRecordEntry[] = [
      {
        transactionId: ''.padEnd(43, '1'),
        ttlSeconds: 3600,
        name: '@',
      },
      {
        transactionId: ''.padEnd(43, '1'),
        ttlSeconds: 3600,
        name: 'zed',
      },
    ];

    assert.deepEqual(parseAntRecords(recordMap), recordList);
    assert.strictEqual(parseAntRecords(recordMap)[0].name, '@');
    assert.deepEqual(parseAntRecords(recordList), recordList);
  });
});
