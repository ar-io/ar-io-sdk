import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { IOToken, mIOToken } from '../../src/types/token.js';

describe('IOToken', () => {
  it('should throw an error on invalid input', () => {
    assert.throws(() => new IOToken(-1));
  });

  it('should round at 6 decimal places', () => {
    const token = new IOToken(1.123456789);
    assert.strictEqual(token.valueOf(), 1.123457);
  });

  it('should convert to mIOToken', () => {
    const token = new IOToken(1);
    const mToken = token.toMIO();
    assert.strictEqual(mToken.valueOf(), 1000000);
  });

  it('should print as a string', () => {
    const token = new IOToken(1);
    assert.strictEqual(`${token}`, '1');
  });
});

describe('mIOToken', () => {
  it('should multiply by a number', () => {
    const token = new mIOToken(1);
    const result = token.multiply(2);
    assert.strictEqual(result.valueOf(), 2);
  });

  it('should multiply by another mIOToken', () => {
    const token = new mIOToken(1);
    const result = token.multiply(new mIOToken(2));
    assert.strictEqual(result.valueOf(), 2);
  });

  it('should divide by a number', () => {
    const token = new mIOToken(2);
    const result = token.divide(2);
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should divide by another mIOToken', () => {
    const token = new mIOToken(2);
    const result = token.divide(new mIOToken(2));
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should throw an error on division by zero', () => {
    const token = new mIOToken(2);
    assert.throws(() => token.divide(0));
  });

  it('should round down on multiplication of a number', () => {
    const token = new mIOToken(1);
    const result = token.multiply(1.5);
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should round down on division with a number', () => {
    const token = new mIOToken(2);
    const result = token.divide(3);
    assert.strictEqual(result.valueOf(), 0);
  });

  it('should round down on division with another mIOToken', () => {
    const token = new mIOToken(2);
    const result = token.divide(new mIOToken(3));
    assert.strictEqual(result.valueOf(), 0);
  });

  it('should add', () => {
    const token = new mIOToken(1);
    const result = token.plus(new mIOToken(1));
    assert.strictEqual(result.valueOf(), 2);
  });

  it('should subtract', () => {
    const token = new mIOToken(2);
    const result = token.minus(new mIOToken(1));
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should convert to IO', () => {
    const token = new mIOToken(1000000);
    const result = token.toIO();
    assert.strictEqual(result.valueOf(), 1);
  });

  it('should print as a string', () => {
    const token = new mIOToken(1);
    assert.strictEqual(`${token}`, '1');
  });
});
