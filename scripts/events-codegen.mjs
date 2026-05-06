#!/usr/bin/env node
/**
 * Event decoder codegen for the SDK.
 *
 * Codama (renderers-js 2.x) emits typed encoders/decoders for every
 * account, instruction, error, type, and PDA in an Anchor IDL — but it
 * does not yet emit decoders for the IDL's `events[]` array. This
 * script fills that gap.
 *
 * For each program's IDL we emit:
 *   sdk/src/solana/generated/<program>/events/<eventName>.ts
 *     - 8-byte discriminator const (matches sha256("event:<EventName>")[..8])
 *     - getEventNameDecoder() / getEventNameEncoder() / getEventNameCodec()
 *     - `EventName` (decoded shape) and `EventNameArgs` (encoder input shape)
 *   sdk/src/solana/generated/<program>/events/index.ts
 *     - barrel re-export
 *   sdk/src/solana/generated/<program>/index.ts
 *     - re-export of `events`, mirroring how `accounts`/`instructions` are exposed today
 *
 * Output style matches Codama's existing accounts/instructions generators
 * so the consumer-facing surface stays uniform across accounts /
 * instructions / events. Every codec uses primitives from `@solana/kit`.
 *
 * Run: `node sdk/scripts/events-codegen.mjs` (idempotent; safe to re-run)
 * Wired into `yarn codegen` via `sdk/scripts/codegen.mjs`.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IDL_DIR = resolve(HERE, '../idls');
const OUT_DIR = resolve(HERE, '../src/solana/generated');

// IDLs to process. Mirrors `scripts/codegen.mjs` but skips `mpl_core`
// (no events). All IDLs live in the top-level `idls/` directory of
// this repo; see `docs/IDL_REFRESH.md` for the bump runbook.
const PROGRAMS = [
  { idl: 'ario_core', dir: 'core' },
  { idl: 'ario_gar', dir: 'gar' },
  { idl: 'ario_arns', dir: 'arns' },
  { idl: 'ario_ant', dir: 'ant' },
  { idl: 'ario_ant_escrow', dir: 'ant-escrow' },
];

// Anchor 0.31 derives event discriminators as sha256("event:<EventName>")[..8].
// We compute and verify against the IDL's own `events[].discriminator` to catch
// drift (e.g., a renamed event whose IDL was mutated by hand).
function computeEventDiscriminator(eventName) {
  return createHash('sha256')
    .update(`event:${eventName}`)
    .digest()
    .subarray(0, 8);
}

// Map an IDL field type → ({ decoder, encoder, tsType, tsArgsType }).
// Codecs come straight from @solana/kit so there's nothing custom here;
// the only nuance is unwrapping array/option composite types recursively.
function mapType(ty) {
  // String scalar
  if (typeof ty === 'string') {
    switch (ty) {
      case 'bool':
        return {
          decoder: 'getBooleanDecoder()',
          encoder: 'getBooleanEncoder()',
          tsType: 'boolean',
          tsArgsType: 'boolean',
        };
      case 'i64':
        return {
          decoder: 'getI64Decoder()',
          encoder: 'getI64Encoder()',
          tsType: 'bigint',
          tsArgsType: 'number | bigint',
        };
      case 'pubkey':
        return {
          decoder: 'getAddressDecoder()',
          encoder: 'getAddressEncoder()',
          tsType: 'Address',
          tsArgsType: 'Address',
        };
      case 'string':
        // Borsh strings are length-prefixed (u32 little-endian length + UTF-8 bytes).
        // @solana/kit composes that as `addXxxSizePrefix(getUtf8Xxx(), getU32Xxx())`.
        return {
          decoder: 'addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())',
          encoder: 'addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())',
          tsType: 'string',
          tsArgsType: 'string',
        };
      case 'u8':
        return {
          decoder: 'getU8Decoder()',
          encoder: 'getU8Encoder()',
          tsType: 'number',
          tsArgsType: 'number',
        };
      case 'u16':
        return {
          decoder: 'getU16Decoder()',
          encoder: 'getU16Encoder()',
          tsType: 'number',
          tsArgsType: 'number',
        };
      case 'u32':
        return {
          decoder: 'getU32Decoder()',
          encoder: 'getU32Encoder()',
          tsType: 'number',
          tsArgsType: 'number',
        };
      case 'u64':
        return {
          decoder: 'getU64Decoder()',
          encoder: 'getU64Encoder()',
          tsType: 'bigint',
          tsArgsType: 'number | bigint',
        };
      default:
        throw new Error(`Unsupported event field scalar type: ${ty}`);
    }
  }
  if (typeof ty === 'object' && ty !== null) {
    // Fixed-size byte array: {array: [u8, N]}
    if (
      Array.isArray(ty.array) &&
      ty.array[0] === 'u8' &&
      typeof ty.array[1] === 'number'
    ) {
      const len = ty.array[1];
      return {
        decoder: `fixDecoderSize(getBytesDecoder(), ${len})`,
        encoder: `fixEncoderSize(getBytesEncoder(), ${len})`,
        tsType: 'ReadonlyUint8Array',
        tsArgsType: 'ReadonlyUint8Array',
      };
    }
    // Optional: {option: T}
    if (ty.option !== undefined) {
      const inner = mapType(ty.option);
      return {
        decoder: `getOptionDecoder(${inner.decoder})`,
        encoder: `getOptionEncoder(${inner.encoder})`,
        tsType: `Option<${inner.tsType}>`,
        tsArgsType: `OptionOrNullable<${inner.tsArgsType}>`,
      };
    }
  }
  throw new Error(`Unsupported event field type: ${JSON.stringify(ty)}`);
}

// Build the set of @solana/kit symbols we need to import for a given event.
// Mirrors the patterns Codama emits — only the codecs we actually use.
// `variableSize` flips between FixedSize* and bare Codec/Decoder/Encoder types
// (variable-sized events have String / Option fields that don't admit a known
// fixed length).
function collectImports(fields, variableSize) {
  const imports = new Set([
    'combineCodec',
    'getStructDecoder',
    'getStructEncoder',
    'fixDecoderSize',
    'fixEncoderSize',
    'getBytesDecoder',
    'getBytesEncoder',
    'transformEncoder',
    'type ReadonlyUint8Array',
  ]);
  if (variableSize) {
    imports.add('type Codec');
    imports.add('type Decoder');
    imports.add('type Encoder');
  } else {
    imports.add('type FixedSizeCodec');
    imports.add('type FixedSizeDecoder');
    imports.add('type FixedSizeEncoder');
  }
  // We need a decoder + encoder for every distinct field type.
  const walk = (ty) => {
    if (typeof ty === 'string') {
      switch (ty) {
        case 'bool':
          imports.add('getBooleanDecoder');
          imports.add('getBooleanEncoder');
          break;
        case 'i64':
          imports.add('getI64Decoder');
          imports.add('getI64Encoder');
          break;
        case 'pubkey':
          imports.add('getAddressDecoder');
          imports.add('getAddressEncoder');
          imports.add('type Address');
          break;
        case 'string':
          imports.add('addDecoderSizePrefix');
          imports.add('addEncoderSizePrefix');
          imports.add('getUtf8Decoder');
          imports.add('getUtf8Encoder');
          imports.add('getU32Decoder');
          imports.add('getU32Encoder');
          break;
        case 'u8':
          imports.add('getU8Decoder');
          imports.add('getU8Encoder');
          break;
        case 'u16':
          imports.add('getU16Decoder');
          imports.add('getU16Encoder');
          break;
        case 'u32':
          imports.add('getU32Decoder');
          imports.add('getU32Encoder');
          break;
        case 'u64':
          imports.add('getU64Decoder');
          imports.add('getU64Encoder');
          break;
      }
      return;
    }
    if (Array.isArray(ty?.array)) return; // covered by fixDecoderSize already in base set
    if (ty?.option !== undefined) {
      imports.add('getOptionDecoder');
      imports.add('getOptionEncoder');
      imports.add('type Option');
      imports.add('type OptionOrNullable');
      walk(ty.option);
    }
  };
  fields.forEach((f) => walk(f.type));

  // string with size: u32 ⇒ getStringDecoder isn't variable, the kit way is
  // `getUtf8Decoder({ size: getU32Decoder() })`. The borsh-equivalent
  // serialization (u32 length prefix + UTF-8 bytes) matches Anchor's emit
  // by construction — verified against `TransferEvent` round-trip.
  return Array.from(imports).sort();
}

// Some events declared whose `tsType` for a field needs to be variable-sized
// (string, Option<...>) — that breaks `FixedSizeCodec`. We detect this and
// fall back to plain `Codec`/`Decoder`/`Encoder` types. The IDL doesn't tell
// us upfront, so we walk the field types and check.
function isVariableSize(fields) {
  const walk = (ty) => {
    if (typeof ty === 'string') return ty === 'string';
    if (ty?.option !== undefined) return true; // option encoding is variable: 1 + (T?)
    if (Array.isArray(ty?.array)) return false;
    return false;
  };
  return fields.some((f) => walk(f.type));
}

function snakeToCamel(name) {
  return name.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const SCREAMING_SNAKE = (s) =>
  s
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toUpperCase();

function discrToTsArray(bytes) {
  return `new Uint8Array([${Array.from(bytes).join(', ')}])`;
}

function renderEvent(eventName, fields) {
  const variable = isVariableSize(fields);
  const decoderType = variable ? 'Decoder' : 'FixedSizeDecoder';
  const encoderType = variable ? 'Encoder' : 'FixedSizeEncoder';
  const codecType = variable ? 'Codec' : 'FixedSizeCodec';

  const discr = computeEventDiscriminator(eventName);
  const discrConst = SCREAMING_SNAKE(eventName) + '_DISCRIMINATOR';

  const fieldLines = fields.map((f) => {
    const t = mapType(f.type);
    const camel = snakeToCamel(f.name);
    return { name: camel, ...t };
  });

  // Decoder body (struct codec entries)
  const structDecoderEntries = [
    "['discriminator', fixDecoderSize(getBytesDecoder(), 8)]",
    ...fieldLines.map((f) => `['${f.name}', ${f.decoder}]`),
  ].join(', ');

  // Encoder body (struct codec entries)
  const structEncoderEntries = [
    "['discriminator', fixEncoderSize(getBytesEncoder(), 8)]",
    ...fieldLines.map((f) => `['${f.name}', ${f.encoder}]`),
  ].join(', ');

  // TypeScript types
  const decodedShape = [
    'discriminator: ReadonlyUint8Array;',
    ...fieldLines.map((f) => `${f.name}: ${f.tsType};`),
  ].join('\n  ');
  const argsShape = fieldLines
    .map((f) => `${f.name}: ${f.tsArgsType};`)
    .join('\n  ');

  const imports = collectImports(fields, variable);

  return `/**
 * This code was AUTOGENERATED by sdk/scripts/events-codegen.mjs.
 * Please DO NOT EDIT THIS FILE — re-run \`yarn codegen\` instead.
 *
 * Decoder for the Anchor \`#[event] ${eventName}\` emit. The
 * 8-byte discriminator is sha256("event:${eventName}")[..8].
 */

import { ${imports.join(', ')} } from '@solana/kit';

export const ${discrConst} = ${discrToTsArray(discr)};

export function get${eventName}DiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(${discrConst});
}

export type ${eventName} = {
  ${decodedShape}
};

export type ${eventName}Args = {
  ${argsShape}
};

export function get${eventName}Encoder(): ${encoderType}<${eventName}Args> {
  return transformEncoder(
    getStructEncoder([${structEncoderEntries}]),
    (value) => ({ ...value, discriminator: ${discrConst} }),
  );
}

export function get${eventName}Decoder(): ${decoderType}<${eventName}> {
  return getStructDecoder([${structDecoderEntries}]);
}

export function get${eventName}Codec(): ${codecType}<${eventName}Args, ${eventName}> {
  return combineCodec(get${eventName}Encoder(), get${eventName}Decoder());
}
`;
}

function renderBarrel(eventNames) {
  return (
    '/* AUTOGENERATED by sdk/scripts/events-codegen.mjs. */\n\n' +
    eventNames
      .sort()
      .map((n) => `export * from './${lowerFirst(n)}.js';`)
      .join('\n') +
    '\n'
  );
}

// Source-tree drift check is intentionally absent here: this repo
// receives IDLs as committed snapshots, not via local `anchor build`.
// The contracts source isn't available, so we trust the input IDL.
// The corresponding check lives in the contracts monorepo's codegen.

let totalEvents = 0;
const programReports = [];

for (const program of PROGRAMS) {
  const idlPath = resolve(IDL_DIR, `${program.idl}.json`);
  if (!existsSync(idlPath)) {
    console.error(`[events-codegen] ${program.idl}: IDL missing at ${idlPath}`);
    process.exit(2);
  }
  const idl = JSON.parse(readFileSync(idlPath, 'utf8'));
  const events = idl.events ?? [];

  if (events.length === 0) {
    console.log(`[events-codegen] ${program.idl}: no events, skipping`);
    continue;
  }

  // Per-program output directory. Recreate cleanly so a removed event
  // doesn't leave a stale .ts file behind.
  const outDir = resolve(OUT_DIR, program.dir, 'events');
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const eventNames = [];
  for (const ev of events) {
    const typeDef = idl.types?.find((t) => t.name === ev.name);
    if (!typeDef) {
      throw new Error(
        `[events-codegen] ${program.idl}: missing type def for event ${ev.name}`,
      );
    }
    const fields = typeDef.type?.fields ?? [];
    // Sanity: discriminator on the IDL must match what we'd derive from name.
    const computed = computeEventDiscriminator(ev.name);
    const idlDiscr = Buffer.from(ev.discriminator);
    if (Buffer.compare(computed, idlDiscr) !== 0) {
      throw new Error(
        `[events-codegen] ${program.idl}.${ev.name}: IDL discriminator [${idlDiscr.join(',')}] doesn't match sha256-derived [${computed.join(',')}]. Did the event get renamed without an IDL refresh?`,
      );
    }
    const out = renderEvent(ev.name, fields);
    writeFileSync(resolve(outDir, `${lowerFirst(ev.name)}.ts`), out);
    eventNames.push(ev.name);
    totalEvents++;
  }

  writeFileSync(resolve(outDir, 'index.ts'), renderBarrel(eventNames));

  // Patch the program's top-level index.ts to re-export `events/` (idempotent).
  const programIndex = resolve(OUT_DIR, program.dir, 'index.ts');
  if (existsSync(programIndex)) {
    const current = readFileSync(programIndex, 'utf8');
    const exportLine = "export * from './events/index.js';";
    if (!current.includes(exportLine)) {
      writeFileSync(programIndex, current.trimEnd() + '\n' + exportLine + '\n');
    }
  }

  programReports.push({ program: program.idl, count: eventNames.length });
}

console.log('[events-codegen] OK');
for (const r of programReports) {
  console.log(`  ${r.program}: ${r.count} events`);
}
console.log(`[events-codegen] total: ${totalEvents} event decoders generated`);
