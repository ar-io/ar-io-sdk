import {
  ANTRegistry,
  ANT_REGISTRY_ID,
  AoANTRegistryRead,
  AoANTRegistryWrite,
  AoSigner,
  ArweaveSigner,
  createAoSigner,
  spawnANT,
} from '@ar.io/sdk';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { JWKInterface } from 'arbundles/node';
import Arweave from 'arweave';
import { describe, expect, it } from 'vitest';

import App from './App';

const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443,
});

describe('ESM browser validation', () => {
  let registry: AoANTRegistryWrite;
  let wallet: JWKInterface;
  let address: string;
  let signer: AoSigner;

  beforeAll(async () => {
    wallet = await arweave.wallets.generate();
    address = await arweave.wallets.jwkToAddress(wallet);
    const arbundlesSigner = await new ArweaveSigner(wallet);
    signer = await createAoSigner(arbundlesSigner);
    registry = ANTRegistry.init({
      signer: arbundlesSigner,
      processId: ANT_REGISTRY_ID,
    }) as AoANTRegistryWrite;
  });
  it('should load the app and SDK', async () => {
    await act(async () => render(<App />));

    await waitFor(
      () => {
        console.log('waiting for contract info to render...');
        screen.getByTestId('load-info-result');
      },
      {
        interval: 2000,
        timeout: 30000,
      },
    );

    const result = screen.getByTestId('load-info-result');
    // check the sdk loaded the data
    expect(result).toHaveTextContent('true');
  });

  it('should deploy and register a new ANT', async () => {
    const antId = await spawnANT({
      signer,
    });
    await registry.register({ processId: antId });
    // wait 5 seconds for the contract to be registered
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const antIdsRes = await registry.accessControlList({ address });
    const antIds = [...antIdsRes.Owned, ...antIdsRes.Controlled];
    expect(antIds).toContain(antId);
  });
});
