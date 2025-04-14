/**
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */
import {
  ANT,
  ANTRegistry,
  ANTVersions,
  ANT_REGISTRY_ID,
  AOProcess,
  ARIO,
  ARIOReadable,
  ARIOWithFaucet,
  ARIOWriteable,
  ARIO_MAINNET_PROCESS_ID,
  ARIO_TESTNET_PROCESS_ID,
  AoANTReadable,
  AoANTRegistryWriteable,
  AoANTWriteable,
  AoARIORead,
  ArweaveSigner,
  createAoSigner,
  createFaucet,
  isDistributedEpochData,
} from '@ar.io/sdk';
import { connect } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  DockerComposeEnvironment,
  StartedDockerComposeEnvironment,
  Wait,
} from 'testcontainers';

const projectRootPath = process.cwd();
const testWalletJSON = fs.readFileSync('../test-wallet.json', {
  encoding: 'utf-8',
});

const testWallet = JSON.parse(testWalletJSON);
const signers = [
  new ArweaveSigner(testWallet),
  createAoSigner(new ArweaveSigner(testWallet)),
] as const;

const aoClient = connect({
  CU_URL: 'http://localhost:6363',
});
const arweave = Arweave.init({});
const processId = process.env.ARIO_PROCESS_ID || ARIO_TESTNET_PROCESS_ID;
const ario = ARIO.init({
  process: new AOProcess({
    processId,
    ao: aoClient,
  }),
});

describe('e2e esm tests', async () => {
  let compose: StartedDockerComposeEnvironment;

  before(async () => {
    compose = await new DockerComposeEnvironment(
      projectRootPath,
      '../docker-compose.test.yml',
    )
      .withWaitStrategy('ao-cu-1', Wait.forHttp(`/state/${processId}`, 6363))
      .withStartupTimeout(60_000_000)
      .up(['ao-cu', 'faucet']);
  });

  after(async () => {
    await compose.down();
  });

  describe('ARIO', async () => {
    it('should be able to instantiate ARIO with default process', async () => {
      const ario = ARIO.init();
      assert(ario instanceof ARIOReadable);
    });

    it('should be able to instantiate mainnet ARIO', async () => {
      const ario = ARIO.mainnet();
      assert(ario instanceof ARIOReadable);
      assert(ario.process.processId === ARIO_MAINNET_PROCESS_ID);
    });

    it('should be able to instantiate testnet ARIO', async () => {
      const ario = ARIO.testnet();
      assert(ario instanceof ARIOReadable);
      assert(ario.process.processId === ARIO_TESTNET_PROCESS_ID);
    });

    it('should be able to instantiate ARIO default process with just a signer', async () => {
      const ario = ARIO.init({
        signer: new ArweaveSigner(testWallet),
      });
      assert(ario instanceof ARIOWriteable);
    });

    it('should able to instantiate mainnet ARIO with just a signer', async () => {
      const ario = ARIO.mainnet({
        signer: new ArweaveSigner(testWallet),
      });
      assert(ario instanceof ARIOWriteable);
      assert(ario.process.processId === ARIO_MAINNET_PROCESS_ID);
    });

    it('should able to instantiate testnet ARIO with just a signer', async () => {
      const ario = ARIO.testnet({
        signer: new ArweaveSigner(testWallet),
      });
      assert(ario instanceof ARIOWriteable);
      assert(ario.process.processId === ARIO_TESTNET_PROCESS_ID);
    });

    it('should be able to instantiate ARIO with a process and arweave', async () => {
      const ario = ARIO.init({
        process: new AOProcess({
          processId,
        }),
        arweave,
      });
      assert(ario instanceof ARIOReadable);
      assert(ario.process.processId === processId);
    });

    it('should be able to instantiate ARIO with a process id and arweave', async () => {
      const ario = ARIO.init({
        processId,
        arweave,
      });
      assert(ario instanceof ARIOReadable);
      assert(ario.process.processId === processId);
    });

    it('should be able to get the process information', async () => {
      const info = await ario.getInfo();
      assert.ok(info);
      assert(typeof info.Name === 'string');
      assert(typeof info.Ticker === 'string');
      assert(typeof info.Logo === 'string');
      assert(typeof info.Denomination === 'number');
      assert(Array.isArray(info.Handlers));
      assert(typeof info.LastCreatedEpochIndex === 'number');
      assert(typeof info.LastDistributedEpochIndex === 'number');
    });

    it('should be able to return a specific page of arns records', async () => {
      const records = await ario.getArNSRecords({
        cursor: 'ardrive',
        limit: 5,
        sortOrder: 'desc',
        sortBy: 'name',
      });
      assert.ok(records);
      assert(records.limit === 5);
      assert(records.sortOrder === 'desc');
      assert(records.sortBy === 'name');
      assert(typeof records.totalItems === 'number');
      assert(typeof records.sortBy === 'string');
      assert(typeof records.sortOrder === 'string');
      assert(typeof records.limit === 'number');
      assert(typeof records.hasMore === 'boolean');
      if (records.nextCursor) {
        assert(typeof records.nextCursor === 'string');
      }
      assert(Array.isArray(records.items));
      records.items.forEach((record) => {
        assert(typeof record.processId === 'string');
        assert(typeof record.name === 'string');
        assert(typeof record.startTimestamp === 'number');
        assert(['lease', 'permabuy'].includes(record.type));
        assert(typeof record.undernameLimit === 'number');
      });
    });
    it('should be able to get a single arns record', async () => {
      const arns = await ario.getArNSRecord({ name: 'ardrive' });
      assert.ok(arns);
      assert(typeof arns.processId === 'string');
      assert(typeof arns.startTimestamp === 'number');
      assert(
        typeof arns.type === 'string' &&
          ['lease', 'permabuy'].includes(arns.type),
      );
      assert(typeof arns.undernameLimit === 'number');
      assert(typeof arns.purchasePrice === 'number');
    });

    it('should be able to get reserved names', async () => {
      const reservedNames = await ario.getArNSReservedNames({
        limit: 1,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      assert.ok(reservedNames);
      assert(reservedNames.limit === 1);
      assert(reservedNames.sortOrder === 'asc');
      assert(reservedNames.sortBy === 'name');
      assert(typeof reservedNames.totalItems === 'number');
      assert(typeof reservedNames.sortBy === 'string');
      assert(typeof reservedNames.sortOrder === 'string');
      assert(typeof reservedNames.limit === 'number');
      assert(typeof reservedNames.hasMore === 'boolean');
      if (reservedNames.nextCursor) {
        assert(typeof reservedNames.nextCursor === 'string');
      }
      assert(Array.isArray(reservedNames.items));
      reservedNames.items.forEach((item) => {
        assert(typeof item.name === 'string');
      });
    });

    it('should be able to get a single reserved name', async () => {
      const { items: reservedNames } = await ario.getArNSReservedNames();
      assert.ok(reservedNames);
      if (reservedNames.length > 0) {
        const reservedName = await ario.getArNSReservedName({
          name: reservedNames[0].name,
        });
        assert.ok(reservedName);
      }
    });

    it('should be able to get the current epoch', async () => {
      const epoch = await ario.getCurrentEpoch();
      assert.ok(epoch);
      assert.equal(typeof epoch.epochIndex, 'number');
      assert.equal(typeof epoch.startHeight, 'number');
      assert.equal(typeof epoch.endTimestamp, 'number');
      assert.equal(typeof epoch.arnsStats.totalReservedNames, 'number');
      assert.equal(typeof epoch.arnsStats.totalActiveNames, 'number');
      assert.equal(typeof epoch.arnsStats.totalReturnedNames, 'number');
      assert.equal(typeof epoch.arnsStats.totalGracePeriodNames, 'number');
      assert(Array.isArray(epoch.prescribedObservers));
      assert(Array.isArray(epoch.prescribedNames));
      assert(Array.isArray(epoch.observations.failureSummaries));
      assert(Array.isArray(epoch.observations.reports));
    });

    it('should be able to get a previous epoch', async () => {
      const currentEpoch = await ario.getCurrentEpoch();
      const epoch = await ario.getEpoch({
        epochIndex: currentEpoch.epochIndex - 1,
      });
      assert.ok(epoch);
      assert.equal(typeof epoch.epochIndex, 'number');
      assert.equal(typeof epoch.startHeight, 'number');
      assert.equal(typeof epoch.endTimestamp, 'number');
      assert.equal(epoch.epochIndex, currentEpoch.epochIndex - 1);
    });

    it('should be able to get epoch-settings', async () => {
      const epochSettings = await ario.getEpochSettings();
      assert.ok(epochSettings);

      assert.equal(typeof epochSettings.maxObservers, 'number');
      assert.equal(typeof epochSettings.durationMs, 'number');
      assert.equal(typeof epochSettings.prescribedNameCount, 'number');
      assert.equal(typeof epochSettings.epochZeroStartTimestamp, 'number');
    });

    it('should be able to get demand factor settings', async () => {
      const demandFactorSettings = await ario.getDemandFactorSettings();
      assert.ok(demandFactorSettings);
      assert.equal(
        typeof demandFactorSettings.periodZeroStartTimestamp,
        'number',
      );
      assert.equal(typeof demandFactorSettings.movingAvgPeriodCount, 'number');
      assert.equal(typeof demandFactorSettings.periodLengthMs, 'number');
      assert.equal(typeof demandFactorSettings.demandFactorBaseValue, 'number');
      assert.equal(typeof demandFactorSettings.demandFactorMin, 'number');
      assert.equal(
        typeof demandFactorSettings.demandFactorUpAdjustmentRate,
        'number',
      );
      assert.equal(
        typeof demandFactorSettings.demandFactorDownAdjustmentRate,
        'number',
      );
      assert.equal(
        typeof demandFactorSettings.maxPeriodsAtMinDemandFactor,
        'number',
      );
      assert.equal(typeof demandFactorSettings.criteria, 'string');
    });

    it('should be able to get first page of gateways', async () => {
      const gateways = await ario.getGateways();
      assert.ok(gateways);
      assert(gateways.limit === 100);
      assert(gateways.sortOrder === 'desc');
      assert(gateways.sortBy === 'startTimestamp');
      assert(typeof gateways.totalItems === 'number');
      assert(typeof gateways.sortBy === 'string');
      assert(typeof gateways.sortOrder === 'string');
      assert(typeof gateways.limit === 'number');
      assert(typeof gateways.hasMore === 'boolean');
      if (gateways.nextCursor) {
        assert(typeof gateways.nextCursor === 'string');
      }
      assert(Array.isArray(gateways.items));
      gateways.items.forEach((gateway) => {
        assert(typeof gateway.gatewayAddress === 'string');
        assert(typeof gateway.observerAddress === 'string');
        assert(typeof gateway.startTimestamp === 'number');
        assert(typeof gateway.operatorStake === 'number');
        assert(typeof gateway.totalDelegatedStake === 'number');
        assert(typeof gateway.settings === 'object');
        assert(typeof gateway.weights === 'object');
        assert(typeof gateway.weights.normalizedCompositeWeight === 'number');
        assert(typeof gateway.weights.compositeWeight === 'number');
        assert(typeof gateway.weights.stakeWeight === 'number');
        assert(typeof gateway.weights.tenureWeight === 'number');
        assert(typeof gateway.weights.observerPerformanceRatio === 'number');
        assert(typeof gateway.weights.gatewayPerformanceRatio === 'number');
      });
    });

    it('should be able to get a specific page of gateways', async () => {
      const gateways = await ario.getGateways({
        cursor: '1000000',
        limit: 1,
        sortBy: 'operatorStake',
        sortOrder: 'desc',
      });
      assert.ok(gateways);
      assert(gateways.limit === 1);
      assert(gateways.sortOrder === 'desc');
      assert(gateways.sortBy === 'operatorStake');
      assert(typeof gateways.totalItems === 'number');
      assert(typeof gateways.sortBy === 'string');
      assert(typeof gateways.sortOrder === 'string');
      assert(typeof gateways.limit === 'number');
      assert(typeof gateways.hasMore === 'boolean');
      if (gateways.nextCursor) {
        assert(typeof gateways.nextCursor === 'string');
      }
      assert(Array.isArray(gateways.items));
      gateways.items.forEach((gateway) => {
        assert(typeof gateway.gatewayAddress === 'string');
        assert(typeof gateway.observerAddress === 'string');
        assert(typeof gateway.startTimestamp === 'number');
        assert(typeof gateway.operatorStake === 'number');
        assert(typeof gateway.totalDelegatedStake === 'number');
        assert(typeof gateway.settings === 'object');
        assert(typeof gateway.weights === 'object');
        assert(typeof gateway.weights.normalizedCompositeWeight === 'number');
        assert(typeof gateway.weights.compositeWeight === 'number');
        assert(typeof gateway.weights.stakeWeight === 'number');
        assert(typeof gateway.weights.tenureWeight === 'number');
        assert(typeof gateway.weights.observerPerformanceRatio === 'number');
        assert(typeof gateway.weights.gatewayPerformanceRatio === 'number');
      });
    });

    it('should be able to get a page of gateways sorted by nested key like `weights.compositeWeight`', async () => {
      const gateways = await ario.getGateways({
        limit: 3,
        sortBy: 'weights.compositeWeight',
        sortOrder: 'desc',
      });
      assert.ok(gateways);
      assert(gateways.limit === 3);
      assert(gateways.sortOrder === 'desc');
      assert(gateways.sortBy === 'weights.compositeWeight');
      assert(typeof gateways.totalItems === 'number');
      assert(Array.isArray(gateways.items));
      let lastWeight = Infinity;
      gateways.items.forEach((gateway) => {
        assert(typeof gateway.weights === 'object');
        assert(typeof gateway.weights.compositeWeight === 'number');

        // Ensure the sort order is correct
        assert(gateway.weights.compositeWeight <= lastWeight);
        lastWeight = gateway.weights.compositeWeight;
      });
    });

    it('should be able to get a single gateway', async () => {
      const { items: gateways } = await ario.getGateways({
        limit: 1,
      });
      if (gateways.length === 0) {
        return;
      }
      const gatewayObject = gateways[0];
      const gateway = await ario.getGateway({
        address: gatewayObject.gatewayAddress,
      });
      assert.ok(gateway);
    });

    it('should be able to get gateway delegates', async () => {
      const { items: gateways } = await ario.getGateways({
        limit: 1,
      });
      if (gateways.length === 0) {
        return;
      }
      const delegates = await ario.getGatewayDelegates({
        address: gateways[0].gatewayAddress,
        limit: 1,
        sortBy: 'startTimestamp',
        sortOrder: 'desc',
      });
      assert.ok(delegates);
      assert(delegates.limit === 1);
      assert(delegates.sortOrder === 'desc');
      assert(delegates.sortBy === 'startTimestamp');
      assert(typeof delegates.totalItems === 'number');
      assert(typeof delegates.sortBy === 'string');
      assert(typeof delegates.sortOrder === 'string');
      assert(typeof delegates.limit === 'number');
      assert(typeof delegates.hasMore === 'boolean');
      if (delegates.nextCursor) {
        assert(typeof delegates.nextCursor === 'string');
      }
      assert(Array.isArray(delegates.items));
      delegates.items.forEach((delegate) => {
        assert(typeof delegate.delegatedStake === 'number');
        assert(typeof delegate.startTimestamp === 'number');
        assert(typeof delegate.address === 'string');
      });
    });

    it('should be able get list of allowed gateway delegate addresses, if applicable', async () => {
      const { items: gateways } = await ario.getGateways({
        limit: 1,
      });
      if (gateways.length === 0) {
        return;
      }
      const allowedDelegates = await ario.getAllowedDelegates({
        address: gateways[0].gatewayAddress,
      });
      assert.ok(allowedDelegates);
      assert(allowedDelegates.limit === 100);
      assert(typeof allowedDelegates.totalItems === 'number');
      assert(typeof allowedDelegates.limit === 'number');
      assert(typeof allowedDelegates.hasMore === 'boolean');
      if (allowedDelegates.nextCursor) {
        assert(typeof allowedDelegates.nextCursor === 'string');
      }
      assert(Array.isArray(allowedDelegates.items));
      allowedDelegates.items.forEach((address) => {
        assert(typeof address === 'string');
      });
    });

    it('should be able to get the first page of all delegates', async () => {
      const delegates = await ario.getAllDelegates({
        limit: 1,
        sortBy: 'startTimestamp',
        sortOrder: 'desc',
      });
      assert.ok(delegates);
      assert(delegates.limit === 1);
      assert(delegates.sortOrder === 'desc');
      assert(delegates.sortBy === 'startTimestamp');
      assert(typeof delegates.totalItems === 'number');
      assert(typeof delegates.sortBy === 'string');
      assert(typeof delegates.sortOrder === 'string');
      assert(typeof delegates.limit === 'number');
      assert(typeof delegates.hasMore === 'boolean');
      if (delegates.nextCursor) {
        assert(typeof delegates.nextCursor === 'string');
      }
      assert(Array.isArray(delegates.items));
      delegates.items.forEach((delegate) => {
        assert(typeof delegate.delegatedStake === 'number');
        assert(typeof delegate.startTimestamp === 'number');
        assert(typeof delegate.address === 'string');
        assert(typeof delegate.gatewayAddress === 'string');
        assert(typeof delegate.cursorId === 'string');
        assert(typeof delegate.vaultedStake === 'number');
      });
    });

    it('should be able to get gateway vaults', async () => {
      const { items: gateways } = await ario.getGateways({
        limit: 1,
      });
      if (gateways.length === 0) {
        return;
      }
      const vaults = await ario.getGatewayVaults({
        address: gateways[0].gatewayAddress,
      });
      assert.ok(vaults);
      assert(vaults.limit === 100);
      assert(vaults.sortOrder === 'desc');
      assert(vaults.sortBy === 'endTimestamp');
      assert(typeof vaults.totalItems === 'number');
      assert(typeof vaults.sortBy === 'string');
      assert(typeof vaults.sortOrder === 'string');
      assert(typeof vaults.limit === 'number');
      assert(typeof vaults.hasMore === 'boolean');
      if (vaults.nextCursor) {
        assert(typeof vaults.nextCursor === 'string');
      }
      assert(Array.isArray(vaults.items));
      vaults.items.forEach((vault) => {
        assert(typeof vault.balance === 'number');
        assert(typeof vault.cursorId === 'string');
        assert(typeof vault.vaultId === 'string');
        assert(typeof vault.startTimestamp === 'number');
        assert(typeof vault.endTimestamp === 'number');
      });
    });

    it('should be able to get the first page of all gateway vaults', async () => {
      const vaults = await ario.getAllGatewayVaults({
        limit: 1,
        sortBy: 'balance',
        sortOrder: 'desc',
      });
      assert.ok(vaults);
      assert(vaults.limit === 1);
      assert(vaults.sortOrder === 'desc');
      assert(vaults.sortBy === 'balance');
      assert(typeof vaults.totalItems === 'number');
      assert(typeof vaults.sortBy === 'string');
      assert(typeof vaults.sortOrder === 'string');
      assert(typeof vaults.limit === 'number');
      assert(typeof vaults.hasMore === 'boolean');
      if (vaults.nextCursor) {
        assert(typeof vaults.nextCursor === 'string');
      }
      assert(Array.isArray(vaults.items));
      vaults.items.forEach((vault) => {
        assert(typeof vault.balance === 'number');
        assert(typeof vault.startTimestamp === 'number');
        assert(typeof vault.endTimestamp === 'number');
        assert(typeof vault.gatewayAddress === 'string');
        assert(typeof vault.cursorId === 'string');
        assert(typeof vault.vaultId === 'string');
      });
    });

    it('should be able to get gateway delegate allow list', async () => {
      const { items: gateways } = await ario.getGateways({
        limit: 1,
      });
      if (gateways.length === 0) {
        return;
      }
      const allowList = await ario.getGatewayDelegateAllowList({
        address: gateways[0].gatewayAddress,
        limit: 1,
        // note: sortBy is omitted because it's not supported for by this contract handler, the result is an array of addresses
        sortOrder: 'desc',
      });
      assert.ok(allowList);
      assert(allowList.limit === 1);
      assert(allowList.sortOrder === 'desc');
      assert(typeof allowList.totalItems === 'number');
      assert(typeof allowList.sortOrder === 'string');
      assert(typeof allowList.limit === 'number');
      assert(typeof allowList.hasMore === 'boolean');
      if (allowList.nextCursor) {
        assert(typeof allowList.nextCursor === 'string');
      }
      assert(Array.isArray(allowList.items));
      allowList.items.forEach((address) => {
        assert(typeof address === 'string');
      });
    });

    it('should be able to get balances, defaulting to first page', async () => {
      const balances = await ario.getBalances();
      assert.ok(balances);
      assert(balances.limit === 100);
      assert(balances.sortOrder === 'desc');
      assert(balances.sortBy === 'balance');
      assert(typeof balances.totalItems === 'number');
      assert(typeof balances.sortBy === 'string');
      assert(typeof balances.sortOrder === 'string');
      assert(typeof balances.limit === 'number');
      assert(typeof balances.hasMore === 'boolean');
      if (balances.nextCursor) {
        assert(typeof balances.nextCursor === 'string');
      }
      assert(Array.isArray(balances.items));
      balances.items.forEach((wallet) => {
        assert(typeof wallet.address === 'string');
        assert(
          typeof wallet.balance === 'number',
          `Balance for ${wallet.address} is not a number: ${wallet.balance}`,
        );
      });
    });

    it('should be able to get balances of a specific to first page', async () => {
      const balances = await ario.getBalances({
        cursor: '1000000',
        limit: 1,
        sortBy: 'address',
        sortOrder: 'asc',
      });
      assert.ok(balances);
      assert(balances.limit === 1);
      assert(balances.sortOrder === 'asc');
      assert(balances.sortBy === 'address');
      assert(typeof balances.totalItems === 'number');
      assert(typeof balances.sortBy === 'string');
      assert(typeof balances.sortOrder === 'string');
      assert(typeof balances.limit === 'number');
      assert(typeof balances.hasMore === 'boolean');
      if (balances.nextCursor) {
        assert(typeof balances.nextCursor === 'string');
      }
      assert(Array.isArray(balances.items));
      balances.items.forEach((wallet) => {
        assert(typeof wallet.address === 'string');
        assert(typeof wallet.balance === 'number');
      });
    });

    it('should be able to get a single balance', async () => {
      const balance = await ario.getBalance({
        address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
      });
      assert.ok(balance);
      assert(typeof balance === 'number');
      assert(balance >= 0);
    });

    it('should be able to get prescribed names', async () => {
      const prescribedNames = await ario.getPrescribedNames();
      assert.ok(prescribedNames);
      assert(Array.isArray(prescribedNames));
      for (const name of prescribedNames) {
        assert(typeof name === 'string');
      }
    });

    it('should return the prescribed observers for a given epoch', async () => {
      const observers = await ario.getPrescribedObservers();
      assert.ok(observers);
      for (const observer of observers) {
        assert(typeof observer.gatewayAddress === 'string');
        assert(typeof observer.observerAddress === 'string');
        assert(typeof observer.stake === 'number');
        assert(typeof observer.startTimestamp === 'number');
        assert(typeof observer.stakeWeight === 'number');
        assert(typeof observer.tenureWeight === 'number');
        assert(typeof observer.gatewayPerformanceRatio === 'number');
        assert(typeof observer.observerPerformanceRatio === 'number');
        assert(typeof observer.compositeWeight === 'number');
      }
    });

    it('should be able to get token cost for leasing a name using `Buy-Record` intent', async () => {
      const tokenCost = await ario.getTokenCost({
        intent: 'Buy-Name',
        name: 'new-name',
        years: 1,
      });
      // it should have a token cost
      assert.ok(tokenCost);
    });

    it('should be able to get token cost for buying a name using `Buy-Record` intent', async () => {
      const tokenCost = await ario.getTokenCost({
        intent: 'Buy-Record',
        name: 'new-name',
        type: 'permabuy',
      });
      assert.ok(tokenCost);
      assert.ok(typeof tokenCost === 'number');
      assert(tokenCost > 0);
    });

    it('should be able to get token cost for buying a name using `Buy-Name` intent', async () => {
      const tokenCost = await ario.getTokenCost({
        intent: 'Buy-Name',
        name: 'new-name',
        type: 'permabuy',
      });
      assert.ok(tokenCost);
      assert.ok(typeof tokenCost === 'number');
      assert(tokenCost > 0);
    });

    it('should be able to get cost details for buying a name', async () => {
      const costDetails = await ario.getCostDetails({
        intent: 'Buy-Name',
        name: 'new-name',
        type: 'permabuy',
        fromAddress: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
        fundFrom: undefined,
      });
      assert.ok(costDetails);
      assert.equal(typeof costDetails.tokenCost, 'number');
      assert.equal(typeof costDetails.discounts, 'object');
      assert.equal(typeof costDetails.fundingPlan, 'undefined'); // no funding plan with absence of fundFrom
    });

    it('should be able to support `Buy-Name` intent for cost details', async () => {
      const costDetails = await ario.getCostDetails({
        intent: 'Buy-Name',
        name: 'new-name',
        type: 'permabuy',
        fromAddress: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
        fundFrom: undefined,
      });
      assert.ok(costDetails);
      assert.equal(typeof costDetails.tokenCost, 'number');
      assert.equal(typeof costDetails.discounts, 'object');
      assert.equal(typeof costDetails.fundingPlan, 'undefined'); // no funding plan with absence of fundFrom
    });

    it('should be able to get cost details for leasing a name', async () => {
      const costDetails = await ario.getCostDetails({
        intent: 'Buy-Name',
        name: 'new-name',
        years: 1,
        fromAddress: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
        fundFrom: 'stakes',
      });
      assert.ok(costDetails);
      assert.equal(typeof costDetails.tokenCost, 'number');
      assert.equal(typeof costDetails.discounts, 'object');
      assert.equal(typeof costDetails.fundingPlan.balance, 'number');
      assert.equal(typeof costDetails.fundingPlan.shortfall, 'number');
      assert.equal(typeof costDetails.fundingPlan.stakes, 'object');
    });

    it('should be able to get registration fees', async () => {
      const registrationFees = await ario.getRegistrationFees();
      assert(registrationFees);
      assert.equal(Object.keys(registrationFees).length, 51);
      for (const nameLength of Object.keys(registrationFees)) {
        // assert lease is length of 5
        assert(registrationFees[nameLength]['lease']['1'] > 0);
        assert(registrationFees[nameLength]['lease']['2'] > 0);
        assert(registrationFees[nameLength]['lease']['3'] > 0);
        assert(registrationFees[nameLength]['lease']['4'] > 0);
        assert(registrationFees[nameLength]['lease']['5'] > 0);
        assert(registrationFees[nameLength]['permabuy'] > 0);
      }
    });

    it('should be able to get current epoch distributions', async () => {
      const distributions = await ario.getDistributions();
      assert.ok(distributions);
    });

    it('should be able to get epoch distributions at a specific epoch', async () => {
      const currentEpoch = await ario.getCurrentEpoch();
      const distributions = await ario.getDistributions({
        epochIndex: currentEpoch.epochIndex - 1,
      });
      assert.ok(distributions);
      assert.ok(isDistributedEpochData(distributions));
      assert(
        typeof distributions === 'object',
        'distributions is not an object',
      );
      assert(
        typeof distributions.rewards === 'object',
        'rewards is not an object',
      );
      assert(
        typeof distributions.totalEligibleGateways === 'number',
        'totalEligibleGateways is not a number',
      );
      assert(
        typeof distributions.totalEligibleRewards === 'number',
        'totalEligibleRewards is not a number',
      );
      assert(
        typeof distributions.totalEligibleObserverReward === 'number',
        'totalEligibleObserverReward is not a number',
      );
      assert(
        typeof distributions.totalEligibleGatewayReward === 'number',
        'totalEligibleGatewayReward is not a number',
      );
      assert(
        typeof distributions.distributedTimestamp === 'number',
        'distributedTimestamp is not a number',
      );
      assert(
        typeof distributions.totalDistributedRewards === 'number',
        'totalDistributedRewards is not a number',
      );
      for (const [gatewayAddress, rewards] of Object.entries(
        distributions.rewards.eligible,
      )) {
        assert(typeof gatewayAddress === 'string');
        assert(typeof rewards.delegateRewards === 'object');
        assert(typeof rewards.operatorReward === 'number');
        assert(
          Object.entries(rewards.delegateRewards).every(
            ([address, reward]) =>
              typeof address === 'string' && typeof reward === 'number',
          ),
        );
      }
      for (const [gatewayAddress, rewards] of Object.entries(
        distributions.rewards.distributed,
      )) {
        assert(typeof gatewayAddress === 'string');
        assert(typeof rewards === 'number');
      }
    });

    it('should be able to get current epoch observations', async () => {
      const observations = await ario.getObservations();
      assert.ok(observations);
    });

    it('should be able to get epoch observations at a specific epoch', async () => {
      const currentEpoch = await ario.getCurrentEpoch();
      const observations = await ario.getObservations({
        epochIndex: currentEpoch.epochIndex - 1,
      });
      assert.ok(observations);
      // assert the type of the observations
      assert(typeof observations === 'object');
      assert.ok(observations.failureSummaries);
      assert.ok(observations.reports);
      // now validate the contents of both
      for (const [gatewayAddress, failedByAddresses] of Object.entries(
        observations.failureSummaries,
      )) {
        // should be
        assert(typeof gatewayAddress === 'string');
        assert(Array.isArray(failedByAddresses));
        assert(
          failedByAddresses.every((address) => typeof address === 'string'),
        );
      }
      for (const [observerAddress, reportTxId] of Object.entries(
        observations.reports,
      )) {
        assert(typeof observerAddress === 'string');
        assert(typeof reportTxId === 'string');
      }
    });

    it('should be able to get current demand factor', async () => {
      const demandFactor = await ario.getDemandFactor();
      assert.ok(demandFactor);
    });

    it('should be able to get current returned names', async () => {
      const { items: returnedNames } = await ario.getArNSReturnedNames();
      assert.ok(returnedNames);
    });

    it('should be able to get a specific returned name', async () => {
      const { items: returnedNames } = await ario.getArNSReturnedNames();
      if (returnedNames.length === 0) {
        return;
      }
      const returnedName = await ario.getArNSReturnedName({
        name: returnedNames[0].name,
      });
      assert.ok(returnedName);
    });

    it('should be able to create ARIOWriteable with valid signers', async () => {
      for (const signer of signers) {
        const ario = ARIO.init({ signer });

        assert(ario instanceof ARIOWriteable);
      }
    });

    it('should be able to get a specific vault', async () => {
      const { items: vaults } = await ario.getVaults();
      if (vaults.length > 0) {
        const vault = await ario.getVault({
          address: vaults[0].address,
          vaultId: vaults[0].vaultId,
        });
        assert.ok(vault);
        assert.equal(typeof vault.balance, 'number');
        assert.equal(typeof vault.startTimestamp, 'number');
        assert.equal(typeof vault.endTimestamp, 'number');
      }
    });

    it('should throw an error when unable to get a specific vault', async () => {
      const error = await ario
        .getVault({
          address: '31LPFYoow2G7j-eSSsrIh8OlNaARZ84-80J-8ba68d8',
          vaultId: 'Dmsrp1YIYUY5hA13euO-pAGbT1QPazfj1bKD9EpiZeo',
        })
        .catch((e) => e);
      assert.ok(error);
      assert(error instanceof Error);
    });

    it('should be able to get paginated vaults', async () => {
      const vaults = await ario.getVaults();
      assert.ok(vaults);
      assert(vaults.limit === 100);
      assert(vaults.sortOrder === 'desc');
      assert(vaults.sortBy === 'address');
      assert(typeof vaults.totalItems === 'number');
      assert(typeof vaults.sortBy === 'string');
      assert(typeof vaults.sortOrder === 'string');
      assert(typeof vaults.limit === 'number');
      assert(typeof vaults.hasMore === 'boolean');
      if (vaults.nextCursor) {
        assert(typeof vaults.nextCursor === 'string');
      }
      assert(Array.isArray(vaults.items));
      vaults.items.forEach(
        ({ address, vaultId, balance, endTimestamp, startTimestamp }) => {
          assert(typeof address === 'string');
          assert(typeof balance === 'number');
          assert(typeof startTimestamp === 'number');
          assert(typeof endTimestamp === 'number');
          assert(typeof vaultId === 'string');
        },
      );
    });

    it('should be able to get paginated vaults with custom sort', async () => {
      const vaults = await ario.getVaults({
        sortBy: 'balance',
        sortOrder: 'asc',
      });
      assert.ok(vaults);
      assert(vaults.limit === 100);
      assert(vaults.sortOrder === 'asc');
      assert(vaults.sortBy === 'balance');
      assert(typeof vaults.totalItems === 'number');
      assert(typeof vaults.sortBy === 'string');
      assert(typeof vaults.sortOrder === 'string');
      assert(typeof vaults.limit === 'number');
      assert(typeof vaults.hasMore === 'boolean');
      if (vaults.nextCursor) {
        assert(typeof vaults.nextCursor === 'string');
      }
      assert(Array.isArray(vaults.items));
      vaults.items.forEach(
        ({ address, vaultId, balance, endTimestamp, startTimestamp }) => {
          assert(typeof address === 'string');
          assert(typeof balance === 'number');
          assert(typeof startTimestamp === 'number');
          assert(typeof endTimestamp === 'number');
          assert(typeof vaultId === 'string');
        },
      );
    });

    it('should be able to get paginated delegations for a delegate address', async () => {
      const delegations = await ario.getDelegations({
        address: 'N4h8M9A9hasa3tF47qQyNvcKjm4APBKuFs7vqUVm-SI',
        limit: 1,
      });
      assert.ok(delegations);
      assert.equal(delegations.limit, 1);
      assert.equal(delegations.sortOrder, 'desc');
      assert.equal(delegations.sortBy, 'startTimestamp');
      assert.equal(typeof delegations.totalItems, 'number');
      assert.equal(typeof delegations.sortBy, 'string');
      assert.equal(typeof delegations.sortOrder, 'string');
      assert.equal(typeof delegations.limit, 'number');
      assert.equal(typeof delegations.hasMore, 'boolean');
      if (delegations.nextCursor) {
        assert.equal(typeof delegations.nextCursor, 'string');
      }
      assert(Array.isArray(delegations.items));
      delegations.items.forEach(
        ({
          type,
          gatewayAddress,
          delegationId,
          balance,
          startTimestamp,
          // @ts-expect-error
          vaultId = undefined,
          // @ts-expect-error
          endTimestamp = undefined,
        }) => {
          assert.equal(['stake', 'vault'].includes(type), true);
          assert.equal(typeof gatewayAddress, 'string');
          assert.equal(typeof delegationId, 'string');
          assert.equal(typeof balance, 'number');
          assert.equal(typeof startTimestamp, 'number');
          assert(
            endTimestamp === undefined || typeof endTimestamp === 'number',
          );
          assert(vaultId === undefined || typeof vaultId === 'string');
        },
      );
    });

    it('should be able to get paginated delegations for a delegate address with custom sort', async () => {
      const delegations = await ario.getDelegations({
        address: 'N4h8M9A9hasa3tF47qQyNvcKjm4APBKuFs7vqUVm-SI',
        limit: 1,
        sortBy: 'balance',
        sortOrder: 'desc',
      });
      assert.ok(delegations);
      assert.equal(delegations.limit, 1);
      assert.equal(delegations.sortOrder, 'desc');
      assert.equal(delegations.sortBy, 'balance');
      assert.equal(typeof delegations.totalItems, 'number');
      assert.equal(typeof delegations.sortBy, 'string');
      assert.equal(typeof delegations.sortOrder, 'string');
      assert.equal(typeof delegations.limit, 'number');
      assert.equal(typeof delegations.hasMore, 'boolean');
      if (delegations.nextCursor) {
        assert.equal(typeof delegations.nextCursor, 'string');
      }
      assert(Array.isArray(delegations.items));
      delegations.items.forEach(
        ({
          type,
          gatewayAddress,
          delegationId,
          balance,
          startTimestamp,
          // @ts-expect-error
          vaultId = undefined,
          // @ts-expect-error
          endTimestamp = undefined,
        }) => {
          assert.equal(typeof type, 'string');
          assert.equal(typeof gatewayAddress, 'string');
          assert.equal(typeof delegationId, 'string');
          assert.equal(typeof balance, 'number');
          assert.equal(typeof startTimestamp, 'number');
          assert(
            endTimestamp === undefined || typeof endTimestamp === 'number',
          );
          assert(vaultId === undefined || typeof vaultId === 'string');
        },
      );
    });

    it('should be able to get paginated primary names', async () => {
      const primaryNames = await ario.getPrimaryNames();
      assert.ok(primaryNames);
    });

    it('should be able to get paginated primary names with custom sort', async () => {
      const primaryNames = await ario.getPrimaryNames({
        sortBy: 'startTimestamp',
        sortOrder: 'desc',
      });
      assert.ok(primaryNames);
    });

    it('should be able to get a specific primary name by address', async () => {
      const { items: primaryNames } = await ario.getPrimaryNames();
      if (primaryNames.length === 0) {
        return;
      }
      const primaryName = await ario.getPrimaryName({
        address: primaryNames[0].owner,
      });
      const arnsRecord = await ario.getArNSRecord({
        name: primaryName.name,
      });
      assert.ok(primaryName);
      assert.deepStrictEqual(primaryName, {
        owner: primaryNames[0].owner,
        name: primaryNames[0].name,
        startTimestamp: primaryName.startTimestamp,
        processId: arnsRecord.processId,
      });
    });

    it('should be able to get a specific primary name by name', async () => {
      const { items: primaryNames } = await ario.getPrimaryNames();
      if (primaryNames.length === 0) {
        return;
      }
      const primaryName = await ario.getPrimaryName({
        name: primaryNames[0].name,
      });
      const arnsRecord = await ario.getArNSRecord({
        name: primaryName.name,
      });
      assert.ok(primaryName);
      assert.deepStrictEqual(primaryName, {
        owner: primaryNames[0].owner,
        name: primaryNames[0].name,
        startTimestamp: primaryName.startTimestamp,
        processId: arnsRecord.processId,
      });
    });

    it('should be able to get paginated primary name requests', async () => {
      const primaryNameRequests = await ario.getPrimaryNameRequests();
      assert.ok(primaryNameRequests);
    });

    it('should be able to get current redelegation fee', async () => {
      const redelegationFee = await ario.getRedelegationFee({
        address: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
      });
      assert.ok(redelegationFee);
      assert.equal(redelegationFee.redelegationFeeRate, 0);
      assert.equal(redelegationFee.feeResetTimestamp, undefined);
    });

    it('should be able to get gateway registry settings', async () => {
      const registrySettings = await ario.getGatewayRegistrySettings();
      assert.ok(registrySettings);
      assert.ok(typeof registrySettings.delegates.minStake === 'number');
      assert.ok(
        typeof registrySettings.delegates.withdrawLengthMs === 'number',
      );
      assert.ok(typeof registrySettings.observers.maxTenureWeight === 'number');
      assert.ok(
        typeof registrySettings.observers.tenureWeightDurationMs === 'number',
      );
      assert.ok(
        typeof registrySettings.operators.failedEpochCountMax === 'number',
      );
      assert.ok(
        typeof registrySettings.operators.failedGatewaySlashRate === 'number',
      );
      assert.ok(
        typeof registrySettings.operators.maxDelegateRewardSharePct ===
          'number',
      );
      assert.ok(typeof registrySettings.operators.leaveLengthMs === 'number');
      assert.ok(typeof registrySettings.operators.minStake === 'number');
      assert.ok(
        typeof registrySettings.operators.withdrawLengthMs === 'number',
      );
    });

    it('should be able to get the first page of eligible distributions', async () => {
      const eligibleDistributions = await ario.getEligibleEpochRewards();
      assert.ok(eligibleDistributions);
      assert.equal(eligibleDistributions.limit, 100);
      assert.equal(eligibleDistributions.sortOrder, 'desc');
      assert.equal(eligibleDistributions.sortBy, 'cursorId');
      assert.equal(typeof eligibleDistributions.totalItems, 'number');
      assert.equal(typeof eligibleDistributions.sortBy, 'string');
      assert.equal(typeof eligibleDistributions.sortOrder, 'string');
      assert.equal(typeof eligibleDistributions.limit, 'number');
      assert.equal(typeof eligibleDistributions.hasMore, 'boolean');
      if (eligibleDistributions.nextCursor) {
        assert.equal(typeof eligibleDistributions.nextCursor, 'string');
      }
      assert(Array.isArray(eligibleDistributions.items));

      eligibleDistributions.items.forEach(
        ({ type, recipient, eligibleReward, gatewayAddress, cursorId }) => {
          assert(['operatorReward', 'delegateReward'].includes(type));
          assert.equal(typeof recipient, 'string');
          assert.equal(typeof eligibleReward, 'number');
          assert.equal(typeof gatewayAddress, 'string');
          assert.equal(typeof cursorId, 'string');
        },
      );
    });

    describe('faucet', async () => {
      let testnet: ARIOWithFaucet<AoARIORead>;

      before(async () => {
        // setup our testnet instance to use local APIs
        testnet = ARIO.testnet({
          faucetUrl: 'http://localhost:3000',
          process: new AOProcess({
            processId: ARIO_TESTNET_PROCESS_ID,
            ao: connect({
              CU_URL: 'http://localhost:6363',
            }),
          }),
        });
      });

      describe('existing APIs', () => {
        it('should be able to get info of the token', async () => {
          const info = await testnet.getInfo();
          assert.ok(info);
        });

        it('should be able to get the token supply', async () => {
          const supply = await testnet.getTokenSupply();
          assert.ok(supply);
        });
      });

      describe('captchaUrl()', () => {
        it('should return a captcha URL for a process', async () => {
          const request = await testnet.faucet.captchaUrl();
          assert.ok(request);
          assert.ok(request.captchaUrl);
          assert.ok(request.processId);
        });

        it('should throw an error if the process is not supported by the faucet', async () => {
          const fake = createFaucet({
            arioInstance: new ARIOReadable({
              process: new AOProcess({
                processId: 'some-non-supported-process-id',
                ao: aoClient,
              }),
            }),
            faucetApiUrl: 'http://localhost:3000',
          });
          await assert.rejects(
            async () => await fake.faucet.captchaUrl(),
            Error,
          );
        });
      });

      describe('requestAuthToken()', () => {
        it('should return a success status with a valid captcha response', async () => {
          const captchaResponse = 'test-captcha-response';
          const authToken = await testnet.faucet.requestAuthToken({
            captchaResponse,
          });
          assert.ok(authToken);
          assert.ok(authToken.status === 'success');
          assert.ok(authToken.token);
          assert.ok(authToken.expiresAt);
        });

        it('should throw an error if the captcha response is invalid', async () => {
          await assert.rejects(
            async () =>
              await testnet.faucet.requestAuthToken({ captchaResponse: '' }),
            Error,
          );
        });
      });

      describe('verifyAuthToken()', () => {
        it('should return true for a valid auth token', async () => {
          const authToken = await testnet.faucet.requestAuthToken({
            captchaResponse: 'test-captcha-response',
          });
          const valid = await testnet.faucet.verifyAuthToken({
            authToken: authToken.token,
          });
          assert.ok(valid);
          assert.ok(valid.valid);
          assert.ok(valid.expiresAt);
        });
      });

      describe('claimWithAuthToken()', () => {
        it('should throw an error if the auth token is invalid', async () => {
          await assert.rejects(
            async () =>
              await testnet.faucet.claimWithAuthToken({
                authToken: 'invalid-auth-token',
                recipient: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
                quantity: 1,
              }),
            Error,
          );
        });
        it('should throw an error if the recipient is invalid', async () => {
          await assert.rejects(
            async () =>
              await testnet.faucet.claimWithAuthToken({
                authToken: 'invalid-auth-token',
                recipient: '',
                quantity: 1,
              }),
            Error,
          );
        });

        it('should throw an error if the quantity is invalid', async () => {
          await assert.rejects(
            async () =>
              await testnet.faucet.claimWithAuthToken({
                authToken: 'invalid-auth-token',
                recipient: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
                quantity: -1,
              }),
            Error,
          );
        });

        it('should throw an error if the quantity is not a number', async () => {
          await assert.rejects(
            async () =>
              await testnet.faucet.claimWithAuthToken({
                authToken: 'invalid-auth-token',
                recipient: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
                // @ts-expect-error - we are testing an error
                quantity: 'not-a-number',
              }),
            Error,
          );
        });

        it('should throw an error if the faucet wallet does not have enough balance', async () => {
          const authToken = await testnet.faucet.requestAuthToken({
            captchaResponse: 'test-captcha-response',
          });
          await assert.rejects(
            async () =>
              await testnet.faucet.claimWithAuthToken({
                authToken: authToken.token,
                recipient: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
                quantity: 1,
              }),
            Error,
          );
        });

        // TODO: additional tests that actually claim tokens with a local ARIO process
      });
    });
  });

  describe('ANTRegistry', async () => {
    const registry = ANTRegistry.init({
      process: new AOProcess({
        processId: ANT_REGISTRY_ID,
        // ao: aoClient,
      }),
    });
    const address = '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk';

    it('should retrieve ids from registry', async () => {
      const affiliatedAnts = await registry.accessControlList({ address });
      assert(Array.isArray(affiliatedAnts.Owned));
      assert(Array.isArray(affiliatedAnts.Controlled));
    });

    it('should be able to create AoANTRegistryWriteable with valid signers', async () => {
      for (const signer of signers) {
        const registry = ANTRegistry.init({
          signer,
          process: new AOProcess({
            processId: ANT_REGISTRY_ID,
            // ao: aoClient,
          }),
        });
        assert(registry instanceof AoANTRegistryWriteable);
      }
    });
  });

  describe('ANTVersions', async () => {
    const antVersions = ANTVersions.init({
      process: new AOProcess({
        processId: ANT_REGISTRY_ID,
        // ao: aoClient,
      }),
    });

    it('should get ANT versions', async () => {
      const versions = await antVersions.getANTVersions();
      assert(versions, 'Failed to get ANT versions');
    });

    it('should get latest ANT version', async () => {
      const version = await antVersions.getLatestANTVersion();
      assert(version, 'Failed to get ANT versions');
    });
  });

  describe('ANT', async () => {
    // ANT v7 process id
    const processId = 'YcxE5IbqZYK72H64ELoysxiJ-0wb36deYPv55wgl8xo';
    const ant = ANT.init({
      process: new AOProcess({
        processId,
        ao: aoClient,
      }),
    });

    describe('AoANTReadable', () => {
      it('should be able to create an ANT with just a processId', async () => {
        const ant = ANT.init({
          processId,
        });
        assert(ant instanceof AoANTReadable);
      });

      it('should be able to create an ANT with a processId and strict', async () => {
        const ant = ANT.init({
          processId,
          strict: true,
        });
        assert(ant instanceof AoANTReadable);
      });

      it('should be able to get ANT info', async () => {
        const info = await ant.getInfo();
        assert.ok(info);
      });

      it('should be able to get the ANT records', async () => {
        const records = await ant.getRecords();
        assert.ok(records);
        for (const record of Object.values(records)) {
          assert(typeof record.transactionId === 'string');
          assert(typeof record.ttlSeconds === 'number');
          assert(typeof record.index === 'number');
          if (record.priority) {
            assert(typeof record.priority === 'number');
          }
        }
      });

      it('should be able to get a @ record from the ANT', async () => {
        const record = await ant.getRecord({ undername: '@' });
        assert.ok(record);
      });

      it('should be able to get the ANT owner', async () => {
        const owner = await ant.getOwner();
        assert.ok(owner);
      });

      it('should be able to get the ANT name', async () => {
        const name = await ant.getName();
        assert.ok(name);
      });

      it('should be able to get the ANT ticker', async () => {
        const ticker = await ant.getTicker();
        assert.ok(ticker);
      });

      it('should be able to get the ANT controllers', async () => {
        const controllers = await ant.getControllers();
        assert.ok(controllers);
      });

      it('should be able to get the ANT state', async () => {
        const state = await ant.getState();
        assert.ok(state);
      });

      it('should be able to get the ANT logo', async () => {
        const logo = await ant.getLogo();
        assert.ok(logo);
        assert.equal(typeof logo, 'string');
      });

      it('should be able to get the ANT balance for an address', async () => {
        const balance = await ant.getBalance({
          address: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
        });
        assert.notEqual(balance, undefined);
      });

      it('should be able to get the ANT balances', async () => {
        const balances = await ant.getBalances();
        assert.ok(balances);
      });
    });

    describe('AoANTWriteable', () => {
      for (const signer of signers) {
        it(`should be able to create ANTWriteable with valid signer ${signer.constructor.name}`, async () => {
          const ant = ANT.init({
            process: new AOProcess({
              processId,
              ao: aoClient,
            }),
            signer,
          });

          assert(ant instanceof AoANTWriteable);
        });

        it(`should be able to create ANTWriteable with valid signer ${signer.constructor.name} and strict`, async () => {
          const ant = ANT.init({
            processId,
            signer,
            strict: true,
          });
          assert(ant instanceof AoANTWriteable);
        });
      }
    });
  });
});
