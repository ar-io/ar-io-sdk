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

import { randomInt } from './random.js';

describe('randomInt', () => {
  it('should generate a random integer within the specified range', () => {
    const min = 1;
    const max = 10;

    // Run multiple iterations to test randomness
    for (let i = 0; i < 100; i++) {
      const result = randomInt(min, max);

      // Check that the result is an integer
      assert.equal(Math.floor(result), result);

      // Check that the result is within the specified range
      assert.ok(result >= min);
      assert.ok(result < max);
    }
  });

  it('should work with zero as the minimum value', () => {
    const min = 0;
    const max = 5;

    // Run multiple iterations
    for (let i = 0; i < 100; i++) {
      const result = randomInt(min, max);

      assert.ok(result >= min);
      assert.ok(result < max);
    }
  });

  it('should work with negative numbers', () => {
    const min = -10;
    const max = -5;

    // Run multiple iterations
    for (let i = 0; i < 100; i++) {
      const result = randomInt(min, max);

      assert.ok(result >= min);
      assert.ok(result < max);
    }
  });

  it('should work with a range that spans negative to positive', () => {
    const min = -5;
    const max = 5;

    // Run multiple iterations
    for (let i = 0; i < 100; i++) {
      const result = randomInt(min, max);

      assert.ok(result >= min);
      assert.ok(result < max);
    }
  });

  it('should generate all possible values in a small range over many iterations', () => {
    const min = 0;
    const max = 5;
    const possibleValues = new Set();

    // Run many iterations to ensure we get all possible values
    for (let i = 0; i < 1000; i++) {
      possibleValues.add(randomInt(min, max));
    }

    // With many iterations, we should get all possible values
    assert.equal(possibleValues.size, max - min);

    // Check that all values in the range are present
    for (let i = min; i < max; i++) {
      assert.ok(possibleValues.has(i));
    }
  });
});
