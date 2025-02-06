import { AOS_MODULE_ID, AoClient } from '@ar.io/sdk';
import AoLoader from '@permaweb/ao-loader';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
export const TEST_AOS_ANT_WASM = fs.readFileSync(
  path.join(__dirname, 'fixtures', `aos-ant-${AOS_MODULE_ID}.wasm`),
);

export const STUB_PROCESS_ID = 'process-id-'.padEnd(43, '1');
export const STUB_ADDRESS = 'arweave-address-'.padEnd(43, '1');
export const STUB_ETH_ADDRESS = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c';
export const STUB_ANT_REGISTRY_ID = 'ant-registry-'.padEnd(43, '1');

export const AO_LOADER_HANDLER_ENV = {
  Process: {
    Id: STUB_ADDRESS,
    Owner: STUB_ADDRESS,
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

export type HandleFunction = Awaited<ReturnType<typeof AoLoader>>;

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
  ): ReturnType<AoClient['dryrun']> {
    const res = await this.handle(
      this.memory,
      {
        Id: this.nonce,
        ...params,
      },
      {
        ...this.handlerEnv,
        ...(handlerEnvOverrides ?? {}),
      },
    );
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
        Id: newNonce,
        Data: params.data,
        Tags: params.tags,
      },
      {
        ...this.handlerEnv,
        ...(handlerEnvOverrides ?? {}),
      },
    );
    const { Memory, ...rest } = res;
    this.memory = Memory;
    this.nonce = newNonce;
    this.resultsCache.set(this.nonce, rest);
    return this.nonce;
  }

  async result(
    params: Parameters<AoClient['result']>[0],
  ): ReturnType<AoClient['result']> {
    const res = this.resultsCache.get(params.message);
    if (!res) throw new Error('Message does exist');
    return res;
  }

  // TODO: implement rest of AoClient tooling
}
