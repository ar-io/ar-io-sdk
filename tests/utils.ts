import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import * as fs from 'fs';
import path from 'path';
import { ContractDeploy, Warp } from 'warp-contracts';

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
  return await warp.deploy({
    wallet: jwk,
    src: src,
    initState: JSON.stringify({
      ...state,
      owner: address,
      balances: { [address]: 100_000_000_000_000 },
    }),
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
  const walletBalance = await arweave.wallets.getBalance(address);
  console.log(`Wallet balance: ${walletBalance}`);
  // save it to local directory
  if (!fs.existsSync(path.join(__dirname, `./wallets/${address}.json`))) {
    fs.writeFileSync(
      path.join(__dirname, `./wallets/${address}.json`),
      JSON.stringify(wallet),
    );
  }

  return {
    wallet,
    address,
  };
}

export function removeDirectories() {
  ['./wallets', './contracts'].forEach((dir) => {
    if (fs.existsSync(path.join(__dirname, dir))) {
      fs.rmSync(path.join(__dirname, dir), { recursive: true });
    }
  });
}

export function createDirectories() {
  ['./wallets', './contracts'].forEach((dir) => {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      fs.mkdirSync(path.join(__dirname, dir));
    }
  });
}
