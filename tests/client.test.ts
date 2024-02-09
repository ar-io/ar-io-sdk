import { DefaultClient } from '../src';

describe('DefaultClient', () => {
  it('should create a Default', () => {
    const client = new DefaultClient();
    expect(client).toBeInstanceOf(DefaultClient);
  });
});
