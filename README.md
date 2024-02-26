# @ar-io/sdk

This is the home of ar.io SDK. This SDK provides functionality for interacting with the ArNS and ar.io ecosystem. It is available for both NodeJS and Web environments.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [NodeJS Environments](#node)
  - [Web Environments](#web)
  - [Typescript](#typescript)
- [APIs](#apis)
- [Examples](./examples)
- [Developers](#developers)
  - [Requirements](#requirements)
  - [Setup & Build](#setup--build)
  - [Testing](#testing)
  - [Linting and Formatting](#linting--formatting)
  - [Architecture](#architecture)
- [Contributing](./CONTRIBUTING.md)

## Installation

```shell
npm install @ar-io/sdk
```

or

```shell
yarn add @ar-io/sdk
```

## Quick Start

```typescript
import { ArIO } from '@ar-io/sdk';

const arIO = new ArIO({});
const address = 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ';
const domain = 'ardrive';
const contractTxIds = [
  'I-cxQhfh0Zb9UqQNizC9PiLC41KpUeA9hjiVV02rQRw',
  'DGWp8_6c1YywKgCgBFhncMglciQyCdfX1swil4qjNSc',
];

const balance = await arIO.mainnet.getBalance({ address });
const gateway = await arIO.mainnet.getGateway({ address });
const record = await arIO.mainnet.getRecord({ domain });
const records = await arIO.mainnet.getRecords({ contractTxIds });
const allRecords = await arIO.mainnet.getRecords({});
```

## Usage

The SDK is provided in both CommonJS and ESM formats, and it's compatible with bundlers such as Webpack, Rollup, and ESbuild. Utilize the appropriately named exports provided by this SDK's [package.json] based on your project's configuration. Refer to the [examples] directory to see how to use the SDK in various environments.

### Web

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { ArIO } from '@ar-io/sdk';

const arIO = new ArIO({});
const gateways = arIO.mainnet.getGateways();
```

#### Browser

```html
<script type="module">
  import { ArIO } from 'https://unpkg.com/@ar-io/sdk';

  // set up our client
  const arIO = new ArIO({});
  // fetch mainnet gateways
  const gateways = await arIO.mainnet.getGateways();
</script>
```

### Node

```javascript
const { ArIO } = require('@ar-io/sdk');

const arIO = new ArIO({});
const gateways = await arIO.mainnet.getGateways();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project:

Types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

## APIs

The contract that the following methods retrieve data from are determined by the `testnet` or `devnet` clients - see examples above for implementation details.

| Method Name               | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `getBalance({ address })` | Retrieves the balance of the specified address.       |
| `getBalances()`           | Retrieves all balances on the ArIO contract.          |
| `getGateway({ address })` | Retrieves the specified gateway by address.           |
| `getGateways()`           | Retrieves all gateways.                               |
| `getRecord({ domain })`   | Retrieves a specified ArNS record by the domain name. |
| `getRecords()`            | Retrieves all records                                 |

## Developers

### Requirements

- `nvm`
- `node` (>= 18)
- `yarn`

### Setup & Build

- `yarn install` - installs dependencies
- `yarn build` - builds web/node/bundled outputs

### Testing

- `yarn test` - runs integration tests
- `yarn example:web` - opens up the example web page
- `yarn example:cjs` - runs example CJS node script
- `yarn example:esm` - runs example ESM node script

### Linting & Formatting

- `yarn lint:check` - checks for linting errors
- `yarn lint:fix` - fixes linting errors
- `yarn format:check` - checks for formatting errors
- `yarn format:fix` - fixes formatting errors

### Architecture

- Code to interfaces.
- Prefer type safety over runtime safety.
- Prefer composition over inheritance.
- Prefer integration tests over unit tests.

For more information on how to contribute, please see [CONTRIBUTING.md].

<!-- ADD ALL LINK REFERENCES BELOW -->
