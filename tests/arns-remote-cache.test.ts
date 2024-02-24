import { ArNSRemoteCache } from '../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../src/common/error.js';

describe('ArNSRemoteCache', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});

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
});
