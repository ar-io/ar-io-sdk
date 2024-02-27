const {
  ArIO,
  ARNS_TESTNET_REGISTRY_TX,
} = require('../../lib/cjs/node/index.js');

(async () => {
  const arIO = new ArIO({});
  // testnet gateways
  const testnetGateways = await arIO.testnet.getGateways();
  const protocolBalance = await arIO.testnet.getBalance({
    address: ARNS_TESTNET_REGISTRY_TX,
  });
  const ardriveRecord = await arIO.testnet.getRecord({ domain: 'ardrive' });
  const allRecords = await arIO.testnet.getRecords();

  console.dir(
    {
      testnetGateways,
      ardriveRecord,
      protocolBalance,
      arnsStats: {
        'registered domains': Object.keys(allRecords).length,
        ardrive: allRecords.ardrive,
      },
    },
    { depth: 2 },
  );
})();
