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
import { z } from 'zod';

import { parseSchemaResult } from './schema.js';

describe('parseSchemaResult', () => {
  it('should successfully parse a value that matches the schema', () => {
    // Define a simple schema
    const userSchema = z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
    });

    // Valid data
    const userData = {
      id: '123',
      name: 'John Doe',
      age: 30,
    };

    const result = parseSchemaResult(userSchema, userData);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, userData);
  });

  it('should throw an error when parsing fails', () => {
    // Define a schema
    const userSchema = z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
    });

    // Invalid data (missing required property, wrong type)
    const invalidData = {
      id: '123',
      name: 'John Doe',
      age: '30', // Should be a number
    };

    assert.throws(() => {
      parseSchemaResult(userSchema, invalidData);
    }, Error);
  });

  it('should include validation error details in the thrown error', () => {
    // Define a schema with specific requirements
    const userSchema = z.object({
      id: z.string().min(5),
      email: z.string().email(),
      age: z.number().min(18).max(120),
    });

    // Invalid data with multiple validation issues
    const invalidData = {
      id: '123', // Too short
      email: 'not-an-email', // Invalid email
      age: 15, // Below minimum age
    };

    try {
      parseSchemaResult(userSchema, invalidData);
      assert.fail('Expected parseSchemaResult to throw');
    } catch (error) {
      // The error message should be a JSON string with validation details
      const errorMessage = error.message;

      // Check that the error message contains the validation issues
      assert.ok(errorMessage.includes('id'));
      assert.ok(errorMessage.includes('email'));
      assert.ok(errorMessage.includes('age'));
    }
  });

  it('should handle nested objects in the schema', () => {
    // Define a schema with nested objects
    const addressSchema = z.object({
      street: z.string(),
      city: z.string(),
      zipCode: z.string(),
    });

    const userSchema = z.object({
      id: z.string(),
      name: z.string(),
      address: addressSchema,
    });

    // Valid nested data
    const validData = {
      id: '123',
      name: 'John Doe',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        zipCode: '12345',
      },
    };

    const result = parseSchemaResult(userSchema, validData);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, validData);

    // Invalid nested data
    const invalidData = {
      id: '123',
      name: 'John Doe',
      address: {
        street: '123 Main St',
        // Missing city
        zipCode: '12345',
      },
    };

    assert.throws(() => {
      parseSchemaResult(userSchema, invalidData);
    }, Error);
  });

  it('should handle array schemas', () => {
    // Define a schema for an array of strings
    const stringArraySchema = z.array(z.string());

    // Valid array
    const validArray = ['one', 'two', 'three'];

    const result = parseSchemaResult(stringArraySchema, validArray);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, validArray);

    // Invalid array (contains a number)
    const invalidArray = ['one', 'two', 3];

    assert.throws(() => {
      parseSchemaResult(stringArraySchema, invalidArray);
    }, Error);
  });
});
