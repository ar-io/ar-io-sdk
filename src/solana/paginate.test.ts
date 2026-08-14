import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { paginate } from './io-readable.js';

type Row = {
  name: string;
  stake: bigint;
  score?: number;
  status?: string;
  settings?: { fqdn: string };
};

const rows: Row[] = [
  {
    name: 'c',
    stake: 300n,
    score: 3,
    status: 'joined',
    settings: { fqdn: 'c.example' },
  },
  {
    name: 'a',
    stake: 100n,
    score: 1,
    status: 'leaving',
    settings: { fqdn: 'a.example' },
  },
  { name: 'd', stake: 400n, status: 'joined', settings: { fqdn: 'd.example' } }, // score missing
  {
    name: 'b',
    stake: 200n,
    score: 2,
    status: 'joined',
    settings: { fqdn: 'b.example' },
  },
];

describe('paginate', () => {
  it('preserves input order when no sortBy is given', () => {
    const r = paginate(rows, { limit: 10 });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['c', 'a', 'd', 'b'],
    );
  });

  it('sorts ascending by a top-level key', () => {
    const r = paginate(rows, { limit: 10, sortBy: 'stake' });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('sorts descending, which is the reported bug', () => {
    // Previously this returned input order while reporting sortOrder: 'desc'.
    const r = paginate(rows, { limit: 10, sortBy: 'stake', sortOrder: 'desc' });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['d', 'c', 'b', 'a'],
    );
    assert.equal(r.sortOrder, 'desc');
  });

  it('reports the sortBy it applied, not just the order', () => {
    // PaginationResult<T> declares sortBy. Leaving it undefined while sorting is
    // the same defect as the original bug in the other direction: metadata that
    // does not describe what happened.
    const sorted = paginate(rows, {
      limit: 10,
      sortBy: 'stake',
      sortOrder: 'desc',
    });
    assert.equal(sorted.sortBy, 'stake');
    assert.equal(sorted.sortOrder, 'desc');

    // No key requested -> nothing claimed.
    const unsorted = paginate(rows, { limit: 10 });
    assert.equal(unsorted.sortBy, undefined);
    assert.equal(unsorted.sortOrder, 'asc');
  });

  it('sorts before slicing, so limit returns the true top N', () => {
    const r = paginate(rows, { limit: 2, sortBy: 'stake', sortOrder: 'desc' });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['d', 'c'],
    );
    assert.equal(r.totalItems, 4);
    assert.equal(r.hasMore, true);
  });

  it('supports nested dot-path keys, which SortBy<T> permits', () => {
    const r = paginate(rows, { limit: 10, sortBy: 'settings.fqdn' });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('keeps full precision on bigints beyond Number.MAX_SAFE_INTEGER', () => {
    // Stakes are mARIO and routinely exceed 2^53. Coercing through Number()
    // would collapse these two into a tie and mis-rank the leaderboard.
    const big: Row[] = [
      // Both collapse to 9007199254740992 once passed through Number().
      { name: 'lo', stake: 9007199254740992n },
      { name: 'hi', stake: 9007199254740993n },
    ];
    assert.equal(
      Number(big[0].stake),
      Number(big[1].stake),
      'precondition: these tie once coerced to Number',
    );
    const r = paginate(big, { sortBy: 'stake', sortOrder: 'desc' });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['hi', 'lo'],
    );
  });

  it('sorts nullish values last in both directions', () => {
    const asc = paginate(rows, { limit: 10, sortBy: 'score' });
    assert.equal(asc.items[asc.items.length - 1].name, 'd');
    const desc = paginate(rows, {
      limit: 10,
      sortBy: 'score',
      sortOrder: 'desc',
    });
    assert.equal(desc.items[desc.items.length - 1].name, 'd');
  });

  it('applies filters, which were previously declared and discarded', () => {
    const r = paginate(rows, { limit: 10, filters: { status: 'joined' } });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['c', 'd', 'b'],
    );
    // totalItems must describe the FILTERED set, or paging over it is wrong.
    assert.equal(r.totalItems, 3);
    assert.equal(r.hasMore, false);
  });

  it('treats an array filter as alternatives, and separate keys as AND', () => {
    const anyOf = paginate(rows, {
      limit: 10,
      filters: { status: ['joined', 'leaving'] },
    });
    assert.equal(anyOf.totalItems, 4);

    const both = paginate(rows, {
      limit: 10,
      filters: { status: 'joined', score: 3 },
    });
    assert.deepEqual(
      both.items.map((i) => i.name),
      ['c'],
    );
  });

  it('matches a bigint field against a plain number filter', () => {
    // Callers write numbers; mARIO fields are bigint. Comparing by type alone
    // would silently match nothing.
    const r = paginate(rows, { limit: 10, filters: { stake: 300 } });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['c'],
    );
  });

  it('filters before sorting and slicing', () => {
    const r = paginate(rows, {
      limit: 2,
      filters: { status: 'joined' },
      sortBy: 'stake',
      sortOrder: 'desc',
    });
    assert.deepEqual(
      r.items.map((i) => i.name),
      ['d', 'c'],
    );
    assert.equal(r.totalItems, 3);
    assert.equal(r.hasMore, true);
  });

  it('does not mutate the caller’s array', () => {
    const input = [...rows];
    paginate(input, { sortBy: 'stake', sortOrder: 'desc' });
    assert.deepEqual(
      input.map((i) => i.name),
      ['c', 'a', 'd', 'b'],
    );
  });

  it('paginates a sorted set consistently across cursors', () => {
    const p1 = paginate(rows, { limit: 2, sortBy: 'stake' });
    const p2 = paginate(rows, {
      limit: 2,
      sortBy: 'stake',
      cursor: p1.nextCursor,
    });
    assert.deepEqual(
      [...p1.items, ...p2.items].map((i) => i.name),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(p2.hasMore, false);
  });
});
