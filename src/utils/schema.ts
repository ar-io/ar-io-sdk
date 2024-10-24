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

import { ANT, AOProcess } from '../common/index.js';
import { ANT_REGISTRY_ID } from '../constants.js';
import { AntStateSchema, AoANTState, AoANTWriteHandler } from '../types/ant.js';
import { AoClient } from '../types/common.js';
import { safeDecode } from './json.js';

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

export const AoMessageSchema = z
  .object({
    Data: z.string(),
    Tags: z.array(z.object({ name: z.string(), value: z.string() })),
    Target: z.string(),
  })
  .passthrough();
export const AoOutputSchema = z
  .object({
    data: z
      .object({
        output: z.string(),
      })
      .passthrough(),
  })
  .passthrough();
export const AoResultSchema = z
  .object({
    Messages: z.array(AoMessageSchema),
    Output: AoOutputSchema,
  })
  .passthrough();

/**
 * @param schema - the array schema you wish to extend
 * @param requiredSchemas - array of zod schemas that the array must contain at least one of
 * @returns - a composite schema that requires at least one of the required schemas to be valid
 */
export const createCompositeArraySchema = <T extends z.ZodTypeAny>(
  schema: z.ZodArray<T>,
  requiredSchemas: z.ZodTypeAny[],
) => {
  return schema.superRefine((items, ctx) => {
    requiredSchemas.forEach((schema) => {
      const schemaName = schema.description || 'required schema';

      // Check if any item validates against the schema and collect issues if it fails
      const schemaIssues = items.reduce((issues, item, index) => {
        const result = schema.safeParse(item);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            issues.push({
              ...issue,
              path: [index, ...issue.path], // Adjust path to reflect item index
            });
          });
        }
        return issues;
      }, [] as z.ZodIssue[]);

      // Add any schema-specific issues to the validation context
      schemaIssues.forEach((issue) => ctx.addIssue(issue));

      // Check if no valid item matches the required schema
      if (!items.some((item) => schema.safeParse(item).success)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Must include at least one ${schemaName}`,
        });
      }
    });
  });
};

export const createAntCreditNoticeSchema = (sender: string) =>
  z.object({
    Tags: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .refine(
        (tags) =>
          tags.find((tag) => tag.name === 'Action')?.value === 'Credit-Notice',
        {
          message: 'Missing or incorrect Credit-Notice action tag',
          path: ['Tags', 'Action'],
        },
      )
      .refine(
        (tags) => tags.find((tag) => tag.name === 'Sender')?.value === sender,
        {
          message: 'Incorrect sender in Credit-Notice',
          path: ['Tags', 'Sender'],
        },
      )
      .refine(
        (tags) => tags.find((tag) => tag.name === 'Quantity')?.value === '1',
        {
          message: 'Incorrect quantity in Credit-Notice',
          path: ['Tags', 'Quantity'],
        },
      ),
    Target: z.string().refine((target) => target === ''.padEnd(43, '1'), {
      message: 'Incorrect target in Credit-Notice',
      path: ['Target'],
    }),
  });

export const createAntDebitNoticeSchema = (recipient: string, owner: string) =>
  z.object({
    Tags: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .refine(
        (tags) =>
          tags.find((tag) => tag.name === 'Action')?.value === 'Debit-Notice',
        {
          message: 'Missing or incorrect Debit-Notice action tag',
          path: ['Tags', 'Action'],
        },
      )
      .refine(
        (tags) =>
          tags.find((tag) => tag.name === 'Recipient')?.value === recipient,
        {
          message: 'Incorrect recipient in Debit-Notice',
          path: ['Tags', 'Recipient'],
        },
      ),
    Target: z.string().refine((target) => target === owner, {
      message: 'Incorrect target in Debit-Notice',
      path: ['Target'],
    }),
  });

export const createAntStateNoticeSchema = ({
  owner,
  controller,
}: {
  owner?: string;
  controller?: string;
}) => {
  const address = owner || controller;
  if (!address) {
    throw new Error('Must provide either owner or controller address');
  }
  const checkOwnerOrController = owner ? 'Owner' : 'Controller';

  return z.object({
    Tags: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .refine(
        (tags) =>
          tags.find((tag) => tag.name === 'Action')?.value === 'State-Notice',
        {
          message: 'Missing or incorrect State-Notice action tag',
          path: ['Tags', 'Action'],
        },
      ),
    Target: z.string().refine((target) => target === ANT_REGISTRY_ID, {
      message: 'Incorrect target in State-Notice',
      path: ['Target'],
    }),
    Data: z
      .string()
      .transform((data) => safeDecode(data) as AoANTState)
      .refine((state) => AntStateSchema.safeParse(state).success, {
        message: 'Invalid state data in State-Notice',
        path: ['Data'],
      })
      .refine(
        (state) => {
          if (checkOwnerOrController == 'Owner') return state.Owner == address;
          if (checkOwnerOrController == 'Controller')
            return state.Controllers.includes(address);
          // Should never reach this point
          return false;
        },
        {
          message: `Incorrect new ${checkOwnerOrController} in State-Notice`,
          path: ['Data', checkOwnerOrController],
        },
      ),
  });
};

export async function validateAnt({
  processId,
  ao = connect(),
}: {
  processId: string;
  ao: AoClient;
}) {
  const ant = ANT.init({
    process: new AOProcess({ processId, ao }),
    strict: true,
  });
  const state = await ant.getState();
  const currentOwner = state.Owner;
  const newOwner = ''.padEnd(43, '1');

  const handlerValidationConfig: Record<
    Exclude<AoANTWriteHandler, 'evolve' | '_default'>,
    {
      Data?: string;
      Tags?: { name: string; value: string }[];
      validate: (res: z.infer<typeof AoResultSchema>) => void;
    }
  > = {
    _eval: {
      Data: "print('SourceCodeTxId: ' .. SourceCodeTxId)",
      Tags: [
        { name: 'Action', value: 'Eval' },
        { name: 'Source-Code-Tx-Id', value: ''.padEnd(43, '1') },
      ],
      validate: (res) => {
        return z
          .object({
            data: z
              .object({
                output: z
                  .string()
                  .refine(
                    (output) =>
                      output.includes(`SourceCodeTxId: ${''.padEnd(43, '1')}`),
                    {
                      message: `The output does not match the expected format 'SourceCodeTxId: ${''.padEnd(43, '1')}'.`,
                      path: ['data', 'output'],
                    },
                  ),
              })
              // Using passthrough to allow for other unexpected fields, which we will not validate
              .passthrough(),
          })
          .safeParse(res.Output);
      },
    },
    transfer: {
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: ''.padEnd(43, '1') },
      ],
      validate: (res) => {
        const transferMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          createAntCreditNoticeSchema(currentOwner),
          createAntDebitNoticeSchema(newOwner, currentOwner),
          createAntStateNoticeSchema({ owner: newOwner }),
        ]);

        return transferMessagesSchema.safeParse(res.Messages);
      },
    },
    addController: {
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: ''.padEnd(43, '1') },
      ],
      validate: (res) => {
        const addControllerMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          createAntStateNoticeSchema({ controller: ''.padEnd(43, '1') }),
          AoMessageSchema.refine(
            (message) =>
              message.Tags.find((tag) => tag.name === 'Action')?.value ===
                'Add-Controller-Notice' && message.Target === currentOwner,
            {
              message: 'Missing or incorrect Add-Controller-Notice action tag',
            },
          ),
        ]);
        return addControllerMessagesSchema.safeParse(res.Messages);
      },
    },
    removeController: {
      Tags: [
        { name: 'Action', value: 'Remove-Controller' },
        { name: 'Controller', value: ''.padEnd(43, '1') },
      ],
      validate: (res) => {
        const removeControllerMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          createAntStateNoticeSchema({ controller: ''.padEnd(43, '1') }),
          AoMessageSchema.refine(
            (message) =>
              message.Tags.find((tag) => tag.name === 'Action')?.value ===
                'Remove-Controller-Notice' && message.Target === currentOwner,
            {
              message:
                'Missing or incorrect Remove-Controller-Notice action tag',
            },
          ),
        ]);
        return removeControllerMessagesSchema.safeParse(res.Messages);
      },
    },
    setRecord: {
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: '@' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '1') },
        { name: 'TTL-Seconds', value: '3600' },
      ],
      validate: (res) => {
        const setRecordMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          AoMessageSchema.refine(
            (message) => {
              const data = safeDecode(message.Data) as any;
              return (
                message.Tags.find((tag) => tag.name === 'Action')?.value ===
                  'Set-Record-Notice' &&
                message.Target === currentOwner &&
                data.transactionId === ''.padEnd(43, '1') &&
                data.ttlSeconds === 3600
              );
            },
            {
              message: 'Missing or incorrect Set-Record-Notice action tag',
            },
          ),
        ]);
        return setRecordMessagesSchema.safeParse(res.Messages);
      },
    },
    removeRecord: {
      Tags: [
        { name: 'Action', value: 'Remove-Record' },
        { name: 'Sub-Domain', value: '@' },
      ],
      validate: (res) => {
        const removeRecordMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          AoMessageSchema.refine(
            (message) => {
              return (
                message.Tags.find((tag) => tag.name === 'Action')?.value ===
                  'Remove-Record-Notice' && message.Target === currentOwner
              );
            },
            {
              message: 'Missing or incorrect Remove-Record-Notice action tag',
            },
          ),
        ]);
        return removeRecordMessagesSchema.safeParse(res.Messages);
      },
    },
    setTicker: {
      Tags: [
        { name: 'Action', value: 'Set-Ticker' },
        { name: 'Ticker', value: 'ticker' },
      ],
      validate: (res) => {
        const setTickerMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          AoMessageSchema.refine(
            (message) => {
              return (
                message.Tags.find((tag) => tag.name === 'Action')?.value ===
                  'Set-Ticker-Notice' && message.Target === currentOwner
              );
            },
            {
              message: 'Missing or incorrect Set-Ticker-Notice action tag',
            },
          ),
        ]);
        return setTickerMessagesSchema.safeParse(res.Messages);
      },
    },
    setName: {
      Tags: [
        { name: 'Action', value: 'Set-Name' },
        { name: 'Name', value: 'name' },
      ],
      validate: (res) => {
        const setNameMessagesSchema = createCompositeArraySchema<
          typeof AoMessageSchema
        >(z.array(AoMessageSchema), [
          AoMessageSchema.refine(
            (message) => {
              return (
                message.Tags.find((tag) => tag.name === 'Action')?.value ===
                  'Set-Name-Notice' && message.Target === currentOwner
              );
            },
            {
              message: 'Missing or incorrect Set-Name-Notice action tag',
            },
          ),
        ]);
        return setNameMessagesSchema.safeParse(res.Messages);
      },
    },
  };

  const results = {};

  for (const [handler, config] of Object.entries(handlerValidationConfig)) {
    const res = await ao
      .dryrun({
        process: processId,
        Owner: currentOwner,
        From: currentOwner,
        Data: config.Data,
        Tags: config.Tags,
      })
      .catch((e) => {
        return new Error(`Failed to validate ${handler} handler: ${e.message}`);
      });
    results[handler] = res instanceof Error ? res : config.validate(res);
  }

  return results;
}
