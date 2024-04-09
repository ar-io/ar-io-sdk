import { ANT } from '../../src/common/ant';
import { RemoteContract } from '../../src/common/contracts/remote-contract';
import { DefaultLogger } from '../../src/common/logger';
import { ANTState } from '../../src/contract-state';
import { evaluateToBlockHeight, evaluateToSortKey } from '../constants';

const contractTxId = 'UC2zwawQoTnh0TNd9mYLQS4wObBBeaOU5LPQTNETqA4';
const localCacheUrl = `https://api.arns.app`;
describe('ANT contract apis', () => {
  const ant = new ANT({
    contract: new RemoteContract<ANTState>({
      cacheUrl: localCacheUrl,
      contractTxId,
      logger: new DefaultLogger({ level: 'none' }),
    }),
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get contract state with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getState({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(`should get record: ${JSON.stringify('%s')}`, async (evalTo) => {
    const record = await ant.getRecord({
      domain: '@',
      evaluationOptions: { evalTo },
    });
    expect(record).toBeDefined();
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get records with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const records = await ant.getRecords({ evaluationOptions: { evalTo } });
      expect(records).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get owner with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const owner = await ant.getOwner({ evaluationOptions: { evalTo } });
      expect(owner).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get controllers with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const controllers = await ant.getControllers({
        evaluationOptions: { evalTo },
      });
      expect(controllers).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get name with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getName({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get ticker with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getTicker({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get balances with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getBalances({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [undefined],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should get balance with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getBalance({
        address: 'TRVCopHzzO1VSwRUUS8umkiO2MpAL53XtVGlLaJuI94',
        evaluationOptions: { evalTo },
      });
      expect(state).toBeDefined();
    },
  );

  it('should get state with warp contract', async () => {
    const state = await ant.getState();
    expect(state).toBeDefined();
  });
});
