# @ar.io/sdk

[![codecov](https://codecov.io/gh/ar-io/ar-io-sdk/graph/badge.svg?token=7dXKcT7dJy)](https://codecov.io/gh/ar-io/ar-io-sdk)

This is the home of [ar.io] SDK. This SDK provides functionality for interacting with the ar.io ecosystem of services (e.g. gateways and observers) and protocols (e.g. ArNS and AO). It is available for both NodeJS and Web environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Web](#web)
  - [Node](#node)
  - [Typescript](#typescript)
- [IOToken & mIOToken](#iotoken--miotoken)
  - [Converting IO to mIO](#converting-io-to-mio)
- [ArIO Process](#ario-process)

  - [APIs](#apis)
    - [`init({ signer })`](#init-signer-)
    - [`getState({ evaluationOptions })`](#getstate-evaluationoptions-)
    - [`getBalance({ address, evaluationOptions })`](#getbalance-address-evaluationoptions-)
    - [`getBalances({ evaluationOptions })`](#getbalances-evaluationoptions-)
    - [`getGateway({ address, evaluationOptions })`](#getgateway-address-evaluationoptions-)
    - [`getGateways({ evaluationOptions })`](#getgateways-evaluationoptions-)
    - [`getArNSRecord({ domain, evaluationOptions })`](#getarnsrecord-domain-evaluationoptions-)
    - [`getArNSRecords({ evaluationOptions })`](#getarnsrecords-evaluationoptions-)
    - [`getObservations({ evaluationOptions })`](#getobservations-evaluationoptions-)
    - [`getDistributions({ evaluationOptions })`](#getdistributions-evaluationoptions-)
    - [`getEpoch({ evaluationOptions })`](#getepoch-evaluationoptions-)
    - [`getCurrentEpoch({ evaluationOptions })`](#getcurrentepoch-evaluationoptions-)
    - [`getPrescribedObservers({ evaluationOptions })`](#getprescribedobservers-evaluationoptions-)
    - [`joinNetwork(params)`](#joinnetworkparams)
    - [`updateGatewaySettings(gatewaySettings)`](#updategatewaysettingsgatewaysettings)
    - [`increaseDelegateStake({ target, qty })`](#increasedelegatestake-target-qty-)
    - [`decreaseDelegateStake({ target, qty })`](#decreasedelegatestake-target-qty-)
    - [`increaseOperatorStake({ qty })`](#increaseoperatorstake-qty-)
    - [`decreaseOperatorStake({ qty })`](#decreaseoperatorstake-qty-)
    - [`saveObservations({ reportTxId, failedGateways })`](#saveobservations-reporttxid-failedgateways-)
    - [`transfer({ target, qty, denomination })`](#transfer-target-qty-denomination-)
  - [Custom Processes](#custom-processes)

- [Arweave Name Tokens (ANT's)](#arweave-name-tokens-ants)
  - [APIs](#apis-1)
    - [`init({ signer })`](#init-signer-)
    - [`getState({ evaluationOptions })`](#getstate-evaluationoptions-)
    - [`getOwner({ evaluationOptions })`](#getowner-evaluationoptions-)
    - [`getControllers({ evaluationOptions })`](#getcontrollers-evaluationoptions-)
    - [`getRecords({ evaluationOptions })`](#getrecords-evaluationoptions-)
    - [`transfer({ target })`](#transfer-target-)
    - [`setController({ controller })`](#setcontroller-controller-)
    - [`removeController({ controller })`](#removecontroller-controller-)
    - [`setRecord({ subDomain, transactionId, ttlSeconds })`](#setrecord-subdomain-transactionid-ttlseconds-)
    - [`removeRecord({ subDomain })`](#removerecord-subdomain-)
    - [`setName({ name })`](#setname-name-)
    - [`setTicker({ ticker })`](#setticker-ticker-)
  - [Configuration](#configuration)
- [Developers](#developers)
  - [Requirements](#requirements)
  - [Setup \& Build](#setup--build)
  - [Testing](#testing)
  - [Linting \& Formatting](#linting--formatting)
  - [Architecture](#architecture)

## Prerequisites

- `node>=v18.0.0`
- `npm` or `yarn`

## Installation

```shell
npm install @ar.io/sdk
```

or

```shell
yarn add @ar.io/sdk
```

## Quick Start

```typescript
import { IO } from '@ar.io/sdk';

const arIO = IO.init();
const gateways = await arIO.getGateways();
```

<details>
  <summary>Output</summary>

```json
{
  "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ": {
    "end": 0,
    "observerWallet": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
    "operatorStake": 250000000000, // value in mIO
    "settings": {
      "fqdn": "ar-io.dev",
      "label": "AR.IO Test",
      "note": "Test Gateway operated by PDS for the AR.IO ecosystem.",
      "port": 443,
      "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
      "protocol": "https"
    },
    "start": 1256694,
    "stats": {
      "failedConsecutiveEpochs": 0,
      "passedEpochCount": 30,
      "submittedEpochCount": 30,
      "totalEpochParticipationCount": 31,
      "totalEpochsPrescribedCount": 31
    },
    "status": "joined",
    "vaults": {},
    "weights": {
      "stakeWeight": 25,
      "tenureWeight": 0.9031327160493827,
      "gatewayRewardRatioWeight": 0.96875,
      "observerRewardRatioWeight": 0.96875,
      "compositeWeight": 21.189222170982834,
      "normalizedCompositeWeight": 0.27485583057217183
    }
  }
}
```

</details>

## Usage

The SDK is provided in both CommonJS and ESM formats and is compatible with bundlers such as Webpack, Rollup, and ESbuild. Utilize the appropriately named exports provided by this SDK's [package.json] based on your project's configuration. Refer to the [examples] directory to see how to use the SDK in various environments.

### Web

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { IO } from '@ar.io/sdk';

// set up client
const arIO = IO.init();
// fetch gateways
const gateways = await arIO.getGateways();
```

> _**Note**: polyfills are only provided when using the named `@ar.io/sdk/web` export (which requires `moduleResolution: nodenext` in `tsconfig.json`). If you are using the default export within a Typescript project (e.g. `moduleResolution: node`), you will need to provide your own polyfills - specifically `crypto`, `fs` and `buffer`. Refer to [examples/webpack] and [examples/vite] for references in how to properly provide those polyfills. For other project configurations, refer to your bundler's documentation for more information on how to provide the necessary polyfills._

#### Browser

```html
<script type="module">
  import { IO } from 'https://unpkg.com/@ar.io/sdk';

  // set up client
  const arIO = IO.init();
  // fetch gateways
  const gateways = await arIO.getGateways();
</script>
```

### Node

#### ESM (NodeNext)

```javascript
import { IO } from '@ar.io/sdk/node';

// set up client
const arIO = IO.init();
// fetch gateways
const gateways = await arIO.getGateways();
```

#### CJS

```javascript
import { IO } from '@ar.io/sdk';

// set up client
const arIO = IO.init();
// fetch gateways
const gateways = await arIO.getGateways();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized by package managers, offering benefits such as type-checking and autocompletion.

## IOToken & mIOToken

The ArIO process stores all values as mIO (milli-IO) to avoid floating-point arithmetic issues. The SDK provides an `IOToken` and `mIOToken` classes to handle the conversion between IO and mIO, along with rounding logic for precision.

**All process interactions expect values in mIO. If numbers are provided as inputs, they are assumed to be in raw mIO values.**

### Converting IO to mIO

```typescript
import { IOToken, mIOToken } from '@ar.io/sdk';

const ioValue = 1;
const mIOValue = new IOToken(ioValue).toMIO();
console.log(mIOValue); // 1000000 (mIO)

const mIOValue = 1_000_000;
const ioValue = new mIOToken(mIOValue).toIO();
console.log(ioValue); // 1 (IO)
```

## ArIO Process

### APIs

#### `init({ signer })`

Factory function to that creates a read-only or writeable client. By providing a `signer` additional write APIs that require signing, like `joinNetwork` and `delegateStake` are available. By default, a read-only client is returned and no write APIs are available.

```typescript
// read-only client that has access to all read APIs
const arIOReadable = IO.init()

const arweave = Arweave.init({
  host: 'ar-io.dev',
  port: 443,
  protocol: 'https'
})
// for browser environments
const browserSigner = new ArConnectSigner(window.arweaveWallet, arweave);
const arIOWriteable = IO.init({ signer: browserSigner});

// for node environments
const nodeSigner = new ArweaveSigner(JWK);
const arIOWriteable = IO.init({ signer: nodeSigner});

```

### Custom Processes

The ArIO client class exposes APIs relevant to the ar.io process. It can be configured to use any AO Process ID that adheres to the spec of the ar.io process. In the default case, it will automatically build and utilize a process data provider interface that is configured to point the the known ar.io mainnet process ID at construction time. You can provide custom process data provider or, alternatively, a `processId` to the ArIO constructor to use a different, ar.io-spec-compatible process.

```typescript
// provide a custom processId to the client and default to remote evaluation
const remoteCustomArIO = IO.init({
  processId: 'TESTNET_PROCESS_ID',
});
```

## Arweave Name Tokens (ANT's)

The ANT process client class exposes APIs relevant to compliant Arweave Name Token processes. It can be configured to use any process ID that adheres to the ANT process spec. You must provide either a custom process data provider or a processId to the ANT class constructor to use.

### APIs

#### `init({ signer })`

Factory function to that creates a read-only or writeable client. By providing a `signer` additional write APIs that require signing, like `setRecord` and `transfer` are available. By default, a read-only client is returned and no write APIs are available.

```typescript
const arweave = Arweave.init({
  host: 'ar-io.dev',
  port: 443,
  protocol: 'https'
})
// in a browser environment with ArConnect
const browserSigner = new ArConnectSigner(window.arweaveWallet, arweave);
const ant = ANT.init({
  signer: browserSigner,
  processId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
});

// in a node environment
const nodeSigner = new ArweaveSigner(JWK);
const ant = ANT.init({
  signer: nodeSigner,
  processId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
});

```

### Configuration

ANT clients can be configured to use custom process evaluator. By default they will use the AO Testnet located at ao-testnet.xyz

```typescript
// provide a processId to the client and default to remote evaluation
const remoteANT = ANT.init({
  processId: 'ANT_PROCESS_ID',
});
```

## Developers

### Requirements

- `node` >= 18.0.0
- `npm` or `yarn`
- `docker` (recommended for testing)

### Setup & Build

- `nvm use` - use the correct node version
- `yarn install` - installs dependencies
- `yarn build` - builds web/node/bundled outputs

### Testing

- `yarn test:integration` - runs integration tests against a local AO testnet
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

[ar.io]: https://ar.io
[package.json]: ./package.json
[examples]: ./examples
[examples/webpack]: ./examples/webpack
[examples/vite]: ./examples/vite
[CONTRIBUTING.md]: ./CONTRIBUTING.md
