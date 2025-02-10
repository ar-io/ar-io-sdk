/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import Arweave from 'arweave';

import { ARIO_MAINNET_PROCESS_ID, ARWEAVE_TX_REGEX } from '../constants.js';
import { BlockHeight } from '../types/common.js';
import { AoEpochData, PaginationParams } from '../types/io.js';
import { parseAoEpochData } from './ao.js';

export const validateArweaveId = (id: string): boolean => {
  return ARWEAVE_TX_REGEX.test(id);
};

export function isBlockHeight(height: string | number): height is BlockHeight {
  return height !== undefined && !isNaN(parseInt(height.toString()));
}

/**
 * Prune tags that are undefined or empty.
 * @param tags - The tags to prune.
 * @returns The pruned tags.
 */
export const pruneTags = (
  tags: { name: string; value: string | undefined }[],
): { name: string; value: string }[] => {
  return tags.filter(
    (tag: {
      name: string;
      value: string | undefined;
    }): tag is { name: string; value: string } =>
      tag.value !== undefined && tag.value !== '',
  );
};

export const paginationParamsToTags = <T>(
  params?: PaginationParams<T>,
): { name: string; value: string }[] => {
  const tags = [
    { name: 'Cursor', value: params?.cursor?.toString() },
    { name: 'Limit', value: params?.limit?.toString() },
    { name: 'Sort-By', value: params?.sortBy?.toString() },
    { name: 'Sort-Order', value: params?.sortOrder?.toString() },
  ];

  return pruneTags(tags);
};

/**
 * Get the epoch with distribution data for the current epoch
 * @param arweave - The Arweave instance
 * @returns The epoch with distribution data
 */
export const getEpochDataFromGql = async ({
  arweave,
  epochIndex,
  processId = ARIO_MAINNET_PROCESS_ID,
  retries = 3,
  gqlUrl = 'https://arweave-search.goldsky.com/graphql',
}: {
  arweave: Arweave;
  epochIndex: number;
  processId?: string;
  retries?: number;
  gqlUrl?: string;
}): Promise<AoEpochData | undefined> => {
  // fetch from gql
  const query = epochDistributionNoticeGqlQuery({ epochIndex, processId });
  // add three retries with exponential backoff
  for (let i = 0; i < retries; i++) {
    try {
      const response = (await fetch(gqlUrl, {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json())) as any;

      // parse the nodes to get the id
      if (response?.data?.transactions?.edges?.length === 0) {
        return undefined;
      }
      const id = response.data.transactions.edges[0].node.id;
      // fetch the transaction from arweave
      const transaction = await arweave.api.get<AoEpochData>(id);
      // assert it is the correct type
      return parseAoEpochData(transaction.data);
    } catch (error) {
      if (i === retries - 1) throw error; // Re-throw on final attempt
      // exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000),
      );
    }
  }
  return undefined;
};

/**
 * Get the epoch with distribution data for the current epoch
 * @param arweave - The Arweave instance
 * @param epochIndex - The index of the epoch
 * @param processId - The process ID (optional, defaults to ARIO_MAINNET_PROCESS_ID)
 * @returns string - The stringified GQL query
 */
export const epochDistributionNoticeGqlQuery = ({
  epochIndex,
  processId = ARIO_MAINNET_PROCESS_ID,
  authorities = ['fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY'],
}): string => {
  // write the query
  const gqlQuery = JSON.stringify({
    query: `
      query {
        transactions(
          tags: [
            { name: "From-Process", values: ["${processId}"] }
            { name: "Action", values: ["Epoch-Distribution-Notice"] }
            { name: "Epoch-Index", values: ["${epochIndex}"] }
            { name: "Data-Protocol", values: ["ao"] }
          ],
          owners: [${authorities.map((a) => `"${a}"`).join(',')}],
          first: 1,
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
            }
          }
        }
      }
    `,
  });
  return gqlQuery;
};
