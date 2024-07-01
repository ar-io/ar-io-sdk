const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
/**
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */
const { IO, ioDevnetProcessId } = require('@ar.io/sdk');

const io = IO.init({
  processId: ioDevnetProcessId,
});
describe('IO', async () => {
  it('should be able to get the process information', async () => {
    const epoch = await io.getInfo();
    assert.ok(epoch);
  });

  it('should be able to get arns records', async () => {
    const arns = await io.getArNSRecords();
    assert.ok(arns);
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

  it('should be able to get gateways', async () => {
    const gateways = await io.getGateways();
    assert.ok(gateways);
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
