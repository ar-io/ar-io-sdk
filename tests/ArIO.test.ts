import { ArIO } from '../src/common/ar-io.js';
import { ArNSRemoteCache } from '../src/common/caches/arns-remote-cache.js';
import { AxiosHTTPService } from '../src/common/http.js';
import { ARNS_REGISTRY_TX } from '../src/constants.js';
import { ArnsStateResponse } from './fixtures/arns-service-responses.js';

jest
  .spyOn(AxiosHTTPService.prototype, 'get')
  .mockResolvedValue(ArnsStateResponse);

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIO({
    contractStateProvider: remoteCacheProvider,
  });

  it('should create an ArIO client', () => {
    expect(arioClient).toBeInstanceOf(ArIO);
  });

  it('should get a contract state', async () => {
    const state = await arioClient.getContractState<Record<string, any>>({
      contractTxId: ARNS_REGISTRY_TX,
    });
    expect(state).toBeDefined();
    expect(state).toHaveProperty('gateways');
  });
});
