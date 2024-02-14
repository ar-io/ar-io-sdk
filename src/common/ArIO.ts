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
import { ArweaveTransactionID } from '../types.js';
import { ContractStateProvider } from '../types.js';
import { DefaultLogger } from './logger.js';

export class ArIO implements ContractStateProvider {
  private contractStateProvider: ContractStateProvider;
  private logger: DefaultLogger;

  constructor({
    contractStateProvider,
    logger = new DefaultLogger({
      level: 'debug',
      logFormat: 'simple',
    }),
  }: {
    contractStateProvider: ContractStateProvider;
    logger?: DefaultLogger;
  }) {
    this.contractStateProvider = contractStateProvider;
    this.logger = logger;
    this.logger.debug(
      `ArIO initialized with ${contractStateProvider.constructor.name} as contract state provider`,
    );
  }

  /**
   * Fetches the state of a contract.
   * @param {string} contractTxId - The Arweave transaction id of the contract.
   */
  async getContractState<ContractState>({
    contractTxId,
  }: {
    contractTxId: ArweaveTransactionID;
  }): Promise<ContractState> {
    return this.contractStateProvider.getContractState({ contractTxId });
  }
}
