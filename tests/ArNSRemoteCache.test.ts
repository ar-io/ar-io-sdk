import { ArIO } from '../src/common/ArIO.js';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache.js';
import { BadRequest } from '../src/common/error.js';

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
    expect(stubGetContractState).toHaveBeenCalledWith(contractTxId);
  });

  it('should call remote state provider and throw on bad contract id', async () => {
    const contractTxId = ''.padEnd(42, 'a');
    const result = await arioClient
      .getContractState({ contractTxId })
      .catch((e) => e);

    expect(result).toBeInstanceOf(BadRequest);
  });
});
