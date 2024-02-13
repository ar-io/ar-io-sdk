import { ArIo } from '../src/common/ArIo';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIo({
    contractStateProviders: [remoteCacheProvider],
  });

  it('should create an ArIo client', () => {
    expect(arioClient).toBeInstanceOf(ArIo);
  });
});
