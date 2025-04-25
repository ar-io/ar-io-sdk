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
import { webcrypto } from 'crypto';

/**
 * Cryptographically secure helper for randomness, does not support seeding
 * @param min - the minimum value
 * @param max - the maximum value
 * @returns a random integer between min and max
 */
export const randomInt = (min: number, max: number): number => {
  const [rand] = webcrypto.getRandomValues(new Uint32Array(1));
  return min + (rand % (max - min));
};
