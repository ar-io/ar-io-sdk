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
import { connect, message, result } from '@permaweb/aoconnect';
import { createData } from 'arbundles';

import { AOContract, ContractSigner, Logger } from '../../types.js';
import { DefaultLogger } from '../logger.js';

export class AOProcess implements AOContract {
  private logger: Logger;
  private processId: string;
  // private scheduler: string;
  private ao: {
    result: any;
    results: any;
    message: any;
    spawn: any;
    monitor: any;
    unmonitor: any;
    dryrun: any;
    assign: any;
  };

  constructor({
    processId,
    // connectionConfig,
    // scheduler = '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
    logger = new DefaultLogger({ level: 'debug' }),
  }: {
    processId: string;
    scheduler?: string;
    connectionConfig?: {
      CU_URL: string;
      MU_URL: string;
      GATEWAY_URL: string;
      GRAPHQL_URL: string;
    };
    logger?: DefaultLogger;
  }) {
    this.processId = processId;
    this.logger = logger;
    // this.scheduler = scheduler;
    this.ao = connect();
  }

  // TODO: could abstract into our own interface that constructs different signers
  async createAoSigner(
    signer: ContractSigner,
  ): Promise<
    (args: {
      data: string | Buffer;
      tags?: { name: string; value: string }[];
      target?: string;
      anchor?: string;
    }) => Promise<{ id: string; raw: ArrayBuffer }>
  > {
    // ensure appropriate permissions are granted with injected signers.
    if (signer.publicKey === undefined && 'setPublicKey' in signer) {
      await signer.setPublicKey();
    }

    const aoSigner = async ({ data, tags, target, anchor }) => {
      const dataItem = createData(data, signer, { tags, target, anchor });
      const signedData = dataItem.sign(signer).then(async () => ({
        id: await dataItem.id,
        raw: await dataItem.getRaw(),
      }));
      return signedData;
    };

    return aoSigner;
  }

  async read<K>({
    tags,
  }: {
    tags?: Array<{ name: string; value: string }>;
  }): Promise<K> {
    this.logger.debug(`Evaluating read interaction on contract`, {
      tags,
    });
    // map tags to inputs
    const result = await this.ao.dryrun({
      process: this.processId,
      tags,
    });

    if (result.Error !== undefined) {
      throw new Error(result.Error);
    }

    if (result.Messages.length === 0) {
      throw new Error('Process does not support provided action.');
    }

    this.logger.debug(`Read interaction result`, {
      result: result.Messages[0].Data,
    });

    const data: K = JSON.parse(result.Messages[0].Data);
    return data;
  }

  async send<I, K>({
    tags,
    data,
    signer,
  }: {
    tags: Array<{ name: string; value: string }>;
    data?: I;
    signer: ContractSigner;
  }): Promise<{ id: string; result?: K }> {
    this.logger.debug(`Evaluating send interaction on contract`, {
      tags,
      data,
      processId: this.processId,
    });

    const messageId = await message({
      process: this.processId,
      tags,
      data: JSON.stringify(data),
      signer: await this.createAoSigner(signer),
    });

    this.logger.debug(`Sent message to process`, {
      messageId,
      proceessId: this.processId,
    });

    // check the result of the send interaction
    const output = await result({
      message: messageId,
      process: this.processId,
    });

    this.logger.debug('Message result', {
      output,
      messageId,
      processId: this.processId,
    });

    // check if there are any Messages in the output
    if (output.Messages.length === 0) {
      return { id: messageId };
    }

    const tagsOutput = output.Messages[0].Tags;
    const error = tagsOutput.find((tag) => tag.name === 'Error');
    // if there's an Error tag
    if (error) {
      // parse the data
      const result = output.Messages[0].Data;
      throw new Error(`${error.Value}: ${result}`);
    }

    const resultData: K = JSON.parse(output.Messages[0].Data);

    // console.log(result);

    // if (result.Error !== undefined) {
    //   throw new Error(result.Error);
    // }

    // this.logger.debug(`Send interaction result`, {
    //   result,
    // });

    return { id: messageId, result: resultData };
  }
}
