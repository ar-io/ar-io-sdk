import { ANTReadable } from '@ar.io/sdk';

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

  // io ant
  const ant = new ANTReadable({
    processId: 'LOhNBTsqTBWZYCCVp_6PqnYjlG_tKCrM1BhZZJxtQYI',
  });
  const antBalance = await ant.getBalance({
    address: 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo',
  });
  const antRecords = await ant.getRecords();
  const rootRecord = await ant.getRecord({ name: '@' });
  const owner = await ant.getOwner();
  const controllers = await ant.getControllers();
  const info = await ant.getInfo();
  console.dir(
    {
      antBalance,
      antRecords,
      rootRecord,
      controllers,
      info,
      owner,
    },
    { depth: 2 },
  );
})();
