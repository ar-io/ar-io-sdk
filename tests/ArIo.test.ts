import { ArIo } from '../src/common/ArIo.js';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache.js';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIo({
    contractStateProvider: remoteCacheProvider,
  });

  it('should create an ArIo client', () => {
    expect(arioClient).toBeInstanceOf(ArIo);
  });
});
