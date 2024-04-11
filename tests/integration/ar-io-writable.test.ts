import { ArweaveSigner } from 'arbundles';

import { ArIO } from '../../src/common/ar-io.js';
import { WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ArIOState } from '../../src/contract-state.js';
import { localCacheUrl, warp } from '../constants.js';

const gatewayAddress = process.env.PRIMARY_WALLET_ADDRESS!;

const contractTxId = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!;
const writeTestCases = [
  [
    'joinNetwork',
    {
      fqdn: 'example.com',
      label: 'example',
      protocol: 'https',
      port: 443,
      qty: 20000,
      properties: ''.padEnd(43, 'a'),
      note: 'a note',
      allowDelegatedStaking: true,
      minDelegatedStake: 100,
    },
  ],
  ['updateGatewaySettings', { fqdn: 'example.com' }],
  ['increaseDelegateStake', { target: gatewayAddress, qty: 101 }],
  ['decreaseDelegateStake', { target: gatewayAddress, qty: 101 }],
  ['increaseOperatorStake', { qty: 101 }],
  ['decreaseOperatorStake', { qty: 101 }],
] as const;

describe('ArIO Client', () => {
  const signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));
  const arIO = ArIO.init({
    signer,
    contract: new WarpContract<ArIOState>({
      cacheUrl: localCacheUrl,
      contractTxId,
      logger: new DefaultLogger({ level: 'none' }),
      warp: warp,
    }),
  });

  it.each(writeTestCases)(
    'Should execute writes with parameters: %s',
    async (
      functionName: string,
      inputs: Record<string, string | number | boolean>,
    ) => {
      const tx = await arIO[functionName]({
        ...inputs,
      });
      expect(tx).toBeDefined();
    },
  );
});
