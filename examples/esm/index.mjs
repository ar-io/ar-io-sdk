import {
  ANT,
  IO,
  IO_TESTNET_PROCESS_ID,
  getANTProcessesOwnedByWallet,
} from '@ar.io/sdk';

(async () => {
  const arIO = IO.init();
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: IO_TESTNET_PROCESS_ID,
  });
  const contractInfo = await arIO.getInfo();
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const partialRecords = await arIO.getArNSRecords();
  const epoch = await arIO.getCurrentEpoch();
  const currentObservations = await arIO.getObservations();
  const observations = await arIO.getObservations({ epochIndex: 0 });
  const distributions = await arIO.getDistributions({ epochIndex: 0 });
  const buyRecordCost = await arIO.getTokenCost({
    intent: 'Buy-Record',
    type: 'lease',
    name: 'ar-io-dapp-record',
    years: 1,
  });
  const extendLeaseCost = await arIO.getTokenCost({
    intent: 'Extend-Lease',
    name: 'ardrive',
    years: 1,
  });
  const increaseUndernameCost = await arIO.getTokenCost({
    intent: 'Increase-Undername-Limit',
    name: 'ao',
    quantity: 1,
  });

  console.dir(
    {
      contractInfo,
      testnetGateways,
      ardriveRecord,
      epoch,
      currentObservations,
      observations,
      distributions,
      protocolBalance,
      records: partialRecords.items,
      buyRecordCost,
      extendLeaseCost,
      increaseUndernameCost,
    },
    { depth: 2 },
  );

  // fetching ants owned by a wallet using an event emitter
  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const affiliatedAnts = await getANTProcessesOwnedByWallet({
    address,
  });
  const ant = ANT.init({
    processId: affiliatedAnts[0],
  });
  const antRecords = await ant.getRecords();
  const rootRecord = await ant.getRecord({ undername: '@' });
  const owner = await ant.getOwner();
  const controllers = await ant.getControllers();
  const info = await ant.getInfo();
  console.dir(
    {
      affiliatedAnts,
      antProcessId: affiliatedAnts[0],
      antRecords,
      rootRecord,
      controllers,
      info,
      owner,
    },
    { depth: 2 },
  );
})();
