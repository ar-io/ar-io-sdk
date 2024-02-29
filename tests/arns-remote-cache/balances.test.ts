import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { SmartWeaveSortKey } from '../../src/utils/index.js';

describe('ArNSRemoteCache ~ BALANCES', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});

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

  it('should return balance at a given block height', async () => {
    const address = '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk';
    const currentBalance = 2_363_250;
    const transferAmount = 1000;
    const transferBlockHeight = 1305612;
    const balance = await remoteCacheProvider.getBalance({
      address,
      blockHeight: transferBlockHeight,
    });
    expect(balance).toEqual(currentBalance);

    const previousBalance = await remoteCacheProvider.getBalance({
      address,
      blockHeight: transferBlockHeight - 1,
    });
    expect(previousBalance).toEqual(currentBalance + transferAmount);
  });

  it('should return balance at a given sort key', async () => {
    const address = '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk';
    const balanceSortKey = new SmartWeaveSortKey(
      '000001305612,0000000000000,6806919fa401ad27fd86db576ef578857bd22a11d6905324d643368069146d4e',
    );
    const balance = await remoteCacheProvider.getBalance({
      address,
      sortKey: balanceSortKey,
    });
    expect(balance).toEqual(2363250);
  });

  it('should return balances at a given block height', async () => {
    const address = '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk';
    const currentBalance = 2363250;
    const transferAmount = 1000;
    const transferBlockHeight = 1305612;
    const balances = await remoteCacheProvider.getBalances({
      blockHeight: transferBlockHeight,
    });
    expect(balances[address]).toEqual(currentBalance);

    const previousBalances = await remoteCacheProvider.getBalances({
      blockHeight: transferBlockHeight - 1,
    });
    expect(previousBalances[address]).toEqual(currentBalance + transferAmount);
  });

  it('should return balances at a given sort key', async () => {
    const address = '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk';
    const balanceSortKey = new SmartWeaveSortKey(
      '000001305612,0000000000000,6806919fa401ad27fd86db576ef578857bd22a11d6905324d643368069146d4e',
    );
    const balances = await remoteCacheProvider.getBalances({
      sortKey: balanceSortKey,
    });
    expect(balances[address]).toEqual(2363250);
  });
});
