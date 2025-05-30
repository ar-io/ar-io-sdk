import {
  ARIO,
  HashVerificationStrategy,
  NetworkGatewaysProvider,
  SimpleCacheGatewaysProvider,
  StaticGatewaysProvider,
  TrustedGatewaysHashProvider,
  Wayfinder,
} from '@ar.io/sdk/web';
import { useEffect, useState } from 'react';

// @ts-ignore
const wayfinder = new Wayfinder({
  gatewaysProvider: new SimpleCacheGatewaysProvider({
    ttlSeconds: 60,
    gatewaysProvider: new NetworkGatewaysProvider({
      ario: ARIO.mainnet(),
      sortBy: 'operatorStake',
      sortOrder: 'desc',
      limit: 5,
    }),
  }),
  verificationStrategy: new HashVerificationStrategy({
    trustedHashProvider: new TrustedGatewaysHashProvider({
      gatewaysProvider: new StaticGatewaysProvider({
        gateways: ['https://permagate.io'],
      }),
    }),
  }),
});

export const WayfinderExample = () => {
  const [wayfinderStatusUpdates, setWayfinderStatusUpdates] = useState(
    new Set<string>(),
  );
  const [wayfinderResponse, setWayfinderResponse] = useState<any>(null);
  const [wayfinderVerificationProgress, setWayfinderVerificationProgress] =
    useState<number>(0);
  const [wayfinderUrl, setWayfinderUrl] = useState<string>('');

  useEffect(() => {
    setWayfinderStatusUpdates(new Set());
    setWayfinderResponse(null);
    setWayfinderVerificationProgress(0);
    if (wayfinderUrl) {
      const resolveUrl = async () => {
        wayfinder
          .request(wayfinderUrl)
          .then(async (res) => {
            setWayfinderResponse({
              data: await res.text(),
              txId: (res as any).txId,
              status: res.status,
              headers: Object.fromEntries(res.headers.entries()),
            });
          })
          .catch((err) => {
            console.error('Failed to fetch video:', err);
          });
      };
      resolveUrl();
    }
  }, [wayfinderUrl]);

  useEffect(() => {
    wayfinder.emitter.on('routing-failed', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        prevUpdates.add(`❌ Routing failed: ${event.error.message}`);
        return prevUpdates;
      });
    });
    wayfinder.emitter.on('routing-succeeded', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        prevUpdates.add(`🔄 Routed request to: ${event.selectedGateway}`);
        return prevUpdates;
      });
    });
    wayfinder.emitter.on('identified-transaction-id', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        prevUpdates.add(`🔍 Identified transaction id: ${event.txId}`);
        return prevUpdates;
      });
    });
    wayfinder.emitter.on('verification-succeeded', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        prevUpdates.add(`✅ Verification passed for ${event.txId}`);
        return prevUpdates;
      });
    });
    wayfinder.emitter.on('verification-failed', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        prevUpdates.add(`❌ Verification failed for ${event.txId}`);
        return prevUpdates;
      });
    });
    wayfinder.emitter.on('verification-progress', (event) => {
      if (event.totalBytes === 0) {
        return;
      }
      const newEventProcessedBytes =
        (event.processedBytes / (event.totalBytes ?? 1)) * 100;
      // for every 10% of progress, update the progress bar
      const newRoundedProgress = Math.round(newEventProcessedBytes / 10) * 10;
      if (
        newRoundedProgress >= wayfinderVerificationProgress &&
        newRoundedProgress > 0
      ) {
        setWayfinderStatusUpdates((prevUpdates) => {
          prevUpdates.add(`⏳ Verifying... ${newRoundedProgress}%`);
          return prevUpdates;
        });
        setWayfinderVerificationProgress(newRoundedProgress);
      }
    });
  }, [wayfinder]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ textAlign: 'center' }}>
        Wayfinder Routing and Verification
      </h2>
      <div
        style={{
          fontSize: '0.8em',
          color: '#666',
          textAlign: 'center',
          margin: '0 auto',
          maxWidth: '500px',
        }}
      >
        Provide an `ar://` URL to see how Wayfinder routes and verifies the
        request.
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Enter ar:// URL"
          onChange={(e) => {
            // wait one second before setting the wayfinder url and clear previous timeout if it exists
            clearTimeout((window as any).wayfinderUrlTimeout);
            (window as any).wayfinderUrlTimeout = setTimeout(() => {
              setWayfinderUrl(e.target.value);
            }, 1000);
          }}
          style={{
            padding: '8px',
            width: '350px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
        <div>
          {wayfinderStatusUpdates.size > 0 && (
            <pre
              style={{
                marginTop: '10px',
                textAlign: 'left',
                maxWidth: '500px',
                overflow: 'auto',
              }}
            >
              {Array.from(wayfinderStatusUpdates).map((update) => (
                <div key={update}>{update}</div>
              ))}
            </pre>
          )}
        </div>
        {wayfinderResponse && (
          <div>
            <h3>Response headers</h3>
            <pre
              style={{
                marginTop: '10px',
                textAlign: 'left',
                maxWidth: '500px',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(wayfinderResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
