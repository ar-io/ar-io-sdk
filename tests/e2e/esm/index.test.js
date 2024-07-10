import { IO, ioDevnetProcessId } from '@ar.io/sdk';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

/**
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */

const io = IO.init({
  processId: ioDevnetProcessId,
});
describe('IO', async () => {
  it('should be able to get the process information', async () => {
    const epoch = await io.getInfo();
    assert.ok(epoch);
  });

  it('should be able to get first page of arns records', async () => {
    const records = await io.getArNSRecords();
    assert.ok(records);
    assert(records.page === 1);
    assert(records.pageSize === 100);
    assert(records.sortOrder === 'asc');
    assert(records.sortBy === 'name');
    assert(typeof records.hasNextPage === 'boolean');
    assert(typeof records.totalItems === 'number');
    assert(typeof records.totalPages === 'number');
    assert(typeof records.sortBy === 'string');
    assert(typeof records.sortOrder === 'string');
    assert(Array.isArray(records.items));
    // check the records
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
      page: 10,
      pageSize: 5,
      sortOrder: 'desc',
      sortBy: 'name',
    });
    assert.ok(records);
    assert(records.page === 10);
    assert(records.pageSize === 5);
    assert(records.sortOrder === 'desc');
    assert(records.sortBy === 'name');
    assert(Array.isArray(records.items));
    assert(typeof records.hasNextPage === 'boolean');
    assert(typeof records.totalItems === 'number');
    assert(typeof records.totalPages === 'number');
    assert(typeof records.sortBy === 'string');
    assert(Array.isArray(records.items));
    // check the records
    records.items.forEach((record) => {
      assert(typeof record.processId === 'string');
      assert(typeof record.name === 'string');
      assert(typeof record.startTimestamp === 'number');
      assert(['lease', 'permabuy'].includes(record.type));
      assert(typeof record.undernameLimit === 'number');
    });
  });

  it('should be able to get a single arns record', async () => {
    const arns = await io.getArNSRecords({ name: 'ao' });
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

  it('should be able to get the current prescribed observers', async () => {
    const observers = await io.getPrescribedObservers();
    assert.ok(observers);
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
    assert(gateways.page === 1);
    assert(gateways.pageSize === 100);
    assert(gateways.sortOrder === 'asc');
    assert(gateways.sortBy === 'gatewayAddress');
    assert(typeof gateways.hasNextPage === 'boolean');
    assert(typeof gateways.totalItems === 'number');
    assert(typeof gateways.totalPages === 'number');
    assert(typeof gateways.sortBy === 'string');
    assert(typeof gateways.sortOrder === 'string');
    assert(Array.isArray(gateways.items));
    // check the records
    gateways.items.forEach((gateway) => {
      assert(typeof gateway.gatewayAddress === 'string');
      assert(typeof gateway.observerAddress === 'string');
      assert(typeof gateway.startTimestamp === 'number');
      assert(typeof gateway.operatorStake === 'number');
      assert(typeof gateway.totalDelegatedStake === 'number');
    });
  });

  it('should be able to get a specific page of gateways', async () => {
    const gateways = await io.getGateways({
      page: 2,
      pageSize: 1,
      sortBy: 'operatorStake',
      sortOrder: 'desc',
    });
    assert.ok(gateways);
    assert(gateways.page === 2);
    assert(gateways.pageSize === 1);
    assert(gateways.sortOrder === 'desc');
    assert(gateways.sortBy === 'operatorStake');
    assert(typeof gateways.hasNextPage === 'boolean');
    assert(typeof gateways.totalItems === 'number');
    assert(typeof gateways.totalPages === 'number');
    assert(typeof gateways.sortBy === 'string');
    assert(typeof gateways.sortOrder === 'string');
    assert(Array.isArray(gateways.items));
    // check the gateways
    gateways.items.forEach((gateway) => {
      assert(typeof gateway.gatewayAddress === 'string');
      assert(typeof gateway.observerAddress === 'string');
      assert(typeof gateway.startTimestamp === 'number');
      assert(typeof gateway.operatorStake === 'number');
      assert(typeof gateway.totalDelegatedStake === 'number');
    });
  });

  it('should be able to get a single gateway', async () => {
    const gateways = await io.getGateways({
      address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
    });
    assert.ok(gateways);
  });

  it('should be able to get balances', async () => {
    const balances = await io.getBalances();
    assert.ok(balances);
  });

  it('should be able to get a single balance', async () => {
    const balances = await io.getBalances({
      address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
    });
    assert.ok(balances);
  });

  it('should be able to get prescribed names', async () => {
    const prescribedNames = await io.getPrescribedNames();
    assert.ok(prescribedNames);
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
});
