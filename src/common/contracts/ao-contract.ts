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
import { connect } from '@permaweb/aoconnect';

import { AOContract, BaseContract, Logger } from '../../types.js';
import { DefaultLogger } from '../logger.js';

export class AOProcess<T> implements BaseContract<T>, AOContract {
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
    // scheduler = 'default-scheduler-tx-id',
    connectionConfig,
    logger = new DefaultLogger(),
  }: {
    processId: string;
    // scheduler?: string;
    connectionConfig?: {
      CU_URL: string;
      MU_URL: string;
      GATEWAY_URL: string;
      GRAPHQL_URL: string;
    };
    logger?: DefaultLogger;
  }) {
    this.processId = processId;
    // this.scheduler = scheduler;
    this.logger = logger;
    this.ao = connect(connectionConfig);
  }

  async getState(): Promise<T> {
    this.logger.info(`Fetching process state`, {
      process: this.processId,
    });
    const state = await this.read<T>({
      tags: [{ name: 'Action', value: 'State' }],
    });
    return state;
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

  async send<K>({
    tags,
    data,
  }: {
    tags: Array<{ name: string; value: string }>;
    data: K;
  }): Promise<K> {
    this.logger.debug(`Evaluating send interaction on contract`, {
      tags,
      data,
    });

    const result = await this.ao.message({
      process: this.processId,
      tags,
      data: JSON.stringify(data),
    });

    if (result.Error !== undefined) {
      throw new Error(result.Error);
    }

    this.logger.debug(`Send interaction result`, {
      result,
    });

    const res: K = JSON.parse(result.Messages[0].Data);
    return res;
  }
}
