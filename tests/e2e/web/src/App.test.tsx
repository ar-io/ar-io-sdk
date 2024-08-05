import { ANTRegistry } from '@ar.io/sdk/web';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('ESM browser validation', () => {
  const registry = ANTRegistry.init();
  const address = '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk';

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

  it('should retrieve ids from registry', async () => {
    const affiliatedAnts = await registry.accessControlList({ address });

    expect(Array.isArray(affiliatedAnts.Owned)).toEqual(true);
    expect(Array.isArray(affiliatedAnts.Controlled)).toEqual(true);
  });
});
