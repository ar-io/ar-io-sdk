const { ARIO, Logger, ARIO_MAINNET_PROCESS_ID } = require('@ar.io/sdk');

(async () => {
  // set the log level for the SDK
  Logger.default.setLogLevel('info');

  const arIO = ARIO.init();
  // testnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ARIO_MAINNET_PROCESS_ID,
  });
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const partialRecords = await arIO.getArNSRecords({
    page: 10,
    pageSize: 5,
  });
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
      partialRecords: partialRecords.items,
      protocolBalance,
      oldEpoch,
      epoch,
      observations,
      observation,
      distributions,
    },
    { depth: 2 },
  );
})();
