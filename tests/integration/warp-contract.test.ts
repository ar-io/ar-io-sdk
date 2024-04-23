import { ArweaveSigner } from 'arbundles';
import Transaction from 'arweave/node/lib/transaction';

import { WarpContract } from '../../src/common/contracts/warp-contract';
import { WriteInteractionError } from '../../src/common/error';
import { DefaultLogger } from '../../src/common/logger';
import { ANTState } from '../../src/contract-state';
import { localCacheUrl, warp } from '../constants';

describe('warp-contract client', () => {
  let signer: ArweaveSigner;
  let contractTxId: string;
  let contract: WarpContract<ANTState>;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_ANT_CONTRACT_TX_ID!;
    signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));
    contract = new WarpContract<ANTState>({
      cacheUrl: localCacheUrl,
      contractTxId,
      warp,
      logger: new DefaultLogger({ level: 'none' }),
    });
  });

  it('should connect and return a valid instance', async () => {
    expect(contract).toBeDefined();
    expect(contract).toBeInstanceOf(WarpContract);
  });

  it('should return contract configuration', async () => {
    const config = contract.configuration();
    expect(config).toBeDefined();
    expect(config).toHaveProperty('cacheUrl');
    expect(config).toHaveProperty('contractTxId');
  });

  it('should write a transaction', async () => {
    const tx = await contract
      .writeInteraction({
        signer,
        functionName: 'setName',
        inputs: {
          name: 'test',
        },
      })
      .catch((e) => {
        return e;
      });
    expect(tx).toBeDefined();
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('should fail to write a transaction', async () => {
    const contract: WarpContract<ANTState> = new WarpContract<ANTState>({
      cacheUrl: localCacheUrl,
      contractTxId,
      logger: new DefaultLogger({ level: 'none' }),
    });

    const error = await contract
      .writeInteraction({
        signer,
        functionName: 'test-fail',
        inputs: {
          name: 'test',
        },
      })
      .catch((e) => e);

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(WriteInteractionError);
  });
});
