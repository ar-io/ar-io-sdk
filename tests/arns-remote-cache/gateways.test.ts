import { ArNSRemoteCache } from '../../src/common/caches/arns-remote-cache.js';
import { NotFound } from '../../src/common/error.js';
import { ARNS_DEVNET_REGISTRY_TX } from '../../src/constants.js';

describe('ArNSRemoteCache ~ GATEWAYS', () => {
  const remoteCacheProvider = new ArNSRemoteCache({
    contractTxId: ARNS_DEVNET_REGISTRY_TX,
  });
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

  // TODO: add blockheight and sortkey tests when simulation with docker is added. current devnet contract doesnt have read api available at last interaction points to test.
  // it('should return gateway state at a given block height', async () => {
  //   const blockHeight = 1348901;
  //   const address = '1H7WZIWhzwTH9FIcnuMqYkTsoyv1OTfGa_amvuYwrgo';
  //   const currentStake = 95048;
  //   const stakeIncrease = 51250;
  //   const gateway = await remoteCacheProvider.getGateway({
  //     address,
  //     evaluationParameters: { evalTo: { blockHeight } },
  //   });
  //   expect(gateway.operatorStake).toEqual(currentStake);

  //   const previousGatewayState = await remoteCacheProvider
  //     .getGateway({
  //       address,
  //       evaluationParameters: { evalTo: { blockHeight: blockHeight - 1 } },
  //     })
  //     .catch((e) => e);
  //   expect(previousGatewayState.operatorStake).toEqual(currentStake - stakeIncrease);
  // });

  // it('should return gateway state at a given sort key', async () => {
  //   const sortKey = new SmartWeaveSortKey(
  //     '000001372179,0000000000000,1babf113056ce4d158c06f17ac8a1d0bff603dd6218dad98381d8e6d295f50a5',
  //   );
  //   const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
  //   const gateway = await remoteCacheProvider.getGateway({
  //     address,
  //     evaluationParameters: { evalTo: { sortKey: sortKey.toString() } },
  //   });
  //   expect(gateway).toBeDefined();
  // });

  // it('should return gateways state at a given block height', async () => {
  //   const blockHeight = 1372179;
  //   const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
  //   const gateways = await remoteCacheProvider.getGateways({
  //     evaluationParameters: { evalTo: { blockHeight } },
  //   });
  //   expect(gateways[address]).toBeDefined();
  // });

  // it('should return gateways state at a given sort key', async () => {
  //   const address = 'usOg4jFzqinXK_ExoU5NijjEyggNA255998LNiM8Vtc';
  //   const sortKey = new SmartWeaveSortKey(
  //     '000001372179,0000000000000,1babf113056ce4d158c06f17ac8a1d0bff603dd6218dad98381d8e6d295f50a5',
  //   );
  //   const gateways = await remoteCacheProvider.getGateways({
  //     evaluationParameters: { evalTo: { sortKey: sortKey.toString() } },
  //   });
  //   expect(gateways[address]).toBeDefined();
  // });
});
