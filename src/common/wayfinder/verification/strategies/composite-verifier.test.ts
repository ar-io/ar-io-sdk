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
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

import { DataVerificationStrategy } from '../../../../types/wayfinder.js';
import { CompositeVerificationStrategy } from './composite-verifier.js';

// Mock verification strategies for testing
class SuccessfulVerificationStrategy implements DataVerificationStrategy {
  public callCount = 0;

  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    this.callCount++;
    // This strategy always succeeds
    return Promise.resolve();
  }
}

class FailingVerificationStrategy implements DataVerificationStrategy {
  public readonly errorMessage: string;
  public callCount = 0;

  constructor(errorMessage = 'Verification failed') {
    this.errorMessage = errorMessage;
  }

  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    this.callCount++;
    // This strategy always fails
    return Promise.reject(new Error(this.errorMessage));
  }
}

class ContentCheckingVerificationStrategy implements DataVerificationStrategy {
  private readonly expectedContent: string;
  public callCount = 0;

  constructor(expectedContent: string) {
    this.expectedContent = expectedContent;
  }

  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    this.callCount++;

    // For Buffer
    if (Buffer.isBuffer(data)) {
      const content = data.toString();
      if (content !== this.expectedContent) {
        throw new Error(
          `Expected "${this.expectedContent}" but got "${content}"`,
        );
      }
      return;
    }

    // For Node.js Readable
    if (data instanceof Readable) {
      let content = '';
      for await (const chunk of data) {
        content += chunk.toString();
      }
      if (content !== this.expectedContent) {
        throw new Error(
          `Expected "${this.expectedContent}" but got "${content}"`,
        );
      }
      return;
    }

    // For Web ReadableStream
    if (data instanceof ReadableStream) {
      const reader = data.getReader();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        content += new TextDecoder().decode(value);
      }

      if (content !== this.expectedContent) {
        throw new Error(
          `Expected "${this.expectedContent}" but got "${content}"`,
        );
      }
      return;
    }

    throw new Error('Unsupported data type');
  }
}

describe('CompositeVerificationStrategy', () => {
  describe('constructor', () => {
    it('should throw an error if no verification strategies are provided', () => {
      assert.throws(
        () => {
          new CompositeVerificationStrategy({ verificationStrategies: [] });
        },
        {
          message: 'At least one verification strategy must be provided',
        },
      );
    });

    it('should throw an error if verification strategies is undefined', () => {
      assert.throws(
        () => {
          // @ts-expect-error - Testing invalid input
          new CompositeVerificationStrategy({
            verificationStrategies: undefined,
          });
        },
        {
          message: 'At least one verification strategy must be provided',
        },
      );
    });

    it('should create an instance with valid verification strategies', () => {
      const strategy1 = new SuccessfulVerificationStrategy();
      const strategy2 = new SuccessfulVerificationStrategy();

      const composite = new CompositeVerificationStrategy({
        verificationStrategies: [strategy1, strategy2],
      });

      assert.ok(composite instanceof CompositeVerificationStrategy);
    });
  });

  describe('verifyData', () => {
    describe('with Buffer data', () => {
      it('should call all verification strategies and succeed if all succeed', async () => {
        const strategy1 = new SuccessfulVerificationStrategy();
        const strategy2 = new SuccessfulVerificationStrategy();
        const strategy3 = new SuccessfulVerificationStrategy();

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2, strategy3],
        });

        const buffer = Buffer.from('test data');
        const txId = 'test-tx-id';

        await composite.verifyData({ data: buffer, txId });

        assert.strictEqual(strategy1.callCount, 1);
        assert.strictEqual(strategy2.callCount, 1);
        assert.strictEqual(strategy3.callCount, 1);
      });

      it('should fail if any verification strategy fails', async () => {
        const strategy1 = new SuccessfulVerificationStrategy();
        const strategy2 = new FailingVerificationStrategy('Strategy 2 failed');
        const strategy3 = new SuccessfulVerificationStrategy();

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2, strategy3],
        });

        const buffer = Buffer.from('test data');
        const txId = 'test-tx-id';

        await assert.rejects(
          async () => {
            await composite.verifyData({ data: buffer, txId });
          },
          {
            message:
              /Verification .+ failed in strategy FailingVerificationStrategy/,
          },
        );
      });

      it('should verify content correctly in all strategies', async () => {
        const testContent = 'test data for content verification';
        const strategy1 = new ContentCheckingVerificationStrategy(testContent);
        const strategy2 = new ContentCheckingVerificationStrategy(testContent);

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2],
        });

        const buffer = Buffer.from(testContent);
        const txId = 'test-tx-id';

        await composite.verifyData({ data: buffer, txId });

        assert.strictEqual(strategy1.callCount, 1);
        assert.strictEqual(strategy2.callCount, 1);
      });
    });

    describe('with Readable stream data', () => {
      it('should call all verification strategies and succeed if all succeed', async () => {
        const strategy1 = new SuccessfulVerificationStrategy();
        const strategy2 = new SuccessfulVerificationStrategy();

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2],
        });

        const testData = 'test stream data';
        const stream = Readable.from(testData);
        const txId = 'test-tx-id';

        await composite.verifyData({ data: stream, txId });

        assert.strictEqual(strategy1.callCount, 1);
        assert.strictEqual(strategy2.callCount, 1);
      });

      it('should fail if any verification strategy fails', async () => {
        const strategy1 = new SuccessfulVerificationStrategy();
        const strategy2 = new FailingVerificationStrategy(
          'Stream verification failed',
        );

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2],
        });

        const testData = 'test stream data';
        const stream = Readable.from(testData);
        const txId = 'test-tx-id';

        await assert.rejects(
          async () => {
            await composite.verifyData({ data: stream, txId });
          },
          {
            message:
              /Verification .+ failed in strategy FailingVerificationStrategy/,
          },
        );
      });

      it('should verify content correctly in all strategies', async () => {
        const testContent = 'test stream data for content verification';
        const strategy1 = new ContentCheckingVerificationStrategy(testContent);
        const strategy2 = new ContentCheckingVerificationStrategy(testContent);

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2],
        });

        const stream = Readable.from(testContent);
        const txId = 'test-tx-id';

        await composite.verifyData({ data: stream, txId });

        assert.strictEqual(strategy1.callCount, 1);
        assert.strictEqual(strategy2.callCount, 1);
      });
    });

    // Skip ReadableStream tests in Node.js environment
    describe.skip('with ReadableStream data', () => {
      it('should call all verification strategies and succeed if all succeed', async () => {
        const strategy1 = new SuccessfulVerificationStrategy();
        const strategy2 = new SuccessfulVerificationStrategy();

        const composite = new CompositeVerificationStrategy({
          verificationStrategies: [strategy1, strategy2],
        });

        const testData = 'test web stream data';
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(testData));
            controller.close();
          },
        });
        const txId = 'test-tx-id';

        await composite.verifyData({ data: stream, txId });

        assert.strictEqual(strategy1.callCount, 1);
        assert.strictEqual(strategy2.callCount, 1);
      });
    });
  });
});
