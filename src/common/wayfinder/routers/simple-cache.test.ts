import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { SimpleCacheRouter } from './simple-cache.js';

describe('SimpleCacheRouter', () => {
  it('should cache gateway for TTL period even if underlying gateway changes', async () => {
    const gateway1 = new URL('https://gateway1.net');
    const gateway2 = new URL('https://gateway2.net');

    let currentGateway = gateway1;

    const mockRouter = {
      name: 'mock',
      getTargetGateway: async () => currentGateway,
    };

    const router = new SimpleCacheRouter({
      router: mockRouter,
      ttlSeconds: 300, // 5 minutes
    });

    // Get initial gateway which should be cached
    const initial = await router.getTargetGateway();
    assert.deepStrictEqual(initial, gateway1);

    // Change the underlying gateway
    currentGateway = gateway2;

    // Should still return cached gateway1 for multiple calls
    for (let i = 0; i < 5; i++) {
      const result = await router.getTargetGateway();
      assert.deepStrictEqual(result, gateway1);
    }

    // Advance time past TTL
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 300 * 1000 + 1;

      // Should now return the new gateway2
      const result = await router.getTargetGateway();
      assert.deepStrictEqual(result, gateway2);
    } finally {
      Date.now = originalNow;
    }
  });
});
