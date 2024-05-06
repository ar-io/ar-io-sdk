import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const bundle = async () => {
  console.log('Building minified web bundle file.');
  await build({
    entryPoints: ['./src/web/index.ts'],
    bundle: true,
    platform: 'browser',
    target: ['esnext'],
    format: 'esm',
    globalName: 'ar.io',
    plugins: [
      polyfillNode({
        polyfills: {
          crypto: true,
          process: true,
          fs: true,
        },
      }),
    ],
    tsconfig: './tsconfig.web.json',
    outfile: './bundles/web.bundle.min.js',
    external: ['dtrace-provider'],
  })
    .catch((e) => {
      console.log(e);
      process.exit(1);
    })
    .then(() => {
      console.log('Successfully built web bundle.');
    });
};

bundle();
