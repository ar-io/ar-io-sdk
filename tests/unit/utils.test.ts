import Arweave from 'arweave';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

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
