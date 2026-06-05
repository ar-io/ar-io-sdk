# SDK e2e test fixtures

Committed assets for `sdk/scripts/start-e2e-localnet.sh` and the
`*.e2e.test.ts` suite that runs against it.

## `e2e-test-wallet.json`

Solana keypair (raw 64-byte secret-key array, the format
`solana-keygen` writes). Funded by `start-e2e-localnet.sh` with SOL
(via `solana airdrop` against the local RPC) and ARIO (via
`spl-token mint` from the localnet authority — devnet-setup retains
mint authority on the ARIO token).

This wallet is **localnet-only** and has no real funds anywhere. The
keypair is checked in deliberately so e2e runs are deterministic and
contributors don't need to coordinate fixture generation.

To rotate (rare — only if the file is ever exposed in a way that
matters, or if some future test wants to assert a specific address):

```bash
solana-keygen new --no-bip39-passphrase --silent \
  --outfile sdk/test/fixtures/e2e-test-wallet.json --force
```

…then commit the new file. Tests read the path from the
`TEST_WALLET_FILE` env var that `start-e2e-localnet.sh` writes into
`sdk/test/.env.e2e`, so they pick up the rotated key automatically.
