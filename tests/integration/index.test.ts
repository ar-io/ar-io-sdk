import { ANT, ArweaveSigner, createAoSigner } from '@ar.io/sdk';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import { describe, it } from 'node:test';

import { createLocalANT } from './utils.js';

const testWalletJSON = fs.readFileSync('./setup/test-wallet.json', {
  encoding: 'utf-8',
});

const testWallet = JSON.parse(testWalletJSON);
const signers = [
  new ArweaveSigner(testWallet),
  createAoSigner(new ArweaveSigner(testWallet)),
] as const;

describe('integration esm tests', async () => {
  describe('ARIO', async () => {
    // TODO: add integration tests for ario
  });

  describe('ANT', async () => {
    describe('Reads', async () => {
      it('should be able to get ANT state', async () => {
        const ant = ANT.init({
          process: await createLocalANT(),
        });

        const state = await ant.getState();

        assert(state, 'unable to read ANT state');
      });
    });

    describe('Writes', async () => {
      it('should be able to set @ record', async () => {
        const ant = ANT.init({
          process: await createLocalANT(),
          signer: signers[0],
        });

        await ant.setBaseNameRecord({
          transactionId: ''.padEnd(43, '1'),
          ttlSeconds: 900,
        });

        const record = await ant.getRecord({ undername: '@' });

        assert.strictEqual(
          record.transactionId,
          ''.padEnd(43, '1'),
          'record not set',
        );
      });
    });
  });
});
