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
import { connect } from '@permaweb/aoconnect';
import { z } from 'zod';

import { AntHandlerNames, AoANTHandler } from '../types/ant.js';
import { AoClient } from '../types/common.js';
import { getAntHandlers } from './ao.js';

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

export async function validateAnt({
  processId,
  ao = connect(),
}: {
  processId: string;
  ao: AoClient;
}): Promise<Record<AoANTHandler, { valid: boolean; error?: string }>> {
  const antHandlers = await getAntHandlers({ processId, ao });
  const defaultValidations = Object.fromEntries(
    AntHandlerNames.map((handler) => [
      handler,
      async (_: { processId: string; ao: AoClient }) => {
        if (antHandlers.includes(handler)) return true;
        throw new Error(`Handler ${handler} not found`);
      },
    ]),
  ) as Record<
    AoANTHandler,
    (p: { processId: string; ao: AoClient }) => Promise<boolean>
  >;
  const handlerValidationConfig: Record<
    AoANTHandler,
    (p: { processId: string; ao: AoClient }) => Promise<boolean>
  > = {
    ...defaultValidations,
    // Add custom validations here for more complex checks using dryrun
  };

  const results: Record<AoANTHandler, { valid: boolean; error?: string }> =
    {} as Record<AoANTHandler, { valid: boolean; error?: string }>;

  for (const [handler, validator] of Object.entries(handlerValidationConfig)) {
    await validator({ processId, ao })
      .then((valid) => {
        results[handler] = { valid };
      })
      .catch((error) => {
        results[handler] = { valid: false, error: error.message };
      });
  }

  return results;
}
