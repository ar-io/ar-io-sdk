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
export const ARWEAVE_TX_REGEX = new RegExp('^[a-zA-Z0-9_-]{43}$');

/** FQDN regex that matches the one used in the ArNS contract. */
export const FQDN_REGEX = new RegExp(
  '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
);

// sortkey: padded blockheight to 12, JS timestamp, hash of transactionID + block hash. Timestamp only applicable to L2 and normally is all zeros.
export const SORT_KEY_REGEX = new RegExp(
  '^[0-9]{12},[0-9]{13},[a-fA-F0-9]{64}$',
);
export const ARNS_TESTNET_REGISTRY_TX =
  process.env.ARNS_REGISTRY_TX ?? 'bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U';

export const ARNS_DEVNET_REGISTRY_TX =
  '_NctcA2sRy1-J4OmIQZbYFPM17piNcbdBPH2ncX2RL8';

export const ARIO_DEVNET_PROCESS_ID =
  'GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc';
// backwards compatibility - TODO: remove in v2.0.0
export const arioDevnetProcessId = ARIO_DEVNET_PROCESS_ID;
export const ARIO_TESTNET_PROCESS_ID =
  'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA';

export const ARIO_MAINNET_PROCESS_ID =
  'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE';

export const ANT_REGISTRY_ID = 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';
export const MARIO_PER_ARIO = 1_000_000;
export const AOS_MODULE_ID = 'pb4fCvdJqwT-_bn38ERMdqnOF4weRMjoJ6bY6yfl4a8';
export const ANT_LUA_ID = 'OO2ewZKq4AHoqGQmYUIl-NhJ-llQyFJ3ha4Uf4-w5RI';

export const AO_AUTHORITY = 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY';
export const DEFAULT_SCHEDULER_ID =
  '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';
