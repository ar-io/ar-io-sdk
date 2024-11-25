# @ar.io/sdk

[![codecov](https://codecov.io/gh/ar-io/ar-io-sdk/graph/badge.svg?token=7dXKcT7dJy)](https://codecov.io/gh/ar-io/ar-io-sdk)

This is the home of [ar.io] SDK. This SDK provides functionality for interacting with the ar.io ecosystem of services (e.g. gateways and observers) and protocols (e.g. ArNS and AO). It is available for both NodeJS and Web environments.

## Table of Contents

<!-- toc -->

- [Table of Contents](#table-of-contents)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Web](#web)
    - [Bundlers (Webpack, Rollup, ESbuild, etc.)](#bundlers-webpack-rollup-esbuild-etc)
    - [Browser](#browser)
  - [Node](#node)
    - [ESM (NodeNext)](#esm-nodenext)
    - [CJS](#cjs)
  - [Typescript](#typescript)
- [IOToken & mIOToken](#iotoken--miotoken)
  - [Converting IO to mIO](#converting-io-to-mio)
- [IO Process](#io-process)
  - [APIs](#apis)
    - [`init({ signer })`](#init-signer-)
    - [`getInfo()`](#getinfo)
    - [`getTokenSupply()`](#gettokensupply)
    - [`getBalance({ address })`](#getbalance-address-)
    - [`getBalances({ cursor, limit, sortBy, sortOrder })`](#getbalances-cursor-limit-sortby-sortorder-)
    - [`getVault({ address, vaultId })`](#getvault-address-vaultid-)
    - [`getVaults({ cursor, limit, sortBy, sortOrder })`](#getvaults-cursor-limit-sortby-sortorder-)
    - [`getGateway({ address })`](#getgateway-address-)
    - [`getGateways({ cursor, limit, sortBy, sortOrder })`](#getgateways-cursor-limit-sortby-sortorder-)
    - [`buyRecord({ name, type, years, processId })`](#buyrecord-name-type-years-processid-)
    - [`getArNSRecord({ name })`](#getarnsrecord-name-)
    - [`getArNSRecords({ cursor, limit, sortBy, sortOrder })`](#getarnsrecords-cursor-limit-sortby-sortorder-)
    - [`getArNSAuctions({ cursor, limit, sortBy, sortOrder })`](#getarnsauctions-cursor-limit-sortby-sortorder-)
    - [`getArNSAuction({ name })`](#getarnsauction-name-)
    - [`getArNSAuctionPrices({ name, type, years, intervalMs })`](#getarnsauctionprices-name-type-years-intervalms-)
    - [`getDemandFactor()`](#getdemandfactor)
    - [`getObservations({ epochIndex })`](#getobservations-epochindex-)
    - [`getDistributions({ epochIndex })`](#getdistributions-epochindex-)
    - [`getEpoch({ epochIndex })`](#getepoch-epochindex-)
    - [`getCurrentEpoch()`](#getcurrentepoch)
    - [`getPrescribedObservers({ epochIndex })`](#getprescribedobservers-epochindex-)
    - [`getTokenCost({ intent, ...args })`](#gettokencost-intent-args-)
    - [`joinNetwork(params)`](#joinnetworkparams)
    - [`leaveNetwork()`](#leavenetwork)
    - [`updateGatewaySettings(gatewaySettings)`](#updategatewaysettingsgatewaysettings)
    - [`increaseDelegateStake({ target, qty })`](#increasedelegatestake-target-qty-)
    - [`decreaseDelegateStake({ target, qty, instant })`](#decreasedelegatestake-target-qty-instant-)
    - [`getDelegations({ address, cursor, limit, sortBy, sortOrder })`](#getdelegations-address-cursor-limit-sortby-sortorder-)
    - [`getAllowedDelegates({ address, cursor, limit, sortBy, sortOrder })`](#getalloweddelegates-address-cursor-limit-sortby-sortorder-)
    - [`getGatewayVaults({ address, cursor, limit, sortBy, sortOrder })`](#getgatewayvaults-address-cursor-limit-sortby-sortorder-)
    - [`instantWithdrawal({ gatewayAddress, vaultId })`](#instantwithdrawal-gatewayaddress-vaultid-)
    - [`increaseOperatorStake({ qty })`](#increaseoperatorstake-qty-)
    - [`decreaseOperatorStake({ qty })`](#decreaseoperatorstake-qty-)
    - [`saveObservations({ reportTxId, failedGateways })`](#saveobservations-reporttxid-failedgateways-)
    - [`transfer({ target, qty })`](#transfer-target-qty-)
    - [`increaseUndernameLimit({ name, qty })`](#increaseundernamelimit-name-qty-)
    - [`extendLease({ name, years })`](#extendlease-name-years-)
    - [`cancelWithdrawal({ gatewayAddress, vaultId })`](#cancelwithdrawal-gatewayaddress-vaultid-)
    - [`submitAuctionBid({ name, type, years, processId })`](#submitauctionbid-name-type-years-processid-)
    - [`getPrimaryNames({ cursor, limit, sortBy, sortOrder })`](#getprimarynames-cursor-limit-sortby-sortorder-)
    - [`getPrimaryName({ name, address })`](#getprimaryname-name-address-)
    - [`requestPrimaryName({ name, address })`](#requestprimaryname-name-address-)
    - [`getPrimaryNameRequest({ initiator })`](#getprimarynamerequest-initiator-)
    - [`redelegateStake({ target, source, stakeQty, vaultId })`](#redelegatestake-target-source-stakeqty-vaultid-)
    - [`getRedelegationFee({ address })`](#getredelegationfee-address-)
  - [Configuration](#configuration)
- [Arweave Name Tokens (ANT's)](#arweave-name-tokens-ants)
  - [ANT APIs](#ant-apis)
    - [`init({ processId, signer })`](#init-processid-signer-)
    - [`getInfo()`](#getinfo-1)
    - [`getHandlers()`](#gethandlers)
    - [`getState()`](#getstate)
    - [`getOwner()`](#getowner)
    - [`getControllers()`](#getcontrollers)
    - [`getRecords()`](#getrecords)
    - [`transfer({ target })`](#transfer-target-)
    - [`setController({ controller })`](#setcontroller-controller-)
    - [`removeController({ controller })`](#removecontroller-controller-)
    - [`setRecord({ undername, transactionId, ttlSeconds })`](#setrecord-undername-transactionid-ttlseconds-)
    - [`removeRecord({ undername })`](#removerecord-undername-)
    - [`setName({ name })`](#setname-name-)
    - [`setTicker({ ticker })`](#setticker-ticker-)
    - [`setDescription({ description })`](#setdescription-description-)
    - [`setKeywords({ keywords })`](#setkeywords-keywords-)
    - [`setLogo({ txId })`](#setlogo-txid-)
    - [`releaseName({ name, ioProcessId })`](#releasename-name-ioprocessid-)
    - [`reassignName({ name, ioProcessId, antProcessId })`](#reassignname-name-ioprocessid-antprocessid-)
    - [`approvePrimaryNameRequest({ name, address, ioProcessId })`](#approveprimarynamerequest-name-address-ioprocessid-)
    - [`removePrimaryNames({ names, ioProcessId })`](#removeprimarynames-names-ioprocessid-)
  - [Configuration](#configuration-1)
- [Logging](#logging)
  - [Configuration](#configuration-2)
- [Pagination](#pagination)
- [Resources](#resources)
  - [Bundling](#bundling)
  - [Gateways](#gateways)
  - [Running a Gateway](#running-a-gateway)
  - [AO](#ao)
- [Developers](#developers)
  - [Requirements](#requirements)
  - [Setup & Build](#setup--build)
  - [Testing](#testing)
  - [Linting & Formatting](#linting--formatting)
  - [Architecture](#architecture)

<!-- tocstop -->

## Prerequisites

- `node>=v18.0.0`
- `npm` or `yarn`

## Installation

```shell
npm install @ar.io/sdk
```

or

```shell
yarn add @ar.io/sdk --ignore-engines
```

> [!NOTE]
> The `--ignore-engines` flag is required when using yarn, as [permaweb/aoconnect] recommends only the use of npm. Alternatively, you can add a `.yarnrc.yml` file to your project containing `ignore-engines true` to ignore the engines check.

## Quick Start

```typescript
import { IO } from '@ar.io/sdk';

const io = IO.init();
const gateways = await io.getGateways();
```

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "gatewayAddress": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
      "observerAddress": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
      "operatorStake": 250000000000,
      "settings": {
        "fqdn": "ar-io.dev",
        "label": "AR.IO Test",
        "note": "Test Gateway operated by PDS for the AR.IO ecosystem.",
        "port": 443,
        "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
        "protocol": "https"
      },
      "startTimestamp": 1720720621424,
      "stats": {
        "failedConsecutiveEpochs": 0,
        "passedEpochCount": 30,
        "submittedEpochCount": 30,
        "totalEpochCount": 31,
        "totalEpochsPrescribedCount": 31
      },
      "status": "joined",
      "vaults": {},
      "weights": {
        "compositeWeight": 0.97688888893556,
        "gatewayRewardRatioWeight": 1,
        "tenureWeight": 0.19444444444444,
        "observerRewardRatioWeight": 1,
        "normalizedCompositeWeight": 0.19247316211083,
        "stakeWeight": 5.02400000024
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "-4xgjroXENKYhTWqrBo57HQwvDL51mMdfsdsxJy6Y2Z_sA",
  "totalItems": 316,
  "sortBy": "startTimestamp",
  "sortOrder": "desc"
}
```

</details>

## Usage

The SDK is provided in both CommonJS and ESM formats and is compatible with bundlers such as Webpack, Rollup, and ESbuild. Utilize the appropriately named exports provided by this SDK's [package.json] based on your project's configuration. Refer to the [examples] directory to see how to use the SDK in various environments.

### Web

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { IO } from '@ar.io/sdk/web';

// set up client
const io = IO.init();
// fetch gateways
const gateways = await io.getGateways();
```

> [!WARNING]
> Polyfills are not provided by default for bundled web projects (Vite, ESBuild, Webpack, Rollup, etc.) . Depending on your apps bundler configuration and plugins, you will need to provide polyfills for various imports including `crypto`, `process` and `buffer`. Refer to [examples/webpack] and [examples/vite] for examples. For other project configurations, refer to your bundler's documentation for more information on how to provide the necessary polyfills.

#### Browser

```html
<script type="module">
  import { IO } from 'https://unpkg.com/@ar.io/sdk';

  // set up client
  const io = IO.init();
  // fetch gateways
  const gateways = await io.getGateways();
</script>
```

### Node

#### ESM (NodeNext)

```javascript
import { IO } from '@ar.io/sdk/node';

// set up client
const io = IO.init();
// fetch gateways
const gateways = await io.getGateways();
```

#### CJS

```javascript
import { IO } from '@ar.io/sdk';

// set up client
const io = IO.init();
// fetch gateways
const gateways = await io.getGateways();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized by package managers, offering benefits such as type-checking and autocompletion.

> [!NOTE]
> Typescript version 5.3 or higher is recommended.

## IOToken & mIOToken

The IO process stores all values as mIO (milli-IO) to avoid floating-point arithmetic issues. The SDK provides an `IOToken` and `mIOToken` classes to handle the conversion between IO and mIO, along with rounding logic for precision.

**All process interactions expect values in mIO. If numbers are provided as inputs, they are assumed to be in raw mIO values.**

### Converting IO to mIO

```typescript
import { IOToken, mIOToken } from '@ar.io/sdk';

const ioValue = 1;
const mIOValue = new IOToken(ioValue).toMIO();

const mIOValue = 1_000_000;
const ioValue = new mIOToken(mIOValue).toIO();
```

## IO Process

### APIs

#### `init({ signer })`

Factory function to that creates a read-only or writeable client. By providing a `signer` additional write APIs that require signing, like `joinNetwork` and `delegateStake` are available. By default, a read-only client is returned and no write APIs are available.

```typescript
// read-only client
const io = IO.init()

// read-write client for browser environments
const io = IO.init({ signer: new ArConnectSigner(window.arweaveWallet, Arweave.init({}))});

// read-write client for node environments
const io = IO.init({ signer: new ArweaveSigner(JWK) });

```

#### `getInfo()`

Retrieves the information of the IO process.

```typescript
const io = IO.init();
const info = await io.getInfo();
```

<details>
  <summary>Output</summary>

```json
{
  "Name": "Testnet IO",
  "Ticker": "tIO",
  "Owner": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
  "Denomination": 6,
  "Handlers": ["_eval", "_default_"], // full list of handlers, useful for debugging
  "LastTickedEpochIndex": 31 // epoch index of the last tick
}
```

</details>

#### `getTokenSupply()`

Retrieves the total supply of tokens, returned in mIO. The total supply includes the following:

- `total` - the total supply of all tokens
- `circulating` - the total supply minus locked, withdrawn, delegated, and staked
- `locked` - tokens that are locked in the protocol (a.k.a. vaulted)
- `withdrawn` - tokens that have been withdrawn from the protocol by operators and delegators
- `delegated` - tokens that have been delegated to gateways
- `staked` - tokens that are staked in the protocol by gateway operators
- `protocolBalance` - tokens that are held in the protocol's treasury. This is included in the circulating supply.

```typescript
const io = IO.init();
const supply = await io.getTokenSupply();
```

<details>
  <summary>Output</summary>

```json
{
  "total": 1000000000000000000,
  "circulating": 998094653842520,
  "locked": 0,
  "withdrawn": 560563387278,
  "delegated": 1750000000,
  "staked": 1343032770199,
  "protocolBalance": 46317263683761
}
```

</details>

#### `getBalance({ address })`

Retrieves the balance of the specified wallet address.

```typescript
const io = IO.init();
// the balance will be returned in mIO as a value
const balance = await io
  .getBalance({
    address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
  })
  .then((balance: number) => new mIOToken(balance).toIO()); // convert it to IO for readability
```

<details>
  <summary>Output</summary>

```json
100000
```

</details>

#### `getBalances({ cursor, limit, sortBy, sortOrder })`

Retrieves the balances of the IO process in `mIO`, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last wallet address from the previous request.

```typescript
const io = IO.init();
const balances = await io.getBalances({
  cursor: '-4xgjroXENKYhTWqrBo57HQwvDL51mMdfsdsxJy6Y2Z_sA',
  limit: 100,
  sortBy: 'balance',
  sortOrder: 'desc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "address": "-4xgjroXENKYhTWqrBo57HQwvDL51mMvSxJy6Y2Z_sA",
      "balance": 1000000
    },
    {
      "address": "-7vXsQZQDk8TMDlpiSLy3CnLi5PDPlAaN2DaynORpck",
      "balance": 1000000
    }
    // ...98 other balances
  ],
  "hasMore": true,
  "nextCursor": "-7vXsQZQDk8TMDlpiSLy3CnLi5PDPlAaN2DaynORpck",
  "totalItems": 1789,
  "sortBy": "balance",
  "sortOrder": "desc"
}
```

</details>
 
#### `getVault({ address, vaultId })`

Retrieves the locked-balance user vault of the IO process by the specified wallet address and vault ID.

```typescript
const io = IO.init();
const vault = await io.getVault({
  address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
  vaultId: 'vaultIdOne',
});
```

<details>
  <summary>Output</summary>

```json
{
  "balance": 1000000,
  "startTimestamp": 123,
  "endTimestamp": 4567
}
```

</details>

#### `getVaults({ cursor, limit, sortBy, sortOrder })`

Retrieves all locked-balance user vaults of the IO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last wallet address from the previous request.

```typescript
const io = IO.init();
const vaults = await io.getVaults({
  cursor: '0',
  limit: 100,
  sortBy: 'balance',
  sortOrder: 'desc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "address": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
      "vaultId": "vaultIdOne",
      "balance": 1000000,
      "startTimestamp": 123,
      "endTimestamp": 4567
    },
    {
      "address": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
      "vaultId": "vaultIdTwo",
      "balance": 1000000,
      "startTimestamp": 123,
      "endTimestamp": 4567
    }
    // ...98 other addresses with vaults
  ],
  "hasMore": true,
  "nextCursor": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
  "totalItems": 1789,
  "sortBy": "balance",
  "sortOrder": "desc"
}
```

</details>

#### `getGateway({ address })`

Retrieves a gateway's info by its staking wallet address.

```typescript
const io = IO.init();
const gateway = await io.getGateway({
  address: '-7vXsQZQDk8TMDlpiSLy3CnLi5PDPlAaN2DaynORpck',
});
```

<details>
  <summary>Output</summary>

```json
{
  "observerAddress": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
  "operatorStake": 250000000000,
  "settings": {
    "fqdn": "ar-io.dev",
    "label": "AR.IO Test",
    "note": "Test Gateway operated by PDS for the AR.IO ecosystem.",
    "port": 443,
    "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
    "protocol": "https"
  },
  "startTimestamp": 1720720620813,
  "stats": {
    "failedConsecutiveEpochs": 0,
    "passedEpochCount": 30,
    "submittedEpochCount": 30,
    "totalEpochCount": 31,
    "totalEpochsPrescribedCount": 31
  },
  "status": "joined",
  "vaults": {},
  "weights": {
    "compositeWeight": 0.97688888893556,
    "gatewayRewardRatioWeight": 1,
    "tenureWeight": 0.19444444444444,
    "observerRewardRatioWeight": 1,
    "normalizedCompositeWeight": 0.19247316211083,
    "stakeWeight": 5.02400000024
  }
}
```

</details>

#### `getGateways({ cursor, limit, sortBy, sortOrder })`

Retrieves registered gateways of the IO process, using pagination and sorting by the specified criteria. The `cursor` used for pagination is the last gateway address from the previous request.

```typescript
const io = IO.init();
const gateways = await io.getGateways({
  limit: 100,
  sortOrder: 'desc',
  sortBy: 'operatorStake',
});
```

Available `sortBy` options are any of the keys on the gateway object, e.g. `operatorStake`, `start`, `status`, `settings.fqdn`, `settings.label`, `settings.note`, `settings.port`, `settings.protocol`, `stats.failedConsecutiveEpochs`, `stats.passedConsecutiveEpochs`, etc.

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "gatewayAddress": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
      "observerAddress": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
      "operatorStake": 250000000000,
      "settings": {
        "fqdn": "ar-io.dev",
        "label": "AR.IO Test",
        "note": "Test Gateway operated by PDS for the AR.IO ecosystem.",
        "port": 443,
        "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
        "protocol": "https"
      },
      "startTimestamp": 1720720620813,
      "stats": {
        "failedConsecutiveEpochs": 0,
        "passedEpochCount": 30,
        "submittedEpochCount": 30,
        "totalEpochCount": 31,
        "totalEpochsPrescribedCount": 31
      },
      "status": "joined",
      "vaults": {},
      "weights": {
        "compositeWeight": 0.97688888893556,
        "gatewayRewardRatioWeight": 1,
        "tenureWeight": 0.19444444444444,
        "observerRewardRatioWeight": 1,
        "normalizedCompositeWeight": 0.19247316211083,
        "stakeWeight": 5.02400000024
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "-4xgjroXENKYhTWqrBo57HQwvDL51mMdfsdsxJy6Y2Z_sA",
  "totalItems": 316,
  "sortBy": "operatorStake",
  "sortOrder": "desc"
}
```

</details>

#### `buyRecord({ name, type, years, processId })`

Purchases a new ArNS record with the specified name, type, and duration.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ processId: IO_DEVNET_PROCESS_ID, signer });
const record = await io.buyRecord(
  { name: 'ardrive', type: 'lease', years: 1 },
  {
    // optional tags
    tags: [{ name: 'App-Name', value: 'ArNS-App' }],
  },
);
```

#### `getArNSRecord({ name })`

Retrieves the record info of the specified ArNS name.

```typescript
const io = IO.init();
const record = await io.getArNSRecord({ name: 'ardrive' });
```

<details>
  <summary>Output</summary>

```json
{
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "endTimestamp": 1752256702026,
  "startTimestamp": 1720720819969,
  "type": "lease",
  "undernames": 100
}
```

</details>

#### `getArNSRecords({ cursor, limit, sortBy, sortOrder })`

Retrieves all registered ArNS records of the IO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last ArNS name from the previous request.

```typescript
const io = IO.init();
// get the newest 100 names
const records = await io.getArNSRecords({
  limit: 100,
  sortBy: 'startTimestamp',
  sortOrder: 'desc',
});
```

Available `sortBy` options are any of the keys on the record object, e.g. `name`, `processId`, `endTimestamp`, `startTimestamp`, `type`, `undernames`.

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "name": "ao",
      "processId": "eNey-H9RB9uCdoJUvPULb35qhZVXZcEXv8xds4aHhkQ",
      "purchasePrice": 75541282285,
      "startTimestamp": 1720720621424,
      "type": "permabuy",
      "undernames": 10
    },
    {
      "name": "ardrive",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720620813,
      "type": "lease",
      "undernames": 100
    },
    {
      "name": "arweave",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720620800,
      "type": "lease",
      "undernames": 100
    },
    {
      "name": "ar-io",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720619000,
      "type": "lease",
      "undernames": 100
    },
    {
      "name": "fwd",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720220811,
      "type": "lease",
      "undernames": 100
    }
    // ...95 other records
  ],
  "hasMore": true,
  "nextCursor": "fwdresearch",
  "totalItems": 21740,
  "sortBy": "startTimestamp",
  "sortOrder": "desc"
}
```

</details>

#### `getArNSAuctions({ cursor, limit, sortBy, sortOrder })`

Retrieves all active auctions of the IO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last auction name from the previous request.

```typescript
const io = IO.init();
const auctions = await io.getArNSAuctions({
  limit: 100,
  sortBy: 'endTimestamp',
  sortOrder: 'asc', // return the auctions ending soonest first
});
```

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "name": "permalink",
      "endTimestamp": 1730985241349,
      "startTimestamp": 1729775641349,
      "baseFee": 250000000,
      "demandFactor": 1.05256,
      "initiator": "GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc",
      "settings": {
        "durationMs": 1209600000,
        "decayRate": 0.000000000016847809193121693,
        "scalingExponent": 190,
        "startPriceMultiplier": 50
      }
    }
  ],
  "hasMore": false,
  "totalItems": 1,
  "sortBy": "endTimestamp",
  "sortOrder": "asc"
}
```

</details>

#### `getArNSAuction({ name })`

Retrieves the auction data for the specified auction name.

```typescript
const io = IO.init();
const auction = await io.getArNSAuction({ name: 'permalink' });
```

<details>
  <summary>Output</summary>

```json
{
  "name": "permalink",
  "endTimestamp": 1730985241349,
  "startTimestamp": 1729775641349,
  "baseFee": 250000000,
  "demandFactor": 1.05256,
  "initiator": "GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc",
  "settings": {
    "durationMs": 1209600000,
    "decayRate": 0.000000000016847809193121693,
    "scalingExponent": 190,
    "startPriceMultiplier": 50
  }
}
```

</details>

#### `getArNSAuctionPrices({ name, type, years, intervalMs })`

Retrieves the auction price curve of the specified auction name for the specified type, duration, and interval. The `intervalMs` is the number of milliseconds between price points on the curve. The default interval is 15 minutes.

```typescript
const io = IO.init();
const priceCurve = await io.getArNSAuctionPrices({
  name: 'permalink',
  type: 'lease',
  years: 1,
  intervalMs: 3600000, // 1 hour price intervals (default is 15 minutes)
});
```

<details>
  <summary>Output</summary>

```json
{
  "name": "permalink",
  "type": "lease",
  "currentPrice": 12582015000,
  "years": 1,
  "prices": {
    "1730412841349": 1618516789,
    "1729908841349": 8210426826,
    "1730722441349": 592768907,
    "1730859241349": 379659914,
    "1730866441349": 370850139,
    "1730884441349": 349705277,
    "1730150041349": 3780993370,
    "1730031241349": 5541718397,
    "1730603641349": 872066253,
    "1730715241349": 606815377,
    "1730942041349": 289775172,
    "1730916841349": 314621977,
    "1730484841349": 1281957300,
    "1730585641349": 924535164,
    "1730232841349": 2895237473,
    "1730675641349": 690200977,
    "1730420041349": 1581242331,
    "1729786441349": 12154428186,
    "1730308441349": 2268298483,
    "1730564041349": 991657913,
    "1730081641349": 4712427282,
    "1730909641349": 322102563,
    "1730945641349": 286388732,
    "1730024041349": 5671483398,
    "1729937641349": 7485620175
    // ...
  }
}
```

</details>

#### `getDemandFactor()`

Retrieves the current demand factor of the network. The demand factor is a multiplier applied to the cost of ArNS interactions based on the current network demand.

```typescript
const io = IO.init();
const demandFactor = await io.getDemandFactor();
```

<details>
  <summary>Output</summary>

```json
1.05256
```

</details>

#### `getObservations({ epochIndex })`

Returns the epoch-indexed observation list. If no epoch index is provided, the current epoch is used.

```typescript
const io = IO.init();
const observations = await io.getObservations();
```

<details>
  <summary>Output</summary>

```json
{
  "0": {
    "failureSummaries": {
      "-Tk2DDk8k4zkwtppp_XFKKI5oUgh6IEHygAoN7mD-w8": [
        "Ie2wEEUDKoU26c7IuckHNn3vMFdNQnMvfPBrFzAb3NA",
        "Ie2wEEUDKoU26c7IuckHNn3vMFdNQnMvfPBrFzAb3NA"
      ]
    },
    "reports": {
      "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": "B6UUjKWjjEWDBvDSMXWNmymfwvgR9EN27z5FTkEVlX4",
      "Ie2wEEUDKoU26c7IuckHNn3vMFdNQnMvfPBrFzAb3NA": "7tKsiQ2fxv0D8ZVN_QEv29fZ8hwFIgHoEDrpeEG0DIs",
      "osZP4D9cqeDvbVFBaEfjIxwc1QLIvRxUBRAxDIX9je8": "aatgznEvC_UPcxp1v0uw_RqydhIfKm4wtt1KCpONBB0",
      "qZ90I67XG68BYIAFVNfm9PUdM7v1XtFTn7u-EOZFAtk": "Bd8SmFK9-ktJRmwIungS8ur6JM-JtpxrvMtjt5JkB1M"
    }
  }
}
```

</details>

#### `getDistributions({ epochIndex })`

Returns the current rewards distribution information. If no epoch index is provided, the current epoch is used.

```typescript
const io = IO.init();
const distributions = await io.getDistributions({ epochIndex: 0 });
```

<details>
  <summary>Output</summary>

```json
{
  "totalEligibleGateways": 1,
  "totalEligibleRewards": 100000000,
  "totalEligibleObserverReward": 100000000,
  "totalEligibleGatewayReward": 100000000,
  "totalDistributedRewards": 100000000,
  "distributedTimestamp": 1720720621424,
  "rewards": {
    "eligible": {
      "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": {
        "operatorReward": 100000000,
        "delegateRewards": {}
      }
    },
    "distributed": {
      "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": 100000000
    }
  }
}
```

</details>

#### `getEpoch({ epochIndex })`

Returns the epoch data for the specified block height. If no epoch index is provided, the current epoch is used.

```typescript
const io = IO.init();
const epoch = await io.getEpoch({ epochIndex: 0 });
```

<details>
  <summary>Output</summary>

```json
{
  "epochIndex": 0,
  "startTimestamp": 1720720620813,
  "endTimestamp": 1752256702026,
  "startHeight": 1350700,
  "distributionTimestamp": 1752256702026,
  "observations": {
    "failureSummaries": {
      "-Tk2DDk8k4zkwtppp_XFKKI5oUgh6IEHygAoN7mD-w8": [
        "Ie2wEEUDKoU26c7IuckHNn3vMFdNQnMvfPBrFzAb3NA"
      ]
    },
    "reports": {
      "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": "B6UUjKWjjEWDBvDSMXWNmymfwvgR9EN27z5FTkEVlX4"
    }
  },
  "prescribedNames": ["ardrive", "ar-io", "arweave", "fwd", "ao"],
  "prescribedObservers": [
    {
      "gatewayAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
      "observerAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
      "stake": 10000000000, // value in mIO
      "startTimestamp": 1720720620813,
      "stakeWeight": 1,
      "tenureWeight": 0.4494598765432099,
      "gatewayRewardRatioWeight": 1,
      "observerRewardRatioWeight": 1,
      "compositeWeight": 0.4494598765432099,
      "normalizedCompositeWeight": 0.002057032496835938
    }
  ],
  "distributions": {
    "totalEligibleGateways": 1,
    "totalEligibleRewards": 100000000,
    "totalEligibleObserverReward": 100000000,
    "totalEligibleGatewayReward": 100000000,
    "totalDistributedRewards": 100000000,
    "distributedTimestamp": 1720720621424,
    "rewards": {
      "eligible": {
        "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": {
          "operatorReward": 100000000,
          "delegateRewards": {}
        }
      },
      "distributed": {
        "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": 100000000
      }
    }
  }
}
```

</details>

#### `getCurrentEpoch()`

Returns the current epoch data.

```typescript
const io = IO.init();
const epoch = await io.getCurrentEpoch();
```

<details>
  <summary>Output</summary>

```json
{
  "epochIndex": 0,
  "startTimestamp": 1720720621424,
  "endTimestamp": 1752256702026,
  "startHeight": 1350700,
  "distributionTimestamp": 1711122739,
  "observations": {
    "failureSummaries": {
      "-Tk2DDk8k4zkwtppp_XFKKI5oUgh6IEHygAoN7mD-w8": [
        "Ie2wEEUDKoU26c7IuckHNn3vMFdNQnMvfPBrFzAb3NA"
      ]
    },
    "reports": {
      "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": "B6UUjKWjjEWDBvDSMXWNmymfwvgR9EN27z5FTkEVlX4"
    }
  },
  "prescribedNames": ["ardrive", "ar-io", "arweave", "fwd", "ao"],
  "prescribedObservers": [
    {
      "gatewayAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
      "observerAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
      "stake": 10000000000,
      "start": 1292450,
      "stakeWeight": 1,
      "tenureWeight": 0.4494598765432099,
      "gatewayRewardRatioWeight": 1,
      "observerRewardRatioWeight": 1,
      "compositeWeight": 0.4494598765432099,
      "normalizedCompositeWeight": 0.002057032496835938
    }
  ],
  "distributions": {
    "distributedTimestamp": 1711122739,
    "totalEligibleRewards": 100000000,
    "rewards": {
      "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": 100000000
    }
  }
}
```

</details>

#### `getPrescribedObservers({ epochIndex })`

Retrieves the prescribed observers of the IO process. To fetch prescribed observers for a previous epoch set the `epochIndex` to the desired epoch index.

```typescript
const io = IO.init();
const observers = await io.getPrescribedObservers({ epochIndex: 0 });
```

<details>
<summary>Output</summary>

```json
[
  {
    "gatewayAddress": "BpQlyhREz4lNGS-y3rSS1WxADfxPpAuing9Lgfdrj2U",
    "observerAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
    "stake": 10000000000, // value in mIO
    "start": 1296976,
    "stakeWeight": 1,
    "tenureWeight": 0.41453703703703704,
    "gatewayRewardRatioWeight": 1,
    "observerRewardRatioWeight": 1,
    "compositeWeight": 0.41453703703703704,
    "normalizedCompositeWeight": 0.0018972019546783507
  }
]
```

</details>

#### `getTokenCost({ intent, ...args })`

Calculates the price in mIO to perform the interaction in question, eg a 'Buy-record' interaction, where args are the specific params for that interaction.

```typescript
const price = await io
  .getTokenCost({
    intent: 'Buy-Record',
    name: 'ar-io',
    type: 'permabuy',
  })
  .then((p) => new mIOToken(p).toIO()); // convert to IO for readability
```

<details>
  <summary>Output</summary>

```json
1642.34
```

</details>

#### `joinNetwork(params)`

Joins a gateway to the ar.io network via its associated wallet.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.joinNetwork(
  {
    qty: new IOToken(10_000).toMIO(), // minimum operator stake allowed
    autoStake: true, // auto-stake operator rewards to the gateway
    allowDelegatedStaking: true, // allows delegated staking
    minDelegatedStake: new IOToken(100).toMIO(), // minimum delegated stake allowed
    delegateRewardShareRatio: 10, // percentage of rewards to share with delegates (e.g. 10%)
    label: 'john smith', // min 1, max 64 characters
    note: 'The example gateway', // max 256 characters
    properties: 'FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44', // Arweave transaction ID containing additional properties of the Gateway
    observerWallet: '0VE0wIhDy90WiQoV3U2PeY44FH1aVetOoulPGqgYukj', // wallet address of the observer, must match OBSERVER_WALLET on the observer
    fqdn: 'example.com', // fully qualified domain name - note: you must own the domain and set the OBSERVER_WALLET on your gateway to match `observerWallet`
    port: 443, // port number
    protocol: 'https', // only 'https' is supported
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `leaveNetwork()`

Sets the gateway as `leaving` on the ar.io network. Requires `signer` to be provided on `IO.init` to sign the transaction. The gateways operator and delegate stakes are vaulted and will be returned after leave periods. The gateway will be removed from the network after the leave period.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });

const { id: txId } = await io.leaveNetwork(
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `updateGatewaySettings(gatewaySettings)`

Writes new gateway settings to the callers gateway configuration.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.updateGatewaySettings(
  {
    // any other settings you want to update
    minDelegatedStake: new IOToken(100).toMIO(),
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `increaseDelegateStake({ target, qty })`

Increases the callers stake on the target gateway.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.increaseDelegateStake(
  {
    target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
    qty: new IOToken(100).toMIO(),
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `decreaseDelegateStake({ target, qty, instant })`

Decreases the callers stake on the target gateway. Can instantly decrease stake by setting instant to `true`.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.decreaseDelegateStake(
  {
    target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
    qty: new IOToken(100).toMIO(),
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

Pay the early withdrawal fee and withdraw instantly.

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.decreaseDelegateStake({
  target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  qty: new IOToken(100).toMIO(),
  instant: true, // Immediately withdraw this stake and pay the instant withdrawal fee
});
```

#### `getDelegations({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all active and vaulted stakes across all gateways for a specific address, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last delegationId (concatenated gateway and startTimestamp of the delgation) from the previous request.

```typescript
const io = IO.init();
const vaults = await io.getDelegations({
  address: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  cursor: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ_123456789',
  limit: 2,
  sortBy: 'startTimestamp',
  sortOrder: 'asc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "asc",
  "hasMore": true,
  "totalItems": 95,
  "limit": 2,
  "sortBy": "startTimestamp",
  "items": [
    {
      "type": "stake",
      "startTimestamp": 1727815440632,
      "gatewayAddress": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
      "delegationId": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ_1727815440632",
      "balance": 1383212512
    },
    {
      "type": "vault",
      "startTimestamp": 1730996691117,
      "gatewayAddress": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
      "delegationId": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ_1730996691117",
      "vaultId": "_sGDS7X1hyLCVpfe40GWioH9BSOb7f0XWbhHBa1q4-g",
      "balance": 50000000,
      "endTimestamp": 1733588691117
    }
  ],
  "nextCursor": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ_1730996691117"
}
```

</details>

#### `getAllowedDelegates({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all allowed delegates for a specific address. The `cursor` used for pagination is the last address from the previous request.

```typescript
const io = IO.init();
const allowedDelegates = await io.getAllowedDelegates({
  address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "desc",
  "hasMore": false,
  "totalItems": 4,
  "limit": 100,
  "items": [
    "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM",
    "N4h8M9A9hasa3tF47qQyNvcKjm4APBKuFs7vqUVm-SI",
    "JcC4ZLUY76vmWha5y6RwKsFqYTrMZhbockl8iM9p5lQ",
    "31LPFYoow2G7j-eSSsrIh8OlNaARZ84-80J-8ba68d8"
  ]
}
```

</details>

#### `getGatewayVaults({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all vaults across all gateways for a specific address, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last vaultId from the previous request.

```typescript
const io = IO.init();
const vaults = await io.getGatewayVaults({
  address: '"PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM',
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "desc",
  "hasMore": false,
  "totalItems": 1,
  "limit": 100,
  "sortBy": "endTimestamp",
  "items": [
    {
      "cursorId": "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM_1728067635857",
      "startTimestamp": 1728067635857,
      "balance": 50000000000,
      "vaultId": "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM",
      "endTimestamp": 1735843635857
    }
  ]
}
```

</details>

#### `instantWithdrawal({ gatewayAddress, vaultId })`

Instantly withdraws an existing vault on a gateway. If no `gatewayAddress` is provided, the signer's address will be used.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
// removes a delegated vault from a gateway
const { id: txId } = await io.instantWithdrawal(
  {
    // gateway address where delegate vault exists
    gatewayAddress: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
    // delegated vault id to cancel
    vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  },
  // optional additional tags
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
// removes an operator vault from a gateway
const { id: txId } = await io.instantWithdrawal(
  {
    vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  },
);
```

#### `increaseOperatorStake({ qty })`

Increases the callers operator stake. Must be executed with a wallet registered as a gateway operator.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.increaseOperatorStake(
  {
    qty: new IOToken(100).toMIO(),
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

#### `decreaseOperatorStake({ qty })`

Decreases the callers operator stake. Must be executed with a wallet registered as a gateway operator. Requires `signer` to be provided on `IO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.decreaseOperatorStake(
  {
    qty: new IOToken(100).toMIO(),
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

#### `saveObservations({ reportTxId, failedGateways })`

Saves the observations of the current epoch. Requires `signer` to be provided on `IO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.saveObservations(
  {
    reportTxId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
    failedGateways: ['t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3'],
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

#### `transfer({ target, qty })`

Transfers `mIO` to the designated `target` recipient address. Requires `signer` to be provided on `IO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.transfer(
  {
    target: '-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5',
    qty: new IOToken(1000).toMIO(),
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `increaseUndernameLimit({ name, qty })`

Increases the undername support of a domain up to a maximum of 10k. Domains, by default, support up to 10 undernames.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.increaseUndernameLimit(
  {
    name: 'ar-io',
    qty: 420,
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `extendLease({ name, years })`

Extends the lease of a registered ArNS domain, with an extension of 1-5 years depending on grace period status. Permanently registered domains cannot be extended.

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.extendLease(
  {
    name: 'ar-io',
    years: 1,
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `cancelWithdrawal({ gatewayAddress, vaultId })`

Cancels an existing vault on a gateway. The vaulted stake will be returned to the callers stake. If no `gatewayAddress` is provided, the signer's address will be used.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
// cancels a delegated vault from a gateway
const { id: txId } = await io.cancelWithdrawal(
  {
    // gateway address where vault exists
    gatewayAddress: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
    // vault id to cancel
    vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
// cancels an operator vault from a gateway
const { id: txId } = await io.cancelWithdrawal(
  {
    // operator vault id to cancel
    vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  },
);
```

#### `submitAuctionBid({ name, type, years, processId })`

Submit a bid for the current auction. If the bid is accepted, the name will be leased for the specified duration and assigned the specified type and processId.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });

const auction = await io.getArNSAuction({ name: 'permalink' });

// check the current price is under some threshold
if (auction && auction.currentPrice <= new IOToken(20_000).toMIO().valueOf()) {
  const { id: txId } = await io.submitAuctionBid(
    {
      name: 'permalink',
      type: 'lease',
      years: 1,
      processId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM',
    },
    // optional additional tags
    { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
  );
}
```

#### `getPrimaryNames({ cursor, limit, sortBy, sortOrder })`

Retrieves all primary names across all gateways, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last name from the previous request.

```typescript
const io = IO.init();
const names = await io.getPrimaryNames({
  cursor: 'ar-io',
  limit: 2,
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "desc",
  "hasMore": false,
  "totalItems": 1,
  "limit": 100,
  "sortBy": "name",
  "items": [
    {
      "owner": "HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA",
      "startTimestamp": 1719356032297,
      "name": "arns"
    }
  ]
}
```

</details>

#### `getPrimaryName({ name, address })`

Retrieves the primary name for a given name or address.

```typescript
const io = IO.init();
const name = await io.getPrimaryName({
  name: 'arns',
});
// or
const name = await io.getPrimaryName({
  address: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
});
```

<details>
  <summary>Output</summary>

```json
{
  "owner": "HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA",
  "startTimestamp": 1719356032297,
  "name": "arns"
}
```

</details>

#### `requestPrimaryName({ name, address })`

Requests a primary name for the caller's address. The request must be approved by the new owner of the requested name via the `approvePrimaryNameRequest`[#approveprimarynamerequest-name-address-] API.

_Note: Requires `signer` to be provided on `IO.init` to sign the transaction._

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await io.requestPrimaryName({
  name: 'arns',
});
```

#### `getPrimaryNameRequest({ initiator })`

Retrieves the primary name request for a a wallet address.

```typescript
const io = IO.init();
const request = await io.getPrimaryNameRequest({
  initiator: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
});
```

<details>
  <summary>Output</summary>

```json
{
  "initiator": "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  "name": "arns",
  "startTimestamp": 1728067635857,
  "endTimestamp": 1735843635857
}
```

</details>

#### `redelegateStake({ target, source, stakeQty, vaultId })`

Redelegates the stake of a specific address to a new gateway. Vault ID may be optionally included in order to redelegate from an existing withdrawal vault. The redelegation fee is calculated based on the fee rate and the stake amount. Users are allowed one free redelegation every seven epochs. Each additional redelegation beyond the free redelegation will increase the fee by 10%, capping at a 60% redelegation fee.

e.g: If 1000 mIO is redelegated and the fee rate is 10%, the fee will be 100 mIO. Resulting in 900 mIO being redelegated to the new gateway and 100 mIO being deducted back to the protocol balance.

```typescript
const io = IO.init({ signer: new ArweaveSigner(jwk) });

const { id: txId } = await io.redelegateStake({
  target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  source: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
  stakeQty: new IOToken(1000).toMIO(),
  vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
});
```

#### `getRedelegationFee({ address })`

Retrieves the fee rate as percentage required to redelegate the stake of a specific address. Fee rate ranges from 0% to 60% based on the number of redelegations since the last fee reset.

```typescript
const io = IO.init();

const fee = await io.getRedelegationFee({
  address: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
});
```

<details>
  <summary>Output</summary>

```json
{
  "redelegationFeeRate": 10,
  "feeResetTimestamp": 1730996691117
}
```

</details>

### Configuration

The IO client class exposes APIs relevant to the ar.io process. It can be configured to use any AO Process ID that adheres to the [IO Network Spec]. By default, it will use the current [IO Testnet Process]. Refer to [AO Connect] for more information on how to configure an IO process to use specific AO infrastructure.

```typescript
// provide a custom ao infrastructure and process id
const io = IO.init({
  process: new AoProcess({
    processId: 'IO_PROCESS_ID'
    ao: connect({
      MU_URL: 'https://mu-testnet.xyz',
      CU_URL: 'https://cu-testnet.xyz',
      GRAPHQL_URL: 'https://arweave.net/graphql',
      GATEWAY_URL: 'https://arweave.net',
    })
  })
});
```

## Arweave Name Tokens (ANT's)

The ANT client class exposes APIs relevant to compliant Arweave Name Token processes. It can be configured to use any process ID that adheres to the ANT process spec. You must provide either a custom process data provider or a processId to the ANT class constructor to use.

### ANT APIs

#### `init({ processId, signer })`

Factory function to that creates a read-only or writeable client. By providing a `signer` additional write APIs that require signing, like `setRecord` and `transfer` are available. By default, a read-only client is returned and no write APIs are available.

```typescript
// in a browser environment with ArConnect
const ant = ANT.init({
  signer: new ArConnectSigner(window.arweaveWallet, Arweave.init({})),
  processId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
});

// in a node environment
const ant = ANT.init({
  signer: new ArweaveSigner(JWK),
  processId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
});

```

#### `getInfo()`

Retrieves the information of the ANT process.

```typescript
const info = await ant.getInfo();
```

<details>
  <summary>Output</summary>

```json
{
  "name": "ArDrive",
  "ticker": "ANT-ARDRIVE",
  "description": "This is the ANT for the ArDrive decentralized web app.",
  "keywords": ["File-sharing", "Publishing", "dApp"],
  "owner": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ"
}
```

</details>

#### `getHandlers()`

Retrieves the handlers supported on the ANT

```typescript
const handlers = await ant.getHandlers();
```

<details>
  <summary>Output</summary>

```json
[
  "evolve",
  "_eval",
  "_default",
  "transfer",
  "balance",
  "balances",
  "totalSupply",
  "info",
  "addController",
  "removeController",
  "controllers",
  "setRecord",
  "removeRecord",
  "record",
  "records",
  "setName",
  "setTicker",
  "initializeState",
  "state"
]
```

</details>

#### `getState()`

Retrieves the state of the ANT process.

```typescript
const state = await ant.getState();
```

<details>
  <summary>Output</summary>

```json
{
  "TotalSupply": 1,
  "Balances": {
    "98O1_xqDLrBKRfQPWjF5p7xZ4Jx6GM8P5PeJn26xwUY": 1
  },
  "Controllers": [],
  "Records": {
    "v1-0-0_whitepaper": {
      "transactionId": "lNjWn3LpyhKC95Kqe-x8X2qgju0j98MhucdDKK85vc4",
      "ttlSeconds": 900
    },
    "@": {
      "transactionId": "2rMLb2uHAyEt7jSu6bXtKx8e-jOfIf7E-DOgQnm8EtU",
      "ttlSeconds": 3600
    },
    "whitepaper": {
      "transactionId": "lNjWn3LpyhKC95Kqe-x8X2qgju0j98MhucdDKK85vc4",
      "ttlSeconds": 900
    }
  },
  "Initialized": true,
  "Ticker": "ANT-AR-IO",
  "Description": "A friendly description for this ANT.",
  "Keywords": ["keyword1", "keyword2", "keyword3"],
  "Logo": "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A",
  "Denomination": 0,
  "Name": "AR.IO Foundation",
  "Owner": "98O1_xqDLrBKRfQPWjF5p7xZ4Jx6GM8P5PeJn26xwUY"
}
```

</details>

#### `getOwner()`

Returns the owner of the configured ANT process.

```typescript
const owner = await ant.getOwner();
```

<details>
  <summary>Output</summary>

```json
"ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4"
```

</details>

#### `getControllers()`

Returns the controllers of the configured ANT process.

```typescript
const controllers = await ant.getControllers();
```

<details>
  <summary>Output</summary>

```json
["ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4"]
```

</details>

#### `getRecords()`

Returns all records on the configured ANT process, including the required `@` record that resolve connected ArNS names.

```typescript
const records = await ant.getRecords();
```

<details>
  <summary>Output</summary>

```json
{
  "@": {
    "transactionId": "UyC5P5qKPZaltMmmZAWdakhlDXsBF6qmyrbWYFchRTk",
    "ttlSeconds": 3600
  },
  "zed": {
    "transactionId": "-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI",
    "ttlSeconds": 900
  },

  "ardrive": {
    "transactionId": "-cucucachoodwedwedoiwepodiwpodiwpoidpwoiedp",
    "ttlSeconds": 900
  }
}
```

</details>

#### `transfer({ target })`

Transfers ownership of the ANT to a new target address. Target MUST be an Arweave address.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.transfer(
  { target: 'aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setController({ controller })`

Adds a new controller to the list of approved controllers on the ANT. Controllers can set records and change the ticker and name of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setController(
  { controller: 'aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `removeController({ controller })`

Removes a controller from the list of approved controllers on the ANT.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removeController(
  { controller: 'aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setRecord({ undername, transactionId, ttlSeconds })`

Updates or creates a record in the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

> Records, or `undernames` are configured with the `transactionId` - the arweave transaction id the record resolves - and `ttlSeconds`, the Time To Live in the cache of client applications.

```typescript
const { id: txId } = await ant.setRecord(
  {
    undername: '@',
    transactionId: '432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
    ttlSeconds: 3600
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `removeRecord({ undername })`

Removes a record from the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removeRecord(
  { undername: 'remove-domemain' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setName({ name })`

Sets the name of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setName(
  { name: 'My ANT' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setTicker({ ticker })`

Sets the ticker of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setTicker(
  { ticker: 'ANT-NEW-TICKER' },
  // optional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setDescription({ description })`

Sets the description of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setDescription(
  { description: 'A friendly description of this ANT' },
  // optional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setKeywords({ keywords })`

Sets the keywords of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setDescription(
  { keywords: ['Game', 'FPS', 'AO'] },
  // optional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `setLogo({ txId })`

Sets the Logo of the ANT - logo should be an Arweave transaction ID.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setLogo(
  { txId: 'U7RXcpaVShG4u9nIcPVmm2FJSM5Gru9gQCIiRaIPV7f' },
  // optional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `releaseName({ name, ioProcessId })`

Releases a name from the auction and makes it available for auction on the IO contract. The name must be permanently owned by the releasing wallet. 50% of the winning bid will be distributed to the ANT owner at the time of release. If no bids, the name will be released and can be reregistered by anyone.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.releaseName({
  name: 'permalink',
  ioProcessId: IO_TESTNET_PROCESS_ID, // releases the name owned by the ANT and sends it to auction on the IO contract
});
```

#### `reassignName({ name, ioProcessId, antProcessId })`

Reassigns a name to a new ANT. This can only be done by the current owner of the ANT.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.reassignName({
  name: 'ardrive',
  ioProcessId: IO_TESTNET_PROCESS_ID,
  antProcessId: NEW_ANT_PROCESS_ID, // the new ANT process id that will take over ownership of the name
});
```

#### `approvePrimaryNameRequest({ name, address, ioProcessId })`

Approves a primary name request for a given name or address.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.approvePrimaryNameRequest({
  name: 'arns',
  address: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3', // must match the request initiator address
  ioProcessId: IO_TESTNET_PROCESS_ID, // the IO process id to use for the request
});
```

#### `removePrimaryNames({ names, ioProcessId })`

Removes primary names from the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removePrimaryNames({
  names: ['arns', 'test_arns'], // any primary names associated with a base name controlled by this ANT will be removed
  ioProcessId: IO_TESTNET_PROCESS_ID,
});
```

### Configuration

ANT clients can be configured to use custom AO process. Refer to [AO Connect] for more information on how to configure the AO process to use specific AO infrastructure.

```typescript

const ant = ANT.init({
  process: new AoProcess({
    processId: 'ANT_PROCESS_ID'
    ao: connect({
      MU_URL: 'https://mu-testnet.xyz',
      CU_URL: 'https://cu-testnet.xyz',
      GRAPHQL_URL: 'https://arweave.net/graphql',
      GATEWAY_URL: 'https://arweave.net',
    })
  })
});
```

## Logging

The library uses the [Winston] logger for node based projects, and `console` logger for web based projects by default. You can configure the log level via `setLogLevel()` API. Alternatively you can set a custom logger as the default logger so long as it satisfes the `ILogger` interface.

### Configuration

```typescript
import { Logger } from '@ar.io/sdk';

// set the log level
Logger.default.setLogLevel('debug');

// provide your own logger
Logger.default = winston.createLogger({ ...loggerConfigs }); // or some other logger that satisifes ILogger interface
```

## Pagination

Certain APIs that could return a large amount of data are paginated using cursors. The SDK uses the `cursor` pattern (as opposed to pages) to better protect against changing data while paginating through a list of items. For more information on pagination strategies refer to [this article](https://www.getknit.dev/blog/api-pagination-best-practices#api-pagination-techniques-).

Paginated results include the following properties:

- `items`: the list of items on the current request, defaulted to 100 items.
- `nextCursor`: the cursor to use for the next batch of items. This is `undefined` if there are no more items to fetch.
- `hasMore`: a boolean indicating if there are more items to fetch. This is `false` if there are no more items to fetch.
- `totalItems`: the total number of items available. This may change as new items are added to the list, only use this for informational purposes.
- `sortBy`: the field used to sort the items, by default this is `startTimestamp`.
- `sortOrder`: the order used to sort the items, by default this is `desc`.

To request all the items in a list, you can iterate through the list using the `nextCursor` until `hasMore` is `false`.

```typescript
let hasMore = true;
let cursor: string | undefined;
const gateaways = [];
while (hasMore) {
  const page = await io.getGateways({ limit: 100, cursor });
  gateaways.push(...items);
  cursor = page.nextCursor;
  hasMore = page.hasMore;
}
```

## Resources

### Bundling

For [ANS-104] bundling compatible with ar.io gateways, we recommend using [turbo-sdk](https://github.com/ardriveapp/turbo-sdk). Turbo SDK provides efficient and reliable methods for creating and uploading data bundles to the Arweave network, which are fully compatible with ar.io gateways. Turbo supports fiat and crypto bundling and uploading with a focus on ease of use and reliability.

### Gateways

### Running a Gateway

To run your own ar.io gateway, you can refer to the following resources:

- [ar-io-node repository]: This repository contains the source code and instructions for setting up and running an ar.io gateway node.
- [ar.io Gateway Documentation]: This comprehensive guide provides detailed information on gateway setup, configuration, and management.

Running your own gateway allows you to participate in the ar.io network, serve Arweave data, and potentially earn rewards. Make sure to follow the official documentation for the most up-to-date and accurate information on gateway operation.

### AO

This library integrates with [AO], a decentralized compute platform built on Arweave. We utilize [AO Connect] to interact with AO processes and messages. This integration allows for seamless communication with the AO network, enabling developers to leverage decentralized computation and storage capabilities in their applications.

For more information on how to use AO and AO Connect within this library, please refer to our documentation and examples.

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

- `yarn test` - runs e2e tests and unit tests
- `yarn test:e2e` - runs e2e tests
- `yarn test:unit` - runs unit tests
- `yarn example:web` - opens up the example web page
- `yarn example:cjs` - runs example CJS node script
- `yarn example:esm` - runs example ESM node script
- `yarn example:vite` - runs example Vite web page

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
[permaweb/aoconnect]: https://github.com/permaweb/aoconnect
[package.json]: ./package.json
[examples]: ./examples
[examples/webpack]: ./examples/webpack
[examples/vite]: ./examples/vite
[CONTRIBUTING.md]: ./CONTRIBUTING.md
[AO Connect]: https://github.com/permaweb/ao/tree/main/connect
[IO Testnet Process]: https://www.ao.link/#/entity/agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA
[IO Network Spec]: https://github.com/ar-io/ar-io-network-process?tab=readme-ov-file#contract-spec
[Winston]: https://www.npmjs.com/package/winston
[AO]: https://github.com/permaweb/ao
[ar-io-node repository]: https://github.com/ar-io/ar-io-node
[ar.io Gateway Documentation]: https://docs.ar.io/gateways/ar-io-node/overview/
[ANS-104]: https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md
