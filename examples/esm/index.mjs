import { ANT, IO, ioDevnetProcessId } from '@ar.io/sdk';

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
  const ant = ANT.init({
    processId: 'LGN8MUAMvTvr6i-WGdXBu1z9jz01LZVnVwklp9z7D6U',
  });
  const antRecords = await ant.getRecords();
  const rootRecord = await ant.getRecord({ name: '@' });
  const owner = await ant.getOwner();
  const controllers = await ant.getControllers();
  const info = await ant.getInfo();
  console.dir(
    {
      antRecords,
      rootRecord,
      controllers,
      info,
      owner,
    },
    { depth: 2 },
  );
})();
