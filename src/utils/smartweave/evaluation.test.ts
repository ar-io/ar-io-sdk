import { SmartWeaveSortKey } from './evaluation.js';

describe(`Smartweave eval utils`, () => {
  it(`should throw on a bad sort key`, async () => {
    const sortKey = '123,456,abc';
    const error = await (async () => new SmartWeaveSortKey(sortKey))().catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(sortKey);
  });
});
