import { ArIO } from '../src/common/ArIO.js';
import { ArNSRemoteCache } from '../src/common/caches/ArNSRemoteCache.js';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIO({
    contractStateProvider: remoteCacheProvider,
  });

  it('should create an ArIO client', () => {
    expect(arioClient).toBeInstanceOf(ArIO);
  });
});
