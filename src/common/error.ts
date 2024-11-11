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

export class InvalidSignerError extends BaseError {
  constructor() {
    super(
      'Invalid signer. Please provide a valid signer to interact with the contract.',
    );
  }
}

export class InvalidContractConfigurationError extends BaseError {
  constructor() {
    super('Invalid contract configuration');
  }
}

export class InvalidProcessConfigurationError extends BaseError {
  constructor() {
    super('Invalid process configuration');
  }
}

export class AbortError extends BaseError {}

export class VaultNotFound extends BaseError {
  constructor() {
    super('Vault not found');
  }
}
