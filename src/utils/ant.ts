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
import { ANTRecords, SortedANTRecords } from '../types/ant.js';

/**
 * Sorts ANT records by priority and then lexicographically.
 *
 * Note: javascript guarantees that the order of objects in an object is persistent. Still, adding index to each record is useful for enforcing against undername limits.
 *
 * Reference: https://github.com/ar-io/ar-io-node/blob/e0a9ec56559cad1b3e35d668563871afb8649913/docs/madr/003-arns-undername-limits.md
 *
 * @param antRecords - The ANT records to sort.
 */
export const sortANTRecords = (antRecords: ANTRecords): SortedANTRecords => {
  const sortedEntries = Object.entries(antRecords).sort(
    ([a, aRecord], [b, bRecord]) => {
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
      // if both records have a priority, sort by priority and fallback to lexicographic sorting
      if (aRecord.priority !== undefined && bRecord.priority !== undefined) {
        if (aRecord.priority === bRecord.priority) {
          // use deterministic comparison instead of localeCompare to avoid locale-specific sorting
          return a < b ? -1 : a > b ? 1 : 0;
        }
        return aRecord.priority - bRecord.priority;
      }
      // all other records are sorted lexicographically, using deterministic comparison instead of localeCompare to avoid locale-specific sorting
      return a < b ? -1 : a > b ? 1 : 0;
    },
  );
  // now that they are sorted, add the index to each record - this is their position in the sorted list and is used to enforce undername limits
  return Object.fromEntries(
    sortedEntries.map(([a, aRecord], index) => [a, { ...aRecord, index }]),
  );
};
