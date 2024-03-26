import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import * as fs from 'fs';
import path from 'path';
import { ContractDeploy, Warp } from 'warp-contracts';

export async function deployANTContract({
  jwk,
  warp,
}: {
  jwk: JWKInterface;
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
  const owner = await warp.arweave.wallets.jwkToAddress(jwk);
  return await warp.deploy({
    wallet: jwk,
    src: src,
    initState: JSON.stringify({
      ...state,
      owner,
      controllers: [owner],
      balances: { [owner]: 1000000 },
    }),
  });
}

export async function deployArIOContract({
  jwk,
  warp,
}: {
  jwk: JWKInterface;
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
  const owner = await warp.arweave.wallets.jwkToAddress(jwk);
  return await warp.deploy({
    wallet: jwk,
    src: src,
    initState: JSON.stringify({
      ...state,
      owner,
      balances: { [owner]: 1 * 1_000_000 * 1_000_000 },
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
