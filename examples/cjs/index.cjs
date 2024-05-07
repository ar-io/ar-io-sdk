const { defaultArweave } = require('../../lib/cjs/common/arweave');
const { ARNS_TESTNET_REGISTRY_TX, ArIO } = require('../../lib/cjs/node/index');

(async () => {
  const arIO = ArIO.init({
    contractTxId: ARNS_TESTNET_REGISTRY_TX,
  });

  const currentBlock = await defaultArweave.network
    .getInfo()
    .then((info) => info.height);
  const targetProtocolBalance = 1_000_000_000;
  let protocolBalance = 0;
  while (protocolBalance < targetProtocolBalance) {
    for (let i = currentBlock; true; i = i - 1) {
      async function update() {
        protocolBalance = await arIO
          .getTotalTokenSupply({
            evaluationOptions: { evalTo: { blockHeight: i } },
          })
          .then((b) => {
            if (!b) throw new Error('No balance');
            return b;
          })
          .catch(async () => {
            console.log(
              `Error getting protocol balance at blockheight ${i} - waiting 10 seconds and retrying...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            await update();
          });
      }
      await update();

      console.log(`Protocol balance: ${protocolBalance} IO at block ${i}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // testnet gateways
  // const testnetGateways = await arIO.getGateways();
  // const protocolBalance = await arIO.getBalance({
  //   address: ARNS_TESTNET_REGISTRY_TX,
  // });
  // const tokenSupply = await arIO.getTotalTokenSupply();
  // const ardriveRecord = await arIO.getArNSRecord({ domain: 'ardrive' });
  // const allRecords = await arIO.getArNSRecords();
  // const oldEpoch = await arIO.getEpoch({
  //   blockHeight: 1382230,
  // });
  // const epoch = await arIO.getCurrentEpoch();
  // const observations = await arIO.getObservations();
  // const observation = await arIO.getObservations({ epochStartHeight: 1350700 });
  // const distributions = await arIO.getDistributions();

  // console.dir(
  //   {
  //     testnetGateways,
  //     ardriveRecord,
  //     protocolBalance,
  //     tokenSupply,
  //     arnsStats: {
  //       'registered domains': Object.keys(allRecords).length,
  //       ardrive: allRecords.ardrive,
  //     },
  //     oldEpoch,
  //     epoch,
  //     observations,
  //     observation,
  //     distributions,
  //   },
  //   { depth: 2 },
  // );
})();
