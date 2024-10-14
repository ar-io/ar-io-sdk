import { z } from 'zod';

/**
 *
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
