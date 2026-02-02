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

import {
  AoCreditNotice,
  AoDebitNotice,
  AoOutputMessage,
  AoTransferNotices,
} from '../types/io.js';

/**
 * Finds a tag value by name from a list of tags
 */
function findTagValue(
  tags: { name: string; value: string }[],
  name: string,
): string | undefined {
  return tags.find((tag) => tag.name === name)?.value;
}

/**
 * Parses credit notices from a list of output messages.
 * Credit notices are sent to the recipient of a token transfer.
 *
 * @param messages - Array of output messages from a message result
 * @returns Array of parsed credit notices
 */
export function parseCreditNotices(
  messages: AoOutputMessage[],
): AoCreditNotice[] {
  return messages
    .filter((msg) => findTagValue(msg.tags, 'Action') === 'Credit-Notice')
    .map((msg) => ({
      target: msg.target,
      sender: findTagValue(msg.tags, 'Sender') ?? '',
      quantity: findTagValue(msg.tags, 'Quantity') ?? '0',
    }));
}

/**
 * Parses debit notices from a list of output messages.
 * Debit notices are sent to the sender of a token transfer.
 *
 * @param messages - Array of output messages from a message result
 * @returns Array of parsed debit notices
 */
export function parseDebitNotices(
  messages: AoOutputMessage[],
): AoDebitNotice[] {
  return messages
    .filter((msg) => findTagValue(msg.tags, 'Action') === 'Debit-Notice')
    .map((msg) => ({
      target: msg.target,
      recipient: findTagValue(msg.tags, 'Recipient') ?? '',
      quantity: findTagValue(msg.tags, 'Quantity') ?? '0',
    }));
}

/**
 * Parses both credit and debit notices from a list of output messages.
 *
 * @param messages - Array of output messages from a message result
 * @returns Object containing arrays of credit and debit notices
 */
export function parseTransferNotices(
  messages: AoOutputMessage[],
): AoTransferNotices {
  return {
    creditNotices: parseCreditNotices(messages),
    debitNotices: parseDebitNotices(messages),
  };
}

/**
 * Checks if a transfer was successful by verifying the presence of credit notices.
 * A successful transfer will generate at least one credit notice to the recipient.
 *
 * @param messages - Array of output messages from a message result
 * @returns true if at least one credit notice is present
 */
export function isTransferSuccessful(messages: AoOutputMessage[]): boolean {
  return parseCreditNotices(messages).length > 0;
}
