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
  ArNSRecord,
  Balances,
  Gateway,
  WieghtedObserver,
} from './arns-state.js';
import { WalletAddress } from './common.js';

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
  Record<string | number, ArNSRecord>
>;

export type BalancesResponse = ArNSStateResponse<'balances', Balances>;

export type ObserversResponse = ArNSStateResponse<
  'result',
  Record<string, WieghtedObserver[]>
>;

export type ArNSFilters = {
  domains?: string[];
  owners?: WalletAddress[];
  contractTxIds?: string[];
  fqdns?: string[];
  observerWallets?: WalletAddress[];
};
export interface ArIONetworkContract {
  gateways({
    filters,
  }: {
    filters?: Pick<ArNSFilters, 'fqdns' | 'owners' | 'observerWallets'>;
  }): Promise<Pick<GatewaysResponse, 'gateways'>>;
  records({
    filters,
  }: {
    filters?: Pick<ArNSFilters, 'contractTxIds' | 'owners' | 'domains'>;
  }): Promise<Pick<RecordsResponse, 'records'>>;
  balance({
    filters,
  }: {
    filters?: Pick<ArNSFilters, 'owners'>;
  }): Promise<Pick<BalancesResponse, 'balances'>>;
  observers({
    filters,
  }: {
    filters?: Pick<ArNSFilters, 'owners'>;
  }): Promise<Pick<ObserversResponse, 'result'>>;
}

export interface ContractCache {
  /**
   * The ContractStateProvider interface is used to define a contract state provider.
   */
  getContractState<ContractState>({
    contractTxId,
  }: {
    contractTxId: string;
  }): Promise<ContractState>;
}
