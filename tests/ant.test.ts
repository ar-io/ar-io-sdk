import { ANT } from '../src/common/ant';
import { RemoteContract } from '../src/common/contracts/remote-contract';
import { ANTState } from '../src/contract-state';

describe('ANT contract apis', () => {
  const ant = new ANT({
    contract: new RemoteContract<ANTState>({
      url: process.env.REMOTE_CACHE_URL || 'http://localhost:3000',
      contractTxId: 'UC2zwawQoTnh0TNd9mYLQS4wObBBeaOU5LPQTNETqA4',
    }),
  });

  const sortKey =
    '000001383961,0000000000000,13987aba2d71b6229989690c15d2838a4deef0a90c3fc9e4d7227ed17e35d0bd';
  const blockHeight = 1383961;

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get contract state with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getState({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get record: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const record = await ant.getRecord({
        domain: '@',
        evaluationOptions: { evalTo },
      });
      expect(record).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get records with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const records = await ant.getRecords({ evaluationOptions: { evalTo } });
      console.dir({ records: records['@'] }, { depth: 4 });
      expect(records).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get owner with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const owner = await ant.getOwner({ evaluationOptions: { evalTo } });
      expect(owner).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get controllers with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const controllers = await ant.getControllers({
        evaluationOptions: { evalTo },
      });
      expect(controllers).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get name with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getName({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get ticker with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getTicker({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get balances with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getBalances({ evaluationOptions: { evalTo } });
      expect(state).toBeDefined();
    },
  );

  it.each([[{ sortKey }], [{ blockHeight }]])(
    `should get balance with evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const state = await ant.getBalance({
        address: 'TRVCopHzzO1VSwRUUS8umkiO2MpAL53XtVGlLaJuI94',
        evaluationOptions: { evalTo },
      });
      expect(state).toBeDefined();
    },
  );
});
