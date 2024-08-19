import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import * as fs from 'fs';
import path from 'path';

const oneYearSeconds = 60 * 60 * 24 * 365;

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
