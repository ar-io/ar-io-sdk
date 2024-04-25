import { ArweaveSigner } from 'arbundles/node';

import { ArIO, ArIOWritable } from '../../src/common/ar-io.js';
import { WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ArIOState } from '../../src/contract-state.js';
import { gatewayAddress, localCacheUrl, warp } from '../constants.js';

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
    const { id: interactionTxId } = await arIO.joinNetwork({
      fqdn: 'example.com',
      label: 'example',
      protocol: 'https',
      port: 443,
      qty: 20000,
      properties: ''.padEnd(43, 'a'),
      note: 'a note',
      allowDelegatedStaking: true,
      delegateRewardShareRatio: 10,
      minDelegatedStake: 100,
      autoStake: true,
    });
    expect(interactionTxId).toBeDefined();
  });

  it('should successfully increase delegate stake', async () => {
    const { id: interactionTxId } = await arIO.increaseDelegateStake({
      target: gatewayAddress,
      qty: 101,
    });
    expect(interactionTxId).toBeDefined();
  });

  it('should successfully decrease delegate stake', async () => {
    const { id: interactionTxId } = await arIO.decreaseDelegateStake({
      target: gatewayAddress,
      qty: 101,
    });
    expect(interactionTxId).toBeDefined();
  });

  it('should successfully transfer tokens to another address', async () => {
    const target = ''.padEnd(43, 'f');
    const qty = 101;
    const { id: interactionTxId } = await arIO.transfer({
      target,
      qty,
    });
    expect(interactionTxId).toBeDefined();
  });
});
