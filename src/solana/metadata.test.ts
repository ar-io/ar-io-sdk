/**
 * Byte-pinning tests for `buildAntMetadata`.
 *
 * Locks the JSON shape we emit so any change to the schema is caught at
 * the unit-test level. The migration import package's
 * `migration/import/src/metadata.ts::buildAntMetadata` produces the same
 * shape — both must stay in lock-step or migrated and SDK-spawned ANTs
 * will render differently in marketplaces. If you change one, change the
 * other and update this snapshot.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildAntMetadata } from './metadata.js';

describe('buildAntMetadata', () => {
  it('emits the canonical Metaplex shape with ar:// URLs by default', () => {
    const json = buildAntMetadata({
      name: 'fallback-name',
      arnsName: 'ardrive',
      ticker: 'ANT-ARDRIVE',
      description: 'ArDrive: Secure, Permanent Storage.',
      logoTxId: 'KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
    });
    assert.deepEqual(json, {
      name: 'ardrive',
      symbol: 'ANT-ARDRIVE',
      description: 'ArDrive: Secure, Permanent Storage.',
      image: 'ar://KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
      external_url: 'ar://ardrive',
      properties: {
        files: [
          {
            uri: 'ar://KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
            type: 'image/png',
          },
        ],
        category: 'image',
      },
    });
  });

  it('swaps to https://<gateway>/raw/<tx> URLs when gateway is set', () => {
    const json = buildAntMetadata({
      name: 'ardrive-test',
      arnsName: 'ardrive-test',
      ticker: 'ANT-ARDRIVE-TEST',
      description: 'devnet test',
      logoTxId: 'KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
      gateway: 'turbo-gateway.com',
    });
    assert.equal(
      json.image,
      'https://turbo-gateway.com/raw/KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
    );
    assert.equal(json.external_url, 'https://ardrive-test.ar.io');
    assert.equal(
      json.properties?.files?.[0]?.uri,
      'https://turbo-gateway.com/raw/KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A',
    );
    assert.equal(json.properties?.category, 'image');
  });

  it('falls back to ARIO_LOGO_TX_ID + auto description when arnsName is unset', () => {
    const json = buildAntMetadata({ name: 'orphan-ant' });
    assert.equal(json.name, 'orphan-ant');
    assert.equal(json.symbol, 'ANT');
    assert.equal(json.description, 'Arweave Name Token');
    assert.equal(
      json.image,
      'ar://WMLnh8pQL-UIXZMpdU2NUIriHfcFB5Bc49V8jTHjsZc',
    );
    // No external_url when no ArNS name
    assert.equal(json.external_url, undefined);
  });

  it('uses category="image" (NOT "domain") for marketplace compatibility', () => {
    // Regression: earlier versions used `category: "domain"` which is non-
    // standard per Metaplex's image|video|audio|vr|html taxonomy and was
    // rejected by some tooling. The semantic "this is an ANT for an ArNS
    // domain" lives in the on-chain Attributes plugin (`Type` trait),
    // not the JSON. See ADR-013 for the patch-layer ownership model.
    const json = buildAntMetadata({ name: 'x' });
    assert.equal(json.properties?.category, 'image');
  });
});
