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

export const ioDevnetProcessId = 'GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc';

export const MIO_PER_IO = 1_000_000;

export const AOS_MODULE_ID = '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4';
export const ANT_LUA_ID = 'J8h6J-_rIOWJ7lT5DZO63PRHB6dgGMxpn9ubkI1OJnY';
export const DEFAULT_SCHEDULER_ID =
  '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';
