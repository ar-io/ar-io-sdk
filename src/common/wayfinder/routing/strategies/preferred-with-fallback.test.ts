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
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { RoutingStrategy } from '../../../../types/wayfinder.js';
import { PreferredWithFallbackRoutingStrategy } from './preferred-with-fallback.js';

describe('PreferredWithFallbackRoutingStrategy', () => {
  const mockPreferredGateway = 'https://example.com/';
  const mockFallbackGateway = new URL('https://fallback.com');
  const mockGateways = [
    new URL('https://gateway1.com'),
    new URL('https://gateway2.com'),
  ];

  // Store original fetch
  const originalFetch = global.fetch;
  let mockFetch;
  let originalAbortSignalTimeout;

  beforeEach(() => {
    // Mock fetch before each test
    mockFetch = mock.fn();
    global.fetch = mockFetch;

    // Mock AbortSignal.timeout
    originalAbortSignalTimeout = AbortSignal.timeout;
    AbortSignal.timeout = mock.fn(() => new AbortController().signal);
  });

  afterEach(() => {
    // Restore original fetch and AbortSignal.timeout after each test
    global.fetch = originalFetch;
    AbortSignal.timeout = originalAbortSignalTimeout;
  });

  it('should use the preferred gateway when it is available', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
      }),
    );

    const mockFallbackStrategy = {
      selectGateway: mock.fn(),
    } as RoutingStrategy;

    const strategy = new PreferredWithFallbackRoutingStrategy({
      preferredGateway: mockPreferredGateway,
      fallbackStrategy: mockFallbackStrategy,
    });

    const result = await strategy.selectGateway({ gateways: mockGateways });

    assert.equal(result.toString(), mockPreferredGateway);
    assert.equal(mockFetch.mock.calls.length, 1);
    assert.equal(mockFetch.mock.calls[0].arguments[0], mockPreferredGateway);
    assert.equal(mockFetch.mock.calls[0].arguments[1].method, 'HEAD');
    assert.equal(mockFallbackStrategy.selectGateway.mock.calls.length, 0);
  });

  it('should fall back to the fallback strategy when preferred gateway is not responsive', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.reject(new Error('Connection timeout')),
    );

    const mockFallbackStrategy = {
      selectGateway: mock.fn(() => Promise.resolve(mockFallbackGateway)),
    } as RoutingStrategy;

    const strategy = new PreferredWithFallbackRoutingStrategy({
      preferredGateway: mockPreferredGateway,
      fallbackStrategy: mockFallbackStrategy,
    });

    const result = await strategy.selectGateway({ gateways: mockGateways });

    assert.equal(result, mockFallbackGateway);
    assert.equal(mockFetch.mock.calls.length, 1);
    assert.equal(mockFetch.mock.calls[0].arguments[0], mockPreferredGateway);
    assert.equal(mockFetch.mock.calls[0].arguments[1].method, 'HEAD');
    assert.equal(mockFallbackStrategy.selectGateway.mock.calls.length, 1);
    assert.deepEqual(
      mockFallbackStrategy.selectGateway.mock.calls[0].arguments[0],
      {
        gateways: mockGateways,
      },
    );
  });

  it('should fall back when preferred gateway returns a non-ok response', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      }),
    );

    const mockFallbackStrategy = {
      selectGateway: mock.fn(() => Promise.resolve(mockFallbackGateway)),
    } as RoutingStrategy;

    const strategy = new PreferredWithFallbackRoutingStrategy({
      preferredGateway: mockPreferredGateway,
      fallbackStrategy: mockFallbackStrategy,
    });

    const result = await strategy.selectGateway({ gateways: mockGateways });

    assert.equal(result, mockFallbackGateway);
    assert.equal(mockFetch.mock.calls.length, 1);
    assert.equal(mockFallbackStrategy.selectGateway.mock.calls.length, 1);
    assert.deepEqual(
      mockFallbackStrategy.selectGateway.mock.calls[0].arguments[0],
      {
        gateways: mockGateways,
      },
    );
  });

  it('should use PingBased router as default fallback if none is provided', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.reject(new Error('Connection timeout')),
    );

    const strategy = new PreferredWithFallbackRoutingStrategy({
      preferredGateway: mockPreferredGateway,
    });

    // Mock the fallback strategy's selectGateway method
    const originalSelectGateway = strategy['fallbackStrategy'].selectGateway;
    strategy['fallbackStrategy'].selectGateway = mock.fn(() =>
      Promise.resolve(mockFallbackGateway),
    );

    const result = await strategy.selectGateway({ gateways: mockGateways });

    assert.equal(result, mockFallbackGateway);
    assert.equal(
      strategy['fallbackStrategy'].selectGateway.mock.calls.length,
      1,
    );
    assert.deepEqual(
      strategy['fallbackStrategy'].selectGateway.mock.calls[0].arguments[0],
      {
        gateways: mockGateways,
      },
    );

    // Verify that the fallback strategy is an instance of FastestPingRoutingStrategy
    assert.equal(
      strategy['fallbackStrategy'].constructor.name,
      'FastestPingRoutingStrategy',
    );

    // Restore original method
    strategy['fallbackStrategy'].selectGateway = originalSelectGateway;
  });

  it('should throw an error if an invalid URL is provided', () => {
    assert.throws(() => {
      new PreferredWithFallbackRoutingStrategy({
        preferredGateway: 'invalid-url',
      });
    }, /Invalid URL provided for preferred gateway: invalid-url/);
  });
});
