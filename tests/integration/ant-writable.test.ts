import { ArweaveSigner } from 'arbundles';

import { ANT, WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ANTState } from '../../src/contract-state.js';
import { localCacheUrl, warp } from '../constants.js';

const signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));

const contractTxId = process.env.DEPLOYED_ANT_CONTRACT_TX_ID!;

const writeTestCases = Object.entries({
  setController: { controller: ''.padEnd(43, 'a') },
  removeController: { controller: ''.padEnd(43, 'a') },
  setName: { name: 'test' },
  setTicker: { ticker: 'test' },
  setRecord: {
    subDomain: 'test',
    transactionId: ''.padEnd(43, 'a'),
    ttlSeconds: 900,
  },
  removeRecord: { subDomain: 'test' },
  transfer: { target: ''.padEnd(43, 'a') },
});

describe('ANT Writable', () => {
  it.each(writeTestCases)(
    'should execute write operation: %s',
    async (method, inputs) => {
      const antWritable = ANT.init({
        contract: new WarpContract<ANTState>({
          cacheUrl: localCacheUrl,
          contractTxId,
          logger: new DefaultLogger({ level: 'none' }),
          warp: warp,
        }),
        signer,
      });
      const result = await antWritable[method](inputs);

      expect(result).toBeDefined();
    },
  );
});
