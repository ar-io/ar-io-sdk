import { ArIO } from '../src/common/ArIO.js';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache.js';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIO({
    contractStateProvider: remoteCacheProvider,
  });

  it('should create an ArIo client', () => {
    expect(arioClient).toBeInstanceOf(ArIO);
  });
});
