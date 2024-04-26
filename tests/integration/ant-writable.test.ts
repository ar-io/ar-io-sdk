import { ArweaveSigner } from 'arbundles';
import Transaction from 'arweave/node/lib/transaction.js';

import { ANT, ANTWritable, WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ANTState } from '../../src/contract-state.js';
import { arweave, localCacheUrl, warp } from '../constants.js';

describe('ANT Writable', () => {
  let signer: ArweaveSigner;
  let contractTxId: string;
  let antWritable: ANTWritable;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_ANT_CONTRACT_TX_ID!;
    signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));
    antWritable = ANT.init({
      contract: new WarpContract<ANTState>({
        cacheUrl: localCacheUrl,
        contractTxId,
        logger: new DefaultLogger({ level: 'none' }),
        warp: warp,
      }),
      signer,
    });
  });

  it('should successfully set controller', async () => {
    const tx = await antWritable.setController({
      controller: ''.padEnd(43, 'a'),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully remove controller', async () => {
    const tx = await antWritable.removeController({
      controller: ''.padEnd(43, 'a'),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully set name', async () => {
    const tx = await antWritable.setName({ name: 'test' });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully set ticker', async () => {
    const tx = await antWritable.setTicker({ ticker: 'test' });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully set record', async () => {
    const tx = await antWritable.setRecord({
      subDomain: 'test',
      transactionId: ''.padEnd(43, 'a'),
      ttlSeconds: 900,
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully remove record', async () => {
    const tx = await antWritable.removeRecord({ subDomain: 'test' });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully transfer tokens to another address', async () => {
    const tx = await antWritable.transfer({
      target: ''.padEnd(43, 'a'),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });
});
