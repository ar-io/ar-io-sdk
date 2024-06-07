import { IO, ioDevnetProcessId } from '@ar.io/sdk';

(async () => {
  const arIO = IO.init({
    processId: ioDevnetProcessId,
  });
  // devnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ioDevnetProcessId,
  });
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();
  const epoch = await arIO.getCurrentEpoch();
  const observations = await arIO.getObservations({ epochIndex: 19879 });
  const distributions = await arIO.getDistributions({ epochIndex: 19879 });
  console.dir(
    {
      testnetGateways,
      ardriveRecord,
      epoch,
      observations,
      distributions,
      protocolBalance,
      names: Object.keys(allRecords),
    },
    { depth: 2 },
  );
})();
