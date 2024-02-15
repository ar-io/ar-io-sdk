import { ArIO } from '../src/common/ar-io.js';
import { ArNSRemoteCache } from '../src/common/caches/arns-remote-cache.js';
import { FailedRequestError } from '../src/common/error.js';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIO({
    contractStateProvider: remoteCacheProvider,
  });

  it('should call remote state provider', async () => {
    const remoteProvider = new ArNSRemoteCache({});
    const client = new ArIO({
      contractStateProvider: remoteProvider,
    });

    const stubGetContractState = jest.fn();
    remoteProvider.getContractState = stubGetContractState;
    const contractTxId = ''.padEnd(43, 'a');
    await client.getContractState({ contractTxId });
    expect(stubGetContractState).toHaveBeenCalledWith({ contractTxId });
  });

  it('should throw on bad contract id', async () => {
    const contractTxId = ''.padEnd(42, 'a');
    const result = (await arioClient
      .getContractState({ contractTxId })
      .catch((e) => e)) as any;

    expect(result).toBeInstanceOf(Error);
  });

  it('should throw 404 on non existent contract', async () => {
    const contractTxId = ''.padEnd(43, 'a');
    const result = (await arioClient
      .getContractState({ contractTxId })
      .catch((e: any) => e)) as any;

    expect(result).toBeInstanceOf(FailedRequestError);
    expect(result?.message).toMatch(/404/);
  });
});
