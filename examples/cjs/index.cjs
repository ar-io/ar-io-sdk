const {
  IO,
  ioDevnetProcessId,
  Logger,
  spawnANT,
  evolveANT,
  ArweaveSigner,
} = require('@ar.io/sdk');
const Arweave = require('arweave');

(async () => {
  // set the log level for the SDK
  Logger.default.setLogLevel('info');

  const arIO = IO.init();
  // testnet gateways
  const testnetGateways = await arIO.getGateways();
  const protocolBalance = await arIO.getBalance({
    address: ioDevnetProcessId,
  });
  const ardriveRecord = await arIO.getArNSRecord({ name: 'ardrive' });
  const partialRecords = await arIO
    .getArNSRecords({
      page: 10,
      pageSize: 5,
    })
    .then((page) => page.items);
  const oldEpoch = await arIO.getEpoch({
    epochIndex: 0,
  });
  const epoch = await arIO.getCurrentEpoch();
  const observations = await arIO.getObservations();
  const observation = await arIO.getObservations({ epochIndex: 0 });
  const distributions = await arIO.getDistributions();

  const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });

  const jwk = await arweave.wallets.generate();

  const processId = await spawnANT({
    signer: new ArweaveSigner(jwk),
  });

  await evolveANT({
    processId,
    signer: new ArweaveSigner(jwk),
    luaCodeTxId: 'AN6-0jkvjhFkHYFqFsjH4R9MVGLuMaaFsD55JOXbAxQ',
  });

  console.dir(
    {
      processId,
      evolveId,
      // testnetGateways,
      // ardriveRecord,
      // protocolBalance,
      // arnsStats: {
      //   'registered domains': Object.keys(allRecords).length,
      //   ardrive: allRecords.ardrive,
      // },
      // oldEpoch,
      // epoch,
      // observations,
      // observation,
      // distributions,
    },
    { depth: 2 },
  );
})();
