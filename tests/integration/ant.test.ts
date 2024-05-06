import { ANT, ANTReadable } from '../../src/common/ant';
import { RemoteContract } from '../../src/common/contracts/remote-contract';
import { WarpContract } from '../../src/common/contracts/warp-contract';
import { DefaultLogger } from '../../src/common/logger';
import { ANTState } from '../../src/contract-state';
import {
  evaluateToBlockHeight,
  evaluateToSortKey,
  localCacheUrl,
  warp,
} from '../constants';

const testCases = [
  [{ sortKey: evaluateToSortKey.toString() }],
  [{ blockHeight: evaluateToBlockHeight }],
  [undefined],
] as const;

describe('ANT contract apis', () => {
  let ant: ANTReadable;
  let contractTxId: string;
  let ownerAddress: string;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_ANT_CONTRACT_TX_ID!;
    ownerAddress = process.env.PRIMARY_WALLET_ADDRESS!;
    ant = ANT.init({
      contract: new RemoteContract<ANTState>({
        cacheUrl: localCacheUrl,
        contractTxId,
        logger: new DefaultLogger({ level: 'none' }),
      }),
    });
  });

  it('should connect and return a valid instance', async () => {
    expect(ant).toBeInstanceOf(ANTReadable);
  });

  it.each(testCases)(
    `should get contract state with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getState({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get record: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const record = await ant.getRecord({
        domain: '@',
        evaluationOptions: { evalTo },
      });
      expect(record).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get records with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const records = await ant.getRecords({ evaluationOptions: { evalTo } });
      expect(records).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get owner with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const owner = await ant.getOwner({ evaluationOptions: { evalTo } });
      expect(owner).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get controllers with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const controllers = await ant.getControllers({
        evaluationOptions: { evalTo },
      });
      expect(controllers).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get name with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const name = await ant.getName({ evaluationOptions: { evalTo } });
      expect(name).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get ticker with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const ticker = await ant.getTicker({ evaluationOptions: { evalTo } });
      expect(ticker).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get balances with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const balances = await ant.getBalances({ evaluationOptions: { evalTo } });
      expect(balances).toBeDefined();
    },
  );

  it.each(testCases)(
    `should get balance with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const balance = await ant.getBalance({
        address: ownerAddress,
        evaluationOptions: { evalTo },
      });
      expect(balance).toBeDefined();
    },
  );

  it('should get state with warp contract', async () => {
    const ant = ANT.init({
      contract: new WarpContract<ANTState>({
        cacheUrl: localCacheUrl,
        contractTxId,
        logger: new DefaultLogger({ level: 'none' }),
        warp,
      }),
    });
    const state = await ant.getState();
    expect(state).toBeDefined();
  });
});
