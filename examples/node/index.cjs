const { ArIO } = require('../../lib/cjs/node');

(async () => {
  const arIO = new ArIO({});
  const testnetClient = arIO.testnet;
  const devnetClient = arIO.devnet;

  const testnetGateways = await testnetClient.getGateways();
  const devnetGateways = await devnetClient.getGateways();

  console.dir({ testnetGateways, devnetGateways }, { depth: 2 });
})();
