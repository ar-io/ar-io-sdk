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
import { ResponseWithData } from 'arweave/node/lib/api.js';

export async function getAllPages({
  queryBuilder,
  pageCallback,
  arweave,
}: {
  queryBuilder: (cursor?: string) => { query: string };
  pageCallback: (response: Omit<ResponseWithData, 'status'>) => void;
  arweave: Arweave;
}): Promise<void> {
  let cursor: string | undefined = undefined;
  let hasNextPage = true;
  let retries = 0;

  do {
    const { status, ...response } = await arweave.api.post(
      '/graphql',
      queryBuilder(cursor),
    );
    if (status == 429) {
      if (retries > 3) throw new Error('Rate limit exceeded, too many retries');
      console.warn('Rate limit exceeded, waiting for 10 seconds');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      retries++;
      continue;
    }
    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`,
      );
    }
    pageCallback(response);

    cursor = response.data.data.transactions.edges.at(-1)?.cursor ?? undefined;
    hasNextPage = response.data.data.transactions.pageInfo.hasNextPage;
    retries = 0;
  } while (hasNextPage);
}
