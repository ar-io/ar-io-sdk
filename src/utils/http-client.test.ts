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
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { Logger } from '../common/logger.js';
import { version } from '../version.js';
import { createAxiosInstance } from './http-client.js';

describe('createAxiosInstance', () => {
  it('should create an axios instance with default config', () => {
    const axiosInstance = createAxiosInstance();

    // Check that default headers are set
    assert.equal(axiosInstance.defaults.headers['x-source-version'], version);
    assert.equal(
      axiosInstance.defaults.headers['x-source-identifier'],
      'ar-io-sdk',
    );

    // Check that maxRedirects is set to 0
    assert.equal(axiosInstance.defaults.maxRedirects, 0);

    // Check that validateStatus is set to a function that always returns true
    assert.equal(typeof axiosInstance.defaults.validateStatus, 'function');
    assert.equal(axiosInstance.defaults.validateStatus!(200), true);
    assert.equal(axiosInstance.defaults.validateStatus!(404), true);
    assert.equal(axiosInstance.defaults.validateStatus!(500), true);
  });

  it('should merge custom headers with default headers', () => {
    const customHeaders = {
      'Custom-Header': 'custom-value',
      'Another-Header': 'another-value',
    };

    const axiosInstance = createAxiosInstance({
      axiosConfig: {
        headers: customHeaders,
      },
    });

    // Check that default headers are still set
    assert.equal(axiosInstance.defaults.headers['x-source-version'], version);
    assert.equal(
      axiosInstance.defaults.headers['x-source-identifier'],
      'ar-io-sdk',
    );

    // Check that custom headers are also set
    assert.equal(
      axiosInstance.defaults.headers['Custom-Header'],
      'custom-value',
    );
    assert.equal(
      axiosInstance.defaults.headers['Another-Header'],
      'another-value',
    );
  });

  it('should apply custom axios config', () => {
    const axiosInstance = createAxiosInstance({
      axiosConfig: {
        baseURL: 'https://example.com',
        timeout: 5000,
      },
    });

    // Check that custom config is applied
    assert.equal(axiosInstance.defaults.baseURL, 'https://example.com');
    assert.equal(axiosInstance.defaults.timeout, 5000);

    // Check that default settings are still applied
    assert.equal(axiosInstance.defaults.maxRedirects, 0);
    assert.equal(axiosInstance.defaults.headers['x-source-version'], version);
  });

  it('should apply custom retry config', () => {
    const customRetryConfig = {
      retries: 3,
      retryCondition: () => false, // Never retry
    };

    const axiosInstance = createAxiosInstance({
      retryConfig: customRetryConfig,
    });

    // We can't directly test the retry behavior without mocking the network,
    // but we can check that the instance was created successfully
    assert.ok(axiosInstance);
  });

  it('should use custom logger if provided', () => {
    // Create a custom logger for testing
    const customLogger = {
      ...Logger.default,
      error: () => {
        // Custom error logger implementation
      },
    };

    const axiosInstance = createAxiosInstance({
      // @ts-expect-error
      logger: customLogger,
    });

    // We can't directly test the logger behavior without mocking the network,
    // but we can check that the instance was created successfully
    assert.ok(axiosInstance);
  });
});
