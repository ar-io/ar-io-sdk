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

import { safeDecode } from './json.js';

describe('safeDecode', () => {
  it('should parse valid JSON string into an object', () => {
    const jsonString = '{"key": "value", "number": 42, "boolean": true}';
    const result = safeDecode(jsonString);

    assert.deepEqual(result, {
      key: 'value',
      number: 42,
      boolean: true,
    });
  });

  it('should parse valid JSON array', () => {
    const jsonArray = '[1, 2, 3, "four", {"five": 5}]';
    const result = safeDecode(jsonArray);

    assert.deepEqual(result, [1, 2, 3, 'four', { five: 5 }]);
  });

  it('should parse valid JSON primitives', () => {
    assert.equal(safeDecode('"string"'), 'string');
    assert.equal(safeDecode('42'), 42);
    assert.equal(safeDecode('true'), true);
    assert.equal(safeDecode('null'), null);
  });

  it('should return the original input when given invalid JSON', () => {
    const invalidJson = '{key: value}'; // Missing quotes around key and value
    const result = safeDecode(invalidJson);

    assert.equal(result, invalidJson);
  });

  it('should return the original input when given non-string input', () => {
    const nonStringInputs = [
      42,
      true,
      { already: 'an object' },
      [1, 2, 3],
      null,
      undefined,
    ];

    nonStringInputs.forEach((input) => {
      // @ts-expect-error
      const result = safeDecode(input);
      assert.equal(result, input);
    });
  });

  it('should handle empty string', () => {
    const result = safeDecode('');
    assert.equal(result, '');
  });

  it('should handle whitespace string', () => {
    const result = safeDecode('   ');
    assert.equal(result, '   ');
  });
});
