import { expect } from 'chai';

import { DefaultClient } from '../src/index.js';

describe('DefaultClient', () => {
  it('should create a Default', () => {
    const client = new DefaultClient();
    expect(client).to.be.instanceOf(DefaultClient);
  });
});
