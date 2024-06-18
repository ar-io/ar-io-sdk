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
import { connect } from '@permaweb/aoconnect';

import ANT_LUA from '../ant-lua-code.js';
import { AOS_MODULE_ID, DEFAULT_SCHEDULER_ID } from '../constants.js';
import { ANTState } from '../contract-state.js';
import { AoClient, Logger } from '../types.js';

/**
 * Spawns an aos process and loads the ANT code. Optionally initializes state.
 * @param param0 configuration for the spawn and eval process.
 * @param options - logger, tags, data - optional, applied to the spawn message.
 * @returns @type {Promise<string | undefined>} - processId or undefined
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { createDataItemSigner } from '@permaweb/aoconnect';
 * const antId = await spawnANT({
 *  signer: createDataItemSigner(window.arweaveWallet)
 * })
 * ```
 */
export async function spawnANT(
  {
    module = AOS_MODULE_ID,
    luaString = ANT_LUA,
    ao = connect(),
    scheduler = DEFAULT_SCHEDULER_ID,
    signer,
    state,
  }: {
    module: string;
    luaString: string;
    ao: AoClient;
    scheduler: string;
    signer: (...args: any) => any;
    state?: ANTState;
  },
  options: {
    logger?: Logger;
    tags?: { name: string; value: string }[];
    data?: string;
  } = {},
): Promise<string | undefined> {
  let processId: string | undefined = undefined;
  try {
    /**
     * 1. spawn aos process
     * 2. call eval with lua source code to load the ANT code
     * 3. Initialize state if provided
     */

    // 1. spawn
    options.logger?.info('Spawning ANT process.', {
      module,
      scheduler,
    });
    processId = await ao.spawn({
      module,
      scheduler,
      signer,
      data: options?.data,
      tags: [
        ...(options?.tags ?? []),
        { name: 'App-Name', value: 'ArNS-AO-ANT' },
      ],
    });

    let antCodeLoaded = false;
    let retries = 0;
    const retryDelay = 5000;
    const maxRetries = 5;
    // retry is necessary since the process may not be ready to receive messages immediately
    while (antCodeLoaded === false) {
      // 2. call eval with lua source code
      const evalResult = await ao
        .message({
          process: processId,
          tags: [{ name: 'Action', value: 'Eval' }],
          data: luaString,
          signer,
        })
        .catch((error) => new Error(error));

      if (evalResult instanceof Error && retries < maxRetries) {
        options.logger?.error(
          `Error messaging process: ${evalResult.message}. Retrying in 2 seconds.`,
          {
            processId,
            error: evalResult,
          },
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retries++;
        continue;
      } else if (evalResult instanceof Error && retries >= maxRetries) {
        throw new Error(
          `Error messaging process: ${evalResult.message}. Max retries reached. Unable to load lua code.`,
        );
      } else {
        options.logger?.info('ANT code loaded.', {
          processId,
          evalId: evalResult,
        });
        antCodeLoaded = true;
      }
    }
    if (state) {
      // 3. Initialize state if provided
      const stateResult = await ao
        .message({
          process: processId,
          tags: [{ name: 'Action', value: 'Initialize-State' }],
          data: JSON.stringify(state),
          signer,
        })
        .catch((error) => new Error(error));
      if (stateResult instanceof Error) {
        throw new Error(
          `Error messaging process: ${stateResult.message}. Unable to initialize state.`,
        );
      }
      options.logger?.info('State initialized.', {
        processId,
        stateMessageId: stateResult,
      });
    }
  } catch (error) {
    options.logger?.error('Error spawning ANT process.', {
      error: error.message,
      processId,
    });
  }
  return processId;
}
