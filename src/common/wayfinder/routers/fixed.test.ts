import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { FixedGatewayRouter } from './fixed.js';

describe('FixedRouter', () => {
  it('should return the provided gateway', async () => {
    const router = new FixedGatewayRouter({
      gateway: new URL('http://test-gateway.net'),
    });
    const result = await router.getTargetGateway();

    assert.deepStrictEqual(result, new URL('http://test-gateway.net'));
  });
});
