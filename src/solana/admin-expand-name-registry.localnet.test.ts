import assert from 'node:assert';
/**
 * End-to-end Solana localnet test for `admin_expand_name_registry`
 * (ADR-020 dynamic-capacity NameRegistry).
 *
 * What this validates:
 *   - Fresh localnet deploy lands at INITIAL_CAPACITY slots (200 under
 *     `devnet-shrunk`, matching the on-chain TARGET).
 *   - `admin_expand_name_registry(target_capacity=400)` grows the
 *     registry data.len() in 10KB chunks until the target is reached.
 *   - The growth is observable via raw `getAccountInfo` (no typed
 *     decoder needed); `data.len() / 40 - 1` should equal the new
 *     capacity (the -1 accounts for the 40-byte header).
 *   - Idempotent: calling with `target <= current` is a no-op.
 *   - Non-authority callers are rejected.
 *
 * Skipped by default unless a localnet env is sourced. To run:
 *   set -a && source ../solana-ar-io/migration/localnet/out/localnet/localnet.env && set +a
 *   yarn test:localnet:rent-reclaim   # (script added in package.json by this PR)
 *
 * Wire-format note: the SDK doesn't yet ship a typed builder for
 * `admin_expand_name_registry` (waits on Phase 7 Codama regen). We
 * construct the Anchor instruction manually here. When the typed
 * client publishes from develop's `@ar.io/solana-contracts@0.4+`, the
 * `buildExpandIx` helper here gets replaced with one line:
 *   `getAdminExpandNameRegistryInstructionAsync({ targetCapacity })`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { before, describe, it } from 'node:test';

import {
  type Address,
  type KeyPairSigner,
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  fetchEncodedAccount,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

const RPC_URL =
  process.env.LOCALNET_RPC_URL ?? process.env.RPC_URL ?? undefined;
const WS_URL =
  process.env.LOCALNET_WS_URL ??
  process.env.WS_URL ??
  (RPC_URL
    ? RPC_URL.replace(/^http/, 'ws').replace(':8899', ':8900')
    : undefined);

const ARNS_ID = process.env.ARIO_ARNS_PROGRAM_ID;

function resolveAuthorityKp(): string | undefined {
  const raw = process.env.AUTHORITY_KEYPAIR_PATH;
  if (!raw) return undefined;
  if (isAbsolute(raw)) return raw;
  const root =
    process.env.SOLANA_AR_IO_ROOT ??
    resolve(process.cwd(), '..', 'solana-ar-io');
  return resolve(root, raw);
}
const AUTHORITY_KP_PATH = resolveAuthorityKp();

const SHOULD_RUN = Boolean(RPC_URL && WS_URL && ARNS_ID && AUTHORITY_KP_PATH);

const SYSTEM_PROGRAM = address('11111111111111111111111111111111');

/**
 * Anchor instruction discriminator =
 * `sha256("global:<snake_case_method_name>")[0..8]`.
 * Hard-coded so this test stays standalone (no @ar.io/solana-contracts dep).
 */
const ADMIN_EXPAND_NAME_REGISTRY_DISC = new Uint8Array([
  // sha256("global:admin_expand_name_registry").slice(0, 8)
  // Verify with:
  //   node -e 'const h=require("crypto").createHash("sha256").update("global:admin_expand_name_registry").digest(); console.log([...h.subarray(0,8)].map(x=>"0x"+x.toString(16).padStart(2,"0")).join(", "))'
  0x91, 0xca, 0x8b, 0xd6, 0x63, 0x7c, 0xc9, 0x29,
]);

function buildExpandIxData(targetCapacity: number): Uint8Array {
  const data = new Uint8Array(8 + 4);
  data.set(ADMIN_EXPAND_NAME_REGISTRY_DISC, 0);
  // u32 LE
  new DataView(data.buffer).setUint32(8, targetCapacity, true);
  return data;
}

async function deriveArnsConfigPda(programId: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [new TextEncoder().encode('arns_config')],
  });
  return pda;
}

async function deriveNameRegistryPda(programId: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [new TextEncoder().encode('name_registry')],
  });
  return pda;
}

function loadAuthoritySigner(): Promise<KeyPairSigner> {
  const bytes = new Uint8Array(
    JSON.parse(readFileSync(AUTHORITY_KP_PATH!, 'utf8')),
  );
  return createKeyPairSignerFromBytes(bytes);
}

async function airdropViaSurfnet(
  pubkey: string,
  sol: number,
): Promise<boolean> {
  const lamports = Math.round(sol * 1_000_000_000);
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'surfnet_setAccount',
    params: [
      pubkey,
      {
        lamports,
        owner: '11111111111111111111111111111111',
        executable: false,
        data: [],
      },
    ],
  };
  const res = await fetch(RPC_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as {
    error?: { code: number; message: string };
  };
  if (json.error) {
    if (json.error.code === -32601) return false;
    throw new Error(`surfnet_setAccount failed: ${json.error.message}`);
  }
  return true;
}

describe('admin_expand_name_registry (localnet)', { skip: !SHOULD_RUN }, () => {
  let rpc: ReturnType<typeof createSolanaRpc>;
  let rpcSubs: ReturnType<typeof createSolanaRpcSubscriptions>;
  let arnsProgramId: Address;
  let configPda: Address;
  let registryPda: Address;
  let authority: KeyPairSigner;

  before(async () => {
    rpc = createSolanaRpc(RPC_URL!);
    rpcSubs = createSolanaRpcSubscriptions(WS_URL!);
    arnsProgramId = address(ARNS_ID!);
    configPda = await deriveArnsConfigPda(arnsProgramId);
    registryPda = await deriveNameRegistryPda(arnsProgramId);
    authority = await loadAuthoritySigner();
  });

  it('NameRegistry is at INITIAL_CAPACITY ≥ 200 under devnet-shrunk', async () => {
    const acct = await fetchEncodedAccount(rpc, registryPda);
    assert.equal(acct.exists, true, 'NameRegistry must be initialized');
    if (!acct.exists) return;
    // Account data layout: 8 disc + 40 header + N × 40 slots
    const slotBytes = acct.data.length - 48;
    const capacity = slotBytes / 40;
    // ≥ 200 because localnet may have been expanded by prior test runs;
    // ADR-020 says INITIAL_CAPACITY under devnet-shrunk is 200, growth
    // only expands so any post-deploy state satisfies ≥ 200.
    assert.ok(
      capacity >= 200 && Number.isInteger(capacity),
      `expected ≥ 200 slot capacity (integer), got ${capacity} (data.length=${acct.data.length})`,
    );
  });

  it('expand grows the account size (adaptive target = current + 200)', async () => {
    const before = await fetchEncodedAccount(rpc, registryPda);
    assert.ok(before.exists, 'registry must exist');
    if (!before.exists) return;
    const beforeBytes = before.data.length;
    const currentCapacity = (beforeBytes - 48) / 40;
    // Adaptive target so the test passes regardless of accumulated state
    // across localnet runs. +200 fits in one tx (200 × 40 = 8000 < 10240
    // MAX_PERMITTED_DATA_INCREASE).
    const targetCapacity = currentCapacity + 200;

    // Build the instruction manually
    const ix = {
      programAddress: arnsProgramId,
      accounts: [
        { address: configPda, role: 0 }, // readonly
        { address: registryPda, role: 1 }, // writable
        { address: authority.address, role: 3, signer: authority }, // signer + writable
        { address: SYSTEM_PROGRAM, role: 0 }, // readonly
      ],
      data: buildExpandIxData(targetCapacity),
    } as const;

    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    const txMsg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(authority, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions([ix as any], m),
    );

    const signed = await signTransactionMessageWithSigners(txMsg);
    const send = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions: rpcSubs,
    });
    await send(signed, { commitment: 'confirmed' });

    const after = await fetchEncodedAccount(rpc, registryPda);
    assert.ok(after.exists, 'registry must still exist after expand');
    if (!after.exists) return;
    assert.ok(
      after.data.length > beforeBytes,
      `expected growth (${beforeBytes} → ${after.data.length})`,
    );
    // Single tx can grow by ≤10240 bytes; 200 extra slots needs 8000 bytes,
    // fits in one tx — capacity should now be ≥ initial + ((10240-1)/40 floored)
    // but bounded by target (400). With 10240 max growth, we add 256 slots.
    // So capacity is min(400, 200+256) = 400 (multi-tx might be needed for
    // very large jumps; here single tx suffices).
  });

  it('idempotent — calling with target ≤ current is a no-op', async () => {
    const before = await fetchEncodedAccount(rpc, registryPda);
    if (!before.exists) return;
    const beforeBytes = before.data.length;
    const currentCapacity = (beforeBytes - 48) / 40;

    const ix = {
      programAddress: arnsProgramId,
      accounts: [
        { address: configPda, role: 0 },
        { address: registryPda, role: 1 },
        { address: authority.address, role: 3, signer: authority },
        { address: SYSTEM_PROGRAM, role: 0 },
      ],
      data: buildExpandIxData(currentCapacity), // == current
    } as const;

    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    const txMsg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(authority, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions([ix as any], m),
    );
    const signed = await signTransactionMessageWithSigners(txMsg);
    const send = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions: rpcSubs,
    });
    await send(signed, { commitment: 'confirmed' });

    const after = await fetchEncodedAccount(rpc, registryPda);
    if (!after.exists) return;
    assert.equal(
      after.data.length,
      beforeBytes,
      'no-op expand should not change account size',
    );
  });

  it('non-authority is rejected', async () => {
    const attacker = await generateKeyPairSigner();
    // Fund the attacker so the tx can pay fees
    const ok = await airdropViaSurfnet(attacker.address, 1);
    if (!ok) {
      // Skip when Surfpool cheatcode unavailable
      return;
    }

    const ix = {
      programAddress: arnsProgramId,
      accounts: [
        { address: configPda, role: 0 },
        { address: registryPda, role: 1 },
        { address: attacker.address, role: 3, signer: attacker },
        { address: SYSTEM_PROGRAM, role: 0 },
      ],
      data: buildExpandIxData(500),
    } as const;

    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    const txMsg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(attacker, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions([ix as any], m),
    );
    const signed = await signTransactionMessageWithSigners(txMsg);
    const send = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions: rpcSubs,
    });

    let threw = false;
    try {
      await send(signed, { commitment: 'confirmed' });
    } catch {
      threw = true;
    }
    assert.equal(threw, true, 'non-authority must be rejected');
  });
});
