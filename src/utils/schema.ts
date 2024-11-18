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
import { z } from 'zod';

/**
 * @param schema - zod schema
 * @param v - value to parse
 * @throws {z.SafeParseError<any>} - if the value fails to parse
 */
export function parseSchemaResult(schema: z.ZodTypeAny, v: unknown) {
  const schemaResult = schema.safeParse(v);
  if (!schemaResult.success) {
    throw new Error(JSON.stringify(schemaResult.error.format(), null, 2));
  }
  return schemaResult;
}
