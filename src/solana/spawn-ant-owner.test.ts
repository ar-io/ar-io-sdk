/**
 * A spawned ANT's OWNER may differ from the wallet that pays for it.
 *
 * `buildSpawnAntInstructions({ owner })` separates the two roles the spawn
 * really has: `signer` funds the MPL Core asset's rent and signs `CreateV1`,
 * while `owner` receives the NFT and signs `ario_ant::initialize`. That is what
 * a sponsored spawn needs — a service pays, the end user owns — and the chain
 * already supports it (`CreateV1` takes `payer` and `owner` as separate
 * accounts, and `owner` is not a signer there).
 *
 * These tests pin the ACCOUNT ROLES rather than the byte layout, which
 * `spawn-ant.test.ts` already covers: the failure mode this guards against is a
 * silent swap of payer and owner, which would hand custody to the wrong wallet
 * while still producing a perfectly well-formed transaction.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type Address,
  address,
  createNoopSigner,
  generateKeyPairSigner,
} from '@solana/kit';

import { buildSpawnAntInstructions } from './spawn-ant.js';

const OWNER: Address = address('11111111111111111111111111111113');

/** MPL Core `CreateV1` account order: asset, collection, authority, payer, owner. */
const CREATE_V1_PAYER_INDEX = 3;
const CREATE_V1_OWNER_INDEX = 4;

async function build(withOwner: boolean) {
  const signer = await generateKeyPairSigner();
  const { instructions } = await buildSpawnAntInstructions({
    signer,
    state: { name: 'sponsored-name' },
    ...(withOwner ? { owner: createNoopSigner(OWNER) } : {}),
  });
  const [createIx, initIx] = instructions;
  assert.ok(createIx.accounts, 'CreateV1 must carry accounts');
  assert.ok(initIx.accounts, 'initialize must carry accounts');
  return { signer, createIx, initIx };
}

describe('buildSpawnAntInstructions owner/payer separation', () => {
  it('defaults the owner to the signer, unchanged from before', async () => {
    const { signer, createIx, initIx } = await build(false);
    const accounts = createIx.accounts as readonly { address: Address }[];

    assert.equal(accounts[CREATE_V1_PAYER_INDEX].address, signer.address);
    assert.equal(accounts[CREATE_V1_OWNER_INDEX].address, signer.address);
    assert.ok(
      (initIx.accounts as readonly { address: Address }[]).some(
        (a) => a.address === signer.address,
      ),
      'initialize must be signed by the signer when no owner is given',
    );
  });

  it('mints to `owner` while `signer` still pays', async () => {
    const { signer, createIx } = await build(true);
    const accounts = createIx.accounts as readonly { address: Address }[];

    assert.equal(
      accounts[CREATE_V1_PAYER_INDEX].address,
      signer.address,
      'the sponsor must remain the payer',
    );
    assert.equal(
      accounts[CREATE_V1_OWNER_INDEX].address,
      OWNER,
      'the ANT must be minted to the supplied owner, not the payer',
    );
    assert.notEqual(
      accounts[CREATE_V1_OWNER_INDEX].address,
      signer.address,
      'payer and owner must not collapse — that silently hands over custody',
    );
  });

  // `ario_ant::initialize` declares `owner: Signer` and creates AntConfig,
  // AntControllers and the root AntRecord with `payer = owner`. Signing it with
  // the sponsor would both fail on chain and charge the wrong account.
  it('signs `initialize` as the OWNER, not the payer', async () => {
    const { signer, initIx } = await build(true);
    const addresses = (initIx.accounts as readonly { address: Address }[]).map(
      (a) => a.address,
    );

    assert.ok(addresses.includes(OWNER), 'initialize must reference the owner');
    assert.ok(
      !addresses.includes(signer.address),
      'initialize must NOT reference the sponsor — it pins payer = owner',
    );
  });

  it('accepts a noop signer, so a sponsor can build for a remote owner', async () => {
    const { createIx } = await build(true);
    const accounts = createIx.accounts as readonly { address: Address }[];
    // The point of a noop signer: the sponsor assembles and partially signs the
    // transaction without holding the owner's key, and the owner adds theirs.
    assert.equal(accounts[CREATE_V1_OWNER_INDEX].address, OWNER);
  });
});
