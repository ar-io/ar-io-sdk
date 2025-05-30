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
  const [wayfinderUrl, setWayfinderUrl] = useState<string>('ar://');

  useEffect(() => {
    setWayfinderStatusUpdates(new Set());
    setWayfinderResponse(null);
    setWayfinderVerificationProgress(0);
    if (wayfinderUrl && wayfinderUrl.trim() !== 'ar://') {
      const resolveUrl = async () => {
        setWayfinderStatusUpdates((prevUpdates) => {
          return new Set([
            ...prevUpdates,
            `🔍 Fetching data from AR.IO network...`,
          ]);
        });
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
        return new Set(prevUpdates);
      });
    });
    wayfinder.emitter.on('routing-succeeded', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        return new Set([
          ...prevUpdates,
          `🔄 Routed request to: ${event.selectedGateway}`,
        ]);
      });
    });
    wayfinder.emitter.on('identified-transaction-id', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        return new Set([
          ...prevUpdates,
          `🔍 Identified transaction id: ${event.txId}`,
        ]);
      });
    });
    wayfinder.emitter.on('verification-succeeded', (event) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        return new Set([
          ...prevUpdates,
          `✅ Verification passed for ${event.txId}`,
        ]);
      });
    });
    wayfinder.emitter.on('verification-failed', (error) => {
      setWayfinderStatusUpdates((prevUpdates) => {
        return new Set([
          ...prevUpdates,
          `❌ Verification failed: ${error.message}`,
        ]);
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
          return new Set([
            ...prevUpdates,
            `⏳ Verifying... ${newRoundedProgress}%`,
          ]);
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

        {wayfinderResponse && (
          <div>
            <h3>Response Data</h3>
            <div
              style={{
                marginTop: '10px',
                textAlign: 'left',
                maxWidth: '500px',
                overflow: 'auto',
              }}
            >
              {(() => {
                const contentType = wayfinderResponse.headers['content-type'];
                if (contentType?.includes('image/')) {
                  return (
                    <img
                      src={URL.createObjectURL(
                        new Blob([wayfinderResponse.data], {
                          type: contentType,
                        }),
                      )}
                      alt="Response"
                      style={{ maxWidth: '100%' }}
                    />
                  );
                } else if (contentType?.includes('video/')) {
                  return (
                    <video
                      controls
                      src={URL.createObjectURL(
                        new Blob([wayfinderResponse.data], {
                          type: contentType,
                        }),
                      )}
                      style={{ maxWidth: '100%' }}
                    />
                  );
                } else if (contentType?.includes('audio/')) {
                  return (
                    <audio
                      controls
                      src={URL.createObjectURL(
                        new Blob([wayfinderResponse.data], {
                          type: contentType,
                        }),
                      )}
                    />
                  );
                } else if (contentType?.includes('application/pdf')) {
                  return (
                    <iframe
                      src={URL.createObjectURL(
                        new Blob([wayfinderResponse.data], {
                          type: contentType,
                        }),
                      )}
                      style={{ width: '100%', height: '400px', border: 'none' }}
                    />
                  );
                } else if (contentType?.includes('application/pdf')) {
                  return <pre>{wayfinderResponse.data}</pre>;
                } else if (contentType?.includes('text/html')) {
                  return (
                    <iframe
                      src={URL.createObjectURL(
                        new Blob([wayfinderResponse.data], {
                          type: 'text/html',
                        }),
                      )}
                      style={{
                        width: '100%',
                        height: '400px',
                        border: 'none',
                        overflow: 'hidden',
                      }}
                    />
                  );
                } else if (contentType?.includes('application/json')) {
                  return (
                    <pre>
                      {JSON.stringify(
                        JSON.parse(wayfinderResponse.data),
                        null,
                        2,
                      )}
                    </pre>
                  );
                } else {
                  return <pre>{wayfinderResponse.data}</pre>;
                }
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
