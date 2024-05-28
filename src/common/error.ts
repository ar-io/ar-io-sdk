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
export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFound extends BaseError {}

export class BadRequest extends BaseError {}

export class FailedRequestError extends BaseError {
  constructor(status: number, message: string) {
    super(`Failed request: ${status}: ${message}`);
  }
}

export class UnknownError extends BaseError {}

export class WriteInteractionError extends BaseError {}

export const INVALID_SIGNER_ERROR =
  'Invalid signer. Please provide a valid signer to interact with the contract.';

export class InvalidSignerError extends BaseError {
  constructor() {
    super(INVALID_SIGNER_ERROR);
  }
}
export const INVALID_CONTRACT_CONFIGURATION_ERROR =
  'Invalid contract configuration';
export class InvalidContractConfigurationError extends BaseError {
  constructor() {
    super(INVALID_CONTRACT_CONFIGURATION_ERROR);
  }
}

export class AbortError extends BaseError {}
