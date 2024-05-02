import { fromB64Url, toB64Url } from '../../src/utils/base64';

describe('b64utils', () => {
  it('should properly convert a buffer to base64url string', async () => {
    const input = Buffer.from('hello+_world_+', 'base64');
    const expected = input.toString('base64url');
    expect(toB64Url(input)).toEqual(expected);
  });

  it('should properly convert a base64 string to a buffer', async () => {
    const b64url = Buffer.from('hello+_world_+').toString('base64url');
    const expected = Buffer.from(b64url, 'base64url');
    expect(fromB64Url(b64url)).toEqual(expected);
  });
});
