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
import { AoClient, BlockHeight } from '../types/common.js';
import {
  AoEligibleDistribution,
  AoEpochData,
  AoEpochDistributed,
  PaginationParams,
  PaginationResult,
  isDistributedEpoch,
} from '../types/io.js';
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
}): Promise<AoEpochData<AoEpochDistributed> | undefined> => {
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
      const transaction =
        await arweave.api.get<AoEpochData<AoEpochDistributed>>(id);
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

export const getEpochDataFromGqlWithCUFallback = async ({
  arweave,
  ao,
  epochIndex,
  processId = ARIO_MAINNET_PROCESS_ID,
}: {
  arweave: Arweave;
  ao: AoClient;
  epochIndex: number;
  processId?: string;
}): Promise<AoEpochData<AoEpochDistributed> | undefined> => {
  const gqlResult = await getEpochDataFromGql({
    arweave,
    epochIndex,
    processId,
  });
  if (gqlResult) {
    return gqlResult;
  }
  const gqlFallbackResult = await getEpochDataFromGqlFallback({
    ao,
    epochIndex,
    processId,
  });
  if (gqlFallbackResult) {
    return gqlFallbackResult;
  }
  return undefined;
};

export const getEpochDataFromGqlFallback = async ({
  ao,
  epochIndex,
  processId = ARIO_MAINNET_PROCESS_ID,
  gqlUrl = 'https://arweave-search.goldsky.com/graphql',
}: {
  ao: AoClient;
  epochIndex: number;
  processId?: string;
  gqlUrl?: string;
}): Promise<AoEpochData<AoEpochDistributed> | undefined> => {
  const query = epochDistributionNoticeGqlQueryFallback({
    epochIndex,
    processId,
  });
  const response = await fetch(gqlUrl, {
    method: 'POST',
    body: query,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const responseJson = (await response.json()) as any;
  if (responseJson.data.transactions.edges.length === 0) {
    return undefined;
  }
  for (const edge of responseJson.data.transactions.edges) {
    const id = edge.node.id;
    const messageResult = await ao
      .result({
        message: id,
        process: processId,
      })
      .catch(() => undefined);
    if (!messageResult) {
      continue;
    }
    for (const message of messageResult.Messages) {
      const data = JSON.parse(message.Data);
      const tags: { name: string; value: string }[] = message.Tags;
      // check if the message results include epoch-distribution-notice for the requested epoch index
      if (
        tags.some(
          (tag) =>
            tag.name === 'Action' && tag.value === 'Epoch-Distribution-Notice',
        ) &&
        tags.some(
          (tag) =>
            tag.name === 'Epoch-Index' && tag.value === epochIndex.toString(),
        )
      ) {
        return parseAoEpochData(data);
      }
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
// fallback query if the distribution notice does not get cranked
export const epochDistributionNoticeGqlQueryFallback = ({
  processId = ARIO_MAINNET_PROCESS_ID,
  owners = ['OAb-n-ZugyN598kZNpfOy0ACelGVmwCQ0kYbgNGDUK8'], // ar.io team wallet ticks once a day
}: {
  epochIndex: number;
  processId?: string;
  owners?: string[];
}): string => {
  return JSON.stringify({
    query: `
      query {
        transactions(
          tags: [
            { name: "Action", values: ["Tick"] }
          ],
          first: 100,
          owners: [${owners.map((a) => `"${a}"`).join(',')}],
          recipients: ["${processId}"],
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
};

export function sortAndPaginateEpochDataIntoEligibleDistributions(
  epochData: AoEpochData,
  params?: PaginationParams<AoEligibleDistribution>,
): PaginationResult<AoEligibleDistribution> {
  const rewards: AoEligibleDistribution[] = [];
  const sortBy = params?.sortBy ?? 'eligibleReward';
  const sortOrder = params?.sortOrder ?? 'desc';
  const limit = params?.limit ?? 100;
  if (!isDistributedEpoch(epochData)) {
    return {
      hasMore: false,
      items: [],
      totalItems: 0,
      limit,
      sortOrder,
      sortBy,
    };
  }
  const eligibleDistributions = epochData?.distributions.rewards.eligible;
  for (const [gatewayAddress, reward] of Object.entries(
    eligibleDistributions,
  )) {
    rewards.push({
      type: 'operatorReward',
      recipient: gatewayAddress,
      eligibleReward: reward.operatorReward,
      cursorId: gatewayAddress + '_' + gatewayAddress,
      gatewayAddress,
    });

    for (const [delegateAddress, delegateRewardQty] of Object.entries(
      reward.delegateRewards,
    )) {
      rewards.push({
        type: 'delegateReward',
        recipient: delegateAddress,
        eligibleReward: delegateRewardQty,
        cursorId: gatewayAddress + '_' + delegateAddress,
        gatewayAddress,
      });
    }
  }

  // sort the rewards by the sortBy

  rewards.sort((a, b) => {
    const aSort = a[sortBy];
    const bSort = b[sortBy];
    if (aSort === bSort || aSort === undefined || bSort === undefined) {
      return 0;
    }
    if (sortOrder === 'asc') {
      return aSort > bSort ? 1 : -1;
    }
    return aSort < bSort ? 1 : -1;
  });

  // paginate the rewards
  const start =
    params?.cursor !== undefined
      ? rewards.findIndex((r) => r.cursorId === params.cursor) + 1
      : 0;
  const end = limit ? start + limit : rewards.length;

  return {
    hasMore: end < rewards.length,
    items: rewards.slice(start, end),
    totalItems: rewards.length,
    limit,
    sortOrder,
    nextCursor: rewards[end]?.cursorId,
    sortBy,
  };
}

export function removeEligibleRewardsFromEpochData(
  epochData: AoEpochData,
): AoEpochData {
  if (!isDistributedEpoch(epochData)) {
    return epochData;
  }
  return {
    ...epochData,
    distributions: {
      ...epochData.distributions,
      rewards: {
        ...epochData.distributions.rewards,
        // @ts-expect-error -- remove eligible rewards
        eligible: undefined,
      },
    },
  };
}
