import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import * as fs from 'fs';
import path from 'path';
import { ContractDeploy, SourceType, Warp } from 'warp-contracts';

import { WeightedObserver } from '../src/contract-state';

export async function deployANTContract({
  jwk,
  address,
  warp,
}: {
  jwk: JWKInterface;
  address: string;
  warp: Warp;
}): Promise<ContractDeploy> {
  const src = fs.readFileSync(
    path.join(__dirname, '/integration/arlocal/ant-contract/index.js'),
    'utf8',
  );
  const state = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '/integration/arlocal/ant-contract/initial-state.json',
      ),
      'utf8',
    ),
  );
  return await warp.deploy({
    wallet: jwk,
    src: src,
    initState: JSON.stringify({
      ...state,
      owner: address,
      controllers: [address],
      balances: { [address]: 1000000 },
    }),
    evaluationManifest: {
      evaluationOptions: {
        sourceType: SourceType.ARWEAVE,
      },
    },
  });
}

export async function deployArIOContract({
  jwk,
  address,
  warp,
}: {
  jwk: JWKInterface;
  address: string;
  warp: Warp;
}): Promise<ContractDeploy> {
  const src = fs.readFileSync(
    path.join(__dirname, '/integration/arlocal/ar-io-contract/index.js'),
    'utf8',
  );
  const state = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '/integration/arlocal/ar-io-contract/initial-state.json',
      ),
      'utf8',
    ),
  );

  // add the wallet owner as a prescribed observer and as a gateway
  const prescribedObservers: WeightedObserver[] =
    state.prescribedObservers['0'];
  const lastObserver: WeightedObserver =
    prescribedObservers.pop() as WeightedObserver;
  const newPrescribedObserver: WeightedObserver = {
    ...lastObserver,
    gatewayAddress: address,
    observerAddress: address,
  };
  const updatedPrescribedObservers = [
    ...prescribedObservers,
    newPrescribedObserver,
  ];
  return await warp.deploy({
    wallet: jwk,
    src: src,
    initState: JSON.stringify({
      ...state,
      owner: address,
      balances: { [address]: 100_000_000_000_000 },
      prescribedObservers: {
        0: updatedPrescribedObservers,
      },
    }),
    evaluationManifest: {
      evaluationOptions: {
        sourceType: SourceType.ARWEAVE,
      },
    },
  });
}

export async function createLocalWallet(
  arweave: Arweave,
  amount = 10_000_000_000_000,
): Promise<{ wallet: JWKInterface; address: string }> {
  // ~~ Generate wallet and add funds ~~
  const wallet = await arweave.wallets.generate();
  const address = await arweave.wallets.jwkToAddress(wallet);
  // mint some tokens
  await arweave.api.get(`/mint/${address}/${amount}`);

  const walletDir = path.join(__dirname, './wallets');
  const walletPath = path.join(walletDir, `${address}.json`);
  // save it to local directory
  if (!fs.existsSync(walletPath)) {
    fs.writeFileSync(walletPath, JSON.stringify(wallet));
  }

  return {
    wallet,
    address,
  };
}

export function removeDirectories() {
  ['./wallets', './contracts'].forEach((dir) => {
    const dirPath = path.join(__dirname, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true });
    }
  });
}

export function createDirectories() {
  ['./wallets', './contracts'].forEach((dir) => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  });
}

export function mineBlocks({
  arweave,
  blocks = 1,
}: {
  arweave: Arweave;
  blocks?: number;
}) {
  return arweave.api.get('/mine/' + blocks);
}
