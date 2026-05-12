#!/usr/bin/env node
/**
 * Codama codegen entry point.
 *
 * Reads program IDLs and renders typed JS/TS clients into
 * `sdk/src/solana/generated/<program>/`. Two source families are supported:
 *
 *   - In-tree Anchor builds at `contracts/target/idl/<program>.json` (default)
 *   - Vendored snapshots under `sdk/idls/<program>.json` (for external
 *     programs we don't build ourselves, e.g. Metaplex Core)
 *
 * The generated output replaces hand-rolled `BorshAccountsCoder.encode(...)`
 * call sites where typos in field names (camelCase vs snake_case) silently
 * produced malformed bytes. With Codama, encoders take strongly-typed
 * objects whose property names are checked at compile time.
 */

import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';
import { createFromRoot } from 'codama';

const HERE = dirname(fileURLToPath(import.meta.url));
const IDL_DIR = resolve(HERE, '../idls');
const OUT_DIR = resolve(HERE, '../src/solana/generated');

/**
 * @typedef {{
 *   idl: string,
 *   out: string,
 *   rename?: string,
 * }} ProgramSpec
 *
 * Programs to generate. Both AR.IO programs and external (vendored) IDLs
 * live in the top-level `idls/` directory of this repo. See
 * `docs/IDL_REFRESH.md` for how to bump them after a contracts release.
 *
 *   `idl`:    basename of the IDL JSON (no extension)
 *   `out`:    subdirectory under `src/solana/generated/`
 *   `rename`: optional override for the IDL's `name` field, applied in-memory
 *             before lowering to a Codama IDL. Used to avoid awkward emit names
 *             like `MPL_CORE_PROGRAM_PROGRAM_ADDRESS` when the upstream IDL's
 *             `name` already ends in `_program`.
 */
const PROGRAMS = [
  // The 5 AR.IO programs (`ario_*`) now come from the
  // `@ar.io/solana-contracts` npm package — see CLAUDE.md "Codegen
  // sources". We only regenerate the vendored Metaplex Core client
  // here, and the SDK's own event decoders via `events-codegen.mjs`
  // (which still reads from `idls/ario_*.json`).
  //
  // External: Metaplex Core. IDL vendored from the upstream repo so we
  // can pin a known program version. Update by overwriting
  // `idls/mpl_core.json` with a fresh snapshot from the desired MPL
  // Core release.
  { idl: 'mpl_core', out: 'mpl-core', rename: 'mpl_core' },
];

for (const { idl, out, rename } of PROGRAMS) {
  const idlPath = resolve(IDL_DIR, `${idl}.json`);
  const outPath = resolve(OUT_DIR, out);

  console.log(`[codama] ${idl} -> generated/${out}`);

  const anchorIdl = JSON.parse(readFileSync(idlPath, 'utf-8'));
  if (rename) anchorIdl.name = rename;
  if (idl === 'mpl_core') patchMplCoreIdl(anchorIdl);
  const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));

  // Wipe + regenerate to avoid stale files from prior runs.
  rmSync(outPath, { recursive: true, force: true });

  await codama.accept(
    renderVisitor(outPath, {
      formatCode: false,
    }),
  );

  // Codama emits `<outPath>/src/generated/...` and a placeholder
  // `<outPath>/package.json` describing a standalone "js-client" package.
  // We don't want either — flatten to `<outPath>/...` so it's just a folder
  // of TypeScript modules consumers can import via relative path.
  const nestedDir = resolve(outPath, 'src/generated');
  if (existsSync(nestedDir)) {
    cpSync(nestedDir, outPath, { recursive: true });
    rmSync(resolve(outPath, 'src'), { recursive: true, force: true });
  }
  const placeholderPkg = resolve(outPath, 'package.json');
  if (existsSync(placeholderPkg)) {
    rmSync(placeholderPkg, { force: true });
  }

  // We keep `accounts/`, `pdas/`, `instructions/`, and `errors/` from
  // Codama's output. `programs/` is dropped because its `arioFooProgram()`
  // plugin pattern wraps a kit `Client` (`addSelfFetchFunctions` /
  // `addSelfPlanAndSendFunctions`) — that's a different abstraction layer
  // than the SDK uses (we build and send transactions explicitly).
  // `errors/` would normally re-export from `programs/`, but we patch the
  // imports to point at the `program-address.ts` shim instead, the same
  // treatment we apply to `instructions/`. That gives us Codama as the
  // single source of truth for error constants (per-error
  // `ARIO_FOO_ERROR__BAR` exports), used directly by tests via the
  // `*Error*` re-exports in `test/helpers/index.ts`. The per-instruction
  // builders we keep have a small dependency on
  // `@solana/program-client-core` (for `getAccountMetaFactory` +
  // `ResolvedInstructionAccount`), which is already a transitive dep of
  // `@solana/kit` at the same version (6.8.0), so no version skew.
  //
  // Codama's `instructions/` files import the program-address constant from
  // `'../programs'`. Before nuking that folder we extract just that constant
  // into a slim `program-address.ts` shim and rewrite every `from '../programs'`
  // import to point at it. Everything else exported from `programs/`
  // (`identifyXxxInstruction`, `arioXxxProgram()` plugin, etc.) is dropped.
  const programsDir = resolve(outPath, 'programs');
  const programAddressShim = resolve(outPath, 'program-address.ts');
  if (existsSync(programsDir)) {
    const constants = [];
    for (const file of readdirSync(programsDir)) {
      if (!file.endsWith('.ts')) continue;
      const src = readFileSync(resolve(programsDir, file), 'utf-8');
      // Match `export const FOO_PROGRAM_ADDRESS = '...' as Address<'...'>;`
      // (covers our `ARIO_*_PROGRAM_ADDRESS` and any vendored programs).
      const match = src.match(
        /export\s+const\s+([A-Z][A-Z0-9_]*_PROGRAM_ADDRESS)\s*=\s*('[^']+'|"[^"]+")\s+as\s+Address<('[^']+'|"[^"]+")>/,
      );
      if (match) {
        constants.push(
          `export const ${match[1]} = ${match[2]} as Address<${match[3]}>;`,
        );
      }
    }
    writeFileSync(
      programAddressShim,
      `/**\n * Program address constant lifted from Codama's pruned \`programs/\` output.\n * The full \`programs/\` plugin requires a kit \`Client\` we don't use; the\n * generated \`instructions/\` builders only need this one constant.\n */\nimport type { Address } from '@solana/kit';\n\n${constants.join('\n')}\n`,
    );
  }
  for (const sub of ['programs']) {
    const dir = resolve(outPath, sub);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  // Patch `errors/<program>.ts` files: their `import { ARIO_*_PROGRAM_ADDRESS }
  // from '../programs'` line points at the dropped folder. Rewrite to use
  // the shim — same treatment as `instructions/`.
  const errorsDir = resolve(outPath, 'errors');
  if (existsSync(errorsDir)) {
    rewriteProgramsImport(errorsDir);
  }
  // The barrel `index.ts` re-exports everything; rewrite it to only the
  // surface that survived the prune. Include `program-address.js` so
  // consumers can import the program-id constants without reaching into
  // the generated tree.
  const indexPath = resolve(outPath, 'index.ts');
  if (existsSync(indexPath)) {
    const banner =
      '/**\n * AUTOGENERATED by sdk/scripts/codegen.mjs.\n * Do not edit by hand — re-run `yarn codegen`.\n */\n\n';
    const dirExports = ['accounts', 'instructions', 'pdas', 'errors']
      .filter((d) => existsSync(resolve(outPath, d)))
      .map((d) => `export * from './${d}/index.js';`);
    const fileExports = existsSync(programAddressShim)
      ? [`export * from './program-address.js';`]
      : [];
    writeFileSync(
      indexPath,
      banner + [...dirExports, ...fileExports].join('\n') + '\n',
    );
  }

  // Codama's `instructions/` files import `ARIO_*_PROGRAM_ADDRESS` from
  // `'../programs'`, but we shimmed that to `program-address.ts`. Rewrite
  // the imports across the instructions/ tree before `addJsExtensions`
  // runs (otherwise the resolver leaves `'../programs'` alone since it
  // doesn't exist on disk).
  const instructionsDir = resolve(outPath, 'instructions');
  if (existsSync(instructionsDir)) {
    rewriteProgramsImport(instructionsDir);
    // The async builders auto-resolve PDA accounts via `await findFooPda(seeds)`
    // — but they DON'T forward the `programAddress` override Codama already
    // computed for the surrounding instruction. That means PDAs are derived
    // against the IDL-baked placeholder (`ARioAntProgXXXX…`) instead of the
    // program ID we actually deploy with, which silently produces a wrong
    // address and surfaces as `AccountNotInitialized` at simulation time.
    // Patch every such call to thread `programAddress` through.
    forwardProgramAddressToPdaHelpers(instructionsDir);
  }

  // Codama emits relative imports without `.js` extensions
  // (e.g. `export * from './balance';`), which TypeScript's `nodenext`
  // resolver and Node ESM's runtime resolver both reject. The SDK ships
  // as `"type": "module"` with `moduleResolution: "nodenext"` and the
  // rest of our source uses `.js` throughout, so we have to bring the
  // generated tree in line.
  //
  // Upstream is aware but the fix is stalled:
  //   - Request: https://github.com/codama-idl/renderers-js/issues/127
  //   - Attempted fix: https://github.com/codama-idl/renderers-js/pull/138
  //     (closed 2026-04-13: maintainer wants this behind an opt-in
  //     option rather than always-on, no follow-up PR yet).
  //
  // Until an opt-in flag lands upstream, we post-process the emitted
  // tree ourselves. The rewrite is idempotent and filesystem-aware
  // (file vs. directory imports), so re-running `yarn codegen` is safe.
  addJsExtensions(outPath);

  console.log(`[codama] ${idl} ✓`);
}

// =========================================================================
// Event decoders — NOT emitted by Codama (renderers-js 2.x has no events
// pass), so we run a sibling generator that walks each IDL's `events[]`
// + `types[]` and writes per-event encode/decode/codec helpers under
// `generated/<program>/events/`. Output style mirrors the
// accounts/instructions/types files Codama produces above.
// =========================================================================
import { execFileSync } from 'node:child_process';
const eventsScript = resolve(HERE, 'events-codegen.mjs');
if (existsSync(eventsScript)) {
  execFileSync(process.execPath, [eventsScript], { stdio: 'inherit' });
}

/**
 * Recursively rewrites every relative `from '...'` / `from "..."` in `.ts`
 * files under `dir` so the import is resolvable under TypeScript `nodenext`
 * and Node ESM at runtime. External package imports (`@solana/kit`, etc.)
 * are left alone.
 *
 * Resolution rules per match (mirrors Node ESM + tsc nodenext):
 *   - `./foo`      → `./foo.js`            (when `./foo.ts` exists)
 *   - `./foo`      → `./foo/index.js`      (when `./foo/index.ts` exists)
 *   - `./foo.ext`  → unchanged             (already has an extension)
 */
/**
 * Recursively rewrite every `from '../programs'` (and `from '../programs/...'`)
 * to point at the slim `program-address.ts` shim we synthesise in place of
 * the dropped `programs/` folder. Idempotent — running on already-rewritten
 * files is a no-op.
 */
function rewriteProgramsImport(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteProgramsImport(full);
    } else if (entry.name.endsWith('.ts')) {
      const src = readFileSync(full, 'utf-8');
      const fixed = src.replace(
        /from\s+(['"])\.\.\/programs(?:\/[^'"]*)?\1/g,
        `from $1../program-address.js$1`,
      );
      if (fixed !== src) writeFileSync(full, fixed);
    }
  }
}

/**
 * In Codama's generated async instruction builders, every PDA-resolve call
 * looks like `await findFooPda({ seedA, seedB })` (no second arg). We rewrite
 * each occurrence to `await findFooPda({ seedA, seedB }, { programAddress })`
 * so the PDA derives against the same program ID the instruction will be
 * sent to (rather than against Codama's hardcoded IDL placeholder).
 *
 * The regex is anchored on `await find<Name>Pda(<balanced-paren-block>)` so it
 * correctly skips already-patched calls (`find...Pda(…, …)`).
 */
function forwardProgramAddressToPdaHelpers(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      forwardProgramAddressToPdaHelpers(full);
    } else if (entry.name.endsWith('.ts')) {
      const src = readFileSync(full, 'utf-8');
      // Match `await findFooPda({ ... })` where the braces are balanced one
      // level deep. We do the bracket-matching manually since regex can't
      // count, but seed objects in Codama's output never contain nested `{}`.
      let out = '';
      let i = 0;
      let changed = false;
      while (i < src.length) {
        const m = /await\s+find\w+Pda\(\s*\{/g;
        m.lastIndex = i;
        const hit = m.exec(src);
        if (!hit) {
          out += src.slice(i);
          break;
        }
        out += src.slice(i, hit.index);
        // Walk forward to find the matching `}` for the seed object, then `)`.
        let depth = 1;
        let j = m.lastIndex; // points just after the opening `{`
        while (j < src.length && depth > 0) {
          const ch = src[j];
          if (ch === '{') depth += 1;
          else if (ch === '}') depth -= 1;
          j += 1;
        }
        // src[j-1] === '}'; expect optional whitespace then ')'.
        let k = j;
        while (k < src.length && /\s/.test(src[k])) k += 1;
        if (src[k] === ')') {
          // Already has a second argument? Skip.
          if (src.slice(j, k).includes(',')) {
            out += src.slice(hit.index, k + 1);
          } else {
            out +=
              src.slice(hit.index, j) +
              ', { programAddress }' +
              src.slice(j, k + 1);
            changed = true;
          }
          i = k + 1;
        } else if (src[k] === ',') {
          // Already has a second arg — leave as-is.
          out += src.slice(hit.index, k);
          i = k;
        } else {
          // Bail on this occurrence.
          out += src.slice(hit.index, j);
          i = j;
        }
      }
      if (changed) writeFileSync(full, out);
    }
  }
}

function addJsExtensions(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      addJsExtensions(full);
    } else if (entry.name.endsWith('.ts')) {
      const fileDir = dirname(full);
      const src = readFileSync(full, 'utf-8');
      let fixed = src;
      // Codama occasionally emits bare-directory imports like `from '.'`
      // (most commonly from sibling type modules cross-referencing the
      // types/ barrel). Node ESM + `nodenext` reject this; rewrite to
      // `from './index.js'` so resolution succeeds.
      fixed = fixed.replace(
        /(from\s+['"])(\.\.?)(['"])/g,
        (_m, prefix, spec, suffix) => `${prefix}${spec}/index.js${suffix}`,
      );
      fixed = fixed.replace(
        /(from\s+['"])(\.\.?\/[^'"]+?)(?<!\.(?:js|json|ts|tsx|jsx|mjs|cjs))(['"])/g,
        (_match, prefix, spec, suffix) => {
          const resolved = resolve(fileDir, spec);
          if (existsSync(`${resolved}.ts`)) {
            return `${prefix}${spec}.js${suffix}`;
          }
          if (
            existsSync(resolved) &&
            statSync(resolved).isDirectory() &&
            existsSync(resolve(resolved, 'index.ts'))
          ) {
            return `${prefix}${spec}/index.js${suffix}`;
          }
          // Unresolved — leave the import as-is so TypeScript can surface
          // a real "cannot find module" error instead of producing a
          // bogus `.js` path that silently fails at runtime.
          return `${prefix}${spec}${suffix}`;
        },
      );
      if (fixed !== src) writeFileSync(full, fixed);
    }
  }
}

/**
 * Surgically patch known issues in the upstream Metaplex Core IDL so it
 * lowers cleanly to a Codama IDL.
 *
 * We don't fork or mirror the IDL — we only normalize a small number of
 * upstream defects in-memory at codegen time. Each branch documents what
 * was broken and why we strip/rewrite it.
 *
 * Update the version pin in `sdk/idls/README.md` and re-test these patches
 * whenever you refresh `sdk/idls/mpl_core.json` from upstream.
 */
function patchMplCoreIdl(idl) {
  // 1. `CreateGroupV1Args.relationships` references a non-existent type
  //    `crate` (Shank macro emitted Rust's literal `crate::` prefix instead
  //    of the qualified type name). Drop the Group instruction family
  //    entirely — we don't use Groups in the AR.IO ANT integration, and
  //    keeping them around forces us to either fix the broken type
  //    reference upstream-style or carry a stub in the generated tree.
  const droppedInstructions = new Set([
    'CreateGroupV1',
    'CloseGroupV1',
    'UpdateGroupV1',
    'AddAssetsToGroupV1',
    'RemoveAssetsFromGroupV1',
    'AddCollectionsToGroupV1',
    'RemoveCollectionsFromGroupV1',
    'AddGroupsToGroupV1',
    'RemoveGroupsFromGroupV1',
  ]);
  const droppedTypes = new Set([
    'CreateGroupV1Args',
    'GroupV1',
    'RelationshipEntry',
    'RelationshipType',
  ]);
  const droppedAccounts = new Set(['GroupV1']);
  if (Array.isArray(idl.instructions)) {
    idl.instructions = idl.instructions.filter(
      (i) => !droppedInstructions.has(i.name),
    );
  }
  if (Array.isArray(idl.types)) {
    idl.types = idl.types.filter((t) => !droppedTypes.has(t.name));
  }
  if (Array.isArray(idl.accounts)) {
    idl.accounts = idl.accounts.filter((a) => !droppedAccounts.has(a.name));
  }
}
