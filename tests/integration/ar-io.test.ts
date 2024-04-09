// import { ArweaveSigner } from 'arbundles';
import { ArIO, ArIOReadable } from '../../src/common/ar-io.js';
import { RemoteContract } from '../../src/common/contracts/remote-contract.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ArIOState } from '../../src/contract-state.js';
import {
  evaluateToBlockHeight,
  evaluateToSortKey,
  gatewayAddress,
  localCacheUrl,
  testDomain,
} from '../constants.js';

describe('ArIOReadable Client', () => {
  let arIO;
  let contractTxId;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID;
    arIO = ArIO.init({
      contract: new RemoteContract<ArIOState>({
        cacheUrl: localCacheUrl,
        contractTxId,
        logger: new DefaultLogger({ level: 'none' }),
      }),
    });
  });

  it('should create a custom ArIO client', () => {
    expect(arIO).toBeInstanceOf(ArIOReadable);
  });

  it('should should return undefined for non existent gateway', async () => {
    const nonExistent = await arIO.getGateway({
      address: 'some-address',
    });
    expect(nonExistent).toEqual(undefined);
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return the gateway for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const gateway = await arIO.getGateway({
        address: gatewayAddress,
        evaluationOptions: { evalTo },
      });
      expect(gateway).toBeDefined();
    },
  );

  it('should return the record for an existing domain', async () => {
    const record = await arIO.getArNSRecord({ domain: testDomain });
    expect(record).toBeDefined();
  });

  it('should throw return undefined for a non existent record', async () => {
    const nonExistent = await arIO.getArNSRecord({
      domain: 'some-domain',
    });
    expect(nonExistent).toEqual(undefined);
  });

  it('should fetch all records', async () => {
    const records = await arIO.getArNSRecords();
    expect(records).toBeDefined();
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return record for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const currentRecord = await arIO.getArNSRecord({
        domain: testDomain,
        evaluationOptions: {
          evalTo: evalTo,
        },
      });
      expect(currentRecord).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return records for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const records = await arIO.getArNSRecords({
        evaluationOptions: {
          evalTo,
        },
      });
      expect(records[testDomain]).toBeDefined();
    },
  );

  it('should return the current epoch information', async () => {
    const epoch = await arIO.getCurrentEpoch();
    expect(epoch).toBeDefined();
    expect(epoch.epochStartHeight).toBeDefined();
    expect(epoch.epochBlockLength).toBeDefined();
    expect(epoch.epochDistributionHeight).toBeDefined();
    expect(epoch.epochEndHeight).toBeDefined();
    expect(epoch.epochPeriod).toBeDefined();
    expect(epoch.epochZeroStartHeight).toBeDefined();
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return the current epoch information for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const epoch = await arIO.getCurrentEpoch({
        evaluationOptions: { evalTo },
      });
      expect(epoch).toBeDefined();
      expect(epoch.epochStartHeight).toBeDefined();
      expect(epoch.epochBlockLength).toBeDefined();
      expect(epoch.epochDistributionHeight).toBeDefined();
      expect(epoch.epochEndHeight).toBeDefined();
      expect(epoch.epochPeriod).toBeDefined();
      expect(epoch.epochZeroStartHeight).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return the epoch information for provided evaluation options: ${JSON.stringify('%s')}`,
    async () => {
      const epoch = await arIO.getEpoch({
        blockHeight: evaluateToBlockHeight,
      });
      expect(epoch).toBeDefined();
      expect(epoch.epochStartHeight).toBeDefined();
      expect(epoch.epochBlockLength).toBeDefined();
      expect(epoch.epochDistributionHeight).toBeDefined();
      expect(epoch.epochEndHeight).toBeDefined();
      expect(epoch.epochPeriod).toBeDefined();
      expect(epoch.epochZeroStartHeight).toBeDefined();
    },
  );

  it('should return the prescribed observers for the current epoch', async () => {
    const observers = await arIO.getPrescribedObservers();
    expect(observers).toBeDefined();
    for (const observer of observers) {
      expect(observer.gatewayAddress).toBeDefined();
      expect(observer.observerAddress).toBeDefined();
      expect(observer.stake).toBeDefined();
      expect(observer.start).toBeDefined();
      expect(observer.stakeWeight).toBeDefined();
      expect(observer.tenureWeight).toBeDefined();
      expect(observer.gatewayRewardRatioWeight).toBeDefined();
      expect(observer.observerRewardRatioWeight).toBeDefined();
      expect(observer.compositeWeight).toBeDefined();
      expect(observer.normalizedCompositeWeight).toBeDefined();
    }
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return the prescribed observers for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const observers = await arIO.getPrescribedObservers({
        evaluationOptions: { evalTo },
      });
      expect(observers).toBeDefined();
      for (const observer of observers) {
        expect(observer.gatewayAddress).toBeDefined();
        expect(observer.observerAddress).toBeDefined();
        expect(observer.stake).toBeDefined();
        expect(observer.start).toBeDefined();
        expect(observer.stakeWeight).toBeDefined();
        expect(observer.tenureWeight).toBeDefined();
        expect(observer.gatewayRewardRatioWeight).toBeDefined();
        expect(observer.observerRewardRatioWeight).toBeDefined();
        expect(observer.compositeWeight).toBeDefined();
        expect(observer.normalizedCompositeWeight).toBeDefined();
      }
    },
  );

  it('should return observation information', async () => {
    const observations = await arIO.getObservations();
    const observation = await arIO.getObservations({
      epochStartHeight: parseInt(Object.keys(observations)[0]),
    });
    expect(observations).toBeDefined();
    expect(observation).toBeDefined();
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return observation for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const observations = await arIO.getObservations({
        evaluationOptions: {
          evalTo,
        },
      });
      expect(observations).toBeDefined();
    },
  );

  it('should return distributions', async () => {
    const distributions = await arIO.getDistributions();
    expect(distributions).toBeDefined();
  });

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return distributions for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const distributions = await arIO.getDistributions({
        evaluationOptions: { evalTo },
      });
      expect(distributions).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return auction for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const auction = await arIO.getAuction({
        domain: 'bobbyhiscut',
        evaluationOptions: { evalTo },
      });
      expect(auction).toBeDefined();
    },
  );

  it.each([
    [{ sortKey: evaluateToSortKey.toString() }],
    [{ blockHeight: evaluateToBlockHeight }],
  ])(
    `should return auction for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const auctions = await arIO.getAuctions({
        evaluationOptions: { evalTo },
      });
      expect(auctions).toBeDefined();
    },
  );
});

// TODO: add ArIOWritable tests
