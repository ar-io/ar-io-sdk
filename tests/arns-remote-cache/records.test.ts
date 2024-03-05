import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../../src/common/error.js';
import { ARNS_DEVNET_REGISTRY_TX } from '../../src/constants.js';
import { SmartWeaveSortKey } from '../../src/utils/index.js';

describe('ArNSRemoteCache ~ RECORDS', () => {
  const remoteCacheProvider = new ArNSRemoteCache({
    contractTxId: ARNS_DEVNET_REGISTRY_TX,
  });
  // records tests
  it('should fetch a record', async () => {
    const record = await remoteCacheProvider.getArNSRecord({
      domain: 'ar-io',
    });
    expect(record).toBeDefined();
  });

  it('should throw NotFound error on non existent record', async () => {
    const error = await remoteCacheProvider
      .getArNSRecord({
        domain: 'some-domain',
      })
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFound);
  });

  it('should fetch all records', async () => {
    const records = await remoteCacheProvider.getArNSRecords();

    expect(records).toBeDefined();
  });

  it('should return record at a given block height', async () => {
    const domain = 'testing5';
    const registrationBlockHeight = 1363242;
    const currentRecord = await remoteCacheProvider.getArNSRecord({
      domain,
      evaluationParameters: {
        evalTo: { blockHeight: registrationBlockHeight + 1 },
      },
    });
    expect(currentRecord).toBeDefined();

    const error = await remoteCacheProvider
      .getArNSRecord({
        domain,
        evaluationParameters: {
          evalTo: { blockHeight: registrationBlockHeight - 1 },
        },
      })
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFound);
  });

  it('should return record at a given sort key', async () => {
    const domain = 'testing5';
    const registrationSortKey = new SmartWeaveSortKey(
      '000001363242,0000000000000,e7ac482567afa26cf205b158af46bf99f12b1dea0c1dd00caf9a573c8e648430',
    );
    const record = await remoteCacheProvider.getArNSRecord({
      domain,
      evaluationParameters: {
        evalTo: { sortKey: registrationSortKey.toString() },
      },
    });
    expect(record).toBeDefined();
  });

  it('should return records at a given block height', async () => {
    const domain = 'testing5';
    const registrationBlockHeight = 1363242;
    const currentRecords = await remoteCacheProvider.getArNSRecords({
      evaluationParameters: {
        evalTo: { blockHeight: registrationBlockHeight },
      },
    });
    expect(currentRecords[domain]).toBeDefined();

    const previousRecords = await remoteCacheProvider.getArNSRecords({
      evaluationParameters: {
        evalTo: { blockHeight: registrationBlockHeight - 1 },
      },
    });
    expect(previousRecords[domain]).not.toBeDefined();
  });

  it('should return records at a given sort key', async () => {
    const domain = 'testing5';
    const registrationSortKey = new SmartWeaveSortKey(
      '000001363242,0000000000000,e7ac482567afa26cf205b158af46bf99f12b1dea0c1dd00caf9a573c8e648430',
    );
    const records = await remoteCacheProvider.getArNSRecords({
      evaluationParameters: {
        evalTo: { sortKey: registrationSortKey.toString() },
      },
    });
    expect(records[domain]).toBeDefined();
  });
});
