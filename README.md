# @ar.io/sdk

[![codecov](https://codecov.io/gh/ar-io/ar-io-sdk/graph/badge.svg?token=7dXKcT7dJy)](https://codecov.io/gh/ar-io/ar-io-sdk)

This is the home of [ar.io] SDK. This SDK provides functionality for interacting with the ar.io ecosystem of services (e.g. gateways and observers) and protocols (e.g. ArNS and AO). It is available for both NodeJS and Web environments.

## Table of Contents

<!-- toc -->

- [Table of Contents](#table-of-contents)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Networks (Mainnet, Testnet, etc.)](#networks-mainnet-testnet-etc)
- [ARIO](#ario)
- [Arweave Name Tokens (ANT's)](#arweave-name-tokens-ants)
- [Token Conversion](#token-conversion)
- [Logging](#logging)
- [Pagination](#pagination)
- [Resources](#resources)
- [Developers](#developers)

<!-- tocstop -->

## Installation

Requires `node>=v18.0.0`

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
import { ARIO } from '@ar.io/sdk';

const ario = ARIO.mainnet(); // defaults to mainnet
const gateways = await ario.getGateways();
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
        "gatewayPerformanceRatio": 1,
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

> [!WARNING]
> Polyfills are not provided by default for bundled web projects (Vite, ESBuild, Webpack, Rollup, etc.) . Depending on your apps bundler configuration and plugins, you will need to provide polyfills for various imports including `crypto`, `process` and `buffer`. Refer to [examples/webpack] and [examples/vite] for examples. For other project configurations, refer to your bundler's documentation for more information on how to provide the necessary polyfills.

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { ARIO } from '@ar.io/sdk/web';

// set up client
const ario = ARIO.mainnet();
// fetch gateways
const gateways = await ario.getGateways();
```

#### Browser

```html
<script type="module">
  // replace <@version> with a pinned version (e.g. @3.8.4) or @latest, if you're risky :)
  import { ARIO } from 'https://unpkg.com/@ar.io/sdk<@version>';

  // set up client
  const ario = ARIO.mainnet();
  // fetch gateways
  const gateways = await ario.getGateways();
</script>
```

### Node

#### ESM (NodeNext)

```javascript
import { ARIO } from '@ar.io/sdk/node';

// set up client
const ario = ARIO.mainnet();
// fetch gateways
const gateways = await ario.getGateways();
```

#### CJS

```javascript
import { ARIO } from '@ar.io/sdk';

// set up client
const ario = ARIO.mainnet();
// fetch gateways
const gateways = await ario.getGateways();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized by package managers, offering benefits such as type-checking and autocompletion.

> [!NOTE]
> Typescript version 5.3 or higher is recommended.

## Networks (Mainnet, Testnet, etc.)

The SDK provides the following process IDs for the mainnet and testnet environments:

- `ARIO_MAINNET_PROCESS_ID` - Mainnet ARIO process ID (production)
- `ARIO_TESTNET_PROCESS_ID` - Testnet ARIO process ID (testing and development)
- `ARIO_DEVNET_PROCESS_ID` - Devnet ARIO process ID (development)

As of `v3.8.1` the SDK defaults all API interactions to **mainnet**. To use the **testnet** or **devnet** provide the appropriate `ARIO_TESTNET_PROCESS_ID` or `ARIO_DEVNET_PROCESS_ID` when initializing the client.

### Mainnet

As of `v3.8.1` the SDK defaults all API interactions to **mainnet**. To use the **testnet** or **devnet** provide the appropriate `ARIO_TESTNET_PROCESS_ID` or `ARIO_DEVNET_PROCESS_ID` when initializing the client.

```typescript
import { ARIO } from '@ar.io/sdk';

const ario = ARIO.mainnet(); // or ARIO.init()
```

### Testnet

```typescript
import { ARIO } from '@ar.io/sdk';

const testnet = ARIO.testnet(); // or ARIO.mainnet({ processId: ARIO_TESTNET_PROCESS_ID })
```

#### Faucet

The SDK provides APIs for claiming tokens via a faucet on the AR.IO Testnet process (`tARIO`) via the [ar-io-testnet-faucet] service. All token requests require a captcha to be solved, and the faucet is rate limited to prevent abuse.

To claim testnet tokens from the testnet token faucet, you can use one of the following methods:

1. Visit [faucet.ar.io](https://faucet.ar.io) - the easiest way to quickly get tokens for testing for a single address.

2. Programmatically via the SDK - useful if you need to claim tokens for multiple addresses or dynamically within your application.

   - `ARIO.testnet().faucet.captchaUrl()` - returns the captcha URL for the testnet faucet. Open this URL in a new browser window and listen for the `ario-jwt-success` event to be emitted.
   - `ARIO.testnet().faucet.claimWithAuthToken({ authToken, recipient, quantity })` - claims tokens for the specified recipient address using the provided auth token.
   - `ARIO.testnet().faucet.verifyAuthToken({ authToken })` - verifies if the provided auth token is still valid.

<details>
  <summary><i>Example client-side code for claiming tokens</i></summary>

```typescript
import { ARIO } from '@ar.io/sdk';

const testnet = ARIO.testnet();
const captchaUrl = await ario.faucet.captchaUrl();

// open the captcha URL in the browser, and listen for the auth token event
const captchaWindow = window.open(
  captchaUrl.captchaUrl,
  '_blank',
  'width=600,height=600',
);
/**
 * The captcha URL includes a window.parent.postMessage event that is used to send the auth token to the parent window.
 * You can store the auth token in localStorage and use it to claim tokens for the duration of the auth token's expiration (default 1 hour).
 */
window.parent.addEventListener('message', async (event) => {
  if (event.data.type === 'ario-jwt-success') {
    localStorage.setItem('ario-jwt', event.data.token);
    localStorage.setItem('ario-jwt-expires-at', event.data.expiresAt);
    // close our captcha window
    captchaWindow?.close();
    // claim the tokens using the JWT token
    const res = await testnet.faucet
      .claimWithAuthToken({
        authToken: event.data.token,
        recipient: await window.arweaveWallet.getActiveAddress(),
        quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
      })
      .then((res) => {
        alert(
          'Successfully claimed 100 ARIO tokens! Transaction ID: ' + res.id,
        );
      })
      .catch((err) => {
        alert(`Failed to claim tokens: ${err}`);
      });
  }
});

/**
 * Once you have a valid JWT, you can check if it is still valid and use it for subsequent requests without having to open the captcha again.
 */
if (
  localStorage.getItem('ario-jwt-expires-at') &&
  Date.now() < parseInt(localStorage.getItem('ario-jwt-expires-at') ?? '0')
) {
  const res = await testnet.faucet.claimWithAuthToken({
    authToken: localStorage.getItem('ario-jwt') ?? '',
    recipient: await window.arweaveWallet.getActiveAddress(),
    quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
  });
}
```

</details>

## ARIO

### General

#### `init({ signer })`

Factory function to that creates a read-only or writeable client. By providing a `signer` additional write APIs that require signing, like `joinNetwork` and `delegateStake` are available. By default, a read-only client is returned and no write APIs are available.

```typescript
// read-only client
const ario = ARIO.mainnet();

// read-write client for browser environments
const ario = ARIO.mainnet({ signer: new ArConnectSigner(window.arweaveWallet, Arweave.init({}))});

// read-write client for node environments
const ario = ARIO.mainnet({ signer: new ArweaveSigner(JWK) });

```

#### `getInfo()`

Retrieves the information of the ARIO process.

```typescript
const ario = ARIO.mainnet();
const info = await ario.getInfo();
```

<details>
  <summary>Output</summary>

```json
{
  "Name": "Testnet ARIO",
  "Ticker": "tARIO",
  "Owner": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
  "Denomination": 6,
  "Handlers": ["_eval", "_default_"], // full list of handlers, useful for debugging
  "LastCreatedEpochIndex": 31, // epoch index of the last tick
  "LastDistributedEpochIndex": 31 // epoch index of the last distribution
}
```

</details>

#### `getTokenSupply()`

Retrieves the total supply of tokens, returned in mARIO. The total supply includes the following:

- `total` - the total supply of all tokens
- `circulating` - the total supply minus locked, withdrawn, delegated, and staked
- `locked` - tokens that are locked in the protocol (a.k.a. vaulted)
- `withdrawn` - tokens that have been withdrawn from the protocol by operators and delegators
- `delegated` - tokens that have been delegated to gateways
- `staked` - tokens that are staked in the protocol by gateway operators
- `protocolBalance` - tokens that are held in the protocol's treasury. This is included in the circulating supply.

```typescript
const ario = ARIO.mainnet();
const supply = await ario.getTokenSupply();
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
const ario = ARIO.mainnet();
// the balance will be returned in mARIO as a value
const balance = await ario
  .getBalance({
    address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
  })
  .then((balance: number) => new mARIOToken(balance).toARIO()); // convert it to ARIO for readability
```

<details>
  <summary>Output</summary>

```json
100000
```

</details>

#### `getBalances({ cursor, limit, sortBy, sortOrder })`

Retrieves the balances of the ARIO process in `mARIO`, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last wallet address from the previous request.

```typescript
const ario = ARIO.mainnet();
const balances = await ario.getBalances({
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

#### `transfer({ target, qty })`

Transfers `mARIO` to the designated `target` recipient address. Requires `signer` to be provided on `ARIO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({
  signer: new ArweaveSigner(jwk),
});
const { id: txId } = await ario.transfer(
  {
    target: '-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5',
    qty: new ARIOToken(1000).toMARIO(),
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

### Vaults

#### `getVault({ address, vaultId })`

Retrieves the locked-balance user vault of the ARIO process by the specified wallet address and vault ID.

```typescript
const ario = ARIO.mainnet();
const vault = await ario.getVault({
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

Retrieves all locked-balance user vaults of the ARIO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last wallet address from the previous request.

```typescript
const ario = ARIO.mainnet();
const vaults = await ario.getVaults({
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

#### `vaultedTransfer({ recipient, quantity, lockLengthMs, revokable })`

Transfers `mARIO` to the designated `recipient` address and locks the balance for the specified `lockLengthMs` milliseconds. The `revokable` flag determines if the vaulted transfer can be revoked by the sender.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.vaultedTransfer(
  {
    recipient: '-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5',
    quantity: new ARIOToken(1000).toMARIO(),
    lockLengthMs: 1000 * 60 * 60 * 24 * 365, // 1 year
    revokable: true,
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `revokeVault({ recipient, vaultId })`

Revokes a vaulted transfer by the recipient address and vault ID. Only the sender of the vaulted transfer can revoke it.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.revokeVault({
  recipient: '-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5',
  vaultId: 'IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs',
});
```

#### `createVault({ lockLengthMs, quantity })`

Creates a vault for the specified `quantity` of mARIO from the signer's balance and locks it for the specified `lockLengthMs` milliseconds.

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });

const { id: txId } = await ario.createVault({
  lockLengthMs: 1000 * 60 * 60 * 24 * 365, // 1 year
  quantity: new ARIOToken(1000).toMARIO(),
});
```

#### `extendVault({ vaultId, extendLengthMs })`

Extends the lock length of a signer's vault by the specified `extendLengthMs` milliseconds.

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });

const { id: txId } = await ario.extendVault({
  vaultId: 'vaultIdOne',
  extendLengthMs: 1000 * 60 * 60 * 24 * 365, // 1 year
});
```

#### `increaseVault({ vaultId, quantity })`

Increases the balance of a signer's vault by the specified `quantity` of mARIO.

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.increaseVault({
  vaultId: 'vaultIdOne',
  quantity: new ARIOToken(1000).toMARIO(),
});
```

### Gateways

#### `getGateway({ address })`

Retrieves a gateway's info by its staking wallet address.

```typescript
const ario = ARIO.mainnet();
const gateway = await ario.getGateway({
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
    "gatewayPerformanceRatio": 1,
    "tenureWeight": 0.19444444444444,
    "observerRewardRatioWeight": 1,
    "normalizedCompositeWeight": 0.19247316211083,
    "stakeWeight": 5.02400000024
  }
}
```

</details>

#### `getGateways({ cursor, limit, sortBy, sortOrder })`

Retrieves registered gateways of the ARIO process, using pagination and sorting by the specified criteria. The `cursor` used for pagination is the last gateway address from the previous request.

```typescript
const ario = ARIO.mainnet();
const gateways = await ario.getGateways({
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
        "gatewayPerformanceRatio": 1,
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

#### `getGatewayDelegates({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all delegates for a specific gateway, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last delegate address from the previous request.

```typescript
const ario = ARIO.mainnet();
const delegates = await ario.getGatewayDelegates({
  address: 'QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ',
  limit: 3,
  sortBy: 'startTimestamp',
  sortOrder: 'desc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "nextCursor": "ScEtph9-vfY7lgqlUWwUwOmm99ySeZGQhOX0MFAyFEs",
  "limit": 3,
  "sortBy": "startTimestamp",
  "totalItems": 32,
  "sortOrder": "desc",
  "hasMore": true,
  "items": [
    {
      "delegatedStake": 600000000,
      "address": "qD5VLaMYyIHlT6vH59TgYIs6g3EFlVjlPqljo6kqVxk",
      "startTimestamp": 1732716956301
    },
    {
      "delegatedStake": 508999038,
      "address": "KG8TlcWk-8pvroCjiLD2J5zkG9rqC6yYaBuZNqHEyY4",
      "startTimestamp": 1731828123742
    },
    {
      "delegatedStake": 510926479,
      "address": "ScEtph9-vfY7lgqlUWwUwOmm99ySeZGQhOX0MFAyFEs",
      "startTimestamp": 1731689356040
    }
  ]
}
```

</details>

#### `joinNetwork(params)`

Joins a gateway to the ar.io network via its associated wallet.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.joinNetwork(
  {
    qty: new ARIOToken(10_000).toMARIO(), // minimum operator stake allowed
    autoStake: true, // auto-stake operator rewards to the gateway
    allowDelegatedStaking: true, // allows delegated staking
    minDelegatedStake: new ARIOToken(100).toMARIO(), // minimum delegated stake allowed
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

Sets the gateway as `leaving` on the ar.io network. Requires `signer` to be provided on `ARIO.init` to sign the transaction. The gateways operator and delegate stakes are vaulted and will be returned after leave periods. The gateway will be removed from the network after the leave period.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });

const { id: txId } = await ario.leaveNetwork(
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `updateGatewaySettings({ ...settings })`

Writes new gateway settings to the callers gateway configuration.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.updateGatewaySettings(
  {
    // any other settings you want to update
    minDelegatedStake: new ARIOToken(100).toMARIO(),
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `increaseDelegateStake({ target, qty })`

Increases the callers stake on the target gateway.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.increaseDelegateStake(
  {
    target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
    qty: new ARIOToken(100).toMARIO(),
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `decreaseDelegateStake({ target, qty, instant })`

Decreases the callers stake on the target gateway. Can instantly decrease stake by setting instant to `true`.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.decreaseDelegateStake(
  {
    target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
    qty: new ARIOToken(100).toMARIO(),
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

Pay the early withdrawal fee and withdraw instantly.

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.decreaseDelegateStake({
  target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  qty: new ARIOToken(100).toMARIO(),
  instant: true, // Immediately withdraw this stake and pay the instant withdrawal fee
});
```

#### `getDelegations({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all active and vaulted stakes across all gateways for a specific address, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last delegationId (concatenated gateway and startTimestamp of the delgation) from the previous request.

```typescript
const ario = ARIO.mainnet();
const vaults = await ario.getDelegations({
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

#### `instantWithdrawal({ gatewayAddress, vaultId })`

Instantly withdraws an existing vault on a gateway. If no `gatewayAddress` is provided, the signer's address will be used.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
// removes a delegated vault from a gateway
const { id: txId } = await ario.instantWithdrawal(
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
const { id: txId } = await ario.instantWithdrawal(
  {
    vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  },
);
```

#### `cancelWithdrawal({ gatewayAddress, vaultId })`

Cancels an existing vault on a gateway. The vaulted stake will be returned to the callers stake. If no `gatewayAddress` is provided, the signer's address will be used.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
// cancels a delegated vault from a gateway
const { id: txId } = await ario.cancelWithdrawal(
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
const { id: txId } = await ario.cancelWithdrawal(
  {
    // operator vault id to cancel
    vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
  },
);
```

#### `getAllowedDelegates({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all allowed delegates for a specific address. The `cursor` used for pagination is the last address from the previous request.

```typescript
const ario = ARIO.mainnet();
const allowedDelegates = await ario.getAllowedDelegates({
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
const ario = ARIO.mainnet();
const vaults = await ario.getGatewayVaults({
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

#### `getAllGatewayVaults({ cursor, limit, sortBy, sortOrder })`

Retrieves all vaults across all gateways, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last vaultId from the previous request.

```typescript
const ario = ARIO.mainnet();
const vaults = await ario.getAllGatewayVaults({
  limit: 1,
  sortBy: 'endTimestamp',
  sortOrder: 'desc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "desc",
  "hasMore": true,
  "totalItems": 95,
  "limit": 1,
  "sortBy": "endTimestamp",
  "items": [
    {
      "cursorId": "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM_E-QVU3dta36Wia2uQw6tQLjQk7Qw5uN0Z6fUzsoqzUc",
      "gatewayAddress": "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM",
      "startTimestamp": 1728067635857,
      "balance": 50000000000,
      "vaultId": "E-QVU3dta36Wia2uQw6tQLjQk7Qw5uN0Z6fUzsoqzUc",
      "endTimestamp": 1735843635857
    }
  ],
  "nextCursor": "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM_E-QVU3dta36Wia2uQw6tQLjQk7Qw5uN0Z6fUzsoqzUc"
}
```

</details>

#### `increaseOperatorStake({ qty })`

Increases the callers operator stake. Must be executed with a wallet registered as a gateway operator.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.increaseOperatorStake(
  {
    qty: new ARIOToken(100).toMARIO(),
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

#### `decreaseOperatorStake({ qty })`

Decreases the callers operator stake. Must be executed with a wallet registered as a gateway operator. Requires `signer` to be provided on `ARIO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.decreaseOperatorStake(
  {
    qty: new ARIOToken(100).toMARIO(),
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

#### `redelegateStake({ target, source, stakeQty, vaultId })`

Redelegates the stake of a specific address to a new gateway. Vault ID may be optionally included in order to redelegate from an existing withdrawal vault. The redelegation fee is calculated based on the fee rate and the stake amount. Users are allowed one free redelegation every seven epochs. Each additional redelegation beyond the free redelegation will increase the fee by 10%, capping at a 60% redelegation fee.

e.g: If 1000 mARIO is redelegated and the fee rate is 10%, the fee will be 100 mARIO. Resulting in 900 mARIO being redelegated to the new gateway and 100 mARIO being deducted back to the protocol balance.

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });

const { id: txId } = await ario.redelegateStake({
  target: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  source: 'HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA',
  stakeQty: new ARIOToken(1000).toMARIO(),
  vaultId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
});
```

#### `getRedelegationFee({ address })`

Retrieves the fee rate as percentage required to redelegate the stake of a specific address. Fee rate ranges from 0% to 60% based on the number of redelegations since the last fee reset.

```typescript
const ario = ARIO.mainnet();

const fee = await ario.getRedelegationFee({
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

#### `getAllDelegates({ cursor, limit, sortBy, sortOrder })`

Retrieves all delegates across all gateways, paginated and sorted by the specified criteria. The `cursor` used for pagination is a `cursorId` derived from delegate address and the gatewayAddress from the previous request. e.g `address_gatewayAddress`.

```typescript
const ario = ARIO.mainnet();
const delegates = await ario.getAllDelegates({
  limit: 2,
  sortBy: 'startTimestamp',
  sortOrder: 'desc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "desc",
  "hasMore": true,
  "totalItems": 95,
  "limit": 2,
  "sortBy": "startTimestamp",
  "items": [
    {
      "startTimestamp": 1734709397622,
      "cursorId": "9jfM0uzGNc9Mkhjo1ixGoqM7ygSem9wx_EokiVgi0Bs_E-QVU3dta36Wia2uQw6tQLjQk7Qw5uN0Z6fUzsoqzUc",
      "gatewayAddress": "E-QVU3dta36Wia2uQw6tQLjQk7Qw5uN0Z6fUzsoqzUc",
      "address": "9jfM0uzGNc9Mkhjo1ixGoqM7ygSem9wx_EokiVgi0Bs",
      "delegatedStake": 2521349108,
      "vaultedStake": 0
    },
    {
      "startTimestamp": 1734593229454,
      "cursorId": "LtV0aSqgK3YI7c5FmfvZd-wG95TJ9sezj_a4syaLMS8_M0WP8KSzCvKpzC-HPF1WcddLgGaL9J4DGi76iMnhrN4",
      "gatewayAddress": "M0WP8KSzCvKpzC-HPF1WcddLgGaL9J4DGi76iMnhrN4",
      "address": "LtV0aSqgK3YI7c5FmfvZd-wG95TJ9sezj_a4syaLMS8",
      "delegatedStake": 1685148110,
      "vaultedStake": 10000000
    }
  ],
  "nextCursor": "PZ5vIhHf8VY969TxBPQN-rYY9CNFP9ggNsMBqlWUzWM_QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ"
}
```

</details>

### Arweave Name System (ArNS)

#### `resolveArNSName({ name })`

Resolves an ArNS name to the underlying data id stored on the names corresponding ANT id.

##### Resolving a base name

```typescript
const ario = ARIO.mainnet();
const record = await ario.resolveArNSName({ name: 'ardrive' });
```

<details>
  <summary>Output</summary>

```json
{
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "txId": "kvhEUsIY5bXe0Wu2-YUFz20O078uYFzmQIO-7brv8qw",
  "type": "lease",
  "recordIndex": 0,
  "undernameLimit": 100,
  "owner": "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  "name": "ardrive"
}
```

</details>

##### Resolving an undername

```typescript
const ario = ARIO.mainnet();
const record = await ario.resolveArNSName({ name: 'logo_ardrive' });
```

<details>
  <summary>Output</summary>

```json
{
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "txId": "kvhEUsIY5bXe0Wu2-YUFz20O078uYFzmQIO-7brv8qw",
  "type": "lease",
  "recordIndex": 1,
  "undernameLimit": 100,
  "owner": "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  "name": "ardrive"
}
```

</details>

#### `buyRecord({ name, type, years, processId })`

Purchases a new ArNS record with the specified name, type, and duration.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer });
const record = await ario.buyRecord(
  {
    name: 'ardrive',
    type: 'lease',
    years: 1,
    referrer: 'my-app.com', // optional: track purchase referrals for analytics
  },
  {
    // optional tags
    tags: [{ name: 'App-Name', value: 'ArNS-App' }],
  },
);
```

#### `upgradeRecord({ name })`

Upgrades an existing leased ArNS record to a permanent ownership. The record must be currently owned by the caller and be of type "lease".

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer });
const record = await ario.upgradeRecord(
  {
    name: 'ardrive',
    referrer: 'my-app.com', // optional: track purchase referrals for analytics
  },
  {
    // optional tags
    tags: [{ name: 'App-Name', value: 'ArNS-App' }],
  },
);
```

#### `getArNSRecord({ name })`

Retrieves the record info of the specified ArNS name.

```typescript
const ario = ARIO.mainnet();
const record = await ario.getArNSRecord({ name: 'ardrive' });
```

<details>
  <summary>Output</summary>

```json
{
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "endTimestamp": 1752256702026,
  "startTimestamp": 1720720819969,
  "type": "lease",
  "undernameLimit": 100
}
```

</details>

#### `getArNSRecords({ cursor, limit, sortBy, sortOrder })`

Retrieves all registered ArNS records of the ARIO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last ArNS name from the previous request.

```typescript
const ario = ARIO.mainnet();
// get the newest 100 names
const records = await ario.getArNSRecords({
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
      "endTimestamp": 1752256702026,
      "type": "permabuy",
      "undernameLimit": 10
    },
    {
      "name": "ardrive",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720620813,
      "purchasePrice": 75541282285,
      "type": "lease",
      "undernameLimit": 100
    },
    {
      "name": "arweave",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720620800,
      "purchasePrice": 75541282285,
      "type": "lease",
      "undernameLimit": 100
    },
    {
      "name": "ar-io",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720619000,
      "purchasePrice": 75541282285,
      "type": "lease",
      "undernameLimit": 100
    },
    {
      "name": "fwd",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "endTimestamp": 1720720819969,
      "startTimestamp": 1720720220811,
      "purchasePrice": 75541282285,
      "type": "lease",
      "undernameLimit": 100
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

#### `increaseUndernameLimit({ name, qty })`

Increases the undername support of a domain up to a maximum of 10k. Domains, by default, support up to 10 undernames.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.increaseUndernameLimit(
  {
    name: 'ar-io',
    qty: 420,
    referrer: 'my-app.com', // optional: track purchase referrals for analytics
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `extendLease({ name, years })`

Extends the lease of a registered ArNS domain, with an extension of 1-5 years depending on grace period status. Permanently registered domains cannot be extended.

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.extendLease(
  {
    name: 'ar-io',
    years: 1,
    referrer: 'my-app.com', // optional: track purchase referrals for analytics
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);
```

#### `getTokenCost({ intent, ...args })`

Calculates the price in mARIO to perform the interaction in question, eg a 'Buy-Name' interaction, where args are the specific params for that interaction.

```typescript
const price = await ario
  .getTokenCost({
    intent: 'Buy-Name',
    name: 'ar-io',
    type: 'permabuy',
  })
  .then((p) => new mARIOToken(p).toARIO()); // convert to ARIO for readability
```

<details>
  <summary>Output</summary>

```json
1642.34
```

</details>

#### `getCostDetails({ intent, fromAddress, fundFrom, ...args})`

Calculates the expanded cost details for the interaction in question, e.g a 'Buy-Name' interaction, where args are the specific params for that interaction. The fromAddress is the address that would be charged for the interaction, and fundFrom is where the funds would be taken from, either `balance`, `stakes`, or `any`.

```typescript
const costDetails = await ario.getCostDetails({
  intent: 'Buy-Name',
  fromAddress: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3',
  fundFrom: 'stakes',
  name: 'ar-io',
  type: 'permabuy',
});
```

<details>
  <summary>Output</summary>

```json
{
  "tokenCost": 2384252273,
  "fundingPlan": {
    "address": "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
    "balance": 0,
    "stakes": {
      "Rc80LG6h27Y3p9TN6J5hwDeG5M51cu671YwZpU9uAVE": {
        "vaults": [],
        "delegatedStake": 2384252273
      }
    },
    "shortfall": 0
  },
  "discounts": []
}
```

</details>

#### `getDemandFactor()`

Retrieves the current demand factor of the network. The demand factor is a multiplier applied to the cost of ArNS interactions based on the current network demand.

```typescript
const ario = ARIO.mainnet();
const demandFactor = await ario.getDemandFactor();
```

<details>
  <summary>Output</summary>

```json
1.05256
```

</details>

#### `getArNSReturnedNames({ cursor, limit, sortBy, sortOrder })`

Retrieves all active returned names of the ARIO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last returned name from the previous request.

```typescript
const ario = ARIO.mainnet();
const returnedNames = await ario.getArNSReturnedNames({
  limit: 100,
  sortBy: 'endTimestamp',
  sortOrder: 'asc', // return the returned names ending soonest first
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

#### `getArNSReturnedName({ name })`

Retrieves the returned name data for the specified returned name.

```typescript
const ario = ARIO.mainnet();
const returnedName = await ario.getArNSReturnedName({ name: 'permalink' });
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

### Epochs

#### `getCurrentEpoch()`

Returns the current epoch data.

```typescript
const ario = ARIO.mainnet();
const epoch = await ario.getCurrentEpoch();
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
      "gatewayPerformanceRatio": 1,
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

#### `getEpoch({ epochIndex })`

Returns the epoch data for the specified block height. If no epoch index is provided, the current epoch is used.

```typescript
const ario = ARIO.mainnet();
const epoch = await ario.getEpoch({ epochIndex: 0 });
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
      "stake": 10000000000, // value in mARIO
      "startTimestamp": 1720720620813,
      "stakeWeight": 1,
      "tenureWeight": 0.4494598765432099,
      "gatewayPerformanceRatio": 1,
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
      "distributed": {
        "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs": 100000000
      }
    }
  }
}
```

</details>

#### `getEligibleEpochRewards({ epochIndex }, { cursor, limit, sortBy, sortOrder })

Returns the eligible epoch rewards for the specified block height. If no epoch index is provided, the current epoch is used.

```typescript
const ario = ARIO.mainnet();
const rewards = await ario.getEligibleEpochRewards({ epochIndex: 0 });
```

<details>
  <summary>Output</summary>
  
```json
{
  "sortOrder": "desc",
  "hasMore": true,
  "totalItems": 37,
  "limit": 1,
  "sortBy": "cursorId",
  "items": [
    {
      "cursorId": "xN_aVln30LmoCffwmk5_kRkcyQZyZWy1o_TNtM_CTm0_xN_aVln30LmoCffwmk5_kRkcyQZyZWy1o_TNtM_CTm0",
      "recipient": "xN_aVln30LmoCffwmk5_kRkcyQZyZWy1o_TNtM_CTm0",
      "gatewayAddress": "xN_aVln30LmoCffwmk5_kRkcyQZyZWy1o_TNtM_CTm0",
      "eligibleReward": 2627618704,
      "type": "operatorReward"
    }
  ],
  "nextCursor": "xN_aVln30LmoCffwmk5_kRkcyQZyZWy1o_TNtM_CTm0_xN_aVln30LmoCffwmk5_kRkcyQZyZWy1o_TNtM_CTm0"
}
```
</details>

#### `getObservations({ epochIndex })`

Returns the epoch-indexed observation list. If no epoch index is provided, the current epoch is used.

```typescript
const ario = ARIO.mainnet();
const observations = await ario.getObservations();
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
const ario = ARIO.mainnet();
const distributions = await ario.getDistributions({ epochIndex: 0 });
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

#### `saveObservations({ reportTxId, failedGateways })`

Saves the observations of the current epoch. Requires `signer` to be provided on `ARIO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.saveObservations(
  {
    reportTxId: 'fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3',
    failedGateways: ['t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3'],
  },
  {
    tags: [{ name: 'App-Name', value: 'My-Awesome-App' }],
  },
);
```

</details>

#### `getPrescribedObservers({ epochIndex })`

Retrieves the prescribed observers of the ARIO process. To fetch prescribed observers for a previous epoch set the `epochIndex` to the desired epoch index.

```typescript
const ario = ARIO.mainnet();
const observers = await ario.getPrescribedObservers({ epochIndex: 0 });
```

<details>
<summary>Output</summary>

```json
[
  {
    "gatewayAddress": "BpQlyhREz4lNGS-y3rSS1WxADfxPpAuing9Lgfdrj2U",
    "observerAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
    "stake": 10000000000, // value in mARIO
    "start": 1296976,
    "stakeWeight": 1,
    "tenureWeight": 0.41453703703703704,
    "gatewayPerformanceRatio": 1,
    "observerRewardRatioWeight": 1,
    "compositeWeight": 0.41453703703703704,
    "normalizedCompositeWeight": 0.0018972019546783507
  }
]
```

</details>

### Primary Names

#### `getPrimaryNames({ cursor, limit, sortBy, sortOrder })`

Retrieves all primary names paginated and sorted by the specified criteria. The `cursor` used for pagination is the last name from the previous request.

```typescript
const ario = ARIO.mainnet();
const names = await ario.getPrimaryNames({
  cursor: 'ao', // this is the last name from the previous request
  limit: 1,
  sortBy: 'startTimestamp',
  sortOrder: 'desc',
});
```

<details>
  <summary>Output</summary>

```json
{
  "sortOrder": "desc",
  "hasMore": true,
  "totalItems": 100,
  "limit": 1,
  "sortBy": "startTimestamp",
  "cursor": "arns",
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
const ario = ARIO.mainnet();
const name = await ario.getPrimaryName({
  name: 'arns',
});
// or
const name = await ario.getPrimaryName({
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

#### `requestPrimaryName({ name })`

Requests a primary name for the caller's address. The request must be approved by the new owner of the requested name via the `approvePrimaryNameRequest`[#approveprimarynamerequest-name-address-] API.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.mainnet({ signer: new ArweaveSigner(jwk) });
const { id: txId } = await ario.requestPrimaryName({
  name: 'arns',
});
```

#### `getPrimaryNameRequest({ initiator })`

Retrieves the primary name request for a a wallet address.

```typescript
const ario = ARIO.mainnet();
const request = await ario.getPrimaryNameRequest({
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

### Configuration

The ARIO client class exposes APIs relevant to the ar.io process. It can be configured to use any AO Process ID that adheres to the [ARIO Network Spec]. By default, it will use the current [ARIO Testnet Process]. Refer to [AO Connect] for more information on how to configure an ARIO process to use specific AO infrastructure.

```typescript
import { ARIO , AOProcess } from '@ar.io/sdk';
import { connect } from '@permaweb/aoconnect';

// provide a custom ao infrastructure and process id
const ario = ARIO.mainnet({
  process: new AOProcess({
    processId: 'ARIO_PROCESS_ID'
    ao: connect({
      MODE: 'legacy',
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

#### `setBaseNameRecord({ transactionId, ttlSeconds })`

Adds or updates the base name record for the ANT. This is the top level name of the ANT (e.g. ardrive.ar.io)

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
// get the ant for the base name
const arnsRecord = await ario.getArNSRecord({ name: 'ardrive' });
const ant = await ANT.init({ processId: arnsName.processId });
const { id: txId } = await ant.setBaseNameRecord({
  transactionId: '432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM',
  ttlSeconds: 3600,
});

// ardrive.ar.io will now resolve to the provided 432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM transaction id
```

#### `setUndernameRecord({ undername, transactionId, ttlSeconds })`

Adds or updates an undername record for the ANT. An undername is appended to the base name of the ANT (e.g. dapp_ardrive.ar.io)

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

> Records, or `undernames` are configured with the `transactionId` - the arweave transaction id the record resolves - and `ttlSeconds`, the Time To Live in the cache of client applications.

```typescript
const arnsRecord = await ario.getArNSRecord({ name: 'ardrive' });
const ant = await ANT.init({ processId: arnsName.processId });
const { id: txId } = await ant.setUndernameRecord(
  {
    undername: 'dapp',
    transactionId: '432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM',
    ttlSeconds: 900,
  },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);

// dapp_ardrive.ar.io will now resolve to the provided 432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM transaction id
```

#### `removeUndernameRecord({ undername })`

Removes an undername record from the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removeUndernameRecord(
  { undername: 'dapp' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);

// dapp_ardrive.ar.io will no longer resolve to the provided transaction id
```

#### `setRecord({ undername, transactionId, ttlSeconds })`

> [!WARNING]
> Deprecated: Use `setBaseNameRecord` or `setUndernameRecord` instead.

Adds or updates a record for the ANT process. The `undername` parameter is used to specify the record name. Use `@` for the base name record.

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

> [!WARNING]
> Deprecated: Use `removeUndernameRecord` instead.

Removes a record from the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const arnsRecord = await ario.getArNSRecord({ name: 'ardrive' });
const ant = await ANT.init({ processId: arnsName.processId });
const { id: txId } = await ant.removeRecord(
  { undername: 'dapp' },
  // optional additional tags
  { tags: [{ name: 'App-Name', value: 'My-Awesome-App' }] },
);

// dapp_ardrive.ar.io will no longer resolve to the provided transaction id
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

#### `getLogo()`

Returns the TX ID of the logo set for the ANT.

```typescript
const logoTxId = await ant.getLogo();
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

#### `releaseName({ name, arioProcessId })`

Releases a name from the current owner and makes it available for purchase on the ARIO contract. The name must be permanently owned by the releasing wallet. If purchased within the recently returned name period (14 epochs), 50% of the purchase amount will be distributed to the ANT owner at the time of release. If no purchases in the recently returned name period, the name can be reregistered by anyone for the normal fee.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.releaseName({
  name: 'permalink',
  arioProcessId: ARIO_MAINNET_PROCESS_ID, // releases the name owned by the ANT and sends it to recently returned names on the ARIO contract
});
```

#### `reassignName({ name, arioProcessId, antProcessId })`

Reassigns a name to a new ANT. This can only be done by the current owner of the ANT.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.reassignName({
  name: 'ardrive',
  arioProcessId: ARIO_MAINNET_PROCESS_ID,
  antProcessId: NEW_ANT_PROCESS_ID, // the new ANT process id that will take over ownership of the name
});
```

#### `approvePrimaryNameRequest({ name, address, arioProcessId })`

Approves a primary name request for a given name or address.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.approvePrimaryNameRequest({
  name: 'arns',
  address: 't4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3', // must match the request initiator address
  arioProcessId: ARIO_MAINNET_PROCESS_ID, // the ARIO process id to use for the request
});
```

#### `removePrimaryNames({ names, arioProcessId, notifyOwners })`

Removes primary names from the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removePrimaryNames({
  names: ['arns', 'test_arns'], // any primary names associated with a base name controlled by this ANT will be removed
  arioProcessId: ARIO_MAINNET_PROCESS_ID,
  notifyOwners: true, // if true, the owners of the removed names will be send AO messages to notify them of the removal
});
```

### Configuration

ANT clients can be configured to use custom AO process. Refer to [AO Connect] for more information on how to configure the AO process to use specific AO infrastructure.

```typescript

const ant = ANT.init({
  process: new AOProcess({
    processId: 'ANT_PROCESS_ID'
    ao: connect({
      MODE: 'legacy',
      MU_URL: 'https://mu-testnet.xyz',
      CU_URL: 'https://cu-testnet.xyz',
      GRAPHQL_URL: 'https://arweave.net/graphql',
      GATEWAY_URL: 'https://arweave.net',
    })
  })
});
```

## Token Conversion

The ARIO process stores all values as mARIO (milli-ARIO) to avoid floating-point arithmetic issues. The SDK provides an `ARIOToken` and `mARIOToken` classes to handle the conversion between ARIO and mARIO, along with rounding logic for precision.

**All process interactions expect values in mARIO. If numbers are provided as inputs, they are assumed to be in raw mARIO values.**

### Converting ARIO to mARIO

```typescript
import { ARIOToken, mARIOToken } from '@ar.io/sdk';

const arioValue = 1;
const mARIOValue = new ARIOToken(arioValue).toMARIO();

const mARIOValue = 1_000_000;
const arioValue = new mARIOToken(mARIOValue).toARIO();
```

## Logging

The library uses the [Winston] logger for node based projects, and `console` logger for web based projects by default. You can configure the log level via `setLogLevel()` API. Alternatively you can set a custom logger as the default logger so long as it satisfes the `ILogger` interface.

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
  const page = await ario.getGateways({ limit: 100, cursor });
  gateaways.push(...items);
  cursor = page.nextCursor;
  hasMore = page.hasMore;
}
```

## Resources

### Bundling

For [ANS-104] bundling compatible with ar.io gateways, we recommend using [turbo-sdk](https://github.com/ardriveapp/turbo-sdk). Turbo SDK provides efficient and reliable methods for creating and uploading data bundles to the Arweave network, which are fully compatible with ar.io gateways. Turbo supports fiat and crypto bundling and uploading with a focus on ease of use and reliability.

### AR.IO Gateways

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
[ARIO Testnet Process]: https://www.ao.link/#/entity/agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA
[ARIO Network Spec]: https://github.com/ar-io/ar-io-network-process?tab=readme-ov-file#contract-spec
[Winston]: https://www.npmjs.com/package/winston
[AO]: https://github.com/permaweb/ao
[ar-io-node repository]: https://github.com/ar-io/ar-io-node
[ar.io Gateway Documentation]: https://docs.ar.io/gateways/ar-io-node/overview/
[ANS-104]: https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md
[ar-io-testnet-faucet]: https://github.com/ar-io/ar-io-testnet-faucet?tab=readme-ov-file#asynchronous-workflow
