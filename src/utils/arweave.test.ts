import { ARNS_DEVNET_REGISTRY_TX } from '../constants.js';
import { validateArweaveId } from './arweave.js';

describe('Arweave ID Validation', () => {
  it('should validate a valid Arweave ID', () => {
    const validId = ARNS_DEVNET_REGISTRY_TX;
    expect(validateArweaveId(validId)).toBe(true);
  });

  it('should not validate an invalid Arweave ID', () => {
    const invalidId = 'invalid-id';
    expect(validateArweaveId(invalidId)).toBe(false);
  });
});
