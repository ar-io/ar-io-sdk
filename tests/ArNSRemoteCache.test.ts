import { ArIo } from '../src/common/ArIo';
import { ArNSRemoteCache } from '../src/common/ContractStateProviders/ArNSRemoteCache';

describe('ArIO Client', () => {
  const remoteCacheProvider = new ArNSRemoteCache({});
  const arioClient = new ArIo({
    contractStateProviders: [remoteCacheProvider],
  });

  it('should call remote state provider', async () => {
    const stubGetContractState = jest.fn();
    remoteCacheProvider.getContractState = stubGetContractState;
    const contractId = ''.padEnd(43, 'a');
    await arioClient.getContractState(contractId);
    expect(stubGetContractState).toHaveBeenCalledWith(contractId);
  });

  it('should call remote state provider and throw on bad contract id', async () => {
    const stubGetContractState = jest.fn();
    remoteCacheProvider.getContractState = stubGetContractState;
    const contractId = ''.padEnd(42, 'a');
    await arioClient.getContractState(contractId);
    expect(stubGetContractState).toThrow();
  });
});
