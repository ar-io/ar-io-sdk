import { ArIo } from '../src/common/ArIo.js';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache.js';
import { BadRequest } from '../src/common/error.js';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIo({
    contractStateProvider: remoteCacheProvider,
  });

  it('should call remote state provider', async () => {
    const remoteProvider = new ArNSRemoteCache({});
    const client = new ArIo({
      contractStateProvider: remoteProvider,
    });

    const stubGetContractState = jest.fn();
    remoteProvider.getContractState = stubGetContractState;
    const contractId = ''.padEnd(43, 'a');
    await client.getContractState(contractId);
    expect(stubGetContractState).toHaveBeenCalledWith(contractId);
  });

  it('should call remote state provider and throw on bad contract id', async () => {
    const contractId = ''.padEnd(42, 'a');
    const result = await arioClient
      .getContractState(contractId)
      .catch((e) => e);

    expect(result).toBeInstanceOf(BadRequest);
  });
});
