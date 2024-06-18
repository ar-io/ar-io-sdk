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
import { ProcessId, WalletAddress } from '../../types.js';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
export const getANTProcessesOwnedByWallet = async ({
  address,
}: {
  address: WalletAddress;
}): Promise<ProcessId[]> => {
  // TODO: insert gql query to find ANT processes owned by wallet given wallet, this may involve dry runs to evaluate ownership and controllership
  return ['LGN8MUAMvTvr6i-WGdXBu1z9jz01LZVnVwklp9z7D6U'];
};
