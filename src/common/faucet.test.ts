/**
 * Unit tests for `createFaucet` — focused on the `processId` boundary guard.
 * The HTTP methods of `ARIOTokenFaucet` are exercised by integration flows,
 * not here.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ARIORead } from '../types/index.js';
import { createFaucet } from './faucet.js';

// The proxy only forwards property access, so a bare object stands in for a
// real ARIO instance for the purposes of these tests.
const stubArio = {} as unknown as ARIORead;

describe('createFaucet', () => {
  it('throws when processId is an empty string', () => {
    assert.throws(
      () => createFaucet({ arioInstance: stubArio, processId: '' }),
      /`processId` is required/,
    );
  });

  it('throws when processId is whitespace only', () => {
    assert.throws(
      () => createFaucet({ arioInstance: stubArio, processId: '   ' }),
      /`processId` is required/,
    );
  });

  it('returns an instance exposing a `.faucet` namespace for a valid processId', () => {
    const ario = createFaucet({
      arioInstance: stubArio,
      processId: 'process-123',
    });
    assert.equal(typeof ario.faucet, 'object');
    assert.equal(typeof ario.faucet.captchaUrl, 'function');
  });
});
