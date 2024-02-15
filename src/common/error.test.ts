import { BadRequest, NotFound } from './error.js';

describe('Error', () => {
  it.each([
    ['BadRequest', BadRequest],
    ['NotFound', NotFound],
  ])(
    'Errors should inherit Base error and names should be applied appropriately',
    (name, errorClass) => {
      const message = 'This is a test error';
      const error = new errorClass(message);
      expect(error.name).toEqual(name);
      expect(error.message).toEqual(message);
    },
  );
});
