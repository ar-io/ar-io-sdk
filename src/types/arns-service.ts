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
import { EvalStateResult, EvaluationOptions } from 'warp-contracts';

import {
  ArNSNameData,
  Balances,
  Gateway,
  WeightedObserver,
} from './arns-state.js';

export type EvaluatedContractState<ContractState> =
  EvalStateResult<ContractState> & {
    sortKey: string;
    evaluationOptions: EvaluationOptions;
    contractTxId: string;
  };

/* ArNS Service Responses */

export type ArNSStateResponse<StateKey extends string, StateObject> = Pick<
  EvaluatedContractState<unknown>,
  'contractTxId' | 'sortKey' | 'evaluationOptions'
> &
  Record<StateKey, StateObject>;

export type GatewaysResponse = ArNSStateResponse<
  'gateways',
  Record<string, Gateway>
>;

export type RecordsResponse = ArNSStateResponse<
  'records',
  Record<string | number, ArNSNameData>
>;

export type BalancesResponse = ArNSStateResponse<'balances', Balances>;

export type ObserversResponse = ArNSStateResponse<
  'result',
  Record<string, WeightedObserver[]>
>;

export interface ArIONetworkContract {
  gateways(): Promise<Pick<GatewaysResponse, 'gateways'>>;
  records(): Promise<Pick<RecordsResponse, 'records'>>;
  balance(): Promise<Pick<BalancesResponse, 'balances'>>;
  observers(): Promise<Pick<ObserversResponse, 'result'>>;
}

export interface ContractCache {
  /**
   * The ContractStateProvider interface is used to define a contract state provider.
   */
  getContractState<ContractState>({
    contractTxId,
    blockHeight,
    sortKey,
  }: {
    contractTxId: string;
    blockHeight?: number;
    sortKey?: string;
  }): Promise<ContractState>;
}
