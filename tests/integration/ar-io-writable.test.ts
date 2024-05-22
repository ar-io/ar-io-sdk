import { ArweaveSigner } from 'arbundles';
import Transaction from 'arweave/node/lib/transaction.js';

import { ArIO, ArIOWritable } from '../../src/common/ar-io.js';
import { WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ArIOState } from '../../src/contract-state.js';
import { IOToken } from '../../src/token.js';
import { arweave, gatewayAddress, localCacheUrl, warp } from '../constants.js';

describe('ArIOWriteable', () => {
  let signer: ArweaveSigner;
  let contractTxId: string;
  let arIO: ArIOWritable;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!;
    signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));
    arIO = ArIO.init({
      signer,
      contract: new WarpContract<ArIOState>({
        cacheUrl: localCacheUrl,
        contractTxId,
        logger: new DefaultLogger({ level: 'none' }),
        warp,
      }),
    });
  });

  it('should successfully join network', async () => {
    const tx = await arIO.joinNetwork({
      fqdn: 'example.com',
      label: 'example',
      protocol: 'https',
      port: 443,
      qty: new IOToken(20000).toMIO(),
      properties: ''.padEnd(43, 'a'),
      note: 'a note',
      observerWallet: ''.padEnd(43, 'b'),
      allowDelegatedStaking: true,
      delegateRewardShareRatio: 10,
      minDelegatedStake: new IOToken(100).toMIO(),
      autoStake: true,
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully increase delegate stake', async () => {
    const tx = await arIO.increaseDelegateStake({
      target: gatewayAddress,
      qty: new IOToken(100).toMIO(),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully decrease delegate stake', async () => {
    const tx = await arIO.decreaseDelegateStake({
      target: gatewayAddress,
      qty: new IOToken(100).toMIO(),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully transfer tokens to another address', async () => {
    const target = ''.padEnd(43, 'f');
    const tx = await arIO.transfer({
      target,
      qty: new IOToken(10).toMIO(),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully extend a domain', async () => {
    const domain = 'test-extend';
    const years = 2;
    const tx = await arIO.extendLease({
      domain,
      years,
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });

  it('should successfully increase the undername support on a domain', async () => {
    const domain = 'test-undername';
    const qty = 1;
    const tx = await arIO.increaseUndernameLimit({
      domain,
      qty,
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
  });
});
