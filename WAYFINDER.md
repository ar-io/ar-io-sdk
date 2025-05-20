# Wayfinder

Wayfinder is a client-side routing and verification solution for Arweave content. It enables applications to retrieve data through decentralized gateways while ensuring integrity through cryptographic verification.

## Quick Start

```javascript
import { Wayfinder } from '@ar-io/sdk';

// create a new Wayfinder instance with default settings
const wayfinder = new Wayfinder();

// use Wayfinder to fetch and verify data using ar:// protocol
const response = await wayfinder.request('ar://example-name');
```

## ar:// Protocol

Wayfinder supports several ar:// URL formats:

```bash
ar://TRANSACTION_ID              // Direct transaction ID
ar://NAME                        // ArNS name
ar:///info                       // Gateway endpoint (/info)
ar://NAME/path/to/resource       // ArNS with path
```

## Gateway Providers

Gateway providers are responsible for providing a list of gateways to Wayfinder. By default, Wayfinder will use the ARIO Network gateway provider. This is a good choice for most users.

### NetworkGatewaysProvider

Returns a list of gateways from the ARIO Network based on on-chain metrics. You can specify on-chain metrics for gateways to prioritize the highest quality gateways. This is the default gateway provider and is recommended for most users.

```javascript
// requests will be routed to one of the top 10 gateways by operator stake
const gatewayProvider = new NetworkGatewaysProvider({
  ario: ARIO.mainnet(),
  sortBy: 'operatorStake', // sort by operator stake | 'totalDelegatedStake'
  sortOrder: 'desc', // 'asc'
  limit: 10, // number of gateways to return
});
```

### Static Gateway Provider

The static gateway provider is a good choice for users who want to use a specific gateway. This is useful for testing or for users who want to use a specific gateway for all requests.

```javascript
const gatewayProvider = new StaticGatewaysProvider({
  gateways: ['https://arweave.net'],
});
```

## Routing Strategies

Wayfinder supports multiple routing strategies to select target gateways for your requests.

| Router                       | Description                                    | Use Case                                |
| ---------------------------- | ---------------------------------------------- | --------------------------------------- |
| `RandomRoutingStrategy`      | Selects a random gateway from a list           | Good for load balancing and resilience  |
| `StaticRoutingStrategy`      | Always uses a single gateway                   | When you need to use a specific gateway |
| `RoundRobinRoutingStrategy`  | Selects gateways in round-robin order          | Good for load balancing and resilience  |
| `FastestPingRoutingStrategy` | Selects the fastest gateway based on ping time | Good for performance and latency        |

### RandomGatewayRouter

Selects a random gateway.

```javascript
const routingStrategy = new RandomRoutingStrategy();
```

### StaticGatewayRouter

Always uses a single gateway.

```javascript
const routingStrategy = new StaticRoutingStrategy({
  gateway: 'https://arweave.net',
});
```

### RoundRobinGatewayRouter

Selects gateways in round-robin order. Currently only supports in-memory storage of routing history.

```javascript
const routingStrategy = new RoundRobinRoutingStrategy();
```

## Verification Strategies

Wayfinder includes verification mechanisms to ensure the integrity of retrieved data. Verification strategies offer different trade-offs between complexity, performance, and security.

| Verifier                        | Complexity | Performance | Security | Description                                                                                                  |
| ------------------------------- | ---------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `HashVerificationStrategy`      | Low        | High        | Low      | Verifies data integrity using SHA-256 hash comparison                                                        |
| `DataRootVerificationStrategy`  | Medium     | Medium      | Low      | Verifies data using Arweave by computing the data root for the transaction (most useful for L1 transactions) |
| `SignatureVerificationStrategy` | Medium     | Medium      | Medium   | Verifies signature of n Arweave transaction or data item using offsets provided by trusted gateway           |

### HashVerificationStrategy

Verifies data integrity using SHA-256 hash comparison. This is the default verification strategy and is recommended for most users looking for a balance between security and performance.

```javascript
import {
  HashVerificationStrategy,
  StaticGatewaysProvider,
  TrustedGatewaysHashProvider,
} from '@ar-io/sdk';

const wayfinder = new Wayfinder({
  verificationStrategy: new HashVerificationStrategy({
    // provide a list of trusted gateways
    trustedHashProvider: new TrustedGatewaysHashProvider({
      gatewaysProvider: new StaticGatewaysProvider({
        gateways: ['https://permagate.io'],
      }),
    }),
  }),
});
```

### DataRootVerificationStrategy

Verifies data integrity using Arweave by computing the data root for the transaction. This is useful for L1 transactions and is recommended for users who want to ensure the integrity of their data.

```javascript
import {
  DataRootVerificationStrategy,
  StaticGatewaysProvider,
  TrustedGatewaysDataRootProvider,
} from '@ar-io/sdk';

const wayfinder = new Wayfinder({
  verificationStrategy: new DataRootVerificationStrategy({
    trustedDataRootProvider: new TrustedGatewaysDataRootProvider({
      gatewaysProvider: new StaticGatewaysProvider({
        gateways: ['https://arweave.net'],
      }),
    }),
  }),
});
```

## Monitoring and Events

Wayfinder emits events during the routing and verification process, allowing you to monitor its operation.

```javascript
const wayfinder = new Wayfinder({
  events: {
    onVerificationPassed: (event) => {
      console.log(`Verification passed for transaction: ${event.txId}`);
    },
    onVerificationFailed: (event) => {
      console.error(
        `Verification failed for transaction: ${event.txId}`,
        event.error,
      );
    },
    onVerificationProgress: (event) => {
      const percentage = (event.processedBytes / event.totalBytes) * 100;
      console.log(
        `Verification progress for ${event.txId}: ${percentage.toFixed(2)}%`,
      );
    },
  },
});

// Or use the event emitter directly
wayfinder.emitter.on('routing-succeeded', (event) => {
  console.log(`Request routed to: ${event.targetGateway}`);
});

wayfinder.emitter.on('routing-failed', (event) => {
  console.error(`Routing failed: ${event.error.message}`);
});
```

## Advanced Usage

### Custom URL Resolution

```javascript
// Get the resolved URL without making a request
const redirectUrl = await wayfinder.resolveUrl({
  originalUrl: 'ar://example-name',
});
console.log(`This request would be routed to: ${redirectUrl}`);
```

### Using With Different HTTP Clients

By default, Wayfinder uses native `fetch` for HTTP requests. You can also use other HTTP clients like `axios` or `node-fetch`. When making a request, Wayfinder will use the HTTP client you provide and any additional configuration you provide.

```javascript
import axios from 'axios';

// create a custom axios instance
const axios = axios.create({
  timeout: 10000,
});
const wayfinderAxios = new Wayfinder({ httpClient: axios });

// add custom headers on the request
const response = await wayfinderAxios.request('ar://example', {
  headers: {
    'X-Custom-Header': 'test',
  },
});
```

## Request Flow

The following sequence diagram illustrates how Wayfinder processes requests:

```mermaid
sequenceDiagram
    participant Client
    participant Wayfinder
    participant WayfinderRouter
    participant ARIO Network
    participant Target Gateway
    participant DataVerifier
    participant Trusted Gateways

    Client->>Wayfinder: request('ar://example')
    activate Wayfinder

    Wayfinder->>+WayfinderRouter: getTargetGateway()
    WayfinderRouter->>+ARIO Network: getGateways()
    ARIO Network-->>-WayfinderRouter: List of gateway URLs
    WayfinderRouter-->>-Wayfinder: Selected gateway URL

    Wayfinder->>+Target Gateway: HTTP request
    Target Gateway-->>-Wayfinder: Response with data & txId

    activate DataVerifier
    Wayfinder->>+DataVerifier: verifyData(responseData, txId)
    DataVerifier->>DataVerifier: Calculate verification data
    DataVerifier->>Wayfinder: Emit 'verification-progress' events
    DataVerifier->>Trusted Gateway: Request verification headers
    Trusted Gateway-->>DataVerifier: Return verification headers
    DataVerifier->>DataVerifier: Compare computed vs trusted data
    DataVerifier-->>-Wayfinder: Verification result

    alt Verification passed
        Wayfinder->>Wayfinder: Emit 'verification-passed' event
        Wayfinder-->>Client: Return verified response
    else Verification failed
        Wayfinder->>Wayfinder: Emit 'verification-failed' event
        Wayfinder-->>Client: Throw verification error
    end

    deactivate Wayfinder
```
