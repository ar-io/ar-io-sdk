#!/usr/bin/env bash
# Standalone ar-io-sdk entry point for the Hermetic e2e localnet harness.
#
# Delegates to github.com/ar-io/solana-ar-io (must be cloned as a sibling:
#   sibling-ar-io/
#     ar-io-sdk/     ← this repo (default)
#     solana-ar-io/  ← cloned here, or set SOLANA_AR_IO_ROOT
#
# Copies the generated test/.env.e2e from the monorepo into this repo so
# `yarn test:sdk-e2e` can run from the SDK package root only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK_ROOT="$(cd "$HERE/.." && pwd)"
SOLANA_AR_IO="${SOLANA_AR_IO_ROOT:-$SDK_ROOT/../solana-ar-io}"
UPSTREAM="$SOLANA_AR_IO/sdk/scripts/start-e2e-localnet.sh"

if [[ ! -f "$UPSTREAM" ]]; then
  echo "[sdk-e2e-bootstrap] Missing solana-ar-io bootstrap at:" >&2
  echo "                     $UPSTREAM" >&2
  echo "                     Clone https://github.com/ar-io/solana-ar-io alongside" >&2
  echo "                     this repo or set SOLANA_AR_IO_ROOT." >&2
  exit 1
fi

bash "$UPSTREAM" "$@"
mkdir -p "$SDK_ROOT/test"
cp "$SOLANA_AR_IO/sdk/test/.env.e2e" "$SDK_ROOT/test/.env.e2e"
echo "[sdk-e2e-bootstrap] Wrote $SDK_ROOT/test/.env.e2e — next: yarn test:sdk-e2e"
