# @ar.io/sdk

[![codecov](https://codecov.io/gh/ar-io/ar-io-sdk/graph/badge.svg?token=7dXKcT7dJy)](https://codecov.io/gh/ar-io/ar-io-sdk)

This is the home of [ar.io] SDK. This SDK provides functionality for interacting with the ar.io ecosystem of services (e.g. gateways and observers) and protocols (e.g. ArNS). It is available for both NodeJS and Web environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Web](#web)
  - [Node](#node)
  - [Typescript](#typescript)
- [ArIO Contract](#ario-contract)
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
    - [`getAuction({ domain, evaluationOptions })`](#getauction-domain-evaluationoptions-)
    - [`getAuctions({ evauluationOptions })`](#getauctions-evauluationoptions-)
    - [`joinNetwork(params)`](#joinnetworkparams)
    - [`updateGatewaySettings(gatewaySettings)`](#updategatewaysettingsgatewaysettings)
    - [`increaseDelegateStake({ target, qty })`](#increasedelegatestake-target-qty-)
    - [`decreaseDelegateStake({ target, qty })`](#decreasedelegatestake-target-qty-)
    - [`increaseOperatorStake({ qty })`](#increaseoperatorstake-qty-)
    - [`decreaseOperatorStake({ qty })`](#decreaseoperatorstake-qty-)
    - [`saveObservations({ reportTxId, failedGateways })`](#saveobservations-reporttxid-failedgateways-)
    - [`transfer({ target, qty, denomination })`](#transfer-target-qty-denomination-)
  - [Custom Contracts](#custom-contracts)
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
import { ArIO } from '@ar.io/sdk';

const arIO = ArIO.init();
const gateways = await arIO.getGateways();
```

<details>
  <summary>Output</summary>

```json
{
  "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ": {
    "end": 0,
    "observerWallet": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
    "operatorStake": 250000,
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
import { ArIO } from '@ar.io/sdk';

// set up client
const arIO = ArIO.init();
// fetch gateways
const gateways = await arIO.getGateways();
```

Note: polyfills are only provided when using the named `@ar.io/sdk/web` export (which requires `moduleResolution: nodenext` in `tsconfig.json`). If you are using the default export within a Typescript project (e.g. `moduleResolution: node`), you will need to provide your own polyfills - specifically `crypto`, and `fs`. An example React/Typescript application using default exports can be found at [examples/webpack] and [examples/vite]. For other project configurations, refer to your bundler's documentation for more information on how to provide the necessary polyfills.

#### Browser

```html
<script type="module">
  import { ArIO } from 'https://unpkg.com/@ar.io/sdk';

  // set up client
  const arIO = ArIO.init();
  // fetch gateways
  const gateways = await arIO.getGateways();
</script>
```

### Node

#### ESM (NodeNext)

```javascript
import { ArIO } from '@ar.io/sdk/node';

// set up client
const arIO = ArIO.init();
// fetch gateways
const gateways = await arIO.getGateways();
```

##### CJS

```javascript
import { ArIO } from '@ar.io/sdk';

// set up client
const arIO = ArIO.init();
// fetch gateways
const gateways = await arIO.getGateways();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized by package managers, offering benefits such as type-checking and autocompletion.

## ArIO Contract

### APIs

#### `init({ signer })`

Factory function to that creates a read-only or writeable client. By providing a `signer` additional write APIs that require signing, like `joinNetwork` and `delegateStake` are available. By default, a read-only client is returned and no write APIs are available.

```typescript
// read-only client that has access to all read APIs
const arIOReadable = ArIO.init()

const arweave = Arweave.init({
  host: 'ar-io.dev',
  port: 443,
  protocol: 'https'
})
const browserSigner = new ArConnectSigner(window.arweaveWallet, arweave);
const arIOWriteable = ArIO.init({ signer: browserSigner});

const nodeSigner = new ArweaveSigner(JWK);
// read and write client that has access to all APIs
const arIOWriteable = ArIO.init({ signer: nodeSigner});

```

### `getState({ evaluationOptions })`

Retrieves the current state of the ArIO contract.

```typescript
const arIO = ArIO.init();
const state = await arIO.getState();
```

<details>
  <summary>Output</summary>

```json
{
  "lastTickedHeight": 1415568, // current block height
  "evolve": "92MCDWn0LihmWXKVnOeMDEQxPbiV4Y3bRjnTet7J3eg",
  "auctions": {
    // auctions
  },
  "balances": {
    // balances
  },
  "distributions": {
    // epoch distribution info
  },
  "gateways": {
    // gateways
  },
  "observations": {
    // observations
  },
  "prescribedObservers": {
    // prescribedObservers
  },
  "records": {
    // records
  },
  "demandFactoring": {
    // demandFactoring
  },
  "vaults": {
    // vaults
  }
}
```

</details>

Alternatively, you can get the contract at a specific block height or sort key by providing `evaluationOptions`:

```typescript
const arIO = ArIO.init();
const state = await arIO.getState({
  evaluationOptions: {
    evalTo: { blockHeight: 1382230 }, // alternatively, use evalTo: { sortKey: 'SORT_KEY' }
  },
});
```

<details>
  <summary>Output</summary>

```json
{
  "lastTickedHeight": 1382230, // evaluated block height
  "evolve": "92MCDWn0LihmWXKVnOeMDEQxPbiV4Y3bRjnTet7J3eg",
  "auctions": {
    // auctions
  },
  "balances": {
    // balances
  },
  "distributions": {
    // epoch distribution info
  },
  "gateways": {
    // gateways
  },
  "observations": {
    // observations
  },
  "prescribedObservers": {
    // prescribedObservers
  },
  "records": {
    // records
  },
  "demandFactoring": {
    // demandFactoring
  },
  "vaults": {
    // vaults
  }
}
```

</details>

#### `getBalance({ address, evaluationOptions })`

Retrieves the balance of the specified wallet address.

```typescript
const arIO = ArIO.init();
const balance = await arIO.getBalance({
  address: 'INSERT_WALLET_ADDRESS',
});
```

<details>
  <summary>Output</summary>

```json
1000000
```

</details>

#### `getBalances({ evaluationOptions })`

Retrieves the balances of the ArIO contract.

<!--
// ALM - A part of me wonders whether streaming JSON might be beneficial in the future
// and if providing streaming versions of these APIs will scale nicely longer term, e.g.
// arIO.streamBalances({ sortingCriteria: BALANCE_DESC });
 -->

```typescript
const arIO = ArIO.init();
const balances = await arIO.getBalances();
```

<details>
  <summary>Output</summary>

```json
{
  "-4xgjroXENKYhTWqrBo57HQwvDL51mMvSxJy6Y2Z_sA": 5000,
  "-7vXsQZQDk8TMDlpiSLy3CnLi5PDPlAaN2DaynORpck": 5000,
  "-9JU3W8g9nOAB1OrJQ8FxkaWCpv5slBET2HppTItbmk": 5000
}
```

</details>

#### `getGateway({ address, evaluationOptions })`

Retrieves a gateway's info by its staking wallet address.

```typescript
const arIO = ArIO.init();
const gateway = await arIO.getGateway({
  address: 'INSERT_GATEWAY_ADDRESS',
});
```

<details>
  <summary>Output</summary>

```json
{
  "end": 0,
  "observerWallet": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
  "operatorStake": 250000,
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
```

</details>

#### `getGateways({ evaluationOptions })`

Retrieves the registered gateways of the ArIO contract.

```typescript
const arIO = ArIO.init();
const gateways = await arIO.getGateways();
```

<details>
  <summary>Output</summary>

```json
{
  "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ": {
    "end": 0,
    "observerWallet": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
    "operatorStake": 250000,
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

#### `getArNSRecord({ domain, evaluationOptions })`

Retrieves the record info of the specified ArNS name.

```typescript
const arIO = ArIO.init();
const record = await arIO.getArNSRecord({ domain: 'ardrive' });
```

<details>
  <summary>Output</summary>

```json
{
  "contractTxId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "endTimestamp": 1711122739,
  "startTimestamp": 1694101828,
  "type": "lease",
  "undernames": 100
}
```

</details>

#### `getArNSRecords({ evaluationOptions })`

Retrieves all registered ArNS records of the ArIO contract.

```typescript
const arIO = ArIO.init();
const records = await arIO.getArNSRecords();
```

<details>
  <summary>Output</summary>

```json
{
  "ardrive": {
    "contractTxId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
    "endTimestamp": 1711122739,
    "startTimestamp": 1694101828,
    "type": "lease",
    "undernames": 100
  },
  "ar-io": {
    "contractTxId": "eNey-H9RB9uCdoJUvPULb35qhZVXZcEXv8xds4aHhkQ",
    "purchasePrice": 17386.717520731843,
    "startTimestamp": 1706747215,
    "type": "permabuy",
    "undernames": 10
  }
}
```

</details>

#### `getObservations({ evaluationOptions })`

Returns the epoch-indexed observation list.

```typescript
const arIO = ArIO.init();
const observations = await arIO.getObservations();
```

<details>
  <summary>Output</summary>

```json
{
  "1350700": {
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

#### `getDistributions({ evaluationOptions })`

Returns the current rewards distribution information. The resulting object is pruned, to get older distributions use the `evaluationOptions` to `evalTo` a previous state.

```typescript
const arIO = ArIO.init();
const distributions = await arIO.getDistributions();
```

<details>
  <summary>Output</summary>

```json
{
  "epochEndHeight": 1382379,
  "epochPeriod": 43,
  "epochStartHeight": 1381660,
  "epochZeroStartHeight": 1350700,
  "nextDistributionHeight": 1382394
}
```

</details>

#### `getEpoch({ evaluationOptions })`

Returns the epoch data for the specified block height.

```typescript
const arIO = ArIO.init();
const epoch = await arIO.getEpoch({ blockHeight: 1382230 });
```

<details>
  <summary>Output</summary>

```json
{
  "epochStartHeight": 1381660,
  "epochEndHeight": 1382379,
  "epochZeroStartHeight": 1350700,
  "epochDistributionHeight": 1382394,
  "epochPeriod": 43,
  "epochBlockLength": 720
}
```

</details>

#### `getCurrentEpoch({ evaluationOptions })`

Returns the current epoch data.

```typescript
const arIO = ArIO.init();
const epoch = await arIO.getCurrentEpoch();
```

<details>
  <summary>Output</summary>

```json
{
  "epochEndHeight": 1382379,
  "epochPeriod": 43,
  "epochStartHeight": 1381660,
  "epochZeroStartHeight": 1350700,
  "nextDistributionHeight": 1382394
}
```

</details>

#### `getPrescribedObservers({ evaluationOptions })`

Retrieves the prescribed observers of the ArIO contract. To fetch prescribed observers for a previous epoch set the `evaluationOptions` to the desired epoch.

```typescript
const arIO = ArIO.init();
const observers = await arIO.getPrescribedObservers();
```

<details>
<summary>Output</summary>

```json
[
  {
    "gatewayAddress": "BpQlyhREz4lNGS-y3rSS1WxADfxPpAuing9Lgfdrj2U",
    "observerAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
    "stake": 10000,
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
 
Fetch the prescribed observers for a previous epoch by setting the `evaluationOptions` to the desired epoch.

```typescript
// observers from a previous epoch
const previousEpochObservers = await arIO.getPrescribedObservers({
  evaluationOptions: {
    evalTo: { blockHeight: 1296975 }, // some block height from a previous epoch
  },
});
```

<details>
  <summary>Output</summary>

```json
[
  {
    "gatewayAddress": "2Ic0ZIpt85tjiVRaD_qoTSo9jgT7w0rbf4puSTRidcU",
    "observerAddress": "2Ic0ZIpt85tjiVRaD_qoTSo9jgT7w0rbf4puSTRidcU",
    "stake": 10000,
    "start": 1292450,
    "stakeWeight": 1,
    "tenureWeight": 0.4494598765432099,
    "gatewayRewardRatioWeight": 1,
    "observerRewardRatioWeight": 1,
    "compositeWeight": 0.4494598765432099,
    "normalizedCompositeWeight": 0.002057032496835938
  }
]
```

</details>

#### `getAuction({ domain, evaluationOptions })`

Return the auction info for the supplied domain, be it in auction, registered, or available to auction.

```typescript
const auction = await arIO.getAuction({ domain });
```

<details>
  <summary>Output</summary>

```json
{
  "name": "ardrive",
  "initiator": "",
  "contractTxId": "",
  "startPrice": 89950,
  "floorPrice": 1799,
  "startHeight": 1384196,
  "endHeight": 1394276,
  "type": "lease",
  "years": 1,
  "isActive": false,
  "isAvailableForAuction": false,
  "isRequiredToBeAuctioned": false,
  "currentPrice": 1799,
  "prices": {
    "1384196": 89950,
    "1384226": 88930,
    "1384256": 87922,
    "1394286": 1921,
    "1394306": 1899,
    "1394336": 1877
  }
}
```

</details>

#### `getAuctions({ evauluationOptions })`

Retrieves all active auctions.

```typescript
const auctions = await arIO.getAuctions({ evaluationOptions });
```

<details>
  <summary>Output</summary>

```json
{
  "cyprien": {
    "contractTxId": "Fmhdc4f1rWK6Zn1W__7GNvWvo4d1FSze7rLK5AOnO5E",
    "endHeight": 1386879,
    "floorPrice": 4758777913,
    "initiator": "UPJHTNsaKcC6baqLFHMAMI7daWPIG3NDDfFQ2s2h8T0",
    "startHeight": 1376799,
    "startPrice": 237938895627,
    "type": "permabuy"
  },
  "saktinaga": {
    "contractTxId": "nl8heYyDxKowujaDqbsPkjALzULYG8T0z3J91CdWDIM",
    "endHeight": 1386834,
    "floorPrice": 2379388956,
    "initiator": "TE0zVR32RF5qFAO8K50-pEivZpM_s35HK-dex-5d-IU",
    "startHeight": 1376754,
    "startPrice": 118969447813,
    "type": "permabuy"
  }
}
```

</details>

#### `joinNetwork(params)`

Joins a gateway to the ar.io network via its associated wallet. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const jointNetworkParams = {
  qty: 10_000, // minimum operator stake allowed
  autoStake: true, // auto-stake operator rewards to the gateway
  allowDelegatedStaking: true, // allows delegated staking
  minDelegatedStake: 100, // minimum delegated stake allowed (in mIO)
  delegateRewardShareRatio: 10, // percentage of rewards to share with delegates (e.g. 10%)
  label: 'john smith', // min 1, max 64 characters
  note: 'The example gateway', // max 256 characters
  properties: 'FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44', // Arweave transaction ID containing additional properties of the Gateway
  observerWallet: '0VE0wIhDy90WiQoV3U2PeY44FH1aVetOoulPGqgYukj', // wallet address of the observer, must match OBSERVER_WALLET on the observer
  fqdn: 'example.com', // fully qualified domain name - note: you must own the domain and set the OBSERVER_WALLET on your gateway to match `observerWallet`
  port: 443, // port number
  protocol: 'https', // only 'https' is supported
};
const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.joinNetwork(joinNetworkParams);
```

#### `updateGatewaySettings(gatewaySettings)`

Writes new gateway settings to the callers gateway configuration. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const updateGatewaySettingsParams = {
  minDelegatedStake: 100,
};

const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.updateGatewaySettings(
  updateGatewaySettingsParams,
);
```

#### `increaseDelegateStake({ target, qty })`

Increases the callers stake on the target gateway. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const params = {
  target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  qty: 100,
};

const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.increaseDelegateStake(params);
```

#### `decreaseDelegateStake({ target, qty })`

Decreases the callers stake on the target gateway. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const params = {
  target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  qty: 100,
};

const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.decreaseDelegateStake(params);
```

#### `increaseOperatorStake({ qty })`

Increases the callers operator stake. Must be executed with a wallet registered as a gateway operator. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const params = {
  qty: 100,
};

const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.increaseOperatorStake(params);
```

#### `decreaseOperatorStake({ qty })`

Decreases the callers operator stake. Must be executed with a wallet registered as a gateway operator. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const params = {
  qty: 100,
};

const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.decreaseOperatorStake(params);
```

#### `saveObservations({ reportTxId, failedGateways })`

Saves the observations of the current epoch. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
const params = {
  reportTxId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  failedGateways: ['t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3'],
};

const signer = new ArweaveSigner(jwk);
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const { id: txId } = await authenticatedArIO.saveObservations(params);
```

#### `transfer({ target, qty, denomination })`

Transfers `IO` or `mIO` depending on the `denomination` selected, defaulting as `IO`, to the designated `target` recipient address. Requires `signer` to be provided on `ArIO.init` to sign the transaction.

```typescript
// signer required for write interactions APIs
const authenticatedArIO = ArIO.init({ signer });
const decreaseOperatorStakeTx = await authenticatedArIO.transfer({
  target: '-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5',
  qty: 1000,
});
```

### Custom Contracts

The ArIO contract client class exposes APIs relevant to the ar.io contract. It can be configured to use any contract ID that adheres to the spec of the ar.io contract. In the default case, it will automatically build and utilize a contract data provider interface that is configured to point the the known mainnet contract ID at construction time. You can provide custom contract data provider or, alternatively, a `contractTxId` to the ArIO constructor to use a different, ar.io-spec-compatible contract.

```typescript
// provide a custom contractTxId to the client and default to remote evaluation
const remoteCustomArIO = ArIO.init({
  contractTxId: 'TESTNET_CONTRACT_TX_ID',
});

// provide a custom contract to the client, and specify local evaluation using warp
const localCustomArIO = ArIO.init({
  contract: new WarpContract<ArIOState>({
    contractTxId: 'TESTNET_CONTRACT_TX_ID',
  }),
});

// provide a custom contract to the client, and specify local evaluation using remote cache
const remoteCacheCustomArIO = ArIO.init({
  contract: new RemoteContract<ArIOState>({
    contractTxId: 'TESTNET_CONTRACT_TX_ID',
  }),
});
```

## Arweave Name Tokens (ANT's)

The ANT contract client class exposes APIs relevant to compliant Arweave Name Token contracts. It can be configured to use any contract ID that adheres to the ANT contract spec. You must provide either a custom contract data provider or a contractTxId to the ANT class constructor to use.

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
  contractTxId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
});

// in a node environment
const nodeSigner = new ArweaveSigner(JWK);
const ant = ANT.init({
  signer: nodeSigner,
  contractTxId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM'
});

```

### `getState({ evaluationOptions })`

Retrieves the current state of the ANT contract.

```typescript
const ant = ANT.init({
  contractTxId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM',
});
const state = await ant.getState();
```

<details>
  <summary>Output</summary>

```json
{
  "balances": {
    "ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4": 1
  },
  "controller": "6Z-ifqgVi1jOwMvSNwKWs6ewUEQ0gU9eo4aHYC3rN1M",
  "evolve": null,
  "name": "ArDrive.io",
  "owner": "ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4",
  "records": {
    "@": {
      "transactionId": "nOXJjj_vk0Dc1yCgdWD8kti_1iHruGzLQLNNBHVpN0Y",
      "ttlSeconds": 3600
    },
    "cn": {
      "transactionId": "_HquerT6pfGFXrVxRxQTkJ7PV5RciZCqvMjLtUY0C1k",
      "ttlSeconds": 3300
    },
    "dapp": {
      "transactionId": "hxlxVgAG0K4o3fVD9T6Q4VBWpPmMZwMWgRh1kcuh3WU",
      "ttlSeconds": 3600
    },
    "logo": {
      "transactionId": "KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A",
      "ttlSeconds": 3600
    },
    "og": {
      "transactionId": "YzD_Pm5VAfYpMD3zQCgMUcKKuleGhEH7axlrnrDCKBo",
      "ttlSeconds": 3600
    },
    "og_dapp": {
      "transactionId": "5iR4wBu4KUV1pUz1YpYE1ARXSRHUT5G2ptMuoN2JDlI",
      "ttlSeconds": 3600
    },
    "og_logo": {
      "transactionId": "TB2wJyKrPnkAW79DAwlJYwpgdHKpijEJWQfcwX715Co",
      "ttlSeconds": 3600
    }
  }
}
```

</details>

Alternatively, you can get the contract at a specific block height or sort key by providing `evaluationOptions`:

```typescript
const ant = ANT.init({
  contractTxId: 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM',
});
const state = await ant.getState({
  evaluationOptions: {
    evalTo: { blockHeight: 1382230 },
  },
});
```

<details>
  <summary>Output</summary>

```json
{
  "balances": {
    "ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4": 1
  },
  "controller": "6Z-ifqgVi1jOwMvSNwKWs6ewUEQ0gU9eo4aHYC3rN1M",
  "evolve": null,
  "name": "ArDrive.io",
  "owner": "ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4",
  "records": {
    "@": {
      "transactionId": "nOXJjj_vk0Dc1yCgdWD8kti_1iHruGzLQLNNBHVpN0Y",
      "ttlSeconds": 3600
    },
    "cn": {
      "transactionId": "_HquerT6pfGFXrVxRxQTkJ7PV5RciZCqvMjLtUY0C1k",
      "ttlSeconds": 3300
    },
    "dapp": {
      "transactionId": "hxlxVgAG0K4o3fVD9T6Q4VBWpPmMZwMWgRh1kcuh3WU",
      "ttlSeconds": 3600
    },
    "logo": {
      "transactionId": "KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A",
      "ttlSeconds": 3600
    },
    "og": {
      "transactionId": "YzD_Pm5VAfYpMD3zQCgMUcKKuleGhEH7axlrnrDCKBo",
      "ttlSeconds": 3600
    },
    "og_dapp": {
      "transactionId": "5iR4wBu4KUV1pUz1YpYE1ARXSRHUT5G2ptMuoN2JDlI",
      "ttlSeconds": 3600
    },
    "og_logo": {
      "transactionId": "TB2wJyKrPnkAW79DAwlJYwpgdHKpijEJWQfcwX715Co",
      "ttlSeconds": 3600
    }
  }
}
```

</details>

#### `getOwner({ evaluationOptions })`

Returns the owner of the configured ANT contract.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const owner = await ant.getOwner();
```

<details>
  <summary>Output</summary>

```json
"ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4"
```

</details>

#### `getControllers({ evaluationOptions })`

Returns the controllers of the configured ANT contract.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const controllers = await ant.getControllers();
```

<details>
  <summary>Output</summary>

```json
["ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4"]
```

</details>

#### `getRecords({ evaluationOptions })`

Returns all records on the configured ANT contract, including the required `@` record that resolve connected ArNS names.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const records = await ant.getRecords();
```

<details>
  <summary>Output</summary>

```json
{
  "@": {
    "transactionId": "nOXJjj_vk0Dc1yCgdWD8kti_1iHruGzLQLNNBHVpN0Y",
    "ttlSeconds": 3600
  },
  "cn": {
    "transactionId": "_HquerT6pfGFXrVxRxQTkJ7PV5RciZCqvMjLtUY0C1k",
    "ttlSeconds": 3300
  },
  "dapp": {
    "transactionId": "hxlxVgAG0K4o3fVD9T6Q4VBWpPmMZwMWgRh1kcuh3WU",
    "ttlSeconds": 3600
  },
  "logo": {
    "transactionId": "KKmRbIfrc7wiLcG0zvY1etlO0NBx1926dSCksxCIN3A",
    "ttlSeconds": 3600
  },
  "og": {
    "transactionId": "YzD_Pm5VAfYpMD3zQCgMUcKKuleGhEH7axlrnrDCKBo",
    "ttlSeconds": 3600
  },
  "og_dapp": {
    "transactionId": "5iR4wBu4KUV1pUz1YpYE1ARXSRHUT5G2ptMuoN2JDlI",
    "ttlSeconds": 3600
  },
  "og_logo": {
    "transactionId": "TB2wJyKrPnkAW79DAwlJYwpgdHKpijEJWQfcwX715Co",
    "ttlSeconds": 3600
  }
}
```

</details>

#### `transfer({ target })`

Transfers ownership of the ANT to a new target address. Target MUST be an Arweave address.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const recipient = 'aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f';
const { id: txId } = await ant.transfer({ target: recipient });
```

#### `setController({ controller })`

Adds a new controller to the list of approved controllers on the ANT. Controllers can set records and change the ticker and name of the ANT contract.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const controller = 'aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f';
const { id: txId } = await ant.setController({ controller });
```

#### `removeController({ controller })`

Removes a controller from the list of approved controllers on the ANT.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const controller = 'aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f';
const { id: txId } = await ant.removeController({ controller });
```

#### `setRecord({ subDomain, transactionId, ttlSeconds })`

Updates or creates a record in the ANT contract.

> Records, or `undernames` are configured with the `transactionId` - the arweave transaction id the record resolves - and `ttlSeconds`, the Time To Live in the cache of client applications.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const subDomain = 'test-domain';
const transactionId = '432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ttlSeconds = 900;
const { id: txId } = await ant.setRecord({
  subDomain,
  transactionId,
  ttlSeconds,
});
```

#### `removeRecord({ subDomain })`

Removes a record from the ANT contract.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const subDomain = 'test-domain';
const { id: txId } = await ant.removeRecord({ subDomain });
```

#### `setName({ name })`

Sets the name of the ANT contract.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const name = 'chumbawumba';
const { id: txId } = await ant.setName({ name });
```

#### `setTicker({ ticker })`

Sets the ticker of the ANT contract.

```typescript
const contractTxId = 'bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM';
const ant = ANT.init({ contractTxId });
const ticker = 'ANT-WUMBA';
const { id: txId } = await ant.setTicker({ ticker });
```

### Configuration

ANT clients can be configured to use custom contract evaluator. By default they will use the remote evaluator that leverages the [arns-service].

```typescript
// provide a contractTxId to the client and default to remote evaluation
const remoteANT = ANT.init({
  contractTxId: 'ANT_CONTRACT_TX_ID',
});

// provide a custom contract to the client, and specify local evaluation using warp
const warpEvaluatedANT = ANT.init({
  contract: new WarpContract<ANTState>({
    contractTxId: 'ANT_CONTRACT_TX_ID',
  }),
  signer, // signer is required when created warp-contract instances
});

// provide a custom contract to the client, and specify local evaluation using remote cache
const remoteANTContract = ANT.init({
  contract: new RemoteContract<ANTState>({
    contractTxId: 'ANT_CONTRACT_TX_ID',
    // the remote api that returns warp compliant contract evaluation
    url: 'https://api.arns.app/v1/contract',
  }),
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

- `yarn test:integration` - runs integration tests against a local [arns-service]
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
[arns-service]: https://github.com/ar-io/arns-service
[CONTRIBUTING.md]: ./CONTRIBUTING.md
