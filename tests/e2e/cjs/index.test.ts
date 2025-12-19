/**
 *
 * NOTE: these tests are just to validate the clients load with a CJS configuration.
 *
 * They only need to be extended when new clients or signers are introduced.
 *
 * Ensure that npm link has been ran prior to running these tests
 * (simply running npm run test:integration will ensure npm link is ran)
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Arweave = require("arweave");
const {
  ARIO,
  arioDevnetProcessId,
  ANTRegistry,
  ANT,
  createAoSigner,
  ArweaveSigner,
  ARIOWriteable,
  AoANTWriteable,
  AoANTRegistryWriteable,
  AoANTRegistryReadable,
  AoANTReadable,
  AOProcess,
  ARIOReadable,
} = require("@ar.io/sdk");

const testWalletJSON = fs.readFileSync("../test-wallet.json", {
  encoding: "utf-8",
});
const testWallet = JSON.parse(testWalletJSON);
const signers = [
  new ArweaveSigner(testWallet),
  createAoSigner(new ArweaveSigner(testWallet)),
];
const processId = process.env.ARIO_PROCESS_ID || arioDevnetProcessId;
const arweave = Arweave.init({});
describe("e2e cjs tests", async () => {
  describe("ARIO client works ", async () => {
    it("should be able to instantiate ARIO with default process", async () => {
      const ario = ARIO.init();
      assert(ario instanceof ARIOReadable);
    });

    it("should able to instantiate ARIOReadable", async () => {
      const ario = ARIO.init({
        process: new AOProcess({
          processId,
        }),
      });
      assert(ario instanceof ARIOReadable);
    });

    it.skip("should be able to instantiate ARIO with a process and arweave", async () => {
      const ario = ARIO.init({
        process: new AOProcess({
          processId,
        }),
        arweave,
      });
      assert(ario instanceof ARIOReadable);
    });

    it("should be able to instantiate ARIO with a process id and arweave", async () => {
      const ario = ARIO.init({
        processId,
        arweave,
      });
      assert(ario instanceof ARIOReadable);
    });

    for (const signer of signers) {
      it(`should be able to instantiate ARIOWriteable with ${signer.constructor.name}`, async () => {
        const ario = ARIO.init({
          process: new AOProcess({
            processId,
          }),
          signer,
        });
        assert(ario instanceof ARIOWriteable);
      });
    }
  });

  describe("ANTRegistry", async () => {
    it("should be able to instantiate AoANTRegistryWriteable", async () => {
      for (const signer of signers) {
        const registry = ANTRegistry.init({ signer });
        assert(registry instanceof AoANTRegistryWriteable);
      }
    });

    it("should be able to instantiate AoANTRegistryReadable", async () => {
      for (const _signer of signers) {
        const registry = ANTRegistry.init();
        assert(registry instanceof AoANTRegistryReadable);
      }
    });
  });

  describe("ANT", async () => {
    const processId = "YcxE5IbqZYK72H64ELoysxiJ-0wb36deYPv55wgl8xo";
    it("should be able to instantiate AoANTWriteable", async () => {
      for (const signer of signers) {
        const ant = ANT.init({ processId, signer });
        assert(ant instanceof AoANTWriteable);
      }
    });

    it("should be able to instantiate AoANTReadable", async () => {
      const ant = ANT.init({ processId });
      assert(ant instanceof AoANTReadable);
    });
  });
});
