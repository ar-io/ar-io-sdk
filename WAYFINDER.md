# Wayfinder

Wayfinder is a client-side routing and verification solution for Arweave content. It enables applications to retrieve data through decentralized gateways while ensuring integrity through cryptographic verification.

## Quick Start

### Installation

Wayfinder is currently available as a beta release in the `@ar.io/sdk` package. To install the latest version, run:

```bash
npm install @ar.io/sdk@beta
# or
yarn add @ar.io/sdk@beta
```

### Basic Usage

```javascript
import { Wayfinder } from '@ar.io/sdk';

// create a new Wayfinder instance with default settings
const wayfinder = new Wayfinder();

// use Wayfinder to fetch and verify data using ar:// protocol
const response = await wayfinder.request('ar://example-name');
```

### Custom Configuration

You can customize the wayfinder instance with different gateways, verification strategies, and routing strategies based on your use case.

Example:

> _Wayfinder client that caches the top 10 gateways by operator stake from the ARIO Network for 1 hour and uses the fastest pinging routing strategy to select the fastest gateway for requests._

```javascript
const wayfinder = new Wayfinder({
  // cache the top 10 gateways by operator stake from the ARIO Network for 1 hour
  gatewaysProvider: new SimpleCacheGatewaysProvider({
    ttlSeconds: 60 * 60, // cache the gateways for 1 hour
    gatewaysProvider: new NetworkGatewaysProvider({
      ario: ARIO.mainnet(),
      sortBy: 'operatorStake',
      sortOrder: 'desc',
      limit: 10,
    }),
  }),
  // use the fastest pinging strategy to select the fastest gateway for requests
  routingStrategy: new FastestPingRoutingStrategy({
    timeoutMs: 1000,
    probePath: '/ar-io/info',
  }),
  // verify the data using the hash of the data against a list of trusted gateways
  verificationStrategy: new HashVerificationStrategy({
    trustedHashProvider: new TrustedGatewaysHashProvider({
      gatewaysProvider: new StaticGatewaysProvider({
        gateways: ['https://arweave.net'],
      }),
    }),
  }),
});
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

Gateway providers are responsible for providing a list of gateways to Wayfinder to choose from when routing requests. By default, Wayfinder will use the `NetworkGatewaysProvider` to get a list of gateways from the ARIO Network.

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

The static gateway provider returns a list of gateways that you provide. This is useful for testing or for users who want to use a specific gateway for all requests.

```javascript
const gatewayProvider = new StaticGatewaysProvider({
  gateways: ['https://arweave.net'],
});
```

## Routing Strategies

Wayfinder supports multiple routing strategies to select target gateways for your requests.

| Strategy                     | Description                                    | Use Case                                |
| ---------------------------- | ---------------------------------------------- | --------------------------------------- |
| `RandomRoutingStrategy`      | Selects a random gateway from a list           | Good for load balancing and resilience  |
| `StaticRoutingStrategy`      | Always uses a single gateway                   | When you need to use a specific gateway |
| `RoundRobinRoutingStrategy`  | Selects gateways in round-robin order          | Good for load balancing and resilience  |
| `FastestPingRoutingStrategy` | Selects the fastest gateway based on ping time | Good for performance and latency        |

### RandomRoutingStrategy

Selects a random gateway from a list of gateways.

```javascript
const routingStrategy = new RandomRoutingStrategy();

const gateway = await routingStrategy.selectGateway({
  gateways: ['https://arweave.net', 'https://permagate.io'],
});
```

### StaticRoutingStrategy

```javascript
const routingStrategy = new StaticRoutingStrategy({
  gateway: 'https://arweave.net',
});

const gateway = await routingStrategy.selectGateway(); // always returns the same gateway
```

### RoundRobinRoutingStrategy

Selects gateways in round-robin order. The gateway list is stored in memory and is not persisted across instances.

```javascript
const gatewayProvider = new NetworkGatewaysProvider({
  ario: ARIO.mainnet(),
  sortBy: 'operatorStake',
  sortOrder: 'desc',
  limit: 10,
});

// provide the gateways to the routing strategy on initialization to track the request count per gateway.
// Any additional gateways provided to the selectGateway method will be ignored.
const routingStrategy = new RoundRobinRoutingStrategy({
  gateways: await gatewayProvider.getGateways(),
});

const gateway = await routingStrategy.selectGateway(); // returns the next gateway in the list
```

### FastestPingRoutingStrategy

Selects the fastest gateway based simple HEAD request to the specified route.

```javascript
const routingStrategy = new FastestPingRoutingStrategy({
  timeoutMs: 1000,
  probePath: '/ar-io/info',
});

// will select the fastest gateway from the list based on the ping time of the /ar-io/info route
const gateway = await routingStrategy.selectGateway({
  gateways: ['https://slow.net', 'https://medium.net', 'https://fast.net'],
});
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
    participant Gateways Provider
    participant Routing Strategy
    participant Selected Gateway
    participant Verification Strategy
    participant Trusted Gateways

    Client->>Wayfinder: request('ar://example')
    activate Wayfinder

    Wayfinder->>+Gateways Provider: getGateways()
    Gateways Provider-->>-Wayfinder: List of gateway URLs

    Wayfinder->>+Routing Strategy: selectGateway() from list of gateways
    Routing Strategy-->>-Wayfinder: Select gateway for request

    Wayfinder->>+Selected Gateway: Send HTTP request to target gateway
    Selected Gateway-->>-Wayfinder: Response with data & txId

    activate Verification Strategy
    Wayfinder->>+Verification Strategy: verifyData(responseData, txId)
    Verification Strategy->>Wayfinder: Emit 'verification-progress' events
    Verification Strategy->>Trusted Gateways: Request verification headers
    Trusted Gateways-->>Verification Strategy: Return verification headers
    Verification Strategy->>Verification Strategy: Compare computed vs trusted data
    Verification Strategy-->>-Wayfinder: Return request data with verification result

    alt Verification passed
        Wayfinder->>Wayfinder: Emit 'verification-passed' event
        Wayfinder-->>Client: Return verified response
    else Verification failed
        Wayfinder->>Wayfinder: Emit 'verification-failed' event
        Wayfinder-->>Client: Throw verification error
    end

    deactivate Wayfinder
```
