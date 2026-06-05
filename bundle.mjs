import fs from 'fs';
import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const bundle = async () => {
  console.log('Building minified web bundle file.');
  return build({
    entryPoints: ['./src/solana/index.ts'],
    bundle: true,
    minify: true,
    platform: 'browser',
    target: ['esnext'],
    format: 'esm',
    globalName: 'ar.io',
    plugins: [
      /**
       * Polyfill the Node primitives Solana code touches (currently
       * `crypto.createHash` from src/solana/ant-readable.ts). `process` /
       * `buffer` keep transitive deps happy in the browser.
       */
      polyfillNode({
        polyfills: {
          crypto: true,
          process: true,
          buffer: true,
        },
      }),
    ],
    external: ['commander', 'prompts'],
    tsconfig: './tsconfig.json',
    outfile: './bundles/web.bundle.min.js',
    metafile: true,
  }).catch((e) => {
    console.log(e);
    process.exit(1);
  });
};

const result = await bundle();

if (result.metafile) {
  fs.writeFileSync('./metafile.json', JSON.stringify(result.metafile, null, 2));
}
