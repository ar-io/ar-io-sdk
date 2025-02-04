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
import { AoANTRecord } from '../types/ant.js';

/**
 * Sorts ANT records by priority and then lexicographically.
 *
 * @param antRecords - The ANT records to sort.
 */
export const sortedANTRecords = (
  antRecords: Record<string, AoANTRecord>,
): Record<string, AoANTRecord> => {
  return Object.fromEntries(
    Object.entries(antRecords).sort(([a, aRecord], [b, bRecord]) => {
      // '@' is the root name and should be resolved first
      if (a === '@') {
        return -1;
      }
      if (b === '@') {
        return 1;
      }
      // if a record has a priority, it should be resolved before any other record without a priority
      if ('priority' in aRecord && !('priority' in bRecord)) {
        return -1;
      }
      if (!('priority' in aRecord) && 'priority' in bRecord) {
        return 1;
      }
      // sort by priority if both records have a priority
      if (aRecord.priority !== undefined && bRecord.priority !== undefined) {
        if (aRecord.priority === bRecord.priority) {
          return a.localeCompare(b);
        }
        return aRecord.priority - bRecord.priority;
      }
      // if the records have no priority, sort lexicographically
      return a.localeCompare(b);
    }),
  );
};
