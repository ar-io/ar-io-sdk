import { RemoteContract, WarpContract } from '../../src/common/index.js';
import { ARNS_DEVNET_REGISTRY_TX } from '../../src/constants.js';
import { ArIOState } from '../../src/contract-state.js';
import {
  isContractConfiguration,
  isContractTxIdConfiguration,
} from '../../src/utils/smartweave.js';

describe('smartweave', () => {
  const contractConfig = {
    contract: new WarpContract<ArIOState>({
      contractTxId: ARNS_DEVNET_REGISTRY_TX,
    }),
  };
  const contractTxIdConfig = {
    contractTxId: ARNS_DEVNET_REGISTRY_TX,
  };
  it('should return true on good contract configuration', async () => {
    expect(isContractConfiguration(contractConfig)).toBe(true);
    expect(
      isContractConfiguration({
        contract: new RemoteContract(contractTxIdConfig),
      }),
    ).toBe(true);
  });

  it('should return false on bad contract configuration', async () => {
    expect(isContractConfiguration(contractTxIdConfig)).toBe(false);
  });

  it('should return true on good contractTxId configuration', async () => {
    expect(isContractTxIdConfiguration(contractTxIdConfig)).toBe(true);
  });

  it('should return false on bad contractTxId configuration', async () => {
    expect(isContractTxIdConfiguration(contractConfig)).toBe(false);
    expect(isContractTxIdConfiguration({})).toBe(false);
    expect(isContractTxIdConfiguration({ contractTxId: 'invalid' })).toBe(
      false,
    );
  });
});
