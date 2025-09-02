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

export const ARIO_DEVNET_PROCESS_ID =
  'GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc';
// backwards compatibility - TODO: remove in v2.0.0
export const arioDevnetProcessId = ARIO_DEVNET_PROCESS_ID;
export const ARIO_TESTNET_PROCESS_ID =
  'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA';

export const ARIO_MAINNET_PROCESS_ID =
  'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE';

export const ANT_REGISTRY_TESTNET_ID =
  'RR0vheYqtsKuJCWh6xj0beE35tjaEug5cejMw9n2aa8';
export const ANT_REGISTRY_ID = 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';
export const MARIO_PER_ARIO = 1_000_000;

/**
 * @deprecated - use ANT.versions.getLatestANTVersion() to get latest ANT module
 **/
export const AOS_MODULE_ID = 'nEjlSFA_8narJlVHApbczDPkMc9znSqYtqtf1iOdoxM';
/**
 * @deprecated - use ANT.versions.getLatestANTVersion() to get latest ANT module
 **/
export const ANT_LUA_ID = 'sOW9Sdm1yoPRrzerC5iu1nsupp4e6I-HnJyYVHzvzQo';
export const AO_AUTHORITY = 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY';
export const DEFAULT_SCHEDULER_ID =
  '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';
