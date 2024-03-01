import { ArIO } from '../src/common/ar-io.js';

describe('ArIO Client', () => {
  it('should create a custom ArIO client', () => {
    const arioClient = new ArIO();

    expect(arioClient).toBeInstanceOf(ArIO);
  });
});
