import { ArweaveSigner } from 'arbundles';

import { ArIO, ArIOWritable } from '../../src/common/ar-io.js';
import { WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ArIOState } from '../../src/contract-state.js';
import { gatewayAddress, localCacheUrl, warp } from '../constants.js';

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
  ['transfer', { target: ''.padEnd(43, 'f'), qty: 101 }],
] as const;

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

  it.each(writeTestCases)(
    'should execute write interaction with parameters: %s',
    async (functionName: string, inputs: Record<string, any>) => {
      const tx = await arIO[functionName]({
        ...inputs,
      });
      expect(tx).toBeDefined();
    },
  );

  // it('should successfully submit saveObservations interaction with parameters', async () => {
  //   // mine blocks so we can submit a observations
  //   await mineBlocks({ arweave, blocks: 20 });
  //   const tx = await arIO.saveObservations({
  //     reportTxId: gatewayAddress,
  //     failedGateways: [gatewayAddress],
  //   });
  //   expect(tx).toBeDefined();
  // });
});
