import { ArweaveSigner } from 'arbundles';
import Transaction, { Tag } from 'arweave/node/lib/transaction.js';

import { ArIO, ArIOWritable } from '../../src/common/ar-io.js';
import { WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import {
  AR_IO_CONTRACT_FUNCTIONS,
  ArIOState,
  ArNSLeaseData,
} from '../../src/contract-state.js';
import { IOToken, mIOToken } from '../../src/token.js';
import { arweave, gatewayAddress, localCacheUrl, warp } from '../constants.js';

describe('ArIOWriteable', () => {
  let signer: ArweaveSigner;
  let interactingAddress = '';
  let contractTxId: string;
  let arIO: ArIOWritable;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!;
    signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));
    interactingAddress = process.env.PRIMARY_WALLET_ADDRESS!;
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
    const gateway = await arIO.getGateway({ address: gatewayAddress });
    expect(gateway?.delegates[interactingAddress]).toEqual({
      start: expect.any(Number),
      delegatedStake: new IOToken(100).toMIO().valueOf(),
      vaults: {},
    });
  });

  it('should successfully decrease delegate stake', async () => {
    const tx = await arIO.decreaseDelegateStake({
      target: gatewayAddress,
      qty: new IOToken(100).toMIO(),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
    const gateway = await arIO.getGateway({ address: gatewayAddress });
    expect(gateway?.delegates[interactingAddress]).toEqual({
      delegatedStake: 0,
      start: expect.any(Number),
      vaults: {
        [tx.id as string]: {
          start: expect.any(Number),
          end: expect.any(Number),
          balance: new IOToken(100).toMIO().valueOf(),
        },
      },
    });
  });

  it('should successfully transfer tokens to another address', async () => {
    const balanceBefore = await arIO.getBalance({
      address: interactingAddress,
    });
    const target = ''.padEnd(43, 'f');
    const tx = await arIO.transfer({
      target,
      qty: new IOToken(10).toMIO(),
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
    const targetBalance = await arIO.getBalance({ address: target });
    expect(targetBalance).toEqual(new IOToken(10).toMIO().valueOf());
    const balanceAfter = await arIO.getBalance({
      address: interactingAddress,
    });
    const expectedAfter = new mIOToken(balanceBefore)
      .minus(new IOToken(10).toMIO())
      .valueOf();
    expect(balanceAfter).toEqual(expectedAfter);
  });

  it('should successfully extend a domain', async () => {
    const domain = 'test-extend';
    const years = 2;
    const recordBefore = (await arIO.getArNSRecord({
      domain: 'test-extend',
    })) as ArNSLeaseData;
    const tx = await arIO.extendLease({
      domain,
      years,
    });
    expect(tx.id).toBeDefined();
    const verified = await arweave.transactions.verify(tx as Transaction);
    expect(verified).toBe(true);
    const record = (await arIO.getArNSRecord({ domain })) as ArNSLeaseData;
    expect(record?.endTimestamp).toBe(
      recordBefore.endTimestamp + years * 31536000,
    );
  });

  it('should successfully increase the undername support on a domain', async () => {
    const domain = 'test-record';
    const qty = 1;
    const res = await arIO.increaseUndernameLimit(
      {
        domain,
        qty,
      },
      {
        tags: [
          {
            name: 'ar-io-sdk-write',
            value: AR_IO_CONTRACT_FUNCTIONS.INCREASE_UNDERNAME_LIMIT,
          },
        ],
      },
    );

    const tx = await arweave.transactions.get(await res.id);
    const tags = tx.tags as Tag[];
    const arIOFunctionTag = tags.find(
      (tag) =>
        tag.get('name', { decode: true, string: true }) === 'ar-io-sdk-write',
    );

    expect(arIOFunctionTag?.get('value', { decode: true, string: true })).toBe(
      AR_IO_CONTRACT_FUNCTIONS.INCREASE_UNDERNAME_LIMIT,
    );

    expect(res.id).toBeDefined();
    const verified = await arweave.transactions.verify(res as Transaction);
    expect(verified).toBe(true);
    const record = await arIO.getArNSRecord({ domain });
    expect(record?.undernames).toBe(11);
  });
});
