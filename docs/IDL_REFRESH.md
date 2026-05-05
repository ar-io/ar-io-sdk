# IDL refresh runbook

The `idls/` directory at the repo root holds the Anchor + vendored IDL
JSON files that Codama lowers into `src/solana/generated/`. The IDLs are
the contract for what the generated client looks like — keeping them
in-tree means installs are hermetic, offline-buildable, and
reproducible (`yarn codegen` always emits the same output for a given
checkout).

## Files

```
idls/
  ario_ant.json
  ario_ant_escrow.json
  ario_arns.json
  ario_core.json
  ario_gar.json
  mpl_core.json          # vendored from metaplex-foundation/mpl-core
```

## When to refresh

Refresh whenever an Anchor contract's IDL changes — i.e. a `cargo
build-sbf` / `anchor build` in the contracts repo writes a different
JSON to `target/idl/<program>.json`. New error variants, new
instructions, modified account schemas, etc. all change the IDL.

Do NOT refresh just to bump the IDL `version` field — that field
floats and isn't a meaningful diff. Run `yarn codegen` after the
refresh; if `git diff src/solana/generated/` is empty, the IDL change
was a no-op and you can revert.

## Refresh procedure

### AR.IO programs (`ario_*`)

The AR.IO programs live in
[`ar-io/solana-ar-io`](https://github.com/ar-io/solana-ar-io)
(`contracts/programs/`). After a contracts release ships:

```bash
# In the solana-ar-io monorepo:
cd contracts && anchor build           # writes target/idl/*.json

# In this repo (ar-io-sdk@solana):
cp /path/to/solana-ar-io/contracts/target/idl/ario_*.json idls/
yarn codegen                           # regenerates src/solana/generated/
git diff --stat src/solana/generated/  # sanity check
git add idls/ src/solana/generated/
git commit -m "chore(idl): refresh ario_* IDLs to <release tag>"
```

### Vendored Metaplex Core IDL (`mpl_core`)

The MPL Core IDL is vendored from a pinned commit on
[`metaplex-foundation/mpl-core`](https://github.com/metaplex-foundation/mpl-core).
We track the upstream `release/core@<version>` tag.

```bash
MPL_CORE_REF=4f97997fc1f514d51319ee32258902aae32a7ee0   # pin
curl -sSfL \
  "https://raw.githubusercontent.com/metaplex-foundation/mpl-core/${MPL_CORE_REF}/idls/mpl_core.json" \
  -o idls/mpl_core.json
yarn codegen
git add idls/mpl_core.json src/solana/generated/mpl-core/
git commit -m "chore(idl): bump mpl_core to <new tag>"
```

## CI gate

`.github/workflows/build.yml` runs a `codegen-drift` job on every PR.
It re-runs `yarn codegen` and fails if `src/solana/generated/` would
change. This guarantees the committed generated tree always matches
`idls/`. If the job fails:

```bash
yarn codegen
git add src/solana/generated/
git commit --amend --no-edit
```

(Or a fresh commit if it's a separate logical change.)

## Why we commit `src/solana/generated/`

Verified Solana ecosystem norm — the same approach is used by
[`metaplex-foundation/mpl-core`](https://github.com/metaplex-foundation/mpl-core/tree/main/clients/js/src/generated)
and [`solana-program/token`](https://github.com/solana-program/token/tree/main/clients/js/src/generated).
Reasons:

- **Hermetic installs** — `npm install @ar.io/sdk@solana` doesn't need
  `yarn codegen` to run during postinstall. No Codama version skew
  between dev and prod.
- **Offline buildable** — consumers don't need network access at
  install time.
- **Reproducible diffs** — a contract change shows up in the PR diff
  as the actual generated TS, not a config bump that "regenerates
  later."
- **Reviewable** — reviewer can see what actually changed in the SDK
  surface, not just an IDL byte diff.

CI ensures committed and IDL-derived stay in sync.
