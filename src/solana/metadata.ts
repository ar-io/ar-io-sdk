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
/**
 * Metaplex-standard JSON metadata builder for AR.IO ANT NFTs.
 *
 * The Core asset's `uri` field on chain points at a JSON file with this
 * shape; marketplaces and DAS providers fetch + parse it for their
 * inline name/image/description display. The 3 ArNS traits (`ArNS Name`,
 * `Type`, `Undername Limit`) live in the on-chain Attributes plugin, NOT
 * in this JSON — see ADR-012.
 *
 * This helper produces the exact same JSON shape as the migration import
 * (`migration/import/src/metadata.ts::buildAntMetadata`); the two paths
 * MUST stay in lock-step or migrated and freshly-spawned ANTs will
 * render differently in marketplace UIs. A regression test in
 * `spawn-ant.test.ts` asserts byte-equality between the two for matching
 * inputs.
 *
 * Pure function. No network, no Turbo, no dependencies. Caller handles
 * uploading the resulting JSON to Arweave (e.g. via `@ardrive/turbo-sdk`
 * with a `HexSolanaSigner` — free for files under 100 KiB) and passes the
 * resulting `ar://${txid}` to `spawnSolanaANT`'s `state.uri`.
 */

// Re-export the SDK-canonical AR.IO logo TX ID + ar:// protocol from the
// shared constants module so this metadata builder stays in lock-step with
// the rest of the SDK + the migration import package's JSON output.
export {
  ARIO_LOGO_TX_ID,
  AR_IO_PROTOCOL as AR_PROTOCOL,
} from '../constants.js';
import {
  ARIO_LOGO_TX_ID,
  AR_IO_PROTOCOL as AR_PROTOCOL,
} from '../constants.js';

/** Metaplex-standard JSON metadata shape. */
export interface NftMetadataJson {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  properties?: {
    files?: Array<{ uri: string; type: string }>;
    /** Metaplex standard categories: image | video | audio | vr | html. */
    category?: string;
  };
}

/** Inputs to `buildAntMetadata`. */
export interface AntMetadataParams {
  /** Display name for the NFT — usually the ArNS name when one is set. */
  name: string;
  /** ArNS name this ANT controls (if any). When set, becomes the JSON
   *  `name` and is also used in `external_url`. */
  arnsName?: string;
  /** Ticker / symbol. Defaults to "ANT". */
  ticker?: string;
  /** Description. Auto-generated from arnsName when omitted. */
  description?: string;
  /** Logo TX id (43-char Arweave id). Defaults to the AR.IO logo. */
  logoTxId?: string;
  /**
   * Optional gateway hostname (e.g. `"turbo-gateway.com"` or `"arweave.net"`).
   * When provided, all Arweave references in the JSON resolve to
   * `https://${gateway}/raw/${txid}` instead of `ar://${txid}`. Useful when
   * you need consumers (like Helius DAS or the Metaplex Core explorer) to
   * fetch the JSON immediately without waiting for Wayfinder-aware
   * resolution; ADR-012's canonical scheme is still `ar://`.
   */
  gateway?: string;
}

function makeUri(txId: string, gateway?: string): string {
  return gateway ? `https://${gateway}/raw/${txId}` : `${AR_PROTOCOL}${txId}`;
}

/**
 * Build ANT NFT JSON metadata.
 *
 * Output is byte-identical to the migration import's `buildAntMetadata`
 * for matching inputs. Defaults to `ar://` URLs (ADR-012 canonical); pass
 * `gateway` to opt into https URLs.
 */
export function buildAntMetadata(params: AntMetadataParams): NftMetadataJson {
  const logoTxId = params.logoTxId || ARIO_LOGO_TX_ID;
  const ticker = params.ticker || 'ANT';
  const arnsName = params.arnsName;
  const gateway = params.gateway;

  const description =
    params.description ||
    (arnsName
      ? `Arweave Name Token for ${arnsName}.ar.io`
      : 'Arweave Name Token');

  const logoUri = makeUri(logoTxId, gateway);

  const metadata: NftMetadataJson = {
    name: arnsName || params.name,
    symbol: ticker,
    description,
    image: logoUri,
    properties: {
      files: [{ uri: logoUri, type: 'image/png' }],
      // Metaplex standard categories are image|video|audio|vr|html. The
      // semantic "this is an ANT for an ArNS domain" is conveyed by the
      // on-chain Attributes plugin (Type=lease/permabuy), not this JSON.
      category: 'image',
    },
  };

  if (arnsName) {
    metadata.external_url = gateway
      ? `https://${arnsName}.ar.io`
      : `${AR_PROTOCOL}${arnsName}`;
  }

  return metadata;
}
