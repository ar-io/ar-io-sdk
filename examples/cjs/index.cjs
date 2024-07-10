const {
  IO,
  ioDevnetProcessId,
  Logger,
  spawnANT,
  evolveANT,
  ArweaveSigner,
  ANT_LUA_ID,
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
  const allRecords = await arIO.getArNSRecords();
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
    luaCodeTxId: '40ehDFzeiOjirz2V7R7mn33D3W97-j_nOJ3pc4b2JXs',
  });

  console.dir(
    {
      processId,
      evolveId,
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
