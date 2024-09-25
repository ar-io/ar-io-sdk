import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { fromB64Url, toB64Url } from '../../src/utils/base64.js';

describe('b64utils', () => {
  it('should convert various strings to base64url and back', () => {
    const testStrings = [
      'Hello, World!',
      'Test123!@#',
      'Base64URLEncoding',
      'Special_Chars+/',
      '',
      'A',
      '1234567890',
    ];
    for (const str of testStrings) {
      const encoded = toB64Url(Buffer.from(str));
      const decoded = Buffer.from(fromB64Url(encoded)).toString();
      assert.strictEqual(decoded, str, `Failed for string: ${str}`);
    }
  });
  it('should convert various buffers to base64url and back', () => {
    const testBuffers = [
      Buffer.from('Hello, World!'),
      Buffer.from([0, 1, 2, 3, 4, 5]),
      Buffer.from('Test123!@#'),
      Buffer.from('Base64URLEncoding'),
      Buffer.from('Special_Chars+/'),
      Buffer.alloc(0),
      Buffer.from('A'),
      Buffer.from('1234567890'),
    ];
    for (const buf of testBuffers) {
      const encoded = toB64Url(buf);
      const decoded = fromB64Url(encoded);
      assert.deepStrictEqual(
        decoded,
        buf,
        `Failed for buffer: ${buf.toString()}`,
      );
    }
  });
  it('should handle edge cases for base64url conversion', () => {
    const edgeCases = [
      '',
      'A',
      'AA',
      'AAA',
      '====',
      '===',
      '==',
      '=',
      'A===',
      'AA==',
      'AAA=',
    ];
    for (const testCase of edgeCases) {
      const encoded = toB64Url(Buffer.from(testCase));
      const decoded = Buffer.from(fromB64Url(encoded)).toString();
      assert.strictEqual(
        decoded,
        testCase,
        `Failed for edge case: ${testCase}`,
      );
    }
  });
});
