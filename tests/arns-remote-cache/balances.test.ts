import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { ARNS_DEVNET_REGISTRY_TX } from '../../src/constants.js';
import { SmartWeaveSortKey } from '../../src/utils/index.js';

describe('ArNSRemoteCache ~ BALANCES', () => {
  const remoteCacheProvider = new ArNSRemoteCache({
    contractTxId: ARNS_DEVNET_REGISTRY_TX,
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

  it('should return balance at a given block height', async () => {
    const address = 'ySqMsg7O0R-BcUw35R3nxJJKJyIdauLCQ4DUZqPCiYo';
    const transferBlockHeight = 1364752;
    const currentBalance = await remoteCacheProvider.getBalance({
      address,
      evaluationParameters: {
        evalTo: { blockHeight: transferBlockHeight },
      },
    });
    const transferAmount = 20000;

    const balance = await remoteCacheProvider.getBalance({
      address,
      evaluationParameters: { evalTo: { blockHeight: transferBlockHeight } },
    });
    expect(balance).toEqual(currentBalance);

    const previousBalance = await remoteCacheProvider.getBalance({
      address,
      evaluationParameters: {
        evalTo: { blockHeight: transferBlockHeight - 1 },
      },
    });
    expect(previousBalance).toEqual(currentBalance - transferAmount);
  });

  it('should return balance at a given sort key', async () => {
    const address = 'ySqMsg7O0R-BcUw35R3nxJJKJyIdauLCQ4DUZqPCiYo';
    const balanceSortKey = new SmartWeaveSortKey(
      '000001364752,0000000000000,7fee05ef004191b252b073628013f987033513c51116d283dc24c866b5c32d0a',
    );
    const balance = await remoteCacheProvider.getBalance({
      address,
      evaluationParameters: { evalTo: { sortKey: balanceSortKey.toString() } },
    });
    expect(balance).toEqual(20000);
  });

  it('should return balances at a given block height', async () => {
    const address = 'ySqMsg7O0R-BcUw35R3nxJJKJyIdauLCQ4DUZqPCiYo';
    const transferBlockHeight = 1364752;
    const currentBalance = await remoteCacheProvider.getBalance({
      address,
      evaluationParameters: {
        evalTo: { blockHeight: transferBlockHeight },
      },
    });
    const balances = await remoteCacheProvider.getBalances({
      evaluationParameters: { evalTo: { blockHeight: transferBlockHeight } },
    });

    expect(balances[address]).toEqual(currentBalance);

    const previousBalances = await remoteCacheProvider.getBalances({
      evaluationParameters: {
        evalTo: { blockHeight: transferBlockHeight - 1 },
      },
    });
    expect(previousBalances[address]).toEqual(undefined);
  });
});
