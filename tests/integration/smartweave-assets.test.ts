import { JWKInterface } from 'arweave/node/lib/wallet.js';

import {
  getContractsTransferredToOrControlledByWallet,
  getSmartweaveContractsFromGQL,
  getSmartweaveTransactionsFromGQL,
} from '../../src/utils/index.js';
import { arweave, warp } from '../constants.js';
import { deployANTContract } from '../utils.js';

describe('Smartweave Assets fetching', () => {
  let userAddress: string;
  let userWallet: JWKInterface = JSON.parse(process.env.PRIMARY_WALLET_JWK!);

  beforeAll(() => {
    userAddress = process.env.PRIMARY_WALLET_ADDRESS!;
  });

  it('should successfully get ANT contracts', async () => {
    const antAmount = 110; // over the gql page limit
    const txIds = await Promise.all(
      new Array(antAmount).map(async () => {
        const tx = await deployANTContract({
          jwk: userWallet,
          address: userAddress,
          warp,
        });
        return tx.contractTxId;
      }),
    );
    const res = await getSmartweaveContractsFromGQL({
      arweave,
      address: userAddress,
    }).then((contracts) => contracts.map((contract) => contract?.id));
    const deployedTxIdsWereReturned = txIds.every((txId) => res.includes(txId));
    expect(deployedTxIdsWereReturned).toBe(true);
  });

  it('should successfully get Smartweave Transactions From GQL', async () => {
    const res = await getSmartweaveTransactionsFromGQL({
      arweave,
      address: userAddress,
      contractTxId: process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!,
    }).then((transactions) =>
      transactions.map((transaction) => transaction?.id),
    );

    expect(res).toBeDefined();
  });

  it('should successfully get smartweave contracts where owner was recipient of transfer or a controller method', async () => {
    const res = await getContractsTransferredToOrControlledByWallet(arweave, {
      address: userAddress,
    }).then((transactions) =>
      transactions.map((transaction) => transaction.id),
    );

    expect(res.length).toBeDefined();
  });
});
