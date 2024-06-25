import {
  ANT,
  ANT_LUA_ID,
  AOS_MODULE_ID,
  ArNSResolver,
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
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const allRecords = await arIO.getArNSRecords();
  const epoch = await arIO.getCurrentEpoch();
  const observations = await arIO.getObservations({ epochIndex: 19879 });
  const distributions = await arIO.getDistributions({ epochIndex: 19879 });
  const buyRecordCost = await arIO.getTokenCost({
    intent: 'BuyRecord',
    purchaseType: 'lease',
    name: 'adriaaaaan',
    years: 1,
  });
  const extendLeaseCost = await arIO.getTokenCost({
    intent: 'ExtendLease',
    name: 'ardrive',
    years: 1,
  });
  const increaseUndernameCost = await arIO.getTokenCost({
    intent: 'IncreaseUndernameLimit',
    name: 'vilenario',
    quantity: 1,
  });

  console.dir(
    {
      testnetGateways,
      ardriveRecord,
      epoch,
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

  const resolver = new ArNSResolver({
    processId: 'GUZmltlen5c4KDsE9V82s8LGm-0R8ldCbk4w2pq4vSs',
  });

  const resolvedRecords = await resolver.getACL(
    '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
  );

  console.dir(resolvedRecords, { depth: 2 });

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
})();
