/**
 *
 * NOTE: these tests are just to validate the clients load with a CJS configuration.
 *
 * They only need to be extended when new clients or signers are introduced.
 *
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  IO,
  ioDevnetProcessId,
  ANTRegistry,
  ANT,
  createAoSigner,
  ArweaveSigner,
  IOWriteable,
  AoANTWriteable,
  AoANTRegistryWriteable,
  AoANTRegistryReadable,
  AoANTReadable,
  AOProcess,
  IOReadable,
} = require('@ar.io/sdk');

const testWalletJSON = fs.readFileSync('../test-wallet.json', {
  encoding: 'utf-8',
});
const testWallet = JSON.parse(testWalletJSON);
const signers = [
  new ArweaveSigner(testWallet),
  createAoSigner(new ArweaveSigner(testWallet)),
];
describe('e2e cjs tests', async () => {
  describe('IO client works ', async () => {
    it('should able to instantiate IOReadable', async () => {
      const io = IO.init({
        process: new AOProcess({
          processId: process.env.IO_PROCESS_ID || ioDevnetProcessId,
        }),
      });
      assert(io instanceof IOReadable);
    });

    for (const signer of signers) {
      it(`should be able to instantiate IOWriteable with ${signer.constructor.name}`, async () => {
        const io = IO.init({
          process: new AOProcess({
            processId: process.env.IO_PROCESS_ID || ioDevnetProcessId,
          }),
          signer,
        });
        assert(io instanceof IOWriteable);
      });
    }
  });

  describe('ANTRegistry', async () => {
    it('should be able to instantiate AoANTRegistryWriteable', async () => {
      for (const signer of signers) {
        const registry = ANTRegistry.init({ signer });
        assert(registry instanceof AoANTRegistryWriteable);
      }
    });

    it('should be able to instantiate AoANTRegistryReadable', async () => {
      for (const signer of signers) {
        const registry = ANTRegistry.init();
        assert(registry instanceof AoANTRegistryReadable);
      }
    });
  });

  describe('ANT', async () => {
    const processId = 'YcxE5IbqZYK72H64ELoysxiJ-0wb36deYPv55wgl8xo';
    it('should be able to instantiate AoANTWriteable', async () => {
      for (const signer of signers) {
        const ant = ANT.init({ processId, signer });
        assert(ant instanceof AoANTWriteable);
      }
    });

    it('should be able to instantiate AoANTReadable', async () => {
      const ant = ANT.init({ processId });
      assert(ant instanceof AoANTReadable);
    });
  });
});
