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
import Arweave from 'arweave';
import { GQLNodeInterface } from 'warp-contracts';

import { AbortError } from '../../common/error.js';
import { DataProtocolTransaction } from '../../types.js';
import { MAX_REQUEST_SIZE } from './common.js';

/**
 * @param arweave - arweave instance to perform gql request
 * @param address - address of the wallet to get transactions for
 * @param signal - signal to abort the request
 * @returns @type {Promise<DataProtocolTransaction[]>} - returns the list of data protocol txs, for e.g smartweave contracts
 */
export async function getSmartweaveContractsFromGQL({
  address,
  arweave,
  signal,
  // TODO: add retry provider - eg pass in fetcher for the query
}: {
  arweave: Arweave;
  address: string;
  signal?: AbortSignal;
}): Promise<DataProtocolTransaction[]> {
  let hasNextPage = false;
  let cursor: string | undefined;
  const protocolTxs = new Set<DataProtocolTransaction>();
  do {
    const queryObject = {
      query: `
      { 
          transactions (
              owners:["${address}"]
              tags: [
                      {
                        name: 'App-Name',
                        values: ['SmartWeaveContract'],
                      },
                    ],
              sort: HEIGHT_DESC,
              first: ${MAX_REQUEST_SIZE},
              bundledIn: null,
              ${cursor !== undefined ? `after: "${cursor}"` : ''}
          ) {
              pageInfo {z
                  hasNextPage
              }
              edges {
                  cursor
                  node {
                      id
                      block {
                          height
                      }
                      tags {
                          name
                          value
                      }
                  }
              }
          }
      }`,
    };

    if (signal?.aborted) {
      throw new AbortError('GraphQL request was aborted.');
    }

    const { status, ...response } = await arweave.api.post(
      '/graphql',
      queryObject,
      {
        signal,
      },
    );

    if (status == 429) {
      // Rate limited, wait for 10 seconds and retry
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      continue;
    }

    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`,
      );
    }

    if (!response.data.data?.transactions?.edges?.length) {
      continue;
    }
    response.data.data.transactions.edges
      .map((e: { node: GQLNodeInterface }) => ({
        id: e.node.id,
        tags: e.node.tags,
        data: e.node.data,
      }))
      .forEach((c: { def: DataProtocolTransaction; cursor: string }) => {
        protocolTxs.add(c.def);
      });
    cursor =
      response.data.data.transactions.edges[MAX_REQUEST_SIZE - 1]?.cursor;
    hasNextPage =
      response.data.data.transactions.pageInfo?.hasNextPage ?? false;
  } while (hasNextPage);

  return [...protocolTxs];
}

/**
 * @param arweave - arweave instance to perform gql request
 * @param address - address of the wallet to get transactions for
 * @param contractTxId - contract tx id to filter the transactions
 * @param signal - signal to abort the request
 * @returns @type {Promise<DataProtocolTransaction[]>} - returns the list of data protocol txs, for e.g smartweave contracts
 */
export async function getSmartweaveTransactionsFromGQL({
  address,
  contractTxId,
  arweave,
  signal,
  // TODO: add retry provider - eg pass in fetcher for the query
}: {
  arweave: Arweave;
  address: string;
  contractTxId: string;
  signal?: AbortSignal;
}): Promise<DataProtocolTransaction[]> {
  let hasNextPage = false;
  let cursor: string | undefined;
  const protocolTxs = new Set<DataProtocolTransaction>();
  do {
    const queryObject = {
      query: `
      { 
          transactions (
              owners:["${address}"]
              tags: [
                      {
                        name: 'App-Name',
                        values: ['SmartWeaveAction'],
                      },
                      {
                        name: 'Contract',
                        values: ['${contractTxId}'],
                      },
                    ],
              sort: HEIGHT_DESC,
              first: ${MAX_REQUEST_SIZE},
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
                      tags {
                          name
                          value
                      }
                  }
              }
          }
      }`,
    };

    if (signal?.aborted) {
      throw new AbortError('GraphQL request was aborted.');
    }

    const { status, ...response } = await arweave.api.post(
      '/graphql',
      queryObject,
      {
        signal,
      },
    );

    if (status == 429) {
      // Rate limited, wait for 10 seconds and retry
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      continue;
    }

    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`,
      );
    }

    if (!response.data.data?.transactions?.edges?.length) {
      continue;
    }
    response.data.data.transactions.edges
      .map((e: { node: GQLNodeInterface }) => ({
        id: e.node.id,
        tags: e.node.tags,
        data: e.node.data,
      }))
      .forEach((c: { def: DataProtocolTransaction; cursor: string }) => {
        protocolTxs.add(c.def);
      });
    cursor =
      response.data.data.transactions.edges[MAX_REQUEST_SIZE - 1]?.cursor;
    hasNextPage =
      response.data.data.transactions.pageInfo?.hasNextPage ?? false;
  } while (hasNextPage);

  return [...protocolTxs];
}

export async function getContractsTransferredToOrControlledByWallet(
  arweave: Arweave,
  params: { address: string },
  signal?: AbortSignal,
): Promise<DataProtocolTransaction[]> {
  const { address } = params;
  let hasNextPage = false;
  let cursor: string | undefined;
  const protocolTxs = new Set<DataProtocolTransaction>();
  do {
    const queryObject = {
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
                  first: ${MAX_REQUEST_SIZE},
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

    if (signal?.aborted) {
      throw new AbortError('GraphQL request was aborted.');
    }

    const { status, ...response } = await arweave.api.post(
      '/graphql',
      queryObject,
      {
        signal,
      },
    );

    if (status == 429) {
      // Rate limited, wait for 10 seconds and retry
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      continue;
    }

    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`,
      );
    }

    if (!response.data.data?.transactions?.edges?.length) {
      continue;
    }

    response.data.data.transactions.edges
      .map((e: { node: GQLNodeInterface }) => {
        // get the contract id of the interaction
        const contractTag = e.node.tags.find(
          (t: { name: string; value: string }) => t.name === 'Contract',
        );
        // we want to preserve the cursor here, so add even if a duplicate and the set will handle removing the contract if its a duplicate
        return {
          id: contractTag?.value,
          tags: [],
          data: 0,
        };
      })
      .forEach(
        (c: {
          tx: DataProtocolTransaction;
          cursor: string;
          hasNextPage: boolean;
        }) => {
          protocolTxs.add(c.tx);
        },
      );
    cursor =
      response.data.data.transactions.edges[MAX_REQUEST_SIZE - 1]?.cursor ??
      undefined;
    hasNextPage =
      response.data.data.transactions.pageInfo?.hasNextPage ?? false;
  } while (hasNextPage);

  return [...protocolTxs];
}
