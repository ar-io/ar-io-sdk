import {
  ANT,
  ArweaveSigner,
  IO,
  ioDevnetProcessId,
  spawnANT,
} from '@ar.io/sdk';
import Arweave from 'arweave';

(async () => {
  const arIO = IO.init({
    processId: ioDevnetProcessId,
  });
  // devnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ioDevnetProcessId,
  });
  const contractInfo = await arIO.getInfo();
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();
  const epoch = await arIO.getCurrentEpoch();
  const currentObservations = await arIO.getObservations();
  const observations = await arIO.getObservations({ epochIndex: 19879 });
  const distributions = await arIO.getDistributions({ epochIndex: 19879 });
  const buyRecordCost = await arIO.getTokenCost({
    intent: 'Buy-Record',
    purchaseType: 'lease',
    name: 'adriaaaaan',
    years: 1,
  });
  const extendLeaseCost = await arIO.getTokenCost({
    intent: 'Extend-Lease',
    name: 'ardrive',
    years: 1,
  });
  const increaseUndernameCost = await arIO.getTokenCost({
    intent: 'Increase-Undername-Limit',
    name: 'vilenario',
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
      names: Object.keys(allRecords),
      buyRecordCost,
      extendLeaseCost,
      increaseUndernameCost,
    },
    { depth: 2 },
  );

  // io ant
  const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });

  const jwk = await arweave.wallets.generate();

  const processId = await spawnANT({
    signer: new ArweaveSigner(jwk),
  });

  const ant = ANT.init({
    processId,
  });
  const antRecords = await ant.getRecords();
  const rootRecord = await ant.getRecord({ undername: '@' });
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

  // fetching ants owned by a wallet using an event emitter
  const address = 'ZjmB2vEUlHlJ7-rgJkYP09N5IzLPhJyStVrK5u9dDEo';
  const processEmitter = new ArNSNameEmitter({ contract: arIO });
  processEmitter.on('error', (e) => {
    console.error(e);
  });
  processEmitter.on('process', (processId, antState) =>
    console.log(
      `Discovered process owned by wallet called "${antState.names}": `,
      processId,
    ),
  );
  processEmitter.on('end', (res) => {
    console.log(
      'Complete',
      `${Object.keys(res).length} ids checked with ${antsInError} ants in error.`,
    );
  });

  // kick off the retrieval of ants owned by a process
  processEmitter.fetchProcessesOwnedByWallet({ address });
})();
