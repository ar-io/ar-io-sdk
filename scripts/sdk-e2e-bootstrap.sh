#!/usr/bin/env bash
# Boot a localnet for ar-io-sdk e2e tests and write test/.env.e2e.
#
# Delegates to github.com/ar-io/solana-ar-io for the localnet itself:
#   sibling clones (default):
#     <parent>/ar-io-sdk/     ← this repo
#     <parent>/solana-ar-io/  ← cloned here, or override via SOLANA_AR_IO_ROOT
#
# What we run:
#   1. solana-ar-io/scripts/start-localnet.sh with SKIP_IMPORT=1 — boots
#      Surfpool, deploys all five AR.IO programs, runs devnet-setup (creates
#      the ARIO mint, ArioConfig, GAR settings, ArNS config, both registries).
#      We deliberately skip the AO migration import: SDK e2e tests spawn
#      fresh state (operator, ANTs, ArNS records) and don't read imported
#      data, so importing 3500 ANTs + 700 ArNS records + 1300 gateways adds
#      ~20 minutes for zero test coverage.
#   2. Source migration/localnet/out/localnet.env (program IDs, ARIO mint,
#      authority keypair path, RPC URL).
#   3. Generate a fresh keypair for the e2e test wallet, airdrop SOL via
#      Surfpool's surfnet_setAccount cheatcode (the bundled `solana airdrop`
#      CLI fails against Surfpool 1.1.2 with InvalidProgramForExecution),
#      and mint ARIO to it via spl-token CLI.
#   4. Write $SDK_ROOT/test/.env.e2e so `yarn test:sdk-e2e` can source it.
#
# Idempotency: passes FORCE_RESTART=1 every run — kills any in-flight
# surfpool, boots fresh, generates a new test wallet. Run cost is dominated
# by the BPF compile (~2 min cached) + devnet-setup (~5 min).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK_ROOT="$(cd "$HERE/.." && pwd)"
SOLANA_AR_IO="${SOLANA_AR_IO_ROOT:-$SDK_ROOT/../solana-ar-io}"
UPSTREAM="$SOLANA_AR_IO/scripts/start-localnet.sh"

if [[ ! -f "$UPSTREAM" ]]; then
  echo "[sdk-e2e-bootstrap] Missing solana-ar-io entrypoint at:" >&2
  echo "                     $UPSTREAM" >&2
  echo "                     Clone https://github.com/ar-io/solana-ar-io alongside" >&2
  echo "                     this repo, or set SOLANA_AR_IO_ROOT." >&2
  exit 1
fi

LOCALNET_ENV="$SOLANA_AR_IO/migration/localnet/out/localnet.env"
TEST_DIR="$SDK_ROOT/test"
WALLET_FILE="$TEST_DIR/e2e-wallet.json"
ENV_FILE="$TEST_DIR/.env.e2e"

# FAST_GENESIS=0 forces the slow path. We need devnet-setup to run (it's what
# creates the NameRegistry/GatewayRegistry as ario-arns/ario-gar-owned PDAs);
# the fast path skips devnet-setup AND skips injecting NameRegistry (>1 MB
# hits surfpool's RPC body limit), leaving every ArNS write tx to fail with
# AccountOwnedByWrongProgram. SKIP_IMPORT=1 still skips the 25-min AO migration
# import (we don't need imported state — SDK tests spawn their own).
echo "[sdk-e2e-bootstrap] Booting localnet via $UPSTREAM (FAST_GENESIS=0, SKIP_IMPORT=1, FORCE_RESTART=1)..."
FAST_GENESIS=0 SKIP_IMPORT=1 FORCE_RESTART=1 bash "$UPSTREAM" "$@"

if [[ ! -f "$LOCALNET_ENV" ]]; then
  echo "[sdk-e2e-bootstrap] localnet bring-up did not produce $LOCALNET_ENV" >&2
  exit 1
fi

# Source the monorepo's localnet.env. Keep it scoped — we don't want random
# vars (e.g. AR_IO_CONTRACTS_PATH) leaking into the test process if they
# were set by the bring-up.
set -a
# shellcheck disable=SC1090
source "$LOCALNET_ENV"
set +a

: "${RPC_URL:?RPC_URL missing from localnet.env}"
: "${ARIO_MINT:?ARIO_MINT missing from localnet.env}"
: "${ARIO_CORE_PROGRAM_ID:?ARIO_CORE_PROGRAM_ID missing}"
: "${ARIO_GAR_PROGRAM_ID:?ARIO_GAR_PROGRAM_ID missing}"
: "${ARIO_ARNS_PROGRAM_ID:?ARIO_ARNS_PROGRAM_ID missing}"
: "${ARIO_ANT_PROGRAM_ID:?ARIO_ANT_PROGRAM_ID missing}"
: "${AUTHORITY_KEYPAIR_PATH:?AUTHORITY_KEYPAIR_PATH missing}"

# Resolve relative AUTHORITY_KEYPAIR_PATH against the solana-ar-io repo root
# (where localnet.env stores it relative-to).
if [[ "$AUTHORITY_KEYPAIR_PATH" != /* ]]; then
  AUTHORITY_KEYPAIR_PATH="$SOLANA_AR_IO/$AUTHORITY_KEYPAIR_PATH"
fi
[[ -f "$AUTHORITY_KEYPAIR_PATH" ]] || {
  echo "[sdk-e2e-bootstrap] resolved AUTHORITY_KEYPAIR_PATH not on disk: $AUTHORITY_KEYPAIR_PATH" >&2
  exit 1
}

# Derive WS_URL from RPC_URL (8899 → 8900, http → ws).
WS_URL="${WS_URL:-$(echo "$RPC_URL" | sed -E 's/^http/ws/; s/:8899/:8900/')}"

mkdir -p "$TEST_DIR"

# Fresh test wallet every run — keeps tests hermetic against any prior
# state (records bought, primary name set, etc.) on a re-used localnet.
echo "[sdk-e2e-bootstrap] Generating fresh test wallet at $WALLET_FILE"
solana-keygen new --outfile "$WALLET_FILE" --no-bip39-passphrase --silent --force
WALLET_PUBKEY="$(solana-keygen pubkey "$WALLET_FILE")"

# Airdrop via Surfpool's surfnet_setAccount cheatcode. The bundled `solana
# airdrop` CLI fails against Surfpool 1.1.2 with InvalidProgramForExecution;
# see https://github.com/txtx/surfpool.
echo "[sdk-e2e-bootstrap] Airdropping 50 SOL to $WALLET_PUBKEY"
# Bound the call so a stalled/unreachable local RPC can't hang bootstrap
# indefinitely: cap each attempt's connect/total time and retry a few times
# (incl. connection-refused while surfpool is still coming up). `-f` + the
# script's `set -e` make an exhausted retry budget fail the bootstrap.
curl -sf --retry 5 --retry-connrefused --retry-delay 2 \
  --connect-timeout 5 --max-time 30 \
  "$RPC_URL" -X POST -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"surfnet_setAccount\",\"params\":[\"$WALLET_PUBKEY\",{\"lamports\":50000000000,\"owner\":\"11111111111111111111111111111111\",\"executable\":false,\"data\":[]}]}" \
  >/dev/null

# Mint ARIO. Create the ATA first (idempotent — `try` it; if it already
# exists spl-token errors but we don't care).
echo "[sdk-e2e-bootstrap] Minting 1,000,000 ARIO to $WALLET_PUBKEY"
spl-token create-account "$ARIO_MINT" \
  --owner "$WALLET_PUBKEY" \
  --fee-payer "$AUTHORITY_KEYPAIR_PATH" \
  --url "$RPC_URL" >/dev/null 2>&1 || true
spl-token mint "$ARIO_MINT" 1000000 \
  --recipient-owner "$WALLET_PUBKEY" \
  --mint-authority "$AUTHORITY_KEYPAIR_PATH" \
  --fee-payer "$AUTHORITY_KEYPAIR_PATH" \
  --url "$RPC_URL" >/dev/null

# Write the env file. Variables match what sdk.e2e.test.ts +
# io-writeable.localnet.test.ts read from process.env.
cat > "$ENV_FILE" <<EOF
# Generated by scripts/sdk-e2e-bootstrap.sh — do not edit by hand. Regenerate
# with: yarn sdk-e2e:up. Wallet at TEST_WALLET_FILE is rotated each run.
RPC_URL=$RPC_URL
WS_URL=$WS_URL
ARIO_CORE_PROGRAM_ID=$ARIO_CORE_PROGRAM_ID
ARIO_GAR_PROGRAM_ID=$ARIO_GAR_PROGRAM_ID
ARIO_ARNS_PROGRAM_ID=$ARIO_ARNS_PROGRAM_ID
ARIO_ANT_PROGRAM_ID=$ARIO_ANT_PROGRAM_ID
ARIO_MINT=$ARIO_MINT
TEST_WALLET_FILE=$WALLET_FILE
# Used by io-writeable.localnet.test.ts. Absolute path so the test passes
# it straight to spl-token CLI regardless of cwd.
AUTHORITY_KEYPAIR_PATH=$AUTHORITY_KEYPAIR_PATH
# Mirror the keypair path under the same env var solana-ar-io exports
# (SDK e2e tests resolve relative paths against this).
SOLANA_AR_IO_ROOT=$SOLANA_AR_IO
EOF

echo "[sdk-e2e-bootstrap] Wrote $ENV_FILE"
echo "[sdk-e2e-bootstrap] Next: yarn test:sdk-e2e   (or  yarn test:localnet:io-write)"
