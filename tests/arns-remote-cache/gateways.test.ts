import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../../src/common/error.js';
import { ARNS_DEVNET_REGISTRY_TX } from '../../src/constants.js';
import { SmartWeaveSortKey } from '../../src/utils/index.js';

describe('ArNSRemoteCache ~ GATEWAYS', () => {
  const remoteCacheProvider = new ArNSRemoteCache({
    contractTxId: ARNS_DEVNET_REGISTRY_TX,
  });
  const address = '1H7WZIWhzwTH9FIcnuMqYkTsoyv1OTfGa_amvuYwrgo';
  const currentBlockHeight = 1377100;
  const previousBlockHeight = currentBlockHeight + 100;
  const currentSortKey = new SmartWeaveSortKey(
    '000001376946,0000000000000,18d52956c8e13ae1f557b4e67f6f298b8ffd2a5cd96e42ec24ca649b7401510f',
  );

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

  it('should return gateway state at a given block height', async () => {
    const gateway = await remoteCacheProvider.getGateway({
      address,
      evaluationParameters: { evalTo: { blockHeight: currentBlockHeight } },
    });

    const previousGatewayState = await remoteCacheProvider.getGateway({
      address,
      evaluationParameters: { evalTo: { blockHeight: previousBlockHeight } },
    });
    expect(
      previousGatewayState.weights.tenureWeight ===
        gateway.weights.tenureWeight,
    ).toBe(false);
  });

  it('should return gateway state at a given sort key', async () => {
    const gateway = await remoteCacheProvider.getGateway({
      address,
      evaluationParameters: { evalTo: { sortKey: currentSortKey.toString() } },
    });
    expect(gateway).toBeDefined();
  });

  it('should return gateways state at a given block height', async () => {
    const gateways = await remoteCacheProvider.getGateways({
      evaluationParameters: { evalTo: { blockHeight: currentBlockHeight } },
    });
    expect(gateways[address]).toBeDefined();
  });

  it('should return gateways state at a given sort key', async () => {
    const gateways = await remoteCacheProvider.getGateways({
      evaluationParameters: { evalTo: { sortKey: currentSortKey.toString() } },
    });
    expect(gateways[address]).toBeDefined();
  });
});
