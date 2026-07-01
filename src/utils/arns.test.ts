import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { splitPrimaryName } from './arns.js';

describe('splitPrimaryName', () => {
  it('returns base-name shape for a name without underscore', () => {
    const r = splitPrimaryName('arweave');
    assert.equal(r.isUndername, false);
    assert.equal(r.baseName, 'arweave');
    assert.equal(r.undername, null);
  });

  it('splits "undername_basename" into both parts', () => {
    const r = splitPrimaryName('blog_arweave');
    assert.equal(r.isUndername, true);
    assert.equal(r.baseName, 'arweave');
    assert.equal(r.undername, 'blog');
  });

  it('lowercases both parts to match contract semantics', () => {
    const r = splitPrimaryName('BLOG_Arweave');
    assert.equal(r.baseName, 'arweave');
    assert.equal(r.undername, 'blog');
  });

  it('only splits on the first underscore (matches splitn(2, _))', () => {
    // "a_b_c" → undername "a", base "b_c". The contract uses splitn(2, '_'),
    // so additional underscores stay on the base side. Note that "b_c" isn't
    // a *valid* base name per ArNS validation (no underscores allowed in a
    // base) — the on-chain validate_primary_name_format would reject it. This
    // test pins splitter behavior independent of validation.
    const r = splitPrimaryName('a_b_c');
    assert.equal(r.isUndername, true);
    assert.equal(r.undername, 'a');
    assert.equal(r.baseName, 'b_c');
  });

  it('treats a leading underscore as an empty undername', () => {
    // "_xyz" → undername "", base "xyz". Again, on-chain validation rejects
    // this shape (undername must be non-empty), but the splitter alone is
    // a pure string split.
    const r = splitPrimaryName('_xyz');
    assert.equal(r.isUndername, true);
    assert.equal(r.undername, '');
    assert.equal(r.baseName, 'xyz');
  });
});
