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

  it('should print as a string', () => {
    const token = new IOToken(1);
    expect(`${token}`).toBe('1');
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

  it('should round down on multiplication of a number', () => {
    const token = new mIOToken(1);
    const result = token.multiply(1.5);
    expect(result.valueOf()).toBe(1);
  });

  it('should round down on division with a number', () => {
    const token = new mIOToken(2);
    const result = token.divide(3);
    expect(result.valueOf()).toBe(0);
  });

  it('should round down on division with another mIOToken', () => {
    const token = new mIOToken(2);
    const result = token.divide(new mIOToken(3));
    expect(result.valueOf()).toBe(0);
  });

  it('should add', () => {
    const token = new mIOToken(1);
    const result = token.plus(new mIOToken(1));
    expect(result.valueOf()).toBe(2);
  });

  it('should subtract', () => {
    const token = new mIOToken(2);
    const result = token.minus(new mIOToken(1));
    expect(result.valueOf()).toBe(1);
  });

  it('should convert to IO', () => {
    const token = new mIOToken(1000000);
    const result = token.toIO();
    expect(result.valueOf()).toBe(1);
  });

  it('should print as a string', () => {
    const token = new mIOToken(1);
    expect(`${token}`).toBe('1');
  });
});
