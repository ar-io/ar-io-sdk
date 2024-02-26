import { ArNSRemoteCache } from '../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../src/common/error.js';

describe('ArNSRemoteCache', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});

  // gateway tests
  it('should be able to fetch gateways', async () => {
    const gateways = await remoteCacheProvider.getGateways();
    expect(gateways).toBeDefined();
  });

  it('should should throw NotFound error on non existent gateway', async () => {
    const error = await remoteCacheProvider
      .getGateway({
        address: 'some-address',
      })
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFound);
  });

  // balance tests
  it('should fetch a balance', async () => {
    const balance = await remoteCacheProvider.getBalance({
      address: 'some-address',
    });
    expect(balance).toEqual(0);
  });

  it('should fetch all balances', async () => {
    const balances = await remoteCacheProvider.getBalances();
    expect(balances).toBeDefined();
  });

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

  it('should fetch records for list of contractIDs', async () => {
    const allRecords = await remoteCacheProvider
      .getRecords({})
      .then((res) => Object.entries(res).slice(200))
      .catch((e) => e); // deliberately attempting to get more than URL params can handle to test batching but limiting to 200 to not strain service

    const contractTxIds = allRecords.map(([, record]) => record.contractTxId); // deliberately attempting to get more than URL params can handle to test batching but limiting to 200 to not strain service

    const expectedRecords = allRecords
      .map(([domain]) => domain)
      .sort((a: string, b: string) => a.localeCompare(b));
    const records = await remoteCacheProvider.getRecords({
      contractTxIds: [...contractTxIds, ...contractTxIds], // mapping twice to test duplicates
    });

    const actualRecords = Object.keys(records).sort((a: string, b: string) =>
      a.localeCompare(b),
    );

    expect(records).toBeDefined();
    expect(actualRecords).toEqual(expectedRecords);
  });
});
