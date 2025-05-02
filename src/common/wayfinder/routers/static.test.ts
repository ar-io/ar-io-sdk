import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { StaticGatewayRouter } from './static.js';

describe('StaticGatewayRouter', () => {
  it('should return the provided gateway', async () => {
    const router = new StaticGatewayRouter({
      gateway: 'http://test-gateway.net',
    });
    const result = await router.getTargetGateway();

    assert.deepStrictEqual(result, new URL('http://test-gateway.net'));
  });
});
