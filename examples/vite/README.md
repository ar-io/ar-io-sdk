# Typescript React Example - Vite

This example shows how to use the `@ar.io/sdk` within a Typescript/React project using [Vite].

<!-- toc -->

- [Getting Started](#getting-started)
- [Polyfills](#polyfills)

<!-- tocstop -->

## Getting Started

1. Install the dependencies:

```bash
yarn
```

2. Start the development server:

```bash
yarn start
```

3. Open your browser and navigate to `http://localhost:3000`. You should see:

![screenshot](./public/image.png)

## Polyfills

The `@ar.io/sdk` uses some modern browser features that may not be available in all browsers. To ensure compatibility, you may need to include some polyfills. This example uses the [vite-plugin-node-polyfills] plugin to include the necessary polyfills.

The [tsconfig.json](./tsconfig.json) includes the following compiler options:

```json
{
  "compilerOptions": {
    "moduleResolution": "Bundler", // or nodenext are reccomended to use named exports (e.g. @ar.io/sdk/web)
    "lib": ["es2015", "dom"]
  }
}
```

The [vite.config.js](./vite.config.js) file includes the following polyfills required for the `@ar.io/sdk`:

```javascript
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  build: {},
  base: '/',
  plugins: [react(), nodePolyfills()],
});
```

If you are using a bundler other than Vite, you may need to include the necessary polyfills in a similar way.

[vite-plugin-node-polyfills]: https://www.npmjs.com/package/vite-plugin-node-polyfills
