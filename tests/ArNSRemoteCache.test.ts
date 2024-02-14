import { ArIO } from '../src/common/ArIO.js';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache.js';
import { ArweaveTransactionID } from '../src/types.js';

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
    const contractTxId = new ArweaveTransactionID(''.padEnd(43, 'a'));
    await client.getContractState({ contractTxId });
    expect(stubGetContractState).toHaveBeenCalledWith({ contractTxId });
  });

  it('should throw on bad contract id', async () => {
    let result;
    try {
      const contractTxId = new ArweaveTransactionID(''.padEnd(42, 'a'));
      result = await arioClient
        .getContractState({ contractTxId })
        .catch((e) => e);
    } catch (error) {
      result = error;
    }

    expect(result).toBeInstanceOf(Error);
  });
});
