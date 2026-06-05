# @ar.io/sdk

[![codecov](https://codecov.io/gh/ar-io/ar-io-sdk/graph/badge.svg?token=7dXKcT7dJy)](https://codecov.io/gh/ar-io/ar-io-sdk)

The Solana-native SDK for the AR.IO network. Provides typed
client classes (`ARIO`, `ANT`, `ANTRegistry`), PDA helpers,
deserializers, and escrow primitives for the AR.IO protocol on Solana.
Codama-generated instruction builders and account decoders are
supplied by [`@ar.io/solana-contracts`](https://www.npmjs.com/package/@ar.io/solana-contracts).

## Table of Contents

<!-- toc -->

- [Table of Contents](#table-of-contents)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [ARIO Contract](#ario-contract)
- [ANT Contracts](#ant-contracts)
- [Escrow](#escrow)
- [Token Conversion](#token-conversion)
- [Logging](#logging)
- [Pagination](#pagination)
- [Advanced](#advanced)
- [Resources](#resources)
- [Developers](#developers)

<!-- tocstop -->

## Installation

Requires `node>=v18.0.0`.

```shell
npm install @ar.io/sdk
```

or

```shell
yarn add @ar.io/sdk
```

## Quick Start

```typescript
import { ARIO } from '@ar.io/sdk';
import { createSolanaRpc } from '@solana/kit';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const ario = ARIO.init({ rpc });
const gateways = await ario.getGateways();
```

Write operations need a `@solana/kit` signer plus an `rpcSubscriptions`
client (used by kit's `sendAndConfirmTransaction`):

```typescript
import { ARIO } from '@ar.io/sdk';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
} from '@solana/kit';
import { readFileSync } from 'node:fs';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const rpcSubscriptions = createSolanaRpcSubscriptions(
  'wss://api.mainnet-beta.solana.com',
);
const signer = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(readFileSync('keypair.json', 'utf8'))),
);

const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
await ario.buyRecord({
  name: 'foo',
  type: 'lease',
  years: 1,
  processId: '<ANT mint pubkey>',
});
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
      "totalDelegatedStake": 0,
      "settings": {
        "allowDelegatedStaking": true,
        "allowedDelegates": [],
        "autoStake": false,
        "delegateRewardShareRatio": 10,
        "minDelegatedStake": 100000000,
        "fqdn": "ar-io.dev",
        "label": "ar.io Test",
        "note": "Test Gateway operated by PDS for the ar.io ecosystem.",
        "port": 443,
        "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
        "protocol": "https"
      },
      "startTimestamp": 1720720621424,
      "endTimestamp": 0,
      "stats": {
        "passedConsecutiveEpochs": 30,
        "failedConsecutiveEpochs": 0,
        "totalEpochCount": 31,
        "passedEpochCount": 30,
        "failedEpochCount": 1,
        "observedEpochCount": 30,
        "prescribedEpochCount": 31
      },
      "status": "joined",
      "weights": {
        "stakeWeight": 5.02400000024,
        "tenureWeight": 0.19444444444444,
        "gatewayPerformanceRatio": 1,
        "observerPerformanceRatio": 1,
        "gatewayRewardRatioWeight": 1,
        "observerRewardRatioWeight": 1,
        "compositeWeight": 0.97688888893556,
        "normalizedCompositeWeight": 0.19247316211083
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "-4xgjroXENKYhTWqrBo57HQwvDL51mMdfsdsxJy6Y2Z_sA",
  "totalItems": 316,
  "limit": 100,
  "sortBy": "startTimestamp",
  "sortOrder": "desc"
}
```

</details>

## Usage

The SDK is published as an ES module (`"type": "module"`) and is
compatible with modern bundlers such as Webpack, Rollup, ESbuild, and
Vite. CommonJS consumers should migrate to ESM (Node 18+ supports ESM
natively). Refer to the [examples] directory to see how to use the SDK
in various environments.

### Subpath exports

- `@ar.io/sdk` — main entry. `ARIO`, `ANT`, `ANTRegistry`, Solana
  client classes, PDA helpers, deserializers, escrow primitives.
- `@ar.io/sdk/solana` — alias of the main entry (kept for one release
  while consumers migrate from the previous subpath layout).

### Web

> [!WARNING]
> Polyfills are not provided by default for bundled web projects (Vite,
> ESBuild, Webpack, Rollup, etc.). Depending on your bundler config, you
> will need polyfills for `crypto`, `process` and `buffer`. Refer to
> [examples/webpack] and [examples/vite] for examples.

```javascript
import { ARIO } from '@ar.io/sdk';
import { createSolanaRpc } from '@solana/kit';

const ario = ARIO.init({
  rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
});
const gateways = await ario.getGateways();
```

### Browser bundle

```html
<script type="module">
  // replace <version> with a release version
  import { ARIO } from 'https://github.com/ar-io/ar-io-sdk/releases/download/v<version>/web.bundle.min.js';
  import { createSolanaRpc } from 'https://esm.sh/@solana/kit@6';

  const ario = ARIO.init({
    rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
  });
  const gateways = await ario.getGateways();
</script>
```

### TypeScript

The SDK ships TypeScript types alongside the JS output. Types are
exported from `./lib/types/solana/index.d.ts` and resolve automatically
for ESM consumers.

> [!NOTE]
> TypeScript 5.3+ is recommended (the SDK uses `nodenext` module
> resolution with `.js` extensions in relative imports).

## ARIO Contract

### General

#### `init({ rpc, rpcSubscriptions?, signer? })`

Factory function that creates a read-only or writeable ARIO client.
Providing `signer` plus `rpcSubscriptions` enables write methods
(`joinNetwork`, `delegateStake`, `buyRecord`, etc.). Without a signer,
the client is read-only.

```typescript
import { ARIO } from '@ar.io/sdk';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
} from '@solana/kit';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');

// read-only client
const ario = ARIO.init({ rpc });

// read-write client (needs rpcSubscriptions for sendAndConfirm)
const rpcSubscriptions = createSolanaRpcSubscriptions(
  'wss://api.mainnet-beta.solana.com',
);
const signer = await createKeyPairSignerFromBytes(/* 64-byte secret key */);
const arioWrite = ARIO.init({ rpc, rpcSubscriptions, signer });
```

#### `getInfo()`

Retrieves the information of the ARIO process.

```typescript
const ario = ARIO.init({ rpc });
const info = await ario.getInfo();
```

<details>
  <summary>Output</summary>

```json
{
  "Name": "AR.IO",
  "Ticker": "ARIO",
  "Logo": "",
  "Denomination": 6,
  "Handlers": [],
  "LastCreatedEpochIndex": 0,
  "LastDistributedEpochIndex": 0,
  "totalSupply": 1000000000000000,
  "protocolBalance": 0,
  "epochSettings": {
    "durationMs": 86400000,
    "prescribedNameCount": 25,
    "maxObservers": 50
  }
}
```

> **Note**: `Handlers`, `LastCreatedEpochIndex`, and `LastDistributedEpochIndex`
> are placeholders on Solana (returned for backwards-compatible field shape
> with consumer code). `totalSupply` / `protocolBalance` are live reads from
> the `ArioConfig` PDA; `epochSettings` is live from the `EpochSettings`
> PDA. See `src/solana/io-readable.ts` for the exact projection.

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
const ario = ARIO.init({ rpc });
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
const ario = ARIO.init({ rpc });
// the balance will be returned in mARIO as a value
const balance = await ario
  .getBalance({
    address: "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
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
const ario = ARIO.init({ rpc });
const balances = await ario.getBalances({
  cursor: "-4xgjroXENKYhTWqrBo57HQwvDL51mMdfsdsxJy6Y2Z_sA",
  limit: 100,
  sortBy: "balance",
  sortOrder: "desc",
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
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.transfer({
  target: 'RecipientSolanaPubkeyBase58',
  qty: new ARIOToken(1000).toMARIO(),
});
```

### Networks

The SDK talks to whatever cluster your `@solana/kit` RPC client points
at — mainnet-beta by default. For devnet or a local validator, override
the RPC URL and (on any non-mainnet cluster) the per-program addresses:

```typescript
import { ARIO } from '@ar.io/sdk';
import { createSolanaRpc, address } from '@solana/kit';

const ario = ARIO.init({
  rpc: createSolanaRpc('https://api.devnet.solana.com'),
  coreProgramId: address('<ARIO_CORE_PROGRAM_ID>'),
  garProgramId: address('<ARIO_GAR_PROGRAM_ID>'),
  arnsProgramId: address('<ARIO_ARNS_PROGRAM_ID>'),
  antProgramId: address('<ARIO_ANT_PROGRAM_ID>'),
});
```

On localnet (Surfpool) source program IDs from
`migration/localnet/out/localnet.env` in the `solana-ar-io` monorepo.

##### Faucet

The SDK exposes a `createFaucet` HTTP wrapper around the ar.io faucet
service ([faucet.ar.io](https://faucet.ar.io)). The faucet backend has
not yet been ported to issue Solana-mint transfers — the SDK surface is
documented here for forward-compatibility once it lands:

- `createFaucet({ arioInstance, processId }).captchaUrl()` — returns
  the captcha URL.
- `createFaucet({ arioInstance, processId }).claimWithAuthToken({ authToken, recipient, quantity })` —
  claim tokens for `recipient` using an auth token returned by the
  captcha flow.
- `createFaucet({ arioInstance, processId }).verifyAuthToken({ authToken })` —
  check whether an auth token is still valid.

<details>
  <summary><i>Example client-side code for claiming tokens</i></summary>

```typescript
import { ARIO } from "@ar.io/sdk";

const ario = ARIO.init({ rpc });
const captchaUrl = await ario.faucet.captchaUrl();

// open the captcha URL in the browser, and listen for the auth token event
const captchaWindow = window.open(
  captchaUrl.captchaUrl,
  "_blank",
  "width=600,height=600",
);
/**
 * The captcha URL includes a window.parent.postMessage event that is used to send the auth token to the parent window.
 * You can store the auth token in localStorage and use it to claim tokens for the duration of the auth token's expiration (default 1 hour).
 */
window.parent.addEventListener("message", async (event) => {
  if (event.data.type === "ario-jwt-success") {
    localStorage.setItem("ario-jwt", event.data.token);
    localStorage.setItem("ario-jwt-expires-at", event.data.expiresAt);
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
          "Successfully claimed 100 ARIO tokens! Transaction ID: " + res.id,
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
  localStorage.getItem("ario-jwt-expires-at") &&
  Date.now() < parseInt(localStorage.getItem("ario-jwt-expires-at") ?? "0")
) {
  const res = await testnet.faucet.claimWithAuthToken({
    authToken: localStorage.getItem("ario-jwt") ?? "",
    recipient: await window.arweaveWallet.getActiveAddress(),
    quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
  });
}
```

</details>

### Vaults

#### `getVault({ address, vaultId })`

Retrieves the locked-balance user vault of the ARIO process by the specified wallet address and vault ID.

```typescript
const ario = ARIO.init({ rpc });
const vault = await ario.getVault({
  address: "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
  vaultId: "vaultIdOne",
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
const ario = ARIO.init({ rpc });
const vaults = await ario.getVaults({
  cursor: "0",
  limit: 100,
  sortBy: "balance",
  sortOrder: "desc",
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
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.vaultedTransfer(
  {
    recipient: "-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5",
    quantity: new ARIOToken(1000).toMARIO(),
    lockLengthMs: 1000 * 60 * 60 * 24 * 365, // 1 year
    revokable: true,
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `revokeVault({ recipient, vaultId })`

Revokes a vaulted transfer by the recipient address and vault ID. Only the sender of the vaulted transfer can revoke it.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.revokeVault({
  recipient: "-5dV7nk7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5",
  vaultId: "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
});
```

#### `createVault({ lockLengthMs, quantity })`

Creates a vault for the specified `quantity` of mARIO from the signer's balance and locks it for the specified `lockLengthMs` milliseconds.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });

const { id: txId } = await ario.createVault({
  lockLengthMs: 1000 * 60 * 60 * 24 * 365, // 1 year
  quantity: new ARIOToken(1000).toMARIO(),
});
```

#### `extendVault({ vaultId, extendLengthMs })`

Extends the lock length of a signer's vault by the specified `extendLengthMs` milliseconds.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });

const { id: txId } = await ario.extendVault({
  vaultId: "vaultIdOne",
  extendLengthMs: 1000 * 60 * 60 * 24 * 365, // 1 year
});
```

#### `increaseVault({ vaultId, quantity })`

Increases the balance of a signer's vault by the specified `quantity` of mARIO.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.increaseVault({
  vaultId: "vaultIdOne",
  quantity: new ARIOToken(1000).toMARIO(),
});
```

### Gateways

#### `getGateway({ address })`

Retrieves a gateway's info by its staking wallet address.

```typescript
const ario = ARIO.init({ rpc });
const gateway = await ario.getGateway({
  address: "-7vXsQZQDk8TMDlpiSLy3CnLi5PDPlAaN2DaynORpck",
});
```

<details>
  <summary>Output</summary>

```json
{
  "observerAddress": "IPdwa3Mb_9pDD8c2IaJx6aad51Ss-_TfStVwBuhtXMs",
  "operatorStake": 250000000000,
  "totalDelegatedStake": 0,
  "settings": {
    "allowDelegatedStaking": true,
    "allowedDelegates": [],
    "autoStake": false,
    "delegateRewardShareRatio": 10,
    "minDelegatedStake": 100000000,
    "fqdn": "ar-io.dev",
    "label": "ar.io Test",
    "note": "Test Gateway operated by PDS for the ar.io ecosystem.",
    "port": 443,
    "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
    "protocol": "https"
  },
  "startTimestamp": 1720720620813,
  "endTimestamp": 0,
  "stats": {
    "passedConsecutiveEpochs": 30,
    "failedConsecutiveEpochs": 0,
    "totalEpochCount": 31,
    "passedEpochCount": 30,
    "failedEpochCount": 1,
    "observedEpochCount": 30,
    "prescribedEpochCount": 31
  },
  "status": "joined",
  "weights": {
    "stakeWeight": 5.02400000024,
    "tenureWeight": 0.19444444444444,
    "gatewayPerformanceRatio": 1,
    "observerPerformanceRatio": 1,
    "gatewayRewardRatioWeight": 1,
    "observerRewardRatioWeight": 1,
    "compositeWeight": 0.97688888893556,
    "normalizedCompositeWeight": 0.19247316211083
  }
}
```

</details>

#### `getGateways({ cursor, limit, sortBy, sortOrder })`

Retrieves registered gateways of the ARIO process, using pagination and sorting by the specified criteria. The `cursor` used for pagination is the last gateway address from the previous request.

```typescript
const ario = ARIO.init({ rpc });
const gateways = await ario.getGateways({
  limit: 100,
  sortOrder: "desc",
  sortBy: "operatorStake",
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
      "totalDelegatedStake": 0,
      "settings": {
        "allowDelegatedStaking": true,
        "allowedDelegates": [],
        "autoStake": false,
        "delegateRewardShareRatio": 10,
        "minDelegatedStake": 100000000,
        "fqdn": "ar-io.dev",
        "label": "ar.io Test",
        "note": "Test Gateway operated by PDS for the ar.io ecosystem.",
        "port": 443,
        "properties": "raJgvbFU-YAnku-WsupIdbTsqqGLQiYpGzoqk9SCVgY",
        "protocol": "https"
      },
      "startTimestamp": 1720720620813,
      "endTimestamp": 0,
      "stats": {
        "passedConsecutiveEpochs": 30,
        "failedConsecutiveEpochs": 0,
        "totalEpochCount": 31,
        "passedEpochCount": 30,
        "failedEpochCount": 1,
        "observedEpochCount": 30,
        "prescribedEpochCount": 31
      },
      "status": "joined",
      "weights": {
        "stakeWeight": 5.02400000024,
        "tenureWeight": 0.19444444444444,
        "gatewayPerformanceRatio": 1,
        "observerPerformanceRatio": 1,
        "gatewayRewardRatioWeight": 1,
        "observerRewardRatioWeight": 1,
        "compositeWeight": 0.97688888893556,
        "normalizedCompositeWeight": 0.19247316211083
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "-4xgjroXENKYhTWqrBo57HQwvDL51mMdfsdsxJy6Y2Z_sA",
  "totalItems": 316,
  "limit": 100,
  "sortBy": "operatorStake",
  "sortOrder": "desc"
}
```

</details>

#### `getGatewayDelegates({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all delegates for a specific gateway, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last delegate address from the previous request.

```typescript
const ario = ARIO.init({ rpc });
const delegates = await ario.getGatewayDelegates({
  address: "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
  limit: 3,
  sortBy: "startTimestamp",
  sortOrder: "desc",
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
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.joinNetwork(
  {
    qty: new ARIOToken(10_000).toMARIO(), // minimum operator stake allowed
    autoStake: true, // auto-stake operator rewards to the gateway
    allowDelegatedStaking: true, // allows delegated staking
    minDelegatedStake: new ARIOToken(100).toMARIO(), // minimum delegated stake allowed
    delegateRewardShareRatio: 10, // percentage of rewards to share with delegates (e.g. 10%)
    label: "john smith", // min 1, max 64 characters
    note: "The example gateway", // max 256 characters
    properties: "FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44", // Arweave transaction ID containing additional properties of the Gateway
    observerWallet: "0VE0wIhDy90WiQoV3U2PeY44FH1aVetOoulPGqgYukj", // wallet address of the observer, must match OBSERVER_WALLET on the observer
    fqdn: "example.com", // fully qualified domain name - note: you must own the domain and set the OBSERVER_WALLET on your gateway to match `observerWallet`
    port: 443, // port number
    protocol: "https", // only 'https' is supported
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `leaveNetwork()`

Sets the gateway as `leaving` on the ar.io network. Requires `signer` to be provided on `ARIO.init` to sign the transaction. The gateways operator and delegate stakes are vaulted and will be returned after leave periods. The gateway will be removed from the network after the leave period.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });

const { id: txId } = await ario.leaveNetwork(
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `updateGatewaySettings({ ...settings })`

Writes new gateway settings to the callers gateway configuration.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.updateGatewaySettings(
  {
    // any other settings you want to update
    minDelegatedStake: new ARIOToken(100).toMARIO(),
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `increaseDelegateStake({ target, qty })`

Increases the callers stake on the target gateway.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.increaseDelegateStake(
  {
    target: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
    qty: new ARIOToken(100).toMARIO(),
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `decreaseDelegateStake({ target, qty, instant })`

Decreases the callers stake on the target gateway. Can instantly decrease stake by setting instant to `true`.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.decreaseDelegateStake(
  {
    target: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
    qty: new ARIOToken(100).toMARIO(),
  },
  {
    tags: [{ name: "App-Name", value: "My-Awesome-App" }],
  },
);
```

Pay the early withdrawal fee and withdraw instantly.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.decreaseDelegateStake({
  target: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  qty: new ARIOToken(100).toMARIO(),
  instant: true, // Immediately withdraw this stake and pay the instant withdrawal fee
});
```

#### `getDelegations({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all active and vaulted stakes across all gateways for a specific address, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last delegationId (concatenated gateway and startTimestamp of the delgation) from the previous request.

```typescript
const ario = ARIO.init({ rpc });
const vaults = await ario.getDelegations({
  address: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  cursor: "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ_123456789",
  limit: 2,
  sortBy: "startTimestamp",
  sortOrder: "asc",
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
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
// removes a delegated vault from a gateway
const { id: txId } = await ario.instantWithdrawal(
  {
    // gateway address where delegate vault exists
    gatewayAddress: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
    // delegated vault id to cancel
    vaultId: "fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3",
  },
  // optional additional tags
  {
    tags: [{ name: "App-Name", value: "My-Awesome-App" }],
  },
);
// removes an operator vault from a gateway
const { id: txId } = await ario.instantWithdrawal({
  vaultId: "fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3",
});
```

#### `cancelWithdrawal({ gatewayAddress, vaultId })`

Cancels an existing vault on a gateway. The vaulted stake will be returned to the callers stake. If no `gatewayAddress` is provided, the signer's address will be used.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
// cancels a delegated vault from a gateway
const { id: txId } = await ario.cancelWithdrawal(
  {
    // gateway address where vault exists
    gatewayAddress: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
    // vault id to cancel
    vaultId: "fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3",
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
// cancels an operator vault from a gateway
const { id: txId } = await ario.cancelWithdrawal({
  // operator vault id to cancel
  vaultId: "fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3",
});
```

#### `getAllowedDelegates({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all allowed delegates for a specific address. The `cursor` used for pagination is the last address from the previous request.

```typescript
const ario = ARIO.init({ rpc });
const allowedDelegates = await ario.getAllowedDelegates({
  address: "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
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
const ario = ARIO.init({ rpc });
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
const ario = ARIO.init({ rpc });
const vaults = await ario.getAllGatewayVaults({
  limit: 1,
  sortBy: "endTimestamp",
  sortOrder: "desc",
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

#### `getWithdrawals({ address, cursor, limit, sortBy, sortOrder })`

Returns every pending stake withdrawal owned by `address` — covering both operator-stake decreases (`isDelegate: false`) and delegate-stake decreases (`isDelegate: true`). A withdrawal is claimable when `Date.now() >= endTimestamp`; call `claimWithdrawal({ withdrawalId: item.vaultId })` to release the tokens.

This is the per-owner read needed to drive "you have X claimable withdrawals" UIs without fanning out across every gateway the wallet has interacted with.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });

const withdrawals = await ario.getWithdrawals({
  address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
});

const claimable = withdrawals.items.filter(
  (w) => Date.now() >= w.endTimestamp,
);
```

<details>
  <summary>Output</summary>

```json
{
  "hasMore": false,
  "totalItems": 2,
  "limit": 100,
  "items": [
    {
      "cursorId": "8CSdSjf7gXqQ5p1U2qfdwHzVw9sZRYHJpDpV87dnvb4d",
      "vaultId": "0",
      "gatewayAddress": "Bxz7Q2tWfqr9Q5T6cZjUnVxRk9CnHwShfgUaW5fY1Mvr",
      "balance": 50000000000,
      "startTimestamp": 1735843635857,
      "endTimestamp": 1738435635857,
      "isDelegate": true
    },
    {
      "cursorId": "FmWUz4w7vSdLcz1nN8H1n2KkjJgrQQXR1n4kV3WqJ7Hf",
      "vaultId": "1",
      "gatewayAddress": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      "balance": 10000000000,
      "startTimestamp": 1735843835857,
      "endTimestamp": 1738435835857,
      "isDelegate": false
    }
  ]
}
```

</details>

#### `increaseOperatorStake({ qty })`

Increases the callers operator stake. Must be executed with a wallet registered as a gateway operator.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.increaseOperatorStake(
  {
    qty: new ARIOToken(100).toMARIO(),
  },
  {
    tags: [{ name: "App-Name", value: "My-Awesome-App" }],
  },
);
```

#### `decreaseOperatorStake({ qty })`

Decreases the callers operator stake. Must be executed with a wallet registered as a gateway operator. Requires `signer` to be provided on `ARIO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.decreaseOperatorStake(
  {
    qty: new ARIOToken(100).toMARIO(),
  },
  {
    tags: [{ name: "App-Name", value: "My-Awesome-App" }],
  },
);
```

#### `redelegateStake({ target, source, stakeQty, vaultId })`

Redelegates the stake of a specific address to a new gateway. Vault ID may be optionally included in order to redelegate from an existing withdrawal vault. The redelegation fee is calculated based on the fee rate and the stake amount. Users are allowed one free redelegation every seven epochs. Each additional redelegation beyond the free redelegation will increase the fee by 10%, capping at a 60% redelegation fee.

e.g: If 1000 mARIO is redelegated and the fee rate is 10%, the fee will be 100 mARIO. Resulting in 900 mARIO being redelegated to the new gateway and 100 mARIO being deducted back to the protocol balance.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });

const { id: txId } = await ario.redelegateStake({
  target: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  source: "HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA",
  stakeQty: new ARIOToken(1000).toMARIO(),
  vaultId: "fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3",
});
```

#### `getRedelegationFee({ address })`

Retrieves the fee rate as percentage required to redelegate the stake of a specific address. Fee rate ranges from 0% to 60% based on the number of redelegations since the last fee reset.

```typescript
const ario = ARIO.init({ rpc });

const fee = await ario.getRedelegationFee({
  address: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
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
const ario = ARIO.init({ rpc });
const delegates = await ario.getAllDelegates({
  limit: 2,
  sortBy: "startTimestamp",
  sortOrder: "desc",
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
const ario = ARIO.init({ rpc });
const record = await ario.resolveArNSName({ name: "ardrive" });
```

<details>
  <summary>Output</summary>

```json
{
  "name": "ardrive",
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "txId": "kvhEUsIY5bXe0Wu2-YUFz20O078uYFzmQIO-7brv8qw",
  "type": "lease",
  "ttlSeconds": 3600,
  "undernameLimit": 100
}
```

</details>

##### Resolving an undername

```typescript
const ario = ARIO.init({ rpc });
const record = await ario.resolveArNSName({ name: "logo_ardrive" });
```

<details>
  <summary>Output</summary>

```json
{
  "name": "ardrive",
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "txId": "kvhEUsIY5bXe0Wu2-YUFz20O078uYFzmQIO-7brv8qw",
  "type": "lease",
  "ttlSeconds": 3600,
  "undernameLimit": 100
}
```

</details>

#### `buyRecord({ name, type, years, processId })`

Purchases a new ArNS record with the specified name, type, processId, and duration.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

**Arguments:**

- `name` - _required_: the name of the ArNS record to purchase
- `type` - _required_: the type of ArNS record to purchase
- `processId` - _optional_: the process id of an existing ANT process. If not provided, a new ANT process using the provided `signer` will be spawned, and the ArNS record will be assigned to that process.
- `years` - _optional_: the duration of the ArNS record in years. If not provided and `type` is `lease`, the record will be leased for 1 year. If not provided and `type` is `permabuy`, the record will be permanently registered.
- `referrer` - _optional_: track purchase referrals for analytics (e.g. `my-app.com`)

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const record = await ario.buyRecord(
  {
    name: "ardrive",
    type: "lease",
    years: 1,
    processId: "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM", // optional: assign to existing ANT process
    referrer: "my-app.com", // optional: track purchase referrals for analytics
  },
  {
    // optional tags
    tags: [{ name: "App-Name", value: "ArNS-App" }],
    onSigningProgress: (step, event) => {
      console.log(`Signing progress: ${step}`);
      if (step === "spawning-ant") {
        console.log("Spawning ant:", event);
      }
      if (step === "registering-ant") {
        console.log("Registering ant:", event);
      }
      if (step === "verifying-state") {
        console.log("Verifying state:", event);
      }
      if (step === "buying-name") {
        console.log("Buying name:", event);
      }
    },
  },
);
```

#### `upgradeRecord({ name })`

Upgrades an existing leased ArNS record to a permanent ownership. The record must be currently owned by the caller and be of type "lease".

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const record = await ario.upgradeRecord(
  {
    name: "ardrive",
    referrer: "my-app.com", // optional: track purchase referrals for analytics
  },
  {
    // optional tags
    tags: [{ name: "App-Name", value: "ArNS-App" }],
  },
);
```

#### `getArNSRecord({ name })`

Retrieves the record info of the specified ArNS name.

```typescript
const ario = ARIO.init({ rpc });
const record = await ario.getArNSRecord({ name: "ardrive" });
```

<details>
  <summary>Output</summary>

```json
{
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "startTimestamp": 1720720819969,
  "endTimestamp": 1752256702026,
  "type": "lease",
  "undernameLimit": 100,
  "purchasePrice": 75541282285
}
```

</details>

#### `getArNSRecords({ cursor, limit, sortBy, sortOrder })`

Retrieves all registered ArNS records of the ARIO process, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last ArNS name from the previous request.

```typescript
const ario = ARIO.init({ rpc });
// get the newest 100 names
const records = await ario.getArNSRecords({
  limit: 100,
  sortBy: "startTimestamp",
  sortOrder: "desc",
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

#### `getArNSRecordsForAddress({ address, cursor, limit, sortBy, sortOrder })`

Retrieves all registered ArNS records of the specified address according to the `ANTRegistry` access control list, paginated and sorted by the specified criteria. The `cursor` used for pagination is the last ArNS name from the previous request.

```typescript
const ario = ARIO.init({ rpc });
const records = await ario.getArNSRecordsForAddress({
  address: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  limit: 100,
  sortBy: "startTimestamp",
  sortOrder: "desc",
});
```

Available `sortBy` options are any of the keys on the record object, e.g. `name`, `processId`, `endTimestamp`, `startTimestamp`, `type`, `undernames`.

<details>
  <summary>Output</summary>

```json
{
  "limit": 1,
  "totalItems": 31,
  "hasMore": true,
  "nextCursor": "ardrive",
  "items": [
    {
      "startTimestamp": 1740009600000,
      "name": "ardrive",
      "endTimestamp": 1777328018367,
      "type": "permabuy",
      "purchasePrice": 0,
      "undernameLimit": 100,
      "processId": "hpF0HdijWlBLFePjWX6u_-Lg3Z2E_PrP_AoaXDVs0bA"
    }
  ],
  "sortOrder": "desc",
  "sortBy": "startTimestamp"
}
```

</details>

#### `increaseUndernameLimit({ name, qty })`

Increases the undername support of a domain up to a maximum of 10k. Domains, by default, support up to 10 undernames.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.increaseUndernameLimit(
  {
    name: "ar-io",
    qty: 420,
    referrer: "my-app.com", // optional: track purchase referrals for analytics
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `extendLease({ name, years })`

Extends the lease of a registered ArNS domain, with an extension of 1-5 years depending on grace period status. Permanently registered domains cannot be extended.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.extendLease(
  {
    name: "ar-io",
    years: 1,
    referrer: "my-app.com", // optional: track purchase referrals for analytics
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `getTokenCost({ intent, ...args })`

Calculates the price in mARIO to perform the interaction in question, eg a 'Buy-Name' interaction, where args are the specific params for that interaction.

```typescript
const price = await ario
  .getTokenCost({
    intent: "Buy-Name",
    name: "ar-io",
    type: "permabuy",
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
  intent: "Buy-Name",
  fromAddress: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
  fundFrom: "stakes",
  name: "ar-io",
  type: "permabuy",
});
```

<details>
  <summary>Output</summary>

```json
{
  "tokenCost": 1907401818,
  "discounts": [
    {
      "name": "Gateway Operator",
      "discountTotal": 476850455,
      "multiplier": 0.8
    }
  ]
}
```

</details>

#### `getDemandFactor()`

Retrieves the current demand factor of the network. The demand factor is a multiplier applied to the cost of ArNS interactions based on the current network demand.

```typescript
const ario = ARIO.init({ rpc });
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
const ario = ARIO.init({ rpc });
const returnedNames = await ario.getArNSReturnedNames({
  limit: 100,
  sortBy: "endTimestamp",
  sortOrder: "asc", // return the returned names ending soonest first
});
```

<details>
  <summary>Output</summary>

```json
{
  "items": [
    {
      "name": "permalink",
      "startTimestamp": 1729775641349,
      "endTimestamp": 1730985241349,
      "initiator": "GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc",
      "premiumMultiplier": 50
    }
  ],
  "hasMore": false,
  "totalItems": 1,
  "limit": 100,
  "sortBy": "endTimestamp",
  "sortOrder": "asc"
}
```

</details>

#### `getArNSReturnedName({ name })`

Retrieves the returned name data for the specified returned name.

```typescript
const ario = ARIO.init({ rpc });
const returnedName = await ario.getArNSReturnedName({ name: "permalink" });
```

<details>
  <summary>Output</summary>

```json
{
  "name": "permalink",
  "startTimestamp": 1729775641349,
  "endTimestamp": 1730985241349,
  "initiator": "GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc",
  "premiumMultiplier": 50
}
```

</details>

### Epochs

#### `getCurrentEpoch()`

Returns the current epoch data.

```typescript
const ario = ARIO.init({ rpc });
const epoch = await ario.getCurrentEpoch();
```

<details>
  <summary>Output</summary>

```json
{
  "epochIndex": 0,
  "startHeight": 0,
  "startTimestamp": 1720720621424,
  "endTimestamp": 1752256702026,
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
      "stake": 10000000000,
      "startTimestamp": 1720720621424,
      "stakeWeight": 1,
      "tenureWeight": 0.4494598765432099,
      "gatewayPerformanceRatio": 1,
      "observerPerformanceRatio": 1,
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
    "totalEligibleGatewayReward": 100000000
  },
  "arnsStats": {
    "totalReturnedNames": 0,
    "totalActiveNames": 0,
    "totalGracePeriodNames": 0,
    "totalReservedNames": 0
  }
}
```

</details>

#### `getEpoch({ epochIndex })`

Returns the epoch data for the specified block height. If no epoch index is provided, the current epoch is used.

```typescript
const ario = ARIO.init({ rpc });
const epoch = await ario.getEpoch({ epochIndex: 0 });
```

<details>
  <summary>Output</summary>

```json
{
  "epochIndex": 0,
  "startHeight": 0,
  "startTimestamp": 1720720620813,
  "endTimestamp": 1752256702026,
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
      "stake": 10000000000,
      "startTimestamp": 1720720620813,
      "stakeWeight": 1,
      "tenureWeight": 0.4494598765432099,
      "gatewayPerformanceRatio": 1,
      "observerPerformanceRatio": 1,
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
    "totalEligibleGatewayReward": 100000000
  },
  "arnsStats": {
    "totalReturnedNames": 0,
    "totalActiveNames": 0,
    "totalGracePeriodNames": 0,
    "totalReservedNames": 0
  }
}
```

</details>

#### `getEligibleEpochRewards({ epochIndex }, { cursor, limit, sortBy, sortOrder })

Returns the eligible epoch rewards for the specified block height. If no epoch index is provided, the current epoch is used.

```typescript
const ario = ARIO.init({ rpc });
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
const ario = ARIO.init({ rpc });
const observations = await ario.getObservations();
```

<details>
  <summary>Output</summary>

```json
{
  "failureSummaries": {
    "-Tk2DDk8k4zkwtppp_XFKKI5oUgh6IEHygAoN7mD-w8": [
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
```

</details>

#### `getDistributions({ epochIndex })`

Returns the current rewards distribution information. If no epoch index is provided, the current epoch is used.

```typescript
const ario = ARIO.init({ rpc });
const distributions = await ario.getDistributions({ epochIndex: 0 });
```

<details>
  <summary>Output</summary>

```json
{
  "totalEligibleGateways": 1,
  "totalEligibleRewards": 100000000,
  "totalEligibleObserverReward": 100000000,
  "totalEligibleGatewayReward": 100000000
}
```

#### `saveObservations({ reportTxId, failedGateways })`

Saves the observations of the current epoch. Requires `signer` to be provided on `ARIO.init` to sign the transaction.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.saveObservations(
  {
    reportTxId: "fDrr0_J4Iurt7caNST02cMotaz2FIbWQ4Kcj616RHl3",
    failedGateways: ["t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3"],
  },
  {
    tags: [{ name: "App-Name", value: "My-Awesome-App" }],
  },
);
```

</details>

#### `getPrescribedObservers({ epochIndex })`

Retrieves the prescribed observers of the ARIO process. To fetch prescribed observers for a previous epoch set the `epochIndex` to the desired epoch index.

```typescript
const ario = ARIO.init({ rpc });
const observers = await ario.getPrescribedObservers({ epochIndex: 0 });
```

<details>
<summary>Output</summary>

```json
[
  {
    "gatewayAddress": "BpQlyhREz4lNGS-y3rSS1WxADfxPpAuing9Lgfdrj2U",
    "observerAddress": "2Fk8lCmDegPg6jjprl57-UCpKmNgYiKwyhkU4vMNDnE",
    "stake": 10000000000,
    "startTimestamp": 1720720620813,
    "stakeWeight": 1,
    "tenureWeight": 0.41453703703703704,
    "gatewayPerformanceRatio": 1,
    "observerPerformanceRatio": 1,
    "gatewayRewardRatioWeight": 1,
    "observerRewardRatioWeight": 1,
    "compositeWeight": 0.41453703703703704,
    "normalizedCompositeWeight": 0.0018972019546783507
  }
]
```

</details>

#### `crankEpochStep(options?)`

High-level, permissionless epoch crank. Advances the epoch lifecycle by **one
step per call** and returns the action it took — run it on a loop (this is what
the standalone cranker and the observer-embedded cranker do). It owns the whole
sequence so you don't orchestrate the individual instructions yourself:

`create` → `tally` → `prescribe` → `distribute` → `close` — closing an epoch's
observation PDAs first (`close_observation`) so `close_epoch` doesn't revert —
plus an idle-tail of permissionless maintenance: `compound` delegate rewards,
`update_demand_factor`, and `prune_returned_names`. The close path is
non-wedging: a cleanup failure never blocks creation of the next epoch.

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });

// one step
const result = await ario.crankEpochStep();
// → { action, epochIndex?, txId?, progress? }
//   action ∈ create | tally | prescribe | distribute | close
//          | close_observation | compound | update_demand_factor
//          | prune_returned_names | idle

// or drive it on an interval
setInterval(async () => {
  const r = await ario.crankEpochStep();
  if (r.action !== 'idle') console.log(r.action, r.epochIndex, r.txId);
}, 60_000);
```

All options are optional: `batchSize`, `enableClose`, `epochRetention`,
`enableCompound`, `compoundMinPendingRewards`, `enableDemandFactorRoll`,
`enablePrune`, `pruneBatchSize`, `nameRegistryAccount`.

### Primary Names

#### `getPrimaryNames({ cursor, limit, sortBy, sortOrder })`

Retrieves all primary names paginated and sorted by the specified criteria. The `cursor` used for pagination is the last name from the previous request.

```typescript
const ario = ARIO.init({ rpc });
const names = await ario.getPrimaryNames({
  cursor: "ao", // this is the last name from the previous request
  limit: 1,
  sortBy: "startTimestamp",
  sortOrder: "desc",
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
  "nextCursor": "arns",
  "items": [
    {
      "name": "arns",
      "owner": "HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA",
      "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
      "startTimestamp": 1719356032297
    }
  ]
}
```

</details>

#### `getPrimaryName({ name, address })`

Retrieves the primary name for a given name or address.

```typescript
const ario = ARIO.init({ rpc });
const name = await ario.getPrimaryName({
  name: "arns",
});
// or
const name = await ario.getPrimaryName({
  address: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
});
```

<details>
  <summary>Output</summary>

```json
{
  "name": "arns",
  "owner": "HwFceQaMQnOBgKDpnFqCqgwKwEU5LBme1oXRuQOWSRA",
  "processId": "bh9l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "startTimestamp": 1719356032297
}
```

</details>

#### `setPrimaryName({ name })`

Sets an ArNS name already owned by the `signer` as their primary name. Note: `signer` must be the owner of the `processId` that is assigned to the name. If not, the transaction will fail.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
await ario.setPrimaryName({ name: 'my-arns-name' });
```

#### `requestPrimaryName({ name })`

Requests a primary name for the `signer`'s address. The request must be approved by the new owner of the requested name via the `approvePrimaryNameRequest`[#approveprimarynamerequest-name-address-] API.

_Note: Requires `signer` to be provided on `ARIO.init` to sign the transaction._

```typescript
const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
const { id: txId } = await ario.requestPrimaryName({
  name: "arns",
});
```

#### `getPrimaryNameRequest({ initiator })`

Retrieves the primary name request for a a wallet address.

```typescript
const ario = ARIO.init({ rpc });
const request = await ario.getPrimaryNameRequest({
  initiator: "t4Xr0_J4Iurt7caNST02cMotaz2FIbWQ4Kbj616RHl3",
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

`ARIO.init` accepts a `@solana/kit` RPC client plus optional program ID
overrides for non-mainnet clusters. See [Networks](#networks) above for
the full shape.

## ANT Contracts

The ANT client class exposes APIs for Arweave Name Tokens. On Solana an
ANT is a Metaplex Core asset; its `processId` is the asset's mint
pubkey. The `ario-ant` program owns the on-chain records / controllers
state attached to the asset.

### Initialize

#### `init({ processId, rpc, rpcSubscriptions?, signer? })`

Factory that creates a read-only or writeable ANT client. Providing
`signer` and `rpcSubscriptions` enables write methods (`setRecord`,
`transfer`, `addController`, etc.).

```typescript
import { ANT } from '@ar.io/sdk';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from '@solana/kit';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');

// Read-only
const ant = await ANT.init({
  processId: '<MPL Core asset pubkey>',
  rpc,
});

// Read + write
const antWrite = await ANT.init({
  processId: '<MPL Core asset pubkey>',
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions(
    'wss://api.mainnet-beta.solana.com',
  ),
  signer,
});
```

### Spawn

#### `ANT.spawn({ rpc, rpcSubscriptions, signer, state })`

Static factory that mints a new MPL Core asset and initializes the
`ario-ant` PDAs in a single transaction. Returns
`{ processId, mint, signature }`.

```typescript
import { ANT } from '@ar.io/sdk';

const { processId, signature } = await ANT.spawn({
  rpc,
  rpcSubscriptions,
  signer,
  state: {
    name: 'My ANT',
    ticker: 'MYANT',
    description: 'My ANT token',
    uri: 'ar://<metadata-tx-id>',
  },
});
```

**CLI Usage:**

```bash
ar.io spawn-ant \
  --wallet-file wallet.json \
  --name "My ANT" \
  --ticker "MYANT" \
  --metadata-uri "ar://<metadata-tx-id>"
```

**Parameters:**

- `state.name: string` — display name of the ANT
- `state.ticker?: string` — ticker symbol
- `state.description?: string` — short description
- `state.uri: string` — `ar://` URI of the Metaplex Core asset's JSON
  metadata. Build via `buildAntMetadata` from `@ar.io/sdk` and upload
  to Arweave (e.g. via `@ardrive/turbo-sdk`).
- `state.keywords?: string[]`
- `state.logo?: string` — Arweave TX ID of the logo
- `state.transactionId?: string` — initial `@` record target

**Returns:**

```ts
{
  processId: string;  // the MPL Core asset mint pubkey
  mint: Address;
  signature: string;  // the Solana tx signature
}
```

### Versions

#### `getModuleId({ graphqlUrl?, retries? })`

Gets the module ID of the current ANT process by querying its spawn transaction tags. Results are cached after the first successful fetch.

```typescript
const moduleId = await ant.getModuleId();
console.log(`ANT was spawned with module: ${moduleId}`);

// With custom GraphQL URL and retries
const moduleId = await ant.getModuleId({
  graphqlUrl: "https://arweave.net/graphql",
  retries: 5,
});
```

<details>
  <summary>Output</summary>

```json
"FKtQtOOtlcWCW2pXrwWFiCSlnuewMZOHCzhulVkyqBE"
```

</details>

#### `getVersion({ antRegistryId?, graphqlUrl?, retries? })`

Gets the version string of the current ANT by matching its module ID with versions from the ANT registry.

```typescript
const version = await ant.getVersion();
console.log(`ANT is running version: ${version}`);

// With custom ANT registry
const version = await ant.getVersion({
  antRegistryId: "custom-ant-registry-id",
});
```

<details>
  <summary>Output</summary>

```json
"23"
```

</details>

#### `isLatestVersion({ antRegistryId?, graphqlUrl?, retries? })`

Checks if the current ANT version is the latest according to the ANT registry.

```typescript
const isLatest = await ant.isLatestVersion();
if (!isLatest) {
  console.log("ANT can be upgraded to the latest version");
}
```

<details>
  <summary>Output</summary>

```json
true
```

</details>

### State

#### `getInfo()`

Retrieves the information of the ANT process.

```typescript
const info = await ant.getInfo();
```

<details>
  <summary>Output</summary>

```json
{
  "Name": "ArDrive",
  "Owner": "QGWqtJdLLgm2ehFWiiPzMaoFLD50CnGuzZIPEdoDRGQ",
  "Ticker": "ANT-ARDRIVE",
  "Total-Supply": "1",
  "Description": "This is the ANT for the ArDrive decentralized web app.",
  "Keywords": ["File-sharing", "Publishing", "dApp"],
  "Logo": "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A",
  "Denomination": "0",
  "Handlers": [
    "balance",
    "balances",
    "totalSupply",
    "info",
    "controllers",
    "record",
    "records",
    "state",
    "transfer",
    "addController",
    "removeController",
    "setRecord",
    "removeRecord",
    "setName",
    "setTicker",
    "setDescription",
    "setKeywords",
    "setLogo",
    "initializeState",
    "releaseName",
    "reassignName",
    "approvePrimaryName",
    "removePrimaryNames",
    "transferRecordOwnership",
    "_eval",
    "_default"
  ]
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
  "balance",
  "balances",
  "totalSupply",
  "info",
  "controllers",
  "record",
  "records",
  "state",
  "transfer",
  "addController",
  "removeController",
  "setRecord",
  "removeRecord",
  "setName",
  "setTicker",
  "setDescription",
  "setKeywords",
  "setLogo",
  "initializeState",
  "releaseName",
  "reassignName",
  "approvePrimaryName",
  "removePrimaryNames",
  "transferRecordOwnership",
  "_eval",
  "_default"
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
  "Name": "ar.io Foundation",
  "Ticker": "ANT-AR-IO",
  "Description": "A friendly description for this ANT.",
  "Keywords": ["keyword1", "keyword2", "keyword3"],
  "Denomination": 0,
  "Owner": "98O1_xqDLrBKRfQPWjF5p7xZ4Jx6GM8P5PeJn26xwUY",
  "Controllers": [],
  "Records": {
    "v1-0-0_whitepaper": {
      "transactionId": "lNjWn3LpyhKC95Kqe-x8X2qgju0j98MhucdDKK85vc4",
      "ttlSeconds": 900,
      "targetProtocol": 0
    },
    "@": {
      "transactionId": "2rMLb2uHAyEt7jSu6bXtKx8e-jOfIf7E-DOgQnm8EtU",
      "ttlSeconds": 3600,
      "targetProtocol": 0
    },
    "alice": {
      "transactionId": "kMk95k_3R8x_7d3wB9tEOiL5v6n8QhR_VnFCh3aeE3f",
      "ttlSeconds": 900,
      "targetProtocol": 0,
      "owner": "alice-wallet-address-123...",
      "displayName": "Alice's Portfolio",
      "logo": "avatar-tx-id-456...",
      "description": "Personal portfolio and blog",
      "keywords": ["portfolio", "personal", "blog"]
    },
    "whitepaper": {
      "transactionId": "lNjWn3LpyhKC95Kqe-x8X2qgju0j98MhucdDKK85vc4",
      "ttlSeconds": 900,
      "targetProtocol": 0
    }
  },
  "Balances": {
    "98O1_xqDLrBKRfQPWjF5p7xZ4Jx6GM8P5PeJn26xwUY": 1
  },
  "Logo": "Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A",
  "TotalSupply": 1,
  "Initialized": true
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

#### `getName()`

Returns the name of the ANT (not the same as ArNS name).

```typescript
const name = await ant.getName();
```

<details>
  <summary>Output</summary>

```json
"ArDrive"
```

</details>

#### `getTicker()`

Returns the ticker symbol of the ANT.

```typescript
const ticker = await ant.getTicker();
```

<details>
  <summary>Output</summary>

```json
"ANT-ARDRIVE"
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
    "ttlSeconds": 3600,
    "targetProtocol": 0,
    "index": 0
  },
  "alice": {
    "transactionId": "kMk95k_3R8x_7d3wB9tEOiL5v6n8QhR_VnFCh3aeE3f",
    "ttlSeconds": 900,
    "targetProtocol": 0,
    "owner": "alice-wallet-address-123...",
    "displayName": "Alice's Portfolio",
    "logo": "avatar-tx-id-456...",
    "description": "Personal portfolio and blog",
    "keywords": ["portfolio", "personal", "blog"],
    "index": 1
  },
  "zed": {
    "transactionId": "-k7t8xMoB8hW482609Z9F4bTFMC3MnuW8bTvTyT8pFI",
    "ttlSeconds": 900,
    "targetProtocol": 0,
    "index": 2
  },
  "ardrive": {
    "transactionId": "-cucucachoodwedwedoiwepodiwpodiwpoidpwoiedp",
    "ttlSeconds": 900,
    "targetProtocol": 0,
    "index": 3
  }
}
```

</details>

#### `getRecord({ undername })`

Returns a specific record by its undername.

```typescript
const record = await ant.getRecord({ undername: "dapp" });
```

<details>
  <summary>Output</summary>

```json
{
  "transactionId": "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  "ttlSeconds": 900,
  "targetProtocol": 0,
  "owner": "alice-wallet-address-123...",
  "displayName": "Alice's Site",
  "logo": "avatar-tx-id-456...",
  "description": "Personal portfolio and blog",
  "keywords": ["portfolio", "personal", "blog"]
}
```

</details>

### Balances

#### `getBalances()`

Returns all token balances for the ANT.

```typescript
const balances = await ant.getBalances();
```

<details>
  <summary>Output</summary>

```json
{
  "ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4": 1,
  "aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f": 0
}
```

</details>

#### `getBalance({ address })`

Returns the balance of a specific address.

```typescript
const balance = await ant.getBalance({
  address: "ccp3blG__gKUvG3hsGC2u06aDmqv4CuhuDJGOIg0jw4",
});
```

<details>
  <summary>Output</summary>

```json
1
```

</details>

### Transfer

#### `transfer({ target })`

Transfers ownership of the ANT to a new target address. Target MUST be an Arweave address.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.transfer(
  { target: "aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f" },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

### Controllers

#### `addController({ controller })`

Adds a new controller to the list of approved controllers on the ANT. Controllers can set records and change the ticker and name of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.addController(
  { controller: "aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f" },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `removeController({ controller })`

Removes a controller from the list of approved controllers on the ANT.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removeController(
  { controller: "aGzM_yjralacHIUo8_nQXMbh9l1cy0aksiL_x9M359f" },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

### Records

#### `setBaseNameRecord({ transactionId, ttlSeconds, owner?, displayName?, logo?, description?, keywords? })`

Adds or updates the base name record for the ANT. This is the top level name of the ANT (e.g. ardrive.ar.io). Supports undername ownership delegation and metadata.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
// get the ant for the base name
const arnsRecord = await ario.getArNSRecord({ name: "ardrive" });
const ant = await ANT.init({ processId: arnsName.processId });

// Basic usage
const { id: txId } = await ant.setBaseNameRecord({
  transactionId: "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  ttlSeconds: 3600,
});

// With ownership delegation and metadata
const { id: txId } = await ant.setBaseNameRecord({
  transactionId: "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
  ttlSeconds: 3600,
  owner: "user-wallet-address-123...", // delegate ownership to another address
  displayName: "ArDrive", // display name
  logo: "logo-tx-id-123...", // logo transaction ID
  description: "Decentralized storage application",
  keywords: ["storage", "decentralized", "web3"],
});

// ardrive.ar.io will now resolve to the provided transaction id and include metadata
```

#### `setUndernameRecord({ undername, transactionId, ttlSeconds, owner?, displayName?, logo?, description?, keywords? })`

Adds or updates an undername record for the ANT. An undername is appended to the base name of the ANT (e.g. dapp_ardrive.ar.io). Supports undername ownership delegation and metadata.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

> Records, or `undernames` are configured with the `transactionId` - the arweave transaction id the record resolves - and `ttlSeconds`, the Time To Live in the cache of client applications.

```typescript
const arnsRecord = await ario.getArNSRecord({ name: "ardrive" });
const ant = await ANT.init({ processId: arnsName.processId });

// Basic usage
const { id: txId } = await ant.setUndernameRecord(
  {
    undername: "dapp",
    transactionId: "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
    ttlSeconds: 900,
  },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);

// With ownership delegation and metadata
const { id: txId } = await ant.setUndernameRecord(
  {
    undername: "alice",
    transactionId: "432l1cy0aksiL_x9M359faGzM_yjralacHIUo8_nQXM",
    ttlSeconds: 900,
    owner: "alice-wallet-address-123...", // delegate ownership to Alice
    displayName: "Alice's Site", // display name
    logo: "avatar-tx-id-123...", // avatar/logo transaction ID
    description: "Personal portfolio and blog",
    keywords: ["portfolio", "personal", "blog"],
  },
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);

// dapp_ardrive.ar.io will now resolve to the provided transaction id
// alice_ardrive.ar.io will be owned by Alice and include metadata
```

#### `removeUndernameRecord({ undername })`

Removes an undername record from the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.removeUndernameRecord(
  { undername: "dapp" },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
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
const arnsRecord = await ario.getArNSRecord({ name: "ardrive" });
const ant = await ANT.init({ processId: arnsName.processId });
const { id: txId } = await ant.removeRecord(
  { undername: "dapp" },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);

// dapp_ardrive.ar.io will no longer resolve to the provided transaction id
```

### Metadata

#### `setName({ name })`

Sets the name of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setName(
  { name: "My ANT" },
  // optional additional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `setTicker({ ticker })`

Sets the ticker of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setTicker(
  { ticker: "ANT-NEW-TICKER" },
  // optional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `setDescription({ description })`

Sets the description of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setDescription(
  { description: "A friendly description of this ANT" },
  // optional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

#### `setKeywords({ keywords })`

Sets the keywords of the ANT process.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.setKeywords(
  { keywords: ["Game", "FPS", "AO"] },
  // optional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
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
  { txId: "U7RXcpaVShG4u9nIcPVmm2FJSM5Gru9gQCIiRaIPV7f" },
  // optional tags
  { tags: [{ name: "App-Name", value: "My-Awesome-App" }] },
);
```

### ARIO Integrations

`releaseName`, `reassignName`, `approvePrimaryNameRequest`, and
`removePrimaryNames` were AO-only orchestration helpers and have been
removed. Their on-chain equivalents on Solana live on the `ario-arns`
program and are exposed through the `ARIO` write client
(`upgradeRecord`, `setPrimaryName`, etc.) or — for permissionless
maintenance — through `SolanaARIOWriteable`'s prune helpers.

### Upgrade

#### `upgrade()`

Migrates this ANT's on-chain state to the latest schema version (per-
ANT data migration on Solana — no process forking, no name
reassignment). Returns `{ id, needsMigration }`.

```typescript
const result = await ant.upgrade();
if (result.needsMigration) {
  console.log(`Migrated: ${result.id}`);
}
```

### Undername Ownership

NTs support ownership of undernames:

1. **ANT Owner** - Has full control over the ANT and all records
2. **Controllers** - Can manage records but cannot transfer ANT ownership
3. **Record Owners** - Can only update their specific delegated records

> [!WARNING]
> When a record owner updates their own record, they **MUST** include their own address in the `owner` field. If the `owner` field is omitted or set to a different address, the record ownership will be transferred or renounced.

#### `transferRecord({ undername, recipient })`

Transfers ownership of a specific record (undername) to another address. This enables delegation of control for individual records within an ANT while maintaining the ANT owner's ultimate authority. The current record owner or ANT owner/controllers can transfer ownership.

_Note: Requires `signer` to be provided on `ANT.init` to sign the transaction._

```typescript
const { id: txId } = await ant.transferRecord({
  undername: "alice", // the subdomain/record to transfer
  recipient: "new-owner-address-123...", // address of the new owner
});

// alice_ardrive.ar.io is now owned by the new owner address
// The new owner can update the record but not other records in the ANT
```

**CLI Usage:**

```bash
# Transfer ownership of a record using the CLI
ar.io transfer-record \
  --process-id "ANT_PROCESS_ID" \
  --undername "alice" \
  --recipient "new-owner-address-123..." \
  --wallet-file "path/to/wallet.json"
```

#### Record Owner Workflow Examples

**Checking Record Ownership:**

```typescript
const record = await ant.getRecord({ undername: "alice" });
console.log(`Record owner: ${record.owner}`);
console.log(`Transaction ID: ${record.transactionId}`);
```

**Record Owner Updating Their Own Record:**

```typescript
// Alice (record owner) updating her own record
const aliceAnt = await ANT.init({
  processId: 'ANT_MINT_PUBKEY',
  rpc,
  rpcSubscriptions,
  signer: aliceSigner, // Alice's @solana/kit signer
});

// ✅ CORRECT: Alice includes her own address as owner
const { id: txId } = await aliceAnt.setUndernameRecord({
  undername: "alice",
  transactionId: "new-content-tx-id-456...",
  ttlSeconds: 1800,
  owner: "alice-wallet-address-123...", // MUST be Alice's own address
  displayName: "Alice Updated Portfolio",
  description: "Updated personal portfolio and blog",
});

// ❌ WRONG: Omitting owner field will renounce ownership
const badUpdate = await aliceAnt.setUndernameRecord({
  undername: "alice",
  transactionId: "new-content-tx-id-456...",
  ttlSeconds: 1800,
  // Missing owner field - this will renounce ownership!
});

// ❌ WRONG: Setting different owner will transfer ownership
const badTransfer = await aliceAnt.setUndernameRecord({
  undername: "alice",
  transactionId: "new-content-tx-id-456...",
  ttlSeconds: 1800,
  owner: "someone-else-address-789...", // This transfers ownership to someone else!
});
```

**What Happens When Record Ownership is Renounced:**

If a record owner updates their record without including the `owner` field, the record becomes owned by the ANT owner/controllers again:

```typescript
// Before: alice record is owned by alice-wallet-address-123...
const recordBefore = await ant.getRecord({ undername: "alice" });
console.log(recordBefore.owner); // "alice-wallet-address-123..."

// Alice updates without owner field
await aliceAnt.setUndernameRecord({
  undername: "alice",
  transactionId: "new-tx-id...",
  ttlSeconds: 900,
  // No owner field = renounces ownership
});

// After: record ownership reverts to ANT owner
const recordAfter = await ant.getRecord({ undername: "alice" });
console.log(recordAfter.owner); // undefined (controlled by ANT owner again)
```

### Static Methods

`ANT.fork()` and the static `ANT.upgrade()` were AO-only (process
forking + name reassignment). On Solana, schema migration is a
per-asset CPI exposed as the instance method `ant.upgrade()` documented
above; new ANTs are created with `ANT.spawn()`.

## Escrow

Trustless, multi-protocol escrow for handing an asset to a recipient identified by
an **Arweave** or **Ethereum** address, claimable once they hold a Solana wallet.
Backed by the `ario-ant-escrow` program. Two clients:

- `TokenEscrow` — escrow liquid **ARIO** (SPL) or a **time-locked vault**.
- `ANTEscrow` — escrow an **ANT** (Metaplex Core NFT).

Each supports **deposit → claim → cancel/refund → update-recipient**. Claims work
three ways: **Arweave-attested** (an off-chain attestor re-signs the canonical
claim with Ed25519, verified on-chain), **Ethereum** (on-chain `secp256k1_recover`
+ EIP-191), and **vault** (instruction introspection that preserves the remaining
lock).

```typescript
import { TokenEscrow, canonicalMessageV2 } from '@ar.io/sdk';

const escrow = new TokenEscrow({
  rpc,
  rpcSubscriptions,
  signer,
  programId,
  coreProgram,
});

// deposit 50 ARIO to an Ethereum recipient
await escrow.depositTokens({
  assetId, // 32-byte client-supplied id
  amount: 50_000_000n,
  arioMint,
  depositorTokenAccount,
  recipient: { protocol: 'ethereum', publicKey: ethAddress20 },
});

// the recipient claims (Ethereum path) once they have a Solana wallet
await escrow.claimTokensEthereum({
  depositor,
  assetId,
  claimant,
  claimantTokenAccount,
  escrowTokenAccount,
  signature, // recipient's EIP-191 signature over canonicalMessageV2(...)
});
```

Build the exact bytes a recipient signs with `canonicalMessage` /
`canonicalMessageV2` — byte-identical to the on-chain program (and the off-chain
attestor). See the contracts repo's escrow design + protocol spec for the full
flow and the cross-language canonical-message vectors.

## Token Conversion

The ARIO process stores all values as mARIO (micro-ARIO) to avoid floating-point arithmetic issues. The SDK provides an `ARIOToken` and `mARIOToken` classes to handle the conversion between ARIO and mARIO, along with rounding logic for precision.

**All process interactions expect values in mARIO. If numbers are provided as inputs, they are assumed to be in raw mARIO values.**

#### Converting ARIO to mARIO

```typescript
import { ARIOToken, mARIOToken } from "@ar.io/sdk";

const arioValue = 1;
const mARIOValue = new ARIOToken(arioValue).toMARIO();

const mARIOValue = 1_000_000;
const arioValue = new mARIOToken(mARIOValue).toARIO();
```

## Logging

The library uses a lightweight console logger by default for both Node.js and web environments. The logger outputs structured JSON logs with timestamps. You can configure the log level via `setLogLevel()` API or provide a custom logger that satisfies the `ILogger` interface.

#### Default Logger

```typescript
import { Logger } from "@ar.io/sdk";

// set the log level
Logger.default.setLogLevel("debug");

// Create a new logger instance with a specific level
const logger = new Logger({ level: "debug" });
```

#### Custom Logger Implementation

You can provide any custom logger that implements the `ILogger` interface:

```typescript
import { ARIO, ILogger } from "@ar.io/sdk";

// Custom logger example
const customLogger: ILogger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
  setLogLevel: (level) => {
    /* implement level filtering */
  },
};

// Set it as the default logger across the entire SDK — every class
// (ARIO, ANT, ANTRegistry, etc.) will route logs through it. `ARIO.init`
// does not accept a per-instance logger.
Logger.default = customLogger;
```

## Pagination

#### Overview

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

#### Filtering

Paginated APIs also support filtering by providing a `filters` parameter. Filters can be applied to any field in the response. When multiple keys are provided, they are treated as AND conditions (all conditions must match). When multiple values are provided for a single key (as an array), they are treated as OR conditions (any value can match).

Example:

```typescript
const records = await ario.getArNSRecords({
  filters: {
    type: "lease",
    processId: [
      "ZkgLfyHALs5koxzojpcsEFAKA8fbpzP7l-tbM7wmQNM",
      "r61rbOjyXx3u644nGl9bkwLWlWmArMEzQgxBo2R-Vu0",
    ],
  },
});
```

In the example above, the query will return ArNS records where:

- The type is "lease" AND
- The processId is EITHER "ZkgLfyHALs5koxzojpcsEFAKA8fbpzP7l-tbM7wmQNM" OR "r61rbOjyXx3u644nGl9bkwLWlWmArMEzQgxBo2R-Vu0"

## Advanced

### RPC Configuration

The SDK accepts any `@solana/kit` RPC client. For read-only usage, only
`rpc` is required. Write operations additionally need `rpcSubscriptions`
(WebSocket) for transaction confirmation and a `signer`.

#### Basic (read-only)

```ts
import { ARIO } from '@ar.io/sdk';
import { createSolanaRpc } from '@solana/kit';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const ario = ARIO.init({ rpc });
```

#### With writes (signer + WebSocket subscriptions)

```ts
import { ARIO } from '@ar.io/sdk';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
} from '@solana/kit';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const rpcSubscriptions = createSolanaRpcSubscriptions(
  'wss://api.mainnet-beta.solana.com',
);
const signer = await createKeyPairSignerFromBytes(/* ... */);

const ario = ARIO.init({ rpc, rpcSubscriptions, signer });
```

> **Note:** `rpcSubscriptions` opens a WebSocket connection and is only
> needed for writes. If your RPC provider doesn't expose a WebSocket
> endpoint, omit it and use the SDK in read-only mode.

### Circuit Breaker

The SDK ships an [opossum]-backed circuit breaker that wraps the RPC
transport. When the primary endpoint starts failing (429 rate-limits,
5xx errors, network timeouts) the circuit opens and subsequent calls
route transparently to a fallback RPC until the primary recovers.

```ts
import { ARIO, createCircuitBreakerRpc } from '@ar.io/sdk';

const rpc = createCircuitBreakerRpc({
  primaryUrl: 'https://my-premium-rpc.example.com',
  fallbackUrl: 'https://api.mainnet-beta.solana.com',
});

const ario = ARIO.init({ rpc });
```

Use `defaultFallbackUrl()` to auto-pick mainnet or devnet based on the
primary URL:

```ts
import {
  createCircuitBreakerRpc,
  defaultFallbackUrl,
} from '@ar.io/sdk';

const primaryUrl = 'https://my-premium-rpc.example.com';
const rpc = createCircuitBreakerRpc({
  primaryUrl,
  fallbackUrl: defaultFallbackUrl(primaryUrl), // → mainnet public RPC
});
```

Tuning knobs (all optional):

| Option | Default | Description |
|---|---|---|
| `timeout` | `10000` | ms before a single request is timed out (`false` to disable) |
| `errorThresholdPercentage` | `50` | error % at which to open the circuit |
| `resetTimeout` | `30000` | ms to wait before probing the primary again (half-open) |
| `volumeThreshold` | `5` | minimum requests in the rolling window before the circuit can trip |

### Automatic Retries

All RPC **read** calls (account fetches, `getProgramAccounts`, etc.)
automatically retry on transient transport errors with exponential
back-off. Writes are **not** retried (to avoid double-sends).

Retried errors: HTTP 429/5xx, `fetch failed`, `ECONNRESET`,
`ETIMEDOUT`, `AbortError` / timeouts. Non-retryable errors (account
not found, invalid params, deserialization) throw immediately.

Defaults: **6 attempts**, 500 ms base delay, 5 s max delay. Override
per-call with the exported `withRetry` helper:

```ts
import { withRetry } from '@ar.io/sdk';

const result = await withRetry(() => rpc.getAccountInfo(addr).send(), {
  maxAttempts: 3,
  baseDelayMs: 1000,
});
```

### Generated instruction builders

For custom transaction building, import Codama-generated typed clients
from [`@ar.io/solana-contracts`](https://www.npmjs.com/package/@ar.io/solana-contracts):

```ts
import {
  getBuyNameInstructionAsync,
  ARIO_ARNS_PROGRAM_ADDRESS,
} from '@ar.io/solana-contracts/arns';
```

### Networks

| Network | RPC | Programs |
|---|---|---|
| Mainnet | `https://api.mainnet-beta.solana.com` (mainnet-beta, default) | Not yet deployed — placeholder IDs in `src/solana/constants.ts` |
| Devnet | `https://api.devnet.solana.com` | See `src/solana/constants.ts` for current devnet program IDs |
| Localnet | Surfpool — `https://github.com/solana-foundation/surfpool` | Localnet harness in `solana-ar-io` monorepo |

The migration tooling (snapshot exporter, batch importer, claim app)
lives in the [`solana-ar-io`](https://github.com/ar-io/solana-ar-io)
monorepo until cutover.

## Resources

### Bundling

For [ANS-104] bundling compatible with ar.io gateways, we recommend using [turbo-sdk](https://github.com/ardriveapp/turbo-sdk). Turbo SDK provides efficient and reliable methods for creating and uploading data bundles to the Arweave network, which are fully compatible with ar.io gateways. Turbo supports fiat and crypto bundling and uploading with a focus on ease of use and reliability.

### ar.io Gateways

### Running a Gateway

To run your own ar.io gateway, you can refer to the following resources:

- [ar-io-node repository]: This repository contains the source code and instructions for setting up and running an ar.io gateway node.
- [ar.io Gateway Documentation]: This comprehensive guide provides detailed information on gateway setup, configuration, and management.

Running your own gateway allows you to participate in the ar.io network, serve Arweave data, and potentially earn rewards. Make sure to follow the official documentation for the most up-to-date and accurate information on gateway operation.

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
[examples]: ./examples
[examples/webpack]: ./examples/webpack
[examples/vite]: ./examples/vite
[CONTRIBUTING.md]: ./CONTRIBUTING.md
[ar-io-node repository]: https://github.com/ar-io/ar-io-node
[ar.io Gateway Documentation]: https://docs.ar.io/gateways/ar-io-node/overview/
[ANS-104]: https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md
[opossum]: https://nodeshift.dev/opossum/

```

```