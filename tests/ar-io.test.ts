import { ArIO } from '../src/common/ar-io.js';
import { ArNSRemoteCache } from '../src/common/caches/arns-remote-cache.js';
import { ARNS_REGISTRY_TX } from '../src/constants.js';

describe('ArIO Client', () => {
  const arIO = new ArIO({});

  it('should create a custom ArIO client', () => {
    const remoteCacheProvider = new ArNSRemoteCache({});
    const customArioClient = new ArIO({
      contractStateProvider: remoteCacheProvider,
    });
    expect(customArioClient).toBeInstanceOf(ArIO);
  });

  it('should get a contract state', async () => {
    const state = await arIO.getContractState<Record<string, any>>({
      contractTxId: ARNS_REGISTRY_TX,
    });
    expect(state).toBeDefined();
    expect(state).toHaveProperty('gateways');
  });
});
