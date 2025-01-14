/**
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */
import {
  ANT,
  ANTRegistry,
  ANT_REGISTRY_ID,
  AOProcess,
  ARIO,
  ARIOWriteable,
  ARIO_TESTNET_PROCESS_ID,
  AoANTRegistryWriteable,
  AoANTWriteable,
  ArweaveSigner,
  arioDevnetProcessId,
  createAoSigner,
} from '@ar.io/sdk';
import { connect } from '@permaweb/aoconnect';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { DockerComposeEnvironment, Wait } from 'testcontainers';

const projectRootPath = process.cwd();
const testWalletJSON = fs.readFileSync('../test-wallet.json', {
  encoding: 'utf-8',
});

const testWallet = JSON.parse(testWalletJSON);
const signers = [
  new ArweaveSigner(testWallet),
  createAoSigner(new ArweaveSigner(testWallet)),
];

const aoClient = connect({
  CU_URL: 'http://localhost:6363',
});

const processId = process.env.ARIO_PROCESS_ID || arioDevnetProcessId;
const ario = ARIO.init({
  process: new AOProcess({
    processId,
    ao: aoClient,
  }),
});

// epochs with known distribution data notices
const epochIndex = processId === ARIO_TESTNET_PROCESS_ID ? 189 : 200;

describe('e2e esm tests', async () => {
  let compose;
  before(async () => {
    compose = await new DockerComposeEnvironment(
      projectRootPath,
      '../docker-compose.test.yml',
    )
      .withBuild()
      .withWaitStrategy('ao-cu-1', Wait.forHttp('/', 6363))
      .up(['ao-cu']);
  });

  after(async () => {
    await compose.down();
  });

  describe('ARIO', async () => {
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

    it('should be able to get the current epoch', async () => {
      const epoch = await ario.getCurrentEpoch();
      assert.ok(epoch);
    });

    it('should be able to get epoch-settings', async () => {
      const epochSettings = await ario.getEpochSettings();
      assert.ok(epochSettings);

      assert.equal(typeof epochSettings.maxObservers, 'number');
      assert.equal(typeof epochSettings.durationMs, 'number');
      assert.equal(typeof epochSettings.prescribedNameCount, 'number');
      assert.equal(typeof epochSettings.distributionDelayMs, 'number');
      assert.equal(typeof epochSettings.epochZeroTimestamp, 'number');
      assert.equal(typeof epochSettings.rewardPercentage, 'number');
      assert.equal(typeof epochSettings.epochZeroStartTimestamp, 'number');
      assert.equal(typeof epochSettings.pruneEpochsCount, 'number');
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
        typeof demandFactorSettings.demandFactorUpAdjustment,
        'number',
      );
      assert.equal(
        typeof demandFactorSettings.demandFactorDownAdjustment,
        'number',
      );
      assert.equal(typeof demandFactorSettings.stepDownThreshold, 'number');
      assert.equal(typeof demandFactorSettings.criteria, 'string');
    });

    it('should be able to get reserved names', async () => {
      const reservedNames = await ario.getArNSReservedNames();
      assert.ok(reservedNames);
    });

    // TODO: fix this test
    it.skip('should be able to get a single reserved name', async () => {
      const reservedNames = await ario.getArNSReservedName({ name: 'www ' });
      assert.ok(reservedNames);
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
        assert(typeof gateway.weights.observerRewardRatioWeight === 'number');
        assert(typeof gateway.weights.gatewayRewardRatioWeight === 'number');
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
        assert(typeof gateway.weights.observerRewardRatioWeight === 'number');
        assert(typeof gateway.weights.gatewayRewardRatioWeight === 'number');
      });
    });

    it('should be able to get a single gateway', async () => {
      const gateway = await ario.getGateway({
        address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
      });
      assert.ok(gateway);
    });

    it('should be able to get gateway delegates', async () => {
      const delegates = await ario.getGatewayDelegates({
        address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
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
      const allowedDelegates = await ario.getAllowedDelegates({
        address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
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

    it('should be able to get gateway vaults', async () => {
      const vaults = await ario.getGatewayVaults({
        address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
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

    it('should be able to get gateway delegate allow list', async () => {
      const allowList = await ario.getGatewayDelegateAllowList({
        address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
        limit: 1,
        sortBy: 'startTimestamp',
        sortOrder: 'desc',
      });
      assert.ok(allowList);
      // note: sortBy is omitted because it's not supported for by this contract handler, the result is an array of addresses
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
        assert(typeof wallet.balance === 'number');
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
        assert(typeof observer.gatewayRewardRatioWeight === 'number');
        assert(typeof observer.observerRewardRatioWeight === 'number');
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

    it('should be able to get token cost for buying a name using `Buy-Name` intent', async () => {
      const tokenCost = await ario.getTokenCost({
        intent: 'Buy-Record',
        name: 'new-name',
        type: 'permabuy',
      });
      assert.ok(tokenCost);
      assert.ok(typeof tokenCost === 'number');
      assert(tokenCost > 0);
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

    it('should be able to support `Buy-Record` intent for cost details', async () => {
      const costDetails = await ario.getCostDetails({
        intent: 'Buy-Record',
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
        intent: 'Buy-Record',
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
      const distributions = await ario.getDistributions({ epochIndex });
      assert.ok(distributions);
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
      const observations = await ario.getObservations({ epochIndex });
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

    // TODO: Make a vault within this test environment's context to cover this
    // it('should be able to get a specific vault', async () => {
    //   const vault = await ario.getVault({
    //     address: '31LPFYoow2G7j-eSSsrIh8OlNaARZ84-80J-8ba68d8',
    //     vaultId: 'Dmsrp1YIYUY5hA13euO-pAGbT1QPazfj1bKD9EpiZeo',
    //   });
    //   assert.deepEqual(vault, {
    //     balance: 1,
    //     startTimestamp: 1729962428678,
    //     endTimestamp: 1731172028678,
    //   });
    // });

    it('should throw an error when unable to get a specific vault', async () => {
      const error = await ario
        .getVault({
          address: '31LPFYoow2G7j-eSSsrIh8OlNaARZ84-80J-8ba68d8',
          vaultId: 'Dmsrp1YIYUY5hA13euO-pAGbT1QPazfj1bKD9EpiZeo',
        })
        .catch((e) => e);
      assert.ok(error);
      assert(error instanceof Error);
      // assert(error.message.includes('Vault-Not-Found'));
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
      const primaryName = await ario.getPrimaryName({
        address: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
      });
      assert.ok(primaryName);
      assert.deepStrictEqual(primaryName, {
        owner: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
        name: 'arns',
        startTimestamp: 1719356032297,
        processId: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
      });
    });

    it('should be able to get a specific primary name by name', async () => {
      const primaryName = await ario.getPrimaryName({
        name: 'arns',
      });
      assert.ok(primaryName);
      assert.deepStrictEqual(primaryName, {
        owner: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
        name: 'arns',
        startTimestamp: 1719356032297,
        processId: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
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
      assert.ok(typeof registrySettings.observers.maxPerEpoch === 'number');
      assert.ok(typeof registrySettings.observers.maxTenureWeight === 'number');
      assert.ok(
        typeof registrySettings.observers.tenureWeightDays === 'number',
      );
      assert.ok(
        typeof registrySettings.observers.tenureWeightPeriod === 'number',
      );
      assert.ok(
        typeof registrySettings.operators.failedEpochCountMax === 'number',
      );
      assert.ok(
        typeof registrySettings.operators.failedEpochSlashRate === 'number',
      );
      assert.ok(typeof registrySettings.operators.leaveLengthMs === 'number');
      assert.ok(typeof registrySettings.operators.minStake === 'number');
      assert.ok(
        typeof registrySettings.operators.withdrawLengthMs === 'number',
      );
    });
  });

  describe('ANTRegistry', async () => {
    const registry = ANTRegistry.init({
      process: new AOProcess({
        processId: ANT_REGISTRY_ID,
        ao: aoClient,
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
            ao: aoClient,
          }),
        });
        assert(registry instanceof AoANTRegistryWriteable);
      }
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

    it('should be able to create ANTWriteable with valid signers', async () => {
      for (const signer of signers) {
        const nonStrictAnt = ANT.init({
          process: new AOProcess({
            processId,
            ao: aoClient,
          }),
          signer,
        });
        const strictAnt = ANT.init({
          process: new AOProcess({
            processId,
            ao: aoClient,
          }),
          signer,
          strict: true,
        });

        assert(nonStrictAnt instanceof AoANTWriteable);
        assert(strictAnt instanceof AoANTWriteable);
      }
    });

    it('should be able to get ANT info', async () => {
      const info = await ant.getInfo();
      assert.ok(info);
    });

    it('should be able to get the ANT records', async () => {
      const records = await ant.getRecords();
      assert.ok(records);
      // TODO: check enforcement of alphabetical order with '@' first
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
});
