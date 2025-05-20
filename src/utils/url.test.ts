import assert from 'node:assert';
import { test } from 'node:test';

import { urlWithSearchParams } from './url.js';

test('urlWithSearchParams prunes undefined values but keeps other falsey values', () => {
  const result = urlWithSearchParams({
    baseUrl: 'https://example.com',
    params: {
      number: 1,
      string: 'string',
      boolean: true,
      empty: '',
      zero: 0,
      false: false,
      null: null,
      undef: undefined,
    },
  });

  assert.strictEqual(
    result,
    'https://example.com/?number=1&string=string&boolean=true&empty=&zero=0&false=false',
  );
});
