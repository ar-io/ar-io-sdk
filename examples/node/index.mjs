import { ArIO } from '../../lib/esm/node/index.js';

(async () => {
  const arIO = new ArIO({});
  // testnet gateways
  const testnetGateways = await arIO.testnet.getGateways();
  // mainnet gateways
  const devnetGateways = await arIO.devnet.getGateways();

  console.dir({ testnetGateways, devnetGateways }, { depth: 2 });
})();
