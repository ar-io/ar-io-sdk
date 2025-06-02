import AoLoader from '@permaweb/ao-loader';
import fs from 'node:fs';
import path from 'node:path';

import { AOProcess, AOS_MODULE_ID, AoClient } from '../../src/node/index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
export const TEST_AOS_ANT_WASM = fs.readFileSync(
  path.join(__dirname, 'fixtures', `aos-ant-${AOS_MODULE_ID}.wasm`),
);

export const STUB_PROCESS_ID = 'process-id-'.padEnd(43, '1');
export const STUB_AR_ADDRESS = 'arweave-address-'.padEnd(43, '1');
export const STUB_ETH_ADDRESS = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c';
export const STUB_ANT_REGISTRY_ID = 'ant-registry-'.padEnd(43, '1');

export const AO_LOADER_HANDLER_ENV = {
  Process: {
    Id: STUB_AR_ADDRESS,
    Owner: STUB_AR_ADDRESS,
    Tags: [
      { name: 'Authority', value: 'XXXXXX' },
      { name: 'ANT-Registry-Id', value: STUB_ANT_REGISTRY_ID },
    ],
  },
  Module: {
    Id: ''.padEnd(43, '1'),
    Tags: [{ name: 'Authority', value: 'YYYYYY' }],
  },
};

export const AO_LOADER_OPTIONS = {
  format: 'wasm32-unknown-emscripten-metering',
  inputEncoding: 'JSON-1',
  outputEncoding: 'JSON-1',
  memoryLimit: '1073741824', // 1 GiB in bytes
  computeLimit: (9e12).toString(),
  extensions: [],
};

export const DEFAULT_HANDLE_OPTIONS = {
  Id: ''.padEnd(43, '1'),
  ['Block-Height']: '1',
  // important to set the address so that that `Authority` check passes. Else the `isTrusted` with throw an error.
  Owner: STUB_AR_ADDRESS,
  Tags: [],
  Module: 'ANT',
  Target: STUB_AR_ADDRESS,
  From: STUB_AR_ADDRESS,
  Timestamp: Date.now(),
  // for msg.reply
  Reference: '1',
  Data: '1234',
};

export type HandleFunction = Awaited<ReturnType<typeof AoLoader>>;

/**
 * @description Drop in replacement class representing the return type of the `connect` function from `@permaweb/aoconnect` (@type{AoClient})
 * 
 * This can be initialized and passed to AOProcess.ao
 * 
 * It satisfies our current use of AoClient.dryrun, AoClient.message, and AoClient.result by maintaining a `handle` function
 * created with AoLoader, a `resultsCache`, and a txid-like `nonce`.
 * 
 * @example
 * 
 * ```ts
 *  new AOProcess({
      processId: 'ant-'.padEnd(43, '1'),
      ao: (await LocalAO.init({
        wasmModule: TEST_AOS_ANT_WASM,
        aoLoaderOptions: AO_LOADER_OPTIONS,
        handlerEnv: AO_LOADER_HANDLER_ENV,
      })) as any,
    });
 * ```
 */
export class LocalAO implements Partial<AoClient> {
  wasmModule: any;
  handle: HandleFunction;
  memory: ArrayBufferLike | null;

  handlerEnv: typeof AO_LOADER_HANDLER_ENV;

  nonce: string;
  resultsCache: Map<string, Awaited<ReturnType<AoClient['result']>>> =
    new Map();
  constructor({
    wasmModule,
    handle,
    handlerEnv,
    memory = null,
    nonce = '0'.padStart(43, '0'),
  }: {
    wasmModule: any;
    handle: HandleFunction;
    handlerEnv: typeof AO_LOADER_HANDLER_ENV;
    memory: ArrayBufferLike | null;
    nonce?: string;
  }) {
    this.wasmModule = wasmModule;
    this.memory = memory;
    this.handle = handle;
    this.nonce = nonce;
    this.handlerEnv = handlerEnv;
  }

  static async init({
    wasmModule,
    aoLoaderOptions,
    handlerEnv = AO_LOADER_HANDLER_ENV,
    memory = null,
  }: {
    wasmModule: any;
    aoLoaderOptions: typeof AO_LOADER_OPTIONS;
    handlerEnv?: typeof AO_LOADER_HANDLER_ENV;
    memory?: ArrayBufferLike | null;
  }): Promise<LocalAO> {
    const handle = await AoLoader(wasmModule, aoLoaderOptions);

    return new LocalAO({
      wasmModule,
      handlerEnv,
      memory,
      handle,
    });
  }

  async dryrun(
    params: Parameters<AoClient['dryrun']>[0],
    handlerEnvOverrides?: typeof AO_LOADER_HANDLER_ENV,
  ): Promise<ReturnType<AoClient['dryrun']>> {
    const res = await this.handle(
      this.memory,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        Id: this.nonce,
        Data: (params as any).data || DEFAULT_HANDLE_OPTIONS.Data,
        Tags: (params as any).tags || DEFAULT_HANDLE_OPTIONS.Tags,
        ...(params as any),
      },
      {
        ...AO_LOADER_HANDLER_ENV,
        ...(handlerEnvOverrides ?? {}),
      },
    );
    if (!res) throw new Error('oops');

    delete res.Memory;

    return res;
  }

  async message(
    params: Parameters<AoClient['message']>[0],
    handlerEnvOverrides?: typeof AO_LOADER_HANDLER_ENV,
  ): Promise<string> {
    const newNonce = (parseInt(this.nonce) + 1).toString().padStart(43, '0');

    const res = await this.handle(
      this.memory,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        Id: newNonce,
        Data: (params as any).data || DEFAULT_HANDLE_OPTIONS.Data,
        Tags: (params as any).tags || DEFAULT_HANDLE_OPTIONS.Tags,
      },
      {
        ...AO_LOADER_HANDLER_ENV,
        ...(handlerEnvOverrides ?? {}),
      },
    ).catch((e) => console.error(e));
    if (!res) throw new Error('Error from handle: ' + res);
    const { Memory, ...rest } = res;
    this.memory = Memory;
    this.nonce = newNonce;
    this.resultsCache.set(this.nonce, rest);
    return this.nonce;
  }

  async result(
    params: Parameters<AoClient['result']>[0],
  ): Promise<ReturnType<AoClient['result']>> {
    const res = this.resultsCache.get((params as any).message);
    if (!res) throw new Error('Message does exist');
    return res;
  }

  // TODO: implement rest of AoClient tooling
}

export async function createLocalProcess({
  processId = 'process-'.padEnd(43, '0'),
  wasmModule = TEST_AOS_ANT_WASM,
  aoLoaderOptions = AO_LOADER_OPTIONS,
  handlerEnv = AO_LOADER_HANDLER_ENV,
} = {}) {
  return new AOProcess({
    processId,
    ao: (await LocalAO.init({
      wasmModule,
      aoLoaderOptions,
      handlerEnv,
    })) as any,
  });
}
