import { ArweaveSigner } from 'arbundles';

import { ArIO, ArIOReadable, ArIOWritable } from '../../src/common/ar-io.js';
import { RemoteContract } from '../../src/common/contracts/remote-contract.js';
import { WarpContract } from '../../src/common/index.js';
import { DefaultLogger } from '../../src/common/logger.js';
import { ArIOState } from '../../src/contract-state.js';
import {
  evaluateToBlockHeight,
  evaluateToSortKey,
  gatewayAddress,
  localCacheUrl,
  testDomain,
} from '../constants.js';

const testCases = [
  [{ sortKey: evaluateToSortKey.toString() }],
  [{ blockHeight: evaluateToBlockHeight }],
  [undefined],
] as const;

describe('ArIO Factory', () => {
  let signer: ArweaveSigner;
  let contractTxId: string;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!;
    signer = new ArweaveSigner(JSON.parse(process.env.PRIMARY_WALLET_JWK!));
  });

  it('should return a readable without any configuration provided', () => {
    const readable = ArIO.init();
    expect(readable).toBeDefined();
    expect(readable).toBeInstanceOf(ArIOReadable);
  });

  it('should return a writable without any configuration provided', () => {
    const writable = ArIO.init({ signer });
    expect(writable).toBeDefined();
    expect(writable).toBeInstanceOf(ArIOWritable);
  });

  it('should return a valid instance of ArIOWritable with contract config', async () => {
    const writeClient = ArIO.init({
      signer,
      contract: new WarpContract<ArIOState>({
        cacheUrl: localCacheUrl,
        contractTxId,
        logger: new DefaultLogger({ level: 'none' }),
      }),
    });
    expect(writeClient).toBeDefined();
    expect(writeClient).toBeInstanceOf(ArIOWritable);
  });
  it('should return a valid instance of ArIOWritable with contractTxId config', async () => {
    const writeClient = ArIO.init({
      signer,
      contractTxId,
    });
    expect(writeClient).toBeDefined();
    expect(writeClient).toBeInstanceOf(ArIOWritable);
  });

  it('should return a valid instance if ArIOReadable with contract config', async () => {
    const readClient = ArIO.init({
      contract: new RemoteContract<ArIOState>({
        contractTxId,
        cacheUrl: localCacheUrl,
      }),
    });

    expect(readClient).toBeDefined();
    expect(readClient).toBeInstanceOf(ArIOReadable);
  });
  it('should return a valid instance if ArIOReadable with contractTxId config', async () => {
    const readClient = ArIO.init({
      contractTxId,
    });

    expect(readClient).toBeDefined();
    expect(readClient).toBeInstanceOf(ArIOReadable);
  });
});
describe('ArIOReadable Client', () => {
  let contractTxId: string;
  let arIO: ArIOReadable;

  beforeAll(() => {
    contractTxId = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!;
    arIO = ArIO.init({
      contract: new RemoteContract<ArIOState>({
        contractTxId,
        cacheUrl: localCacheUrl,
      }),
    });
  });

  it('should getState successfully', async () => {
    const state = await arIO.getState();
    expect(state).toBeDefined();
  });

  it('should getBalance of an address successfully', async () => {
    const balance = await arIO.getBalance({
      address: process.env.PRIMARY_WALLET_ADDRESS!,
    });
    expect(balance).toBeDefined();
  });

  it('should getBalances successfully', async () => {
    const balances = await arIO.getBalances();
    expect(balances).toBeDefined();
  });

  it('should should return undefined for non existent gateway', async () => {
    const nonExistent = await arIO.getGateway({
      address: 'some-address',
    });
    expect(nonExistent).toEqual(undefined);
  });

  it('should return gateways at a given block height', async () => {
    const gateway = await arIO.getGateway({
      address: gatewayAddress,
      evaluationOptions: { evalTo: { blockHeight: evaluateToBlockHeight } },
    });
    expect(gateway).toBeDefined();
  });

  it('should return gateways at a given sort key', async () => {
    const gateway = await arIO.getGateway({
      address: gatewayAddress,
      evaluationOptions: { evalTo: { sortKey: evaluateToSortKey.toString() } },
    });
    expect(gateway).toBeDefined();
  });

  it('should return gateways at a given block height', async () => {
    const gateways = await arIO.getGateways({
      evaluationOptions: { evalTo: { blockHeight: evaluateToBlockHeight } },
    });
    expect(gateways[gatewayAddress]).toBeDefined();
  });

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

  it('should return record at a given block height', async () => {
    const currentRecord = await arIO.getArNSRecord({
      domain: testDomain,
      evaluationOptions: {
        evalTo: { blockHeight: evaluateToBlockHeight + 1 },
      },
    });
    expect(currentRecord).toBeDefined();
  });

  it('should return record at a given sort key', async () => {
    const record = await arIO.getArNSRecord({
      domain: testDomain,
      evaluationOptions: {
        evalTo: { sortKey: evaluateToSortKey.toString() },
      },
    });
    expect(record).toBeDefined();
  });

  it('should return records at a given block height', async () => {
    const records = await arIO.getArNSRecords({
      evaluationOptions: {
        evalTo: { blockHeight: evaluateToBlockHeight },
      },
    });
    expect(records[testDomain]).toBeDefined();
  });

  it('should return records at a given sort key', async () => {
    const records = await arIO.getArNSRecords({
      evaluationOptions: {
        evalTo: { sortKey: evaluateToSortKey.toString() },
      },
    });
    expect(records[testDomain]).toBeDefined();
  });

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

  it('should return the current epoch information when evaluated at a given block height', async () => {
    const epoch = await arIO.getCurrentEpoch({
      evaluationOptions: { evalTo: { blockHeight: evaluateToBlockHeight } },
    });
    expect(epoch).toBeDefined();
    expect(epoch.epochStartHeight).toBeDefined();
    expect(epoch.epochBlockLength).toBeDefined();
    expect(epoch.epochDistributionHeight).toBeDefined();
    expect(epoch.epochEndHeight).toBeDefined();
    expect(epoch.epochPeriod).toBeDefined();
    expect(epoch.epochZeroStartHeight).toBeDefined();
  });

  it('should return the epoch information at a given block height', async () => {
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
  });

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

  it.each(testCases)(
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

  it('should get the observation information at a given block height', async () => {
    const observations = await arIO.getObservations({
      evaluationOptions: { evalTo: { blockHeight: evaluateToBlockHeight } },
    });
    expect(observations).toBeDefined();
  });

  it('should return observations at a sortkey', async () => {
    const observations = await arIO.getObservations({
      evaluationOptions: { evalTo: { sortKey: evaluateToSortKey.toString() } },
    });
    expect(observations).toBeDefined();
  });

  it('should return distributions', async () => {
    const distributions = await arIO.getDistributions();
    expect(distributions).toBeDefined();
  });

  it('should return distributions at a block height', async () => {
    const distributions = await arIO.getDistributions({
      evaluationOptions: { evalTo: { blockHeight: evaluateToBlockHeight } },
    });
    expect(distributions).toBeDefined();
  });
  it('should return distributions at a sortKey', async () => {
    const distributions = await arIO.getDistributions({
      evaluationOptions: { evalTo: { sortKey: evaluateToSortKey.toString() } },
    });
    expect(distributions).toBeDefined();
  });

  it.each(testCases)(
    `should return auction for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const auction = await arIO.getAuction({
        domain: 'ardrive',
        evaluationOptions: { evalTo },
      });
      expect(auction).toBeDefined();
    },
  );

  it.each(testCases)(
    `should return auction for provided evaluation options: ${JSON.stringify('%s')}`,
    async (evalTo) => {
      const auctions = await arIO.getAuctions({
        evaluationOptions: { evalTo },
      });
      expect(auctions).toBeDefined();
    },
  );
});
