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

  it('should fetch all records', async () => {
    const records = await remoteCacheProvider.getRecords();

    expect(records).toBeDefined();
  });
});
