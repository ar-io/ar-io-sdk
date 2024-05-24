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

import { EvaluationTimeoutError } from '../../common/error.js';
import { DataProtocolTransaction } from '../../types.js';

export const MAX_REQUEST_SIZE = 100;

// TODO: add ao contract tags

export const SMARTWEAVE_CONTRACT_TAGS = [
  {
    name: 'App-Name',
    values: ['SmartWeaveContract'],
  },
];

/**
 * @param arweave - arweave instance to perform gql request
 * @param address - address of the wallet to get transactions for
 * @param protocolTags - the data protocol to filter by
 * @param signal - signal to abort the request
 * @returns @type {Promise<DataProtocolTransaction[]>} - returns the list of data protocol txs, for e.g smartweave contracts
 */
export async function getDataProtocolTransactionsByOwner({
  address,
  arweave,
  protocolTags,
  signal,
}: {
  arweave: Arweave;
  address: string;
  protocolTags: { name: string; values: string[] }[];
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
              tags: ${protocolTags},
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
      throw new EvaluationTimeoutError('GraphQL request was aborted.');
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

export async function getSmartweaveContractsFromGQL(params: {
  arweave: Arweave;
  address: string;
  signal?: AbortSignal;
}) {
  return getDataProtocolTransactionsByOwner({
    ...params,
    protocolTags: SMARTWEAVE_CONTRACT_TAGS,
  });
}
