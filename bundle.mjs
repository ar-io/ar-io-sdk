import fs from "fs";
import { build } from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

const bundle = async () => {
  console.log("Building minified web bundle file.");
  return build({
    entryPoints: ["./src/web/index.ts"],
    bundle: true,
    minify: true,
    platform: "browser",
    target: ["esnext"],
    format: "esm",
    globalName: "ar.io",
    plugins: [
      /**
       * We need to polyfill the node modules that are used in the web bundle.
       *
       * Related: https://github.com/permaweb/ao/blob/9110d6af3be8540054c2e9ba2639fd1429033c9d/connect/esbuild.js#L43-L70
       */
      polyfillNode({
        polyfills: {
          crypto: true,
          process: true,
          fs: true,
          buffer: true,
        },
      }),
    ],
    external: ["commander", "prompts", "winston"],
    tsconfig: "./tsconfig.web.json",
    outfile: "./bundles/web.bundle.min.js",
    metafile: true,
  }).catch((e) => {
    console.log(e);
    process.exit(1);
  });
};

const result = await bundle();

if (result.metafile) {
  fs.writeFileSync("./metafile.json", JSON.stringify(result.metafile, null, 2));
}
