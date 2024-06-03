import { IO, ioDevnetProcessId } from '@ar.io/sdk';

(async () => {
  const arIO = IO.init({
    processId: 'GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc',
  });
  // // testnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ioDevnetProcessId,
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
