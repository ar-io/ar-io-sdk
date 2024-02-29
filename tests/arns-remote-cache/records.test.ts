import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../../src/common/error.js';
import { SmartWeaveSortKey } from '../../src/utils/index.js';

describe('ArNSRemoteCache ~ RECORDS', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  // records tests
  it('should fetch a record', async () => {
    const record = await remoteCacheProvider.getRecord({
      domain: 'ar-io',
    });
    expect(record).toBeDefined();
  });

  it('should throw NotFound error on non existent record', async () => {
    const error = await remoteCacheProvider
      .getRecord({
        domain: 'some-domain',
      })
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFound);
  });

  it('should fetch all records', async () => {
    const records = await remoteCacheProvider.getRecords();

    expect(records).toBeDefined();
  });

  it('should return record at a given block height', async () => {
    const domain = 'raiman';
    const registrationBlockHeight = 1372652;
    const currentRecord = await remoteCacheProvider.getRecord({
      domain,
      blockHeight: registrationBlockHeight,
    });
    expect(currentRecord).toBeDefined();

    const error = await remoteCacheProvider
      .getRecord({ domain, blockHeight: registrationBlockHeight - 1 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFound);
  });

  it('should return record at a given sort key', async () => {
    const domain = 'raiman';
    const registrationSortKey = new SmartWeaveSortKey(
      '000001372652,0000000000000,7c697ffe5ffdad0f554dbd4fe8aa4ac997ea58d34ff9bf54178ab894d47e41e8',
    );
    const record = await remoteCacheProvider.getRecord({
      domain,
      sortKey: registrationSortKey,
    });
    expect(record).toBeDefined();
  });

  it('should return records at a given block height', async () => {
    const domain = 'raiman';
    const registrationBlockHeight = 1372652;
    const currentRecords = await remoteCacheProvider.getRecords({
      blockHeight: registrationBlockHeight,
    });
    expect(currentRecords[domain]).toBeDefined();

    const previousRecords = await remoteCacheProvider.getRecords({
      blockHeight: registrationBlockHeight - 1,
    });
    expect(previousRecords[domain]).not.toBeDefined();
  });

  it('should return records at a given sort key', async () => {
    const domain = 'raiman';
    const registrationSortKey = new SmartWeaveSortKey(
      '000001372652,0000000000000,7c697ffe5ffdad0f554dbd4fe8aa4ac997ea58d34ff9bf54178ab894d47e41e8',
    );
    const records = await remoteCacheProvider.getRecords({
      sortKey: registrationSortKey,
    });
    expect(records[domain]).toBeDefined();
  });
});
