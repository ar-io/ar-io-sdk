const { IO, ioDevnetProcessId } = require('@ar.io/sdk');

(async () => {
  const arIO = IO.init();
  // testnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ioDevnetProcessId,
  });
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();
  const oldEpoch = await arIO.getEpoch({
    epochIndex: 0,
  });
  const epoch = await arIO.getCurrentEpoch();
  const observations = await arIO.getObservations();
  const observation = await arIO.getObservations({ epochIndex: 0 });
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