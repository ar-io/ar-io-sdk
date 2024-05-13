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
import { WalletAddress } from '../../../types.js';

export function buildDeployedSmartweaveContractsQuery({
  address,
  cursor,
}: {
  address: WalletAddress;
  cursor?: string;
}): { query: string } {
  return {
    query: `
      { 
          transactions (
              owners:["${address}"]
              tags:[
                {
                  name: "App-Name",
                  values: ["SmartWeaveContract"]
                },
              ],
              sort: HEIGHT_DESC,
              first: ${100},
              bundledIn: null,
              ${cursor !== undefined ? `after: "${cursor}"` : ''}
          ) {
              pageInfo {
                  hasNextPage
              }
              edges {
                  cursor
                  node {
                      id
                      block {
                          height
                      }
                  }
              }
          }
      }`,
  };
}
