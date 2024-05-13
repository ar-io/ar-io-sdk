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
export function buildControlledOrOwnedByQuery({
  address,
  cursor,
}: {
  address: string;
  cursor?: string;
}): { query: string } {
  return {
    query: `
          { 
              transactions (
                  tags:[
                    {
                      name: "App-Name",
                      values: ["SmartWeaveAction"]
                    },
                    {
                      name: "Input",
                      values: ${JSON.stringify([
                        // duplicated because the order of the input matters when querying gql
                        {
                          function: 'setController',
                          target: address,
                        },
                        {
                          target: address,
                          function: 'setController',
                        },
                        {
                          function: 'transfer',
                          target: address,
                          qty: 1,
                        },
                        {
                          function: 'transfer',
                          qty: 1,
                          target: address,
                        },
                        {
                          target: address,
                          function: 'transfer',
                          qty: 1,
                        },
                        {
                          target: address,
                          qty: 1,
                          function: 'transfer',
                        },
                        {
                          qty: 1,
                          target: address,
                          function: 'transfer',
                        },
                        {
                          qty: 1,
                          function: 'transfer',
                          target: address,
                        },
                        // removing qty just for coverage
                        {
                          function: 'transfer',
                          target: address,
                        },
                        {
                          target: address,
                          function: 'transfer',
                        },
                      ])
                        .replace(/"/g, '\\"')
                        .replace(/\{/g, '"{')
                        .replace(/\}/g, '}"')}
                   }
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
                          tags {
                            name
                            value
                          }
                          block {
                              height
                          }
                      }
                  }
              }
          }`,
  };
}
