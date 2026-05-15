import assert from 'node:assert';
/**
 * End-to-end Solana localnet smoke for the fund-from-stakes write paths.
 *
 * Validates the full SDK → Surfpool → on-chain BPF → CPI → SPL token chain
 * for `buyRecord({ fundFrom: 'stakes' })`. This is the class of bug the
 * in-process contract integration tests cannot catch: SDK BorshWriter output
 * not matching what the deployed program's Anchor decoder expects.
 *
 * Skipped by default. Requires:
 *   - A running Surfpool localnet (`./scripts/start-localnet.sh` or pre-existing)
 *   - `migration/localnet/out/localnet.env` sourced into the environment
 *   - `solana` and `spl-token` CLIs on PATH (used to airdrop SOL + mint ARIO)
 *
 * Run (from this package root):
 *   set -a && source ../solana-ar-io/migration/localnet/out/localnet.env && set +a
 *   yarn test:localnet:io-write
 *
 * Requires program deploy + SPL setup from github.com/ar-io/solana-ar-io
 * (`scripts/start-localnet.sh`).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { before, describe, it } from 'node:test';

import {
  type KeyPairSigner,
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  fetchEncodedAccount,
} from '@solana/kit';

import { ARIO } from '../common/io.js';
import { getAssociatedTokenAddressKit } from './ata.js';
import { deserializeWithdrawal } from './deserialize.js';
import { SolanaARIOWriteable } from './io-writeable.js';
import { getWithdrawalPDA } from './pda.js';
import { spawnSolanaANT } from './spawn-ant.js';

const RPC_URL =
  process.env.LOCALNET_RPC_URL ?? process.env.RPC_URL ?? undefined;
const WS_URL =
  process.env.LOCALNET_WS_URL ??
  process.env.WS_URL ??
  (RPC_URL
    ? RPC_URL.replace(/^http/, 'ws').replace(':8899', ':8900')
    : undefined);

const CORE_ID = process.env.ARIO_CORE_PROGRAM_ID;
const GAR_ID = process.env.ARIO_GAR_PROGRAM_ID;
const ARNS_ID = process.env.ARIO_ARNS_PROGRAM_ID;
const ANT_ID = process.env.ARIO_ANT_PROGRAM_ID;
const ARIO_MINT = process.env.ARIO_MINT;
// localnet.env stores AUTHORITY_KEYPAIR_PATH as a path RELATIVE to the
// solana-ar-io repo root (not cwd). Resolve it against SOLANA_AR_IO_ROOT
// (set by the e2e bootstrap script) or the sibling-clone convention.
// `resolve(cwd, '..', path)` was wrong: from inside ar-io-sdk's tree, `..`
// is the user's home dir, not the solana-ar-io repo.
function resolveAuthorityKp(): string | undefined {
  const raw = process.env.AUTHORITY_KEYPAIR_PATH;
  if (!raw) return undefined;
  if (isAbsolute(raw)) return raw;
  const root =
    process.env.SOLANA_AR_IO_ROOT ??
    resolve(process.cwd(), '..', 'solana-ar-io');
  return resolve(root, raw);
}
const AUTHORITY_KP = resolveAuthorityKp();

const SHOULD_RUN = Boolean(
  RPC_URL &&
    WS_URL &&
    CORE_ID &&
    GAR_ID &&
    ARNS_ID &&
    ANT_ID &&
    ARIO_MINT &&
    AUTHORITY_KP,
);

/** 50,000 ARIO — comfortably above the 10k operator floor. */
const OPERATOR_STAKE = 50_000_000_000n;

function shell(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Generate a fresh keypair via `solana-keygen` and load it as a kit signer. */
async function freshSigner(
  scratchDir: string,
  label: string,
): Promise<{ signer: KeyPairSigner; keypairPath: string }> {
  const keypairPath = join(scratchDir, `${label}.json`);
  shell('solana-keygen', [
    'new',
    '--outfile',
    keypairPath,
    '--no-bip39-passphrase',
    '--silent',
    '--force',
  ]);
  const bytes = new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf8')));
  const signer = await createKeyPairSignerFromBytes(bytes);
  return { signer, keypairPath };
}

async function airdropViaSurfnet(
  pubkey: string,
  sol: number,
): Promise<boolean> {
  const lamports = BigInt(Math.round(sol * 1_000_000_000));
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'surfnet_setAccount',
    params: [
      pubkey,
      {
        lamports: Number(lamports),
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
    // -32601 = "Method not found" → not a Surfpool RPC, fall back to CLI.
    if (json.error.code === -32601) return false;
    throw new Error(
      `surfnet_setAccount failed for ${pubkey}: ${json.error.message}`,
    );
  }
  return true;
}

async function airdrop(keypairPath: string, sol: number) {
  // Resolve the pubkey from the keypair file so the helper stays a drop-in
  // replacement for the `solana airdrop --keypair <file>` CLI it shadows.
  const pubkey = shell('solana-keygen', ['pubkey', keypairPath]).trim();
  // Try Surfpool's cheatcode first (the bundled `solana airdrop` CLI fails
  // with `InvalidProgramForExecution` against Surfpool 1.1.2 — see
  // https://github.com/txtx/surfpool). Fall back to the CLI for vanilla
  // `solana-test-validator` and devnet.
  if (await airdropViaSurfnet(pubkey, sol)) return;
  shell('solana', [
    'airdrop',
    String(sol),
    '--keypair',
    keypairPath,
    '--url',
    RPC_URL!,
    '--commitment',
    'confirmed',
  ]);
}

/** Mint `amount` ARIO mARIO to `recipient` via the authority keypair. */
function mintArio(recipient: string, amount: bigint) {
  // Create the recipient ATA first (idempotent — `--owner` may already exist)
  try {
    shell('spl-token', [
      'create-account',
      ARIO_MINT!,
      '--owner',
      recipient,
      '--fee-payer',
      AUTHORITY_KP!,
      '--url',
      RPC_URL!,
    ]);
  } catch {
    // Already exists — fine.
  }
  // Mint to that ATA
  shell('spl-token', [
    'mint',
    ARIO_MINT!,
    String(amount),
    '--recipient-owner',
    recipient,
    '--mint-authority',
    AUTHORITY_KP!,
    '--fee-payer',
    AUTHORITY_KP!,
    '--url',
    RPC_URL!,
  ]);
}

function buildArio(
  signer: KeyPairSigner,
  rpcUrl: string,
  wsUrl: string,
): SolanaARIOWriteable {
  return ARIO.init({
    backend: 'solana',
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
    coreProgramId: address(CORE_ID!),
    garProgramId: address(GAR_ID!),
    arnsProgramId: address(ARNS_ID!),
    antProgramId: address(ANT_ID!),
    signer,
  }) as SolanaARIOWriteable;
}

describe(
  'Fund-from-stakes against Solana localnet (SDK → on-chain BPF round trip)',
  {
    skip: !SHOULD_RUN
      ? 'Requires running localnet + sourced migration/localnet/out/localnet.env'
      : false,
  },
  () => {
    // Mutated in before(); never null inside the actual it() bodies.
    let scratch: string;
    let operator: { signer: KeyPairSigner; keypairPath: string };
    let ario: ReturnType<typeof buildArio>;

    before(async () => {
      try {
        scratch = mkdtempSync(join(tmpdir(), 'arns-localnet-'));
        operator = await freshSigner(scratch, 'operator');
        ario = buildArio(operator.signer, RPC_URL!, WS_URL!);
      } catch (e) {
        console.error('before() failed:', e);
        throw e;
      }
    });

    it('bootstraps operator + funds with SOL + ARIO', async () => {
      // Side-effect-only: airdrops SOL and mints ARIO. spl-token's `accounts`
      // subcommand uses getTokenAccountsByOwner which Surfpool doesn't
      // implement, so we don't read the balance directly here. If the mint
      // silently fails, the joinNetwork test below will fail loudly with
      // AccountNotInitialized for operator_token_account.
      await airdrop(operator.keypairPath, 5);
      mintArio(operator.signer.address, OPERATOR_STAKE * 2n);
    });

    it('joinNetwork: operator joins via SDK and gateway is readable', async () => {
      const result = await ario.joinNetwork({
        // SDK signature is `number`; OPERATOR_STAKE = 5e10 is well within
        // Number.MAX_SAFE_INTEGER (9e15) so the conversion is lossless.
        operatorStake: Number(OPERATOR_STAKE),
        label: 'smoke-gw',
        fqdn: 'smoke.example.com',
        port: 443,
        protocol: 'https',
        autoStake: false,
        allowDelegatedStaking: true,
        delegateRewardShareRatio: 10,
        observerAddress: operator.signer.address as string,
      });
      assert.ok(result.id, 'joinNetwork must return a tx id');

      const gw = await ario.getGateway({
        address: operator.signer.address as string,
      });
      assert.equal(gw.status, 'joined');
      assert.equal(BigInt(gw.operatorStake), OPERATOR_STAKE);
      assert.equal(gw.settings.fqdn, 'smoke.example.com');
    });

    it('buyRecord({ fundFrom: "stakes", fundAsOperator: true }) deducts from operator stake', async () => {
      // Spawn a real Metaplex Core ANT for this name
      const antResult = await spawnSolanaANT({
        rpc: createSolanaRpc(RPC_URL!),
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: operator.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Smoke Test ANT',
          ticker: 'SMK',
          description: 'localnet smoke',
          uri: 'ar://localnet-placeholder-metadata',
        },
      });
      assert.ok(antResult.processId, 'ANT spawn must return a processId');

      const stakeBefore = BigInt(
        (await ario.getGateway({ address: operator.signer.address as string }))
          .operatorStake,
      );

      // Unique name to keep this test re-runnable against a persistent Surfpool
      const name = 'smoke' + Date.now().toString(36).slice(-6);

      const result = await ario.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
        fundFrom: 'stakes',
        fundAsOperator: true,
        gatewayAddress: operator.signer.address as string,
      });
      assert.ok(result.id, 'buyRecord (operator stake) must return a tx id');

      // Verify on-chain: record exists + stake decreased by purchase price
      const record = await ario.getArNSRecord({ name });
      assert.equal(record.processId, antResult.processId);
      assert.equal(record.type, 'lease');
      assert.ok(record.purchasePrice > 0, 'purchasePrice must be > 0');

      const stakeAfter = BigInt(
        (await ario.getGateway({ address: operator.signer.address as string }))
          .operatorStake,
      );
      assert.equal(
        stakeBefore - stakeAfter,
        BigInt(record.purchasePrice),
        'operator_stake must decrease by exactly the purchase price',
      );
    });

    it('buyRecord({ fundFrom: "stakes", fundAsOperator: false }) deducts from delegation', async () => {
      // Fresh delegator signer
      const delegator = await freshSigner(scratch, 'delegator');
      await airdrop(delegator.keypairPath, 5);
      mintArio(delegator.signer.address, 100_000_000_000n); // 100k ARIO

      const delegatorArio = buildArio(delegator.signer, RPC_URL!, WS_URL!);

      // Delegator delegates 50k ARIO to the operator's gateway
      const delegateAmount = 50_000_000_000n;
      const dResult = await delegatorArio.delegateStake({
        target: operator.signer.address as string,
        // SDK signature is `number | mARIOToken`; 5e10 is lossless.
        stakeQty: Number(delegateAmount),
      });
      assert.ok(dResult.id, 'delegateStake must return a tx id');

      // Spawn an ANT owned by the delegator (the ANT-owner check applies to
      // buy_name only via the ant_asset constraint — buy_name itself doesn't
      // check NFT holder, so this is just a fresh asset)
      const antResult = await spawnSolanaANT({
        rpc: createSolanaRpc(RPC_URL!),
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: delegator.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Delegator ANT',
          ticker: 'DEL',
          description: 'localnet smoke',
          uri: 'ar://localnet-placeholder-metadata',
        },
      });

      const name = 'delesm' + Date.now().toString(36).slice(-6);

      // Capture delegation amount before purchase
      const delegationsBefore = await delegatorArio.getDelegations({
        address: delegator.signer.address as string,
      });
      const delBefore = delegationsBefore.items.find(
        (d) => d.gatewayAddress === (operator.signer.address as string),
      );
      assert.ok(delBefore, 'delegation must exist after delegateStake');
      const delAmtBefore = BigInt(delBefore.balance);

      const result = await delegatorArio.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
        fundFrom: 'stakes',
        fundAsOperator: false,
        gatewayAddress: operator.signer.address as string,
      });
      assert.ok(result.id, 'buyRecord (delegation) must return a tx id');

      // Verify the record exists
      const record = await delegatorArio.getArNSRecord({ name });
      assert.equal(record.processId, antResult.processId);

      // Verify delegation reduced by exactly the purchase price
      const delegationsAfter = await delegatorArio.getDelegations({
        address: delegator.signer.address as string,
      });
      const delAfter = delegationsAfter.items.find(
        (d) => d.gatewayAddress === (operator.signer.address as string),
      );
      assert.ok(
        delAfter,
        'delegation must still exist after partial deduction',
      );
      const delAmtAfter = BigInt(delAfter.balance);
      assert.equal(
        delAmtBefore - delAmtAfter,
        BigInt(record.purchasePrice),
        'delegation must decrease by exactly the purchase price',
      );
    });

    /**
     * Read the SPL ATA balance for `owner` directly from the ATA account
     * (offset 64, u64 LE). Avoids `getTokenAccountsByOwner`, which Surfpool
     * doesn't implement (see existing comment on the bootstrap test).
     */
    async function readArioBalance(owner: string): Promise<bigint> {
      const rpc = createSolanaRpc(RPC_URL!);
      const ata = await getAssociatedTokenAddressKit(
        address(ARIO_MINT!),
        address(owner),
      );
      const acct = await fetchEncodedAccount(rpc, ata);
      if (!acct.exists || acct.data.length < 72) return 0n;
      return new DataView(
        acct.data.buffer,
        acct.data.byteOffset,
        72,
      ).getBigUint64(64, true);
    }

    it('buyRecord({ fundFrom: "withdrawal", withdrawalId }) deducts from a locked withdrawal vault', async () => {
      // Fresh delegator → delegate 50k ARIO → decrease the entire delegation
      // to seed Withdrawal id=0 (WithdrawalCounter is init_if_needed and
      // starts at 0 for first-time owners). Then pay for an ArNS lease out
      // of that locked vault via `buy_name_from_withdrawal`.
      const delegator = await freshSigner(scratch, 'wd-delegator');
      await airdrop(delegator.keypairPath, 5);
      mintArio(delegator.signer.address, 100_000_000_000n);

      const delegatorArio = buildArio(delegator.signer, RPC_URL!, WS_URL!);
      const rpc = createSolanaRpc(RPC_URL!);

      const delegateAmount = 50_000_000_000n;
      await delegatorArio.delegateStake({
        target: operator.signer.address as string,
        stakeQty: Number(delegateAmount),
      });
      await delegatorArio.decreaseDelegateStake({
        target: operator.signer.address as string,
        decreaseQty: Number(delegateAmount),
      });

      const withdrawalId = 0n;
      const [withdrawalPda] = await getWithdrawalPDA(
        delegator.signer.address,
        withdrawalId,
        address(GAR_ID!),
      );
      const wBefore = await fetchEncodedAccount(rpc, withdrawalPda);
      assert.ok(
        wBefore.exists,
        'withdrawal vault must exist after decreaseDelegateStake',
      );
      const wdBefore = deserializeWithdrawal(Buffer.from(wBefore.data));
      assert.equal(
        BigInt(wdBefore.balance),
        delegateAmount,
        'newly-minted withdrawal vault must hold the full decreased amount',
      );

      const antResult = await spawnSolanaANT({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: delegator.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Withdrawal ANT',
          ticker: 'WD',
          description: 'localnet smoke',
          uri: 'ar://localnet-placeholder-metadata',
        },
      });

      const name = 'wdsm' + Date.now().toString(36).slice(-6);
      const result = await delegatorArio.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
        fundFrom: 'withdrawal',
        withdrawalId,
      });
      assert.ok(result.id, 'buyRecord (withdrawal) must return a tx id');

      const record = await delegatorArio.getArNSRecord({ name });
      assert.equal(record.processId, antResult.processId);
      assert.equal(record.type, 'lease');
      assert.ok(record.purchasePrice > 0, 'purchasePrice must be > 0');

      const wAfter = await fetchEncodedAccount(rpc, withdrawalPda);
      assert.ok(
        wAfter.exists,
        'partial-drain must leave the withdrawal vault open',
      );
      const wdAfter = deserializeWithdrawal(Buffer.from(wAfter.data));
      assert.equal(
        BigInt(wdBefore.balance) - BigInt(wdAfter.balance),
        BigInt(record.purchasePrice),
        'withdrawal vault must decrease by exactly the purchase price',
      );
    });

    it('getWithdrawals({ address }) returns per-wallet operator + delegate withdrawals', async () => {
      // Fresh operator + fresh delegator so the assertion counts are exact
      // and the shared `operator` state isn't perturbed.
      const wdOp = await freshSigner(scratch, 'wd-list-operator');
      await airdrop(wdOp.keypairPath, 5);
      mintArio(wdOp.signer.address, OPERATOR_STAKE * 2n);
      const wdOpArio = buildArio(wdOp.signer, RPC_URL!, WS_URL!);

      await wdOpArio.joinNetwork({
        operatorStake: Number(OPERATOR_STAKE),
        label: 'wd-list-gw',
        fqdn: 'wd-list.example.com',
        port: 443,
        protocol: 'https',
        autoStake: false,
        allowDelegatedStaking: true,
        delegateRewardShareRatio: 10,
        observerAddress: wdOp.signer.address as string,
      });

      // Operator-stake withdrawal. OPERATOR_STAKE (50k) - 10k = 40k, still
      // above the 10k floor, so the decrease is accepted.
      await wdOpArio.decreaseOperatorStake({
        decreaseQty: 10_000_000_000,
      });

      // Delegate-stake withdrawal from a fresh delegator targeting wdOp.
      const wdDel = await freshSigner(scratch, 'wd-list-delegator');
      await airdrop(wdDel.keypairPath, 5);
      mintArio(wdDel.signer.address, 100_000_000_000n);
      const wdDelArio = buildArio(wdDel.signer, RPC_URL!, WS_URL!);

      const delegateAmount = 50_000_000_000n;
      await wdDelArio.delegateStake({
        target: wdOp.signer.address as string,
        stakeQty: Number(delegateAmount),
      });
      await wdDelArio.decreaseDelegateStake({
        target: wdOp.signer.address as string,
        decreaseQty: Number(delegateAmount),
      });

      const opResult = await wdOpArio.getWithdrawals({
        address: wdOp.signer.address as string,
      });
      assert.equal(
        opResult.items.length,
        1,
        'operator must surface exactly one withdrawal (its own decrease)',
      );
      assert.equal(opResult.items[0].isDelegate, false);
      assert.equal(
        opResult.items[0].gatewayAddress,
        wdOp.signer.address as string,
      );
      assert.ok(
        opResult.items[0].endTimestamp > opResult.items[0].startTimestamp,
        'endTimestamp must be after startTimestamp',
      );

      const delResult = await wdDelArio.getWithdrawals({
        address: wdDel.signer.address as string,
      });
      assert.equal(
        delResult.items.length,
        1,
        'delegator must surface exactly one withdrawal (its delegate decrease)',
      );
      assert.equal(delResult.items[0].isDelegate, true);
      assert.equal(
        delResult.items[0].gatewayAddress,
        wdOp.signer.address as string,
      );

      // Cross-check: operator's getWithdrawals does NOT include the delegate
      // withdrawal that landed on its gateway (delegate withdrawal is owned
      // by the delegator, not by the gateway).
      assert.ok(
        opResult.items.every((w) => !w.isDelegate),
        'operator getWithdrawals must not surface delegate-owned withdrawals',
      );
    });

    it('buyRecord({ fundFrom: "plan", sources: [...] }) draws from a caller-supplied balance + delegation plan', async () => {
      // Fresh delegator → mint balance → delegate so the plan has both a
      // wallet ATA source and a delegation source. Pre-compute cost via
      // getTokenCost so the explicit per-source amounts sum to *exactly*
      // the on-chain cost (the handler hard-rejects mismatches with
      // FundingPlanAmountMismatch).
      const delegator = await freshSigner(scratch, 'plan-delegator');
      await airdrop(delegator.keypairPath, 5);
      mintArio(delegator.signer.address, 100_000_000_000n);

      const delegatorArio = buildArio(delegator.signer, RPC_URL!, WS_URL!);
      const rpc = createSolanaRpc(RPC_URL!);

      const delegateAmount = 50_000_000_000n;
      await delegatorArio.delegateStake({
        target: operator.signer.address as string,
        stakeQty: Number(delegateAmount),
      });

      const antResult = await spawnSolanaANT({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: delegator.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Plan ANT',
          ticker: 'PLAN',
          description: 'localnet smoke',
          uri: 'ar://localnet-placeholder-metadata',
        },
      });

      const name = 'plansm' + Date.now().toString(36).slice(-6);
      const cost = BigInt(
        await delegatorArio.getTokenCost({
          intent: 'Buy-Record',
          name,
          years: 1,
          type: 'lease',
        }),
      );
      assert.ok(
        cost >= 2n,
        'cost must be ≥ 2 mARIO so we can split it across two sources',
      );
      const fromBalance = cost / 2n;
      const fromDelegation = cost - fromBalance;

      const balBefore = await readArioBalance(delegator.signer.address);
      const delegationsBefore = await delegatorArio.getDelegations({
        address: delegator.signer.address as string,
      });
      const delBefore = delegationsBefore.items.find(
        (d) => d.gatewayAddress === (operator.signer.address as string),
      );
      assert.ok(delBefore, 'delegation must exist after delegateStake');
      const delAmtBefore = BigInt(delBefore.balance);

      const result = await delegatorArio.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
        fundFrom: 'plan',
        gatewayAddress: operator.signer.address as string,
        sources: [
          { kind: 'balance', amount: fromBalance },
          {
            kind: 'delegation',
            amount: fromDelegation,
            gateway: operator.signer.address as string,
          },
        ],
      });
      assert.ok(result.id, 'buyRecord (plan) must return a tx id');

      const record = await delegatorArio.getArNSRecord({ name });
      assert.equal(record.processId, antResult.processId);
      assert.equal(
        BigInt(record.purchasePrice),
        cost,
        'recorded purchase price must match the pre-computed cost',
      );

      const balAfter = await readArioBalance(delegator.signer.address);
      const delegationsAfter = await delegatorArio.getDelegations({
        address: delegator.signer.address as string,
      });
      const delAfter = delegationsAfter.items.find(
        (d) => d.gatewayAddress === (operator.signer.address as string),
      );
      assert.ok(
        delAfter,
        'delegation must still exist after partial deduction',
      );
      const delAmtAfter = BigInt(delAfter.balance);

      assert.equal(
        balBefore - balAfter,
        fromBalance,
        'wallet balance must drop by exactly the planned balance source amount',
      );
      assert.equal(
        delAmtBefore - delAmtAfter,
        fromDelegation,
        'delegation must drop by exactly the planned delegation source amount',
      );
    });

    it('buyRecord({ fundFrom: "any" }) auto-plans drawdown from discovered sources', async () => {
      // Fresh delegator with both a wallet balance and a non-trivial
      // delegation. The Lua-faithful planner draws balance → vaults →
      // excess delegation → minimum delegation, so for this setup it
      // should pick balance only — but the assertion checks (balance +
      // delegation) drain == cost, which is robust to any planner shape.
      const delegator = await freshSigner(scratch, 'any-delegator');
      await airdrop(delegator.keypairPath, 5);
      mintArio(delegator.signer.address, 100_000_000_000n);

      const delegatorArio = buildArio(delegator.signer, RPC_URL!, WS_URL!);
      const rpc = createSolanaRpc(RPC_URL!);

      const delegateAmount = 50_000_000_000n;
      await delegatorArio.delegateStake({
        target: operator.signer.address as string,
        stakeQty: Number(delegateAmount),
      });

      const antResult = await spawnSolanaANT({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: delegator.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Any ANT',
          ticker: 'ANY',
          description: 'localnet smoke',
          uri: 'ar://localnet-placeholder-metadata',
        },
      });

      const name = 'anysm' + Date.now().toString(36).slice(-6);
      const cost = BigInt(
        await delegatorArio.getTokenCost({
          intent: 'Buy-Record',
          name,
          years: 1,
          type: 'lease',
        }),
      );

      const balBefore = await readArioBalance(delegator.signer.address);
      const delegationsBefore = await delegatorArio.getDelegations({
        address: delegator.signer.address as string,
      });
      const delBefore = delegationsBefore.items.find(
        (d) => d.gatewayAddress === (operator.signer.address as string),
      );
      assert.ok(delBefore, 'delegation must exist after delegateStake');
      const delAmtBefore = BigInt(delBefore.balance);

      const result = await delegatorArio.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
        fundFrom: 'any',
        gatewayAddress: operator.signer.address as string,
      });
      assert.ok(result.id, 'buyRecord (any) must return a tx id');

      const record = await delegatorArio.getArNSRecord({ name });
      assert.equal(record.processId, antResult.processId);
      assert.equal(BigInt(record.purchasePrice), cost);

      const balAfter = await readArioBalance(delegator.signer.address);
      const delegationsAfter = await delegatorArio.getDelegations({
        address: delegator.signer.address as string,
      });
      const delAfter = delegationsAfter.items.find(
        (d) => d.gatewayAddress === (operator.signer.address as string),
      );
      const delAmtAfter = delAfter ? BigInt(delAfter.balance) : 0n;

      const totalDrained = balBefore - balAfter + (delAmtBefore - delAmtAfter);
      assert.equal(
        totalDrained,
        cost,
        'sum of balance + delegation drain must equal exactly the purchase price',
      );
    });

    it('setPrimaryName calls request_and_set when ArNS + ANT are owned by signer', async () => {
      const rpc = createSolanaRpc(RPC_URL!);
      const antResult = await spawnSolanaANT({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: operator.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Primary set smoke ANT',
          ticker: 'PN1',
          description: 'primary name localnet',
          uri: 'ar://localnet-primary-set',
        },
      });
      const name = `prset${Date.now().toString(36).slice(-8)}`;
      const buy = await ario.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
      });
      assert.ok(buy.id, 'buyRecord must succeed before setPrimaryName');

      const setRes = await ario.setPrimaryName({ name });
      assert.ok(setRes.id, 'setPrimaryName must return a tx id');

      const pn = await ario.getPrimaryName({
        address: operator.signer.address as string,
      });
      assert.equal(pn.name.toLowerCase(), name.toLowerCase());
      assert.equal(pn.processId, antResult.processId);
      assert.equal(
        pn.owner.toLowerCase(),
        operator.signer.address.toLowerCase(),
      );
    });

    it('requestPrimaryName + approvePrimaryName two-step flow sets primary name', async () => {
      // Hermeticity: use a fresh signer rather than the shared `operator`.
      // The prior test (`setPrimaryName calls request_and_set ...`) sets a
      // primary name on `operator`, so reusing it here trips
      // `MustRemoveExistingPrimaryName` on the approve step. ARIO-core's
      // `approve_primary_name` enforces a "remove first" rule when the
      // signer already has a primary name pointing at a different name.
      const fresh = await freshSigner(scratch, 'pn2-signer');
      await airdrop(fresh.keypairPath, 5);
      mintArio(fresh.signer.address, 100_000_000_000n); // 100k ARIO

      const freshArio = buildArio(fresh.signer, RPC_URL!, WS_URL!);
      const rpc = createSolanaRpc(RPC_URL!);
      const antResult = await spawnSolanaANT({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL!),
        signer: fresh.signer,
        antProgramId: address(ANT_ID!),
        state: {
          name: 'Primary approve smoke ANT',
          ticker: 'PN2',
          description: 'primary name localnet',
          uri: 'ar://localnet-primary-approve',
        },
      });
      const name = `prreq${Date.now().toString(36).slice(-8)}`;
      const buy = await freshArio.buyRecord({
        name,
        type: 'lease',
        years: 1,
        processId: antResult.processId,
      });
      assert.ok(buy.id, 'buyRecord must succeed before primary name request');

      const reqRes = await freshArio.requestPrimaryName({ name });
      assert.ok(reqRes.id, 'requestPrimaryName must return a tx id');

      const pending = await freshArio.getPrimaryNameRequest({
        initiator: fresh.signer.address as string,
      });
      assert.equal(pending.name.toLowerCase(), name.toLowerCase());

      const appRes = await freshArio.approvePrimaryName({
        initiator: fresh.signer.address as string,
        name,
      });
      assert.ok(appRes.id, 'approvePrimaryName must return a tx id');

      const pn = await freshArio.getPrimaryName({
        address: fresh.signer.address as string,
      });
      assert.equal(pn.name.toLowerCase(), name.toLowerCase());
      assert.equal(pn.processId, antResult.processId);
    });
  },
);
