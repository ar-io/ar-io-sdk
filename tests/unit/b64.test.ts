import { fromB64Url, toB64Url } from '../../src/utils/base64';

describe('b64utils', () => {
  it.each([
    'hello+_world_+',
    'hello/_world/_',
    '', // empty string
    'hello', // single character
    'hello123456', // alphanumeric string
    '123456', // numeric string
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/', // all base64 characters
    'aGVsbG8=',
  ])(
    'should properly convert a buffer to base64url string',
    async (str: string) => {
      const input = Buffer.from(str, 'base64');
      const expected = input.toString('base64url');
      expect(toB64Url(input)).toEqual(expected);
    },
  );

  it.each([
    'aGVsbG8', // missing padding character
    'YQ==', // single character
    'aGVsbG8gMTIzNDU2', // alphanumeric string
    'MTIzNDU2', // numeric string
    'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXotLUVy', // all base64url characters
    '', // empty string
  ])('should properly convert a base64 string to a buffer', async (str) => {
    const b64url = Buffer.from(str).toString('base64url');
    const expected = Buffer.from(b64url, 'base64url');
    expect(fromB64Url(b64url)).toEqual(expected);
  });
});
