/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FastestPingRoutingStrategy } from './ping.js';

describe('FastestPingRoutingStrategy', () => {
  // Original fetch function
  const originalFetch = global.fetch;

  // Mock response options for each gateway
  const mockResponses = new Map<string, { status: number; delayMs: number }>();

  beforeEach(() => {
    // reset mock responses
    mockResponses.clear();

    // mock fetch to simulate network latency and response status
    // @ts-expect-error - we're mocking the fetch function
    global.fetch = async (url: string | URL) => {
      const urlString = url.toString();

      // find the matching gateway
      let matchingGateway = '';
      for (const gateway of mockResponses.keys()) {
        if (urlString.startsWith(gateway)) {
          matchingGateway = gateway;
          break;
        }
      }

      if (!matchingGateway) {
        return Promise.reject(
          new Error(`No mock response for URL: ${urlString}`),
        );
      }

      const { status, delayMs } = mockResponses.get(matchingGateway)!;

      // simulate network delay
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      return new Response(null, { status });
    };

    // mock AbortSignal.timeout
    if (!AbortSignal.timeout) {
      (AbortSignal as any).timeout = (ms: number) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      };
    }
  });

  // restore original fetch after tests
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('selects the gateway with the lowest latency', async () => {
    const gateways = [
      new URL('https://slow.com'),
      new URL('https://fast.com'),
      new URL('https://medium.com'),
    ];

    // configure mock responses
    mockResponses.set('https://slow.com', { status: 200, delayMs: 300 });
    mockResponses.set('https://fast.com', { status: 200, delayMs: 50 });
    mockResponses.set('https://medium.com', { status: 200, delayMs: 150 });

    const strategy = new FastestPingRoutingStrategy({ timeoutMs: 500 });

    // select the gateway with the lowest latency
    const selectedGateway = await strategy.selectGateway({
      gateways,
    });

    assert.equal(
      selectedGateway.toString(),
      'https://fast.com/',
      'Should select the gateway with the lowest latency',
    );
  });

  it('ignores gateways that return non-200 status codes', async () => {
    const gateways = [
      new URL('https://error.com'),
      new URL('https://success.com'),
      new URL('https://another-error.com'),
    ];

    // configure mock responses
    mockResponses.set('https://error.com', { status: 404, delayMs: 50 });
    mockResponses.set('https://success.com', { status: 200, delayMs: 100 });
    mockResponses.set('https://another-error.com', {
      status: 500,
      delayMs: 75,
    });

    const strategy = new FastestPingRoutingStrategy({ timeoutMs: 500 });

    // select the gateway with the lowest latency
    const selectedGateway = await strategy.selectGateway({
      gateways,
    });

    assert.equal(
      selectedGateway.toString(),
      'https://success.com/',
      'Should select the gateway that returns a 200 status code',
    );
  });

  it('throws an error when all gateways fail', async () => {
    const gateways = [
      new URL('https://error1.com'),
      new URL('https://error2.com'),
    ];

    // configure mock responses
    mockResponses.set('https://error1.com', { status: 404, delayMs: 50 });
    mockResponses.set('https://error2.com', { status: 500, delayMs: 75 });

    const strategy = new FastestPingRoutingStrategy({ timeoutMs: 500 });

    // select the gateway with the lowest latency
    await assert.rejects(
      async () => await strategy.selectGateway({ gateways }),
      /No healthy gateways found/,
      'Should throw an error when all gateways fail',
    );
  });

  it('handles network errors gracefully', async () => {
    const gateways = [
      new URL('https://network-error.com'),
      new URL('https://success.com'),
    ];

    // configure mock responses
    mockResponses.set('https://success.com', { status: 200, delayMs: 100 });

    // override fetch for the network error case
    const originalFetchMock = global.fetch;
    // @ts-expect-error - we're mocking the fetch function
    global.fetch = async (url: string | URL) => {
      if (url.toString().includes('network-error')) {
        throw new Error('Network error');
      }
      return originalFetchMock(url);
    };

    const strategy = new FastestPingRoutingStrategy({ timeoutMs: 500 });

    // select the gateway with the lowest latency
    const selectedGateway = await strategy.selectGateway({
      gateways,
    });

    assert.equal(
      selectedGateway.toString(),
      'https://success.com/',
      'Should handle network errors and select the working gateway',
    );
  });

  it('respects the timeout parameter', async () => {
    const gateways = [
      new URL('https://timeout.com'),
      new URL('https://fast.com'),
    ];

    // configure mock responses
    mockResponses.set('https://timeout.com', { status: 200, delayMs: 300 });
    mockResponses.set('https://fast.com', { status: 200, delayMs: 50 });

    // set a short timeout
    const strategy = new FastestPingRoutingStrategy({ timeoutMs: 100 });

    const selectedGateway = await strategy.selectGateway({
      gateways,
    });

    assert.equal(
      selectedGateway.toString(),
      'https://fast.com/',
      'Should respect the timeout and select only gateways that respond within the timeout',
    );
  });

  it('throws an error when no gateways are provided', async () => {
    const gateways: URL[] = [];
    const strategy = new FastestPingRoutingStrategy();

    // select the gateway with the lowest latency
    await assert.rejects(
      async () => await strategy.selectGateway({ gateways }),
      /No gateways provided/,
      'Should throw an error when no gateways are provided',
    );
  });
});
