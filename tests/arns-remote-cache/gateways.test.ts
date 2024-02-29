import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../../src/common/error.js';
import { SmartWeaveSortKey } from '../../src/utils/index.js';

describe('ArNSRemoteCache ~ GATEWAYS', () => {
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

  it('should return gateway state at a given block height', async () => {
    const blockHeight = 1372179;
    const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
    const gateway = await remoteCacheProvider.getGateway({
      address,
      blockHeight,
    });
    expect(gateway).toBeDefined();

    const previousGatewayState = await remoteCacheProvider
      .getGateway({
        address,
        blockHeight: blockHeight - 1,
      })
      .catch((e) => e);
    expect(previousGatewayState).toBeInstanceOf(NotFound);
  });

  it('should return gateway state at a given sort key', async () => {
    const sortKey = new SmartWeaveSortKey(
      '000001372179,0000000000000,1babf113056ce4d158c06f17ac8a1d0bff603dd6218dad98381d8e6d295f50a5',
    );
    const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
    const gateway = await remoteCacheProvider.getGateway({
      address,
      sortKey,
    });
    expect(gateway).toBeDefined();
  });

  it('should return gateways state at a given block height', async () => {
    const blockHeight = 1372179;
    const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
    const gateways = await remoteCacheProvider.getGateways({
      blockHeight,
    });
    expect(gateways[address]).toBeDefined();
  });

  it('should return gateways state at a given sort key', async () => {
    const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
    const sortKey = new SmartWeaveSortKey(
      '000001372179,0000000000000,1babf113056ce4d158c06f17ac8a1d0bff603dd6218dad98381d8e6d295f50a5',
    );
    const gateways = await remoteCacheProvider.getGateways({
      sortKey,
    });
    expect(gateways[address]).toBeDefined();
  });
});
