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

/**
 * Split an ArNS name into its undername + base parts using the same rule as the
 * on-chain `splitn(2, '_')` in `programs/ario-core/src/instructions/primary_name.rs`:
 * everything before the first '_' is the undername, the rest is the base. A bare
 * name (no '_') has no undername and resolves the apex record.
 *
 * Shared by the primary-name write path (`SolanaARIOWriteable`) and ArNS name
 * resolution (`SolanaARIOReadable.resolveArNSName`) so both use one canonical
 * split rule. Lowercases the input to match contract behavior — ArNS names are
 * case-insensitive and stored lowercase on-chain.
 */
export function splitPrimaryName(name: string): {
  isUndername: boolean;
  baseName: string;
  undername: string | null;
} {
  const lower = name.toLowerCase();
  const ix = lower.indexOf('_');
  if (ix === -1) {
    return { isUndername: false, baseName: lower, undername: null };
  }
  return {
    isUndername: true,
    baseName: lower.slice(ix + 1),
    undername: lower.slice(0, ix),
  };
}
