const {
  ArIO,
  ARNS_TESTNET_REGISTRY_TX,
} = require('../../lib/cjs/node/index.js');

(async () => {
  const arIO = new ArIO();
  // testnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ARNS_TESTNET_REGISTRY_TX,
  });
  const ardriveRecord = await arIO.getArNSRecord({ domain: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();
  const oldEpoch = await arIO.getEpoch({
    blockHeight: 1382230,
  });
  const epoch = await arIO.getCurrentEpoch();
  const observations = await arIO.getObservations();
  const observation = await arIO.getObservations({ epoch: 1350700 });
  const distributions = await arIO.getDistributions();

  console.dir(
    {
      testnetGateways,
      ardriveRecord,
      protocolBalance,
      arnsStats: {
        'registered domains': Object.keys(allRecords).length,
        ardrive: allRecords.ardrive,
      },
      oldEpoch,
      epoch,
      observations,
      observation,
      distributions,
    },
    { depth: 2 },
  );
})();
