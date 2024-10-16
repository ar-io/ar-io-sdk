import {
  ANT,
  ANTRegistry,
  AOProcess,
  AoANTRegistryWriteable,
  AoANTWriteable,
  ArweaveSigner,
  IO,
  IOWriteable,
  createAoSigner,
  ioDevnetProcessId,
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

/**
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */

const io = IO.init({
  process: new AOProcess({
    processId: ioDevnetProcessId,
    ao: connect({
      CU_URL: 'http://localhost:6363',
    }),
  }),
});

describe('IO', async () => {
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

  it('should be able to get the process information', async () => {
    const info = await io.getInfo();
    assert.ok(info);
    assert(typeof info.Name === 'string');
    assert(typeof info.Ticker === 'string');
    assert(typeof info.Logo === 'string');
    assert(typeof info.Denomination === 'number');
    assert(Array.isArray(info.Handlers));
    assert(typeof info.LastTickedEpochIndex === 'number');
  });

  it('should be able to get the total token supply', async () => {
    const tokenSupply = await io.getTokenSupply();
    assert.ok(tokenSupply);
  });

  it('should be able to get first set of arns records', async () => {
    const records = await io.getArNSRecords();
    assert.ok(records);
    assert(records.limit === 100);
    assert(records.sortOrder === 'desc');
    assert(records.sortBy === 'startTimestamp');
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

  it('should be able to return a specific page of arns records', async () => {
    const records = await io.getArNSRecords({
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
    const arns = await io.getArNSRecord({ name: 'ardrive' });
    assert.ok(arns);
  });

  it('should be able to get the current epoch', async () => {
    const epoch = await io.getCurrentEpoch();
    assert.ok(epoch);
  });

  it('should be able to get epoch-settings', async () => {
    const epochSettings = await io.getEpochSettings();
    assert.ok(epochSettings);
  });

  it('should be able to get reserved names', async () => {
    const reservedNames = await io.getArNSReservedNames();
    assert.ok(reservedNames);
  });

  it('should be able to get a single reserved name', async () => {
    const reservedNames = await io.getArNSReservedNames({ name: 'www ' });
    assert.ok(reservedNames);
  });

  it('should be able to get first page of gateways', async () => {
    const gateways = await io.getGateways();
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
    const gateways = await io.getGateways({
      cursor: 1000000,
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
    const gateways = await io.getGateway({
      address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
    });
    assert.ok(gateways);
  });

  it('should be able to get balances, defaulting to first page', async () => {
    const balances = await io.getBalances();
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
      assert(typeof gateways.nextCursor === 'string');
    }
    assert(Array.isArray(balances.items));
    balances.items.forEach((wallet) => {
      assert(typeof wallet.address === 'string');
      assert(typeof wallet.balance === 'number');
    });
  });

  it('should be able to get balances of a specific to first page', async () => {
    const balances = await io.getBalances({
      cursor: 1000000,
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
    const balances = await io.getBalance({
      address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
    });
    assert.ok(balances);
  });

  it('should be able to get prescribed names', async () => {
    const prescribedNames = await io.getPrescribedNames();
    assert.ok(prescribedNames);
  });

  it('should return the prescribed observers for a given epoch', async () => {
    const observers = await io.getPrescribedObservers();
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

  it('should be able to get token cost for leasing a name', async () => {
    const tokenCost = await io.getTokenCost({
      intent: 'Buy-Record',
      name: 'new-name',
      years: 1,
    });
    assert.ok(tokenCost);
  });

  it('should be able to get token cost for buying a name name', async () => {
    const tokenCost = await io.getTokenCost({
      intent: 'Buy-Record',
      name: 'new-name',
      type: 'permabuy',
    });
    assert.ok(tokenCost);
  });

  it('should be able to get registration fees', async () => {
    const registrationFees = await io.getRegistrationFees();
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

  it('should be able to create IOWriteable with valid signers', async () => {
    for (const signer of signers) {
      const io = IO.init({ signer });

      assert(io instanceof IOWriteable);
    }
  });
});

describe('ANTRegistry', async () => {
  const registry = ANTRegistry.init();
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
      });
      assert(registry instanceof AoANTRegistryWriteable);
    }
  });
});

describe('ANT', async () => {
  const processId = 'YcxE5IbqZYK72H64ELoysxiJ-0wb36deYPv55wgl8xo';
  const ant = ANT.init({
    processId,
    strict: true,
  });

  it('should be able to create ANTWriteable with valid signers', async () => {
    for (const signer of signers) {
      const writeable = ANT.init({
        processId,
        signer,
        strict: true,
      });

      assert(writeable instanceof AoANTWriteable);
    }
  });

  it('should be able to get ANT info', async () => {
    const info = await ant.getInfo({ processId });
    assert.ok(info);
  });

  it('should be able to get the ANT records', async () => {
    const records = await ant.getRecords({ processId });
    assert.ok(records);
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

  it('should be able to get the ANT balance for an address', async () => {
    const balance = await ant.getBalance({
      address: '"7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
    });
    assert.notEqual(balance, undefined);
  });

  it('should be able to get the ANT balances', async () => {
    const balances = await ant.getBalances();
    assert.ok(balances);
  });
});
