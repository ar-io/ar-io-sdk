import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ARIOToken, mARIOToken } from '../../src/types/token.js';

describe('ARIOToken', () => {
  it('should throw an error on invalid input', () => {
    assert.throws(() => new ARIOToken(-1));
  });

  it('should round at 6 decimal places', () => {
    const token = new ARIOToken(1.123456789);
    assert.strictEqual(token.valueOf(), 1.123457);
  });

  it('should convert to mARIOToken', () => {
    const token = new ARIOToken(1);
    const mToken = token.toMARIO();
    assert.strictEqual(mToken.valueOf(), 1000000);
  });

  it('should print as a string', () => {
    const token = new ARIOToken(1);
    assert.strictEqual(`${token}`, '1');
  });
});

describe('mARIOToken', () => {
  it('should multiply by a number', () => {
    const token = new mARIOToken(1);
    const result = token.multiply(2);
    assert.strictEqual(result.valueOf(), 2);
  });

  it('should multiply by another mARIOToken', () => {
    const token = new mARIOToken(1);
    const result = token.multiply(new mARIOToken(2));
    assert.strictEqual(result.valueOf(), 2);
  });

  it('should divide by a number', () => {
    const token = new mARIOToken(2);
    const result = token.divide(2);
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should divide by another mARIOToken', () => {
    const token = new mARIOToken(2);
    const result = token.divide(new mARIOToken(2));
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should throw an error on division by zero', () => {
    const token = new mARIOToken(2);
    assert.throws(() => token.divide(0));
  });

  it('should round down on multiplication of a number', () => {
    const token = new mARIOToken(1);
    const result = token.multiply(1.5);
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should round down on division with a number', () => {
    const token = new mARIOToken(2);
    const result = token.divide(3);
    assert.strictEqual(result.valueOf(), 0);
  });

  it('should round down on division with another mARIOToken', () => {
    const token = new mARIOToken(2);
    const result = token.divide(new mARIOToken(3));
    assert.strictEqual(result.valueOf(), 0);
  });

  it('should add', () => {
    const token = new mARIOToken(1);
    const result = token.plus(new mARIOToken(1));
    assert.strictEqual(result.valueOf(), 2);
  });

  it('should subtract', () => {
    const token = new mARIOToken(2);
    const result = token.minus(new mARIOToken(1));
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should convert to ARIO', () => {
    const token = new mARIOToken(1000000);
    const result = token.toARIO();
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should print as a string', () => {
    const token = new mARIOToken(1);
    assert.strictEqual(`${token}`, '1');
  });
});
