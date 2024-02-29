# @ar-io/sdk

This is the home of ar.io SDK. This SDK provides functionality for interacting with the ar.io ecosystem of services (e.g. gateways and observers) and protocols (e.g. ArNS). It is available for both NodeJS and Web environments.

## Table of Contents

// ALM - Consider hoisting requirements before installation, e.g. Prerequisites header

- [Prerequisites](#prerequisites)
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

## Prerequisites

- Node XYZ or above
- npm or yarn package managers

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

const arIO = new ArIO();
const gateways = arIO.testnet.getGateways();

// PRINT/ EXPLAIN WHATEVER THIS GIVES YOU
```

## Usage

The SDK is provided in both CommonJS and ESM formats and is compatible with bundlers such as Webpack, Rollup, and ESbuild. Utilize the appropriately named exports provided by this SDK's [package.json] based on your project's configuration. Refer to the [examples] directory to see how to use the SDK in various environments.

### Web

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { ArIO } from '@ar-io/sdk';

const arIO = new ArIO();
// ALM - I DON'T LIKE THIS PATTERN OF SPECIFYING THE ENVIRONMENT ON EACH API CALL.
// IT WILL BE REDUNDANT CODE IN 99% OF PLACES. FAVOR INSTEAD INSTANTIATING ArIO
// WITH THE APPROPRIATE ENVIRONMENT CONFIGURATION
const gateways = arIO.mainnet.getGateways();
```

#### Browser

```html
<script type="module">
  import { ArIO } from 'https://unpkg.com/@ar-io/sdk';

  // set up our client
  const arIO = new ArIO();
  // fetch mainnet gateways
  const gateways = await arIO.mainnet.getGateways();
</script>
```

### Node

```javascript
const { ArIO } = require('@ar-io/sdk');

const arIO = new ArIO();
const gateways = await arIO.mainnet.getGateways();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project:

// ALM - "and should be automatically recognized," ... by?
Types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

## APIs

// I'd like to see an instantiation example here with explanations about:

- warp configuration
- using API vs. using warp directly
- caching configuration options and tradeoffs

// I'd like to see an example of the returned objects in each example below, either a printout of their console log representation or an interface definition.

// ALM - I don't like this pattern. I'm ok with us providing constants for known/trusted contracts. Also worth disambiguating the environenments - i.e. their purposes.
The contract that the following methods retrieve data from are determined by the `testnet` or `devnet` clients - see examples above for implementation details.

#### `getBalance({ address })`

Retrieves the balance of the specified address.

```typescript
// ALM - REPEATING THE new ArIO() pattern in each example might be misconstrued by less
// sophisticated devs as necessary or beneficial. Better to have the instantiation example
// explain the benefits of preserving a reference (e.g. caching and memory management) and
// then use the instantiated reference in each of the subsequent examples.
const balance = new ArIO().testnet.getBalance({
  address: 'INSERT_WALLET_ADDRESS',
});
```

#### `getBalances()`

Retrieves the balances of the ArIO contract.

```typescript
// ALM - A part of me wonders whether streaming JSON might be beneficial in the future
// and if providing streaming versions of these APIs will scale nicely longer term, e.g.
// arIO.streamBalances({ sortingCriteria: BALANCE_DESC });
const balances = new ArIO().testnet.getBalances();
```

#### `getGateway({ address })`

Retrieves the gateway info of the specified address.

```typescript
const gateway = new ArIO().testnet.getGateway({
  address: 'INSERT_GATEWAY_ADDRESS',
});
```

#### `getGateways()`

Retrieves the registered gateways of the ArIO contract.

```typescript
const gateways = new ArIO().testnet.getGateways();
```

#### `getArNSRecord({ domain })`

Retrieves the domain info of the specified ArNS record.

```typescript
const record = new ArIO().testnet.getArNSRecord({ domain: 'INSERT_ARNS_NAME' });
```

#### `getArNSRecords()`

Retrieves the registered ArNS domains of the ArIO contract.

```typescript
const records = new ArIO().testnet.getArNSRecords();
```

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
