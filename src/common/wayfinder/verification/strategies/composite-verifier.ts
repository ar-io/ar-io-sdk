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
import { PassThrough, Readable } from 'node:stream';

import { DataVerificationStrategy } from '../../../../types/wayfinder.js';

/**
 * A verification strategy that composes multiple verification strategies together.
 * This allows for more comprehensive verification by applying multiple verification techniques.
 * All verifications are run in parallel, and the process stops on the first failure.
 */
export class CompositeVerificationStrategy implements DataVerificationStrategy {
  private readonly verificationStrategies: DataVerificationStrategy[];

  /**
   * Creates a new CompositeVerificationStrategy
   *
   * @param verificationStrategies - An array of verification strategies to apply
   */
  constructor({
    verificationStrategies,
  }: {
    verificationStrategies: DataVerificationStrategy[];
  }) {
    if (
      verificationStrategies === undefined ||
      verificationStrategies.length === 0
    ) {
      throw new Error('At least one verification strategy must be provided');
    }
    this.verificationStrategies = verificationStrategies;
  }

  /**
   * Verifies data using all configured verification strategies in parallel.
   * If any verification fails, the process stops and the error is propagated.
   *
   * @param data - The data to verify (Buffer, Readable, or ReadableStream)
   * @param txId - The transaction ID for the data
   * @returns A promise that resolves if all verifications pass, or rejects with the first verification error
   */
  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    // for Buffer data, reuse the same buffer for all verifications
    if (Buffer.isBuffer(data)) {
      await Promise.all(
        this.verificationStrategies.map(async (strategy, index) => {
          try {
            await strategy.verifyData({ data, txId });
          } catch (error) {
            throw new Error(
              `Verification ${index + 1} failed in strategy ${strategy.constructor.name}`,
              { cause: error },
            );
          }
        }),
      );
      return;
    }

    // For Node.js Readable streams
    if (data instanceof Readable) {
      // create a pass through stream for each strategy and pipe the data to it
      const streams = this.verificationStrategies.map(() => new PassThrough());

      for (const stream of streams) {
        data.pipe(stream);
      }

      // run all verifications in parallel
      await Promise.all(
        this.verificationStrategies.map(async (strategy, index) => {
          try {
            await strategy.verifyData({ data: streams[index], txId });
          } catch (error) {
            throw new Error(
              `Verification ${index + 1} failed in strategy ${strategy.constructor.name}`,
              { cause: error },
            );
          }
        }),
      );

      return;
    }

    // for web ReadableStream
    if (data instanceof ReadableStream) {
      // clone the stream for each strategy
      const streams: ReadableStream[] = [];
      let currentStream = data;

      // create pairs of streams using the tee method
      for (let i = 0; i < this.verificationStrategies.length - 1; i++) {
        const [stream1, stream2] = currentStream.tee();
        streams.push(stream1);
        currentStream = stream2;
      }

      // add the last stream
      streams.push(currentStream);

      // run all verifications in parallel
      await Promise.all(
        this.verificationStrategies.map(async (strategy, index) => {
          try {
            await strategy.verifyData({ data: streams[index], txId });
          } catch (error) {
            throw new Error(
              `Verification ${index + 1} failed in strategy ${strategy.constructor.name}`,
              { cause: error },
            );
          }
        }),
      );

      return;
    }

    throw new Error('Unsupported data type for verification');
  }
}
