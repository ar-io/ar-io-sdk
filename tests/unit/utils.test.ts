import Arweave from 'arweave';
import nock from 'nock';
import { strict as assert } from 'node:assert';
import { after, afterEach, before, describe, it } from 'node:test';

import {
  getCurrentBlockUnixTimestamp,
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
  before(() => {
    // disable network connections for all tests - we don't want to hit the network
    nock.disableNetConnect();
  });

  afterEach(() => {
    // clean up nock after each test
    nock.cleanAll();
  });

  after(() => {
    // allow network connections for other tests
    nock.enableNetConnect();
  });

  it('should return the current block timestamp', async () => {
    // stub arweave block request using nock
    const arweave = Arweave.init({});
    const minTimestamp = Date.now();
    const timestamp = await getCurrentBlockUnixTimestamp(arweave);
    assert.ok(timestamp >= minTimestamp);
  });
});
