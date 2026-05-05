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
import { AoMessageResult } from './common.js';

export interface AoANTRegistryRead {
  accessControlList(params: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }>;
  /**
   * Alias for `accessControlList` with a clearer name. Returns the ANTs
   * owned or controlled by the given address. Implemented by both the AO
   * and Solana backends so consumers can switch backends without renaming
   * calls.
   */
  getAntsForAddress?(params: {
    address: string;
  }): Promise<{ Owned: string[]; Controlled: string[] }>;
}

/**
 * Cross-backend ACL relationship. Both AO and Solana model the same two
 * roles today (owner / controller); the Solana paginated registry stores
 * them as a `u8` byte (`ACL_ROLE_*` constants) but the public surface uses
 * strings so consumers don't have to know the on-chain encoding.
 */
export type AclMaintenanceRole = 'owner' | 'controller';

/**
 * Mutation we want the on-chain ACL to reflect once the transaction lands.
 * `user` and `asset` are wallet/process addresses (base58 on Solana, AO
 * address on AO).
 *
 * On the Solana backend this is the input to the registry's internal
 * preflight planner, surfaced via the workflow helpers
 * (`bootstrapOwnerOnSpawn`, `bulkRemoveControllerEntries`) — they
 * translate it into the minimum `register_acl_config` / `add_acl_page`
 * / `record_acl_*` / `remove_acl_*` instruction set against the
 * paginated `AclConfig` + `AclPage` layout (see ADR-012). On AO, the
 * registry process owns its own ACL bookkeeping, so the equivalent is
 * a no-op.
 */
export type AclMaintenanceOp = {
  action: 'record' | 'remove';
  role: AclMaintenanceRole;
  user: string;
  asset: string;
};

export interface AoANTRegistryWrite extends AoANTRegistryRead {
  register(params: { processId: string }): Promise<AoMessageResult>;
}
