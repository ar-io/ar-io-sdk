import { arweave, warp } from '../constants';
import {
  createDirectories,
  createLocalWallet,
  deployANTContract,
  deployArIOContract,
} from '../utils';

// start arlocal
async function jestGlobalSetup() {
  console.log('Setting up Warp, Arlocal and Arweave clients!');
  // create directories used for tests

  createDirectories();

  // create a wallet and add some funds
  const { wallet, address } = await createLocalWallet(arweave);

  // Used in tests
  process.env.PRIMARY_WALLET_ADDRESS = address;
  process.env.PRIMARY_WALLET_JWK = JSON.stringify(wallet);

  // deploy example any contract
  const [arIOContractDeploy, antContractDeploy] = await Promise.all([
    deployArIOContract({ jwk: wallet, warp }),
    deployANTContract({ jwk: wallet, warp }),
  ]);

  // set in the environment
  process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID =
    arIOContractDeploy.contractTxId;
  process.env.DEPLOYED_ANT_CONTRACT_TX_ID = antContractDeploy.contractTxId;
}

module.exports = jestGlobalSetup;
