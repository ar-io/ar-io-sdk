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
import { connect, createDataItemSigner } from '@permaweb/aoconnect';

import {
  BaseContract,
  ContractSigner,
  EvaluationParameters,
  ReadContract,
  WriteContract,
} from '../../common.js';
import { validateArweaveId } from '../../utils/arweave.js';
import { mixInto } from '../../utils/common.js';
import { InvalidSignerError } from '../error.js';

// TODO: aoconnect current does not export the types for the functions. We need to add those once they are available.
// refer: https://github.com/permaweb/ao/issues/593
export class AoClient {
  private signer: any;
  // aoconnect functions
  result: any;
  results: any;
  message: any;
  spawn: any;
  monitor: any;
  unmonitor: any;
  dryrun: any;
  constructor(
    params: {
      signer?: ContractSigner;
      muUrl?: string;
      cuUrl?: string;
      gatewayUrl?: string;
    } = {},
  ) {
    // bind aoconnect functions to client
    mixInto(
      this,
      connect({
        MU_URL: params.muUrl,
        CU_URL: params.cuUrl,
        GATEWAY_URL: params.gatewayUrl,
      }),
    );
    this.connect(params.signer);
  }
  connect(signer?: ContractSigner): void {
    if (!signer) {
      throw new InvalidSignerError();
    }
    // TODO: add more signer chain types (eg eth, solana etc.)
    this.signer = createDataItemSigner(signer);
  }

  connected(): boolean {
    return this.signer !== undefined;
  }
}

export class AoContract<T>
  implements BaseContract<T>, ReadContract, WriteContract
{
  public readonly processId: string;
  private aoClient: AoClient;
  constructor({
    processId,
    aoClient = new AoClient(),
  }: {
    processId: string;
    aoClient?: AoClient;
  }) {
    if (!validateArweaveId(processId)) {
      throw new Error('Invalid processId');
    }
    this.processId = processId;
    this.aoClient = aoClient;
  }

  async getState(): Promise<T> {
    // how do we get the state of the contract? its process specific, but typically `Info` is the state handler.
    const res = await this.aoClient.dryrun({
      process: this.processId,
      tags: [
        {
          name: 'Action',
          value: 'Info',
        },
      ],
    });
    // could also be messages.tags but that is limited to 2kb, so better to use the Data key as stringified JSON or b64 encoded.
    return JSON.parse(res.messages[0].Data) as T;
  }

  connect(signer: ContractSigner): this {
    this.aoClient.connect(signer);
    return this;
  }
  async readInteraction<Input, State>({
    functionName,
    inputs,
  }: EvaluationParameters<{
    functionName: string;
    inputs?: Input | undefined;
  }>): Promise<State> {
    const messageId = await this.aoClient.message({
      process: this.processId,
      // NOTE: the interactions here are contract specific, so we need to have a way to standardize the tags for each contract
      // normally the tags would be the function name and the inputs, but that restricts the amount of data we can send
      tags: [
        {
          name: 'Action',
          value: functionName,
        },
      ],
      data: JSON.stringify(inputs),
    });
    const result = await this.aoClient.result({
      process: this.processId,
      messageId,
    });
    // what is the standard way of reading the result?
    // we may not be able to have this abstract function - each method would need to have its own API implemented, since each could return data differenty
    // data can be returned as binary, json, b64 encoded, tags, etc. - we need to have a way to standardize this or route it to the correct method and return as normalized data type.

    // Assume the result is returned as stringified JSON in the data key for now
    return JSON.parse(result.Data);
  }
  async writeInteraction<Input, State>({
    functionName,
    inputs,
  }: EvaluationParameters<{
    functionName: string;
    inputs?: Input | undefined;
  }>): Promise<State> {
    const messageId = await this.aoClient.message({
      process: this.processId,
      tags: [
        {
          name: 'Action',
          value: functionName,
        },
      ],
      data: JSON.stringify(inputs),
    });
    return messageId;
  }
}
