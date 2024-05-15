import { IOToken, mIOToken } from '../../src/token';

describe('IOToken', () => {
  it('should throw an error on invalid input', () => {
    expect(() => new IOToken(-1)).toThrow();
  });

  it('should round at 6 decimal places', () => {
    const token = new IOToken(1.123456789);
    expect(token.valueOf()).toBe(1.123457);
  });

  it('should convert to mIOToken', () => {
    const token = new IOToken(1);
    const mToken = token.toMIO();
    expect(mToken.valueOf()).toBe(1000000);
  });
});

describe('mIOToken', () => {
  it('should multiply by a number', () => {
    const token = new mIOToken(1);
    const result = token.multiply(2);
    expect(result.valueOf()).toBe(2);
  });

  it('should multiply by another mIOToken', () => {
    const token = new mIOToken(1);
    const result = token.multiply(new mIOToken(2));
    expect(result.valueOf()).toBe(2);
  });

  it('should divide by a number', () => {
    const token = new mIOToken(2);
    const result = token.divide(2);
    expect(result.valueOf()).toBe(1);
  });

  it('should divide by another mIOToken', () => {
    const token = new mIOToken(2);
    const result = token.divide(new mIOToken(2));
    expect(result.valueOf()).toBe(1);
  });

  it('should throw an error on division by zero', () => {
    const token = new mIOToken(2);
    expect(() => token.divide(0)).toThrow();
  });

  it('should round down on multiplication', () => {
    const token = new mIOToken(1);
    const result = token.multiply(1.5);
    expect(result.valueOf()).toBe(1);
  });

  it('should round down on division', () => {
    const token = new mIOToken(2);
    const result = token.divide(3);
    expect(result.valueOf()).toBe(0);
  });

  it('should round down on division with another mIOToken', () => {
    const token = new mIOToken(2);
    const result = token.divide(new mIOToken(3));
    expect(result.valueOf()).toBe(0);
  });
  it('should multiply', () => {
    const token = new mIOToken(1);
    const result = token.multiply(2);
    expect(result.valueOf()).toBe(2);
  });

  it('should divide', () => {
    const token = new mIOToken(2);
    const result = token.divide(2);
    expect(result.valueOf()).toBe(1);
  });
});
