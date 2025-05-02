import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { RandomGatewayRouter } from './random.js';

describe('RandomRouter', () => {
  const mockGateways: URL[] = [
    new URL('https://gateway1.net'),
    new URL('https://gateway2.net'),
    new URL('https://gateway3.net'),
  ];

  const mockGatewaysProvider = {
    getGateways: async () => mockGateways,
  };

  it('should only return joined gateways', async () => {
    const router = new RandomGatewayRouter({
      gatewaysProvider: mockGatewaysProvider,
    });

    // random gateway should be one of the mock gateways
    for (let i = 0; i < 10; i++) {
      const result = await router.getTargetGateway();
      assert.ok(mockGateways.includes(result));
    }
  });
});
