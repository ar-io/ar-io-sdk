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

/** ar:// protocol prefix for location-independent Arweave references */
export const AR_IO_PROTOCOL = 'ar://';

/** Default AR.IO logo Arweave TX ID (32x32 PNG) */
export const ARIO_LOGO_TX_ID = 'WMLnh8pQL-UIXZMpdU2NUIriHfcFB5Bc49V8jTHjsZc';

/**
 * Construct an ar:// URI from an Arweave TX ID or ArNS name.
 *
 * - ar://{txId} — raw 43-char TX ID, resolved by wallets via arweave.net gateway
 * - ar://{arnsName} — ArNS name, resolved by AR.IO gateways and Wayfinder SDK
 */
export function arweaveUri(txIdOrName: string): string {
  return `${AR_IO_PROTOCOL}${txIdOrName}`;
}

/** FQDN regex that matches the one used in the ArNS contract. */
export const FQDN_REGEX = new RegExp(
  '^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{1,63}$',
);

export const MARIO_PER_ARIO = 1_000_000;
