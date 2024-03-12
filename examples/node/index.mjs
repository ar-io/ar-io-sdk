import { ARNS_TESTNET_REGISTRY_TX, ArIO } from '../../lib/esm/node/index.js';

(async () => {
  const arIO = new ArIO();
  // testnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ARNS_TESTNET_REGISTRY_TX,
  });
  const ardriveRecord = await arIO.getArNSRecord({ domain: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();

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
