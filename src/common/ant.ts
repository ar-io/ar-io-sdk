/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import {
  AoANTRead,
  AoANTWrite,
  OptionalSigner,
  ProcessConfiguration,
  WithSigner,
  isProcessConfiguration,
  isProcessIdConfiguration,
} from '../types.js';
import {
  AoANTReadable,
  AoANTWriteable,
  InvalidContractConfigurationError,
} from './index.js';

export class ANT {
  /**
   * Initializes an ANT instance.
   *
   * There are two overloads for this function:
   * 1. When a signer is provided in the configuration, it returns an instance of ANTWritable.
   * 2. When a signer is NOT provided in the configuration, it returns an instance of ANTReadable.
   *
   *
   * @param {ContractConfiguration & WithSigner} config - The configuration object.
   *    If a signer is provided, it should be an object that implements the ContractSigner interface.
   *
   * @returns {ANTWritable | ANTReadable} - An instance of ANTWritable if a signer is provided, otherwise an instance of ANTReadable.
   * @throws {Error} - Throws an error if the configuration is invalid.
   *
   * @example
   * Overload 1: When signer is provided
   * ```ts
   * const writable = ANT.init({ signer: mySigner, contract: myContract });
   *```
   * Overload 2: When signer is not provided
   * ```ts
   * const readable = ANT.init({ contract: myContract });
   * ```
   */
  static init(
    config: Required<ProcessConfiguration> & { signer?: undefined },
  ): AoANTRead;
  static init({
    signer,
    ...config
  }: WithSigner<Required<ProcessConfiguration>>): AoANTWrite;
  static init({
    signer,
    ...config
  }: OptionalSigner<Required<ProcessConfiguration>>): AoANTRead | AoANTWrite {
    // ao supported implementation
    if (isProcessConfiguration(config) || isProcessIdConfiguration(config)) {
      if (!signer) {
        return new AoANTReadable(config);
      }
      return new AoANTWriteable({ signer, ...config });
    }

    throw new InvalidContractConfigurationError();
  }
}
