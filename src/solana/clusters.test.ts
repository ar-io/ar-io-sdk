import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEVNET_ARIO_MINT,
  DEVNET_PROGRAM_IDS,
  DEVNET_RPC_URL,
  DEVNET_STAKE_TOKEN_ACCOUNT,
  DEVNET_TREASURY_TOKEN_ACCOUNT,
} from './clusters.js';

// Walk up from `start` until `devnet-config.json` is found; throws if
// it isn't found before the filesystem root. Lets the same test work
// from `<repo>/src/solana/` (public SDK) and from
// `<repo>/sdk/src/solana/` (contracts monorepo) without per-repo paths.
function findDevnetConfig(start: string): string {
  let dir = start;
  while (true) {
    const candidate = resolve(dir, 'devnet-config.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `devnet-config.json not found searching upward from ${start}`,
      );
    }
    dir = parent;
  }
}

// Drift guard. The SDK ships hard-coded devnet constants for ergonomic
// imports, but `devnet-config.json` at the repo root is canonical. If
// devnet is redeployed and only one of the two is updated, this test
// fails CI before the SDK can publish stale IDs.
describe('devnet cluster constants', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const configPath = findDevnetConfig(here);
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
    rpcUrl: string;
    mint: string;
    treasuryTokenAccount: string;
    stakeTokenAccount: string;
    programs: Record<string, string | null>;
  };

  it('matches devnet-config.json rpcUrl', () => {
    assert.equal(DEVNET_RPC_URL, config.rpcUrl);
  });

  it('matches devnet-config.json mint + token accounts', () => {
    assert.equal(DEVNET_ARIO_MINT, config.mint);
    assert.equal(DEVNET_TREASURY_TOKEN_ACCOUNT, config.treasuryTokenAccount);
    assert.equal(DEVNET_STAKE_TOKEN_ACCOUNT, config.stakeTokenAccount);
  });

  it('matches devnet-config.json program IDs', () => {
    assert.equal(DEVNET_PROGRAM_IDS.core, config.programs.ario_core);
    assert.equal(DEVNET_PROGRAM_IDS.gar, config.programs.ario_gar);
    assert.equal(DEVNET_PROGRAM_IDS.arns, config.programs.ario_arns);
    assert.equal(DEVNET_PROGRAM_IDS.ant, config.programs.ario_ant);
    assert.equal(DEVNET_PROGRAM_IDS.antEscrow, config.programs.ario_ant_escrow);
  });
});
