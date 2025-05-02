import {
  ARIO,
  ARIOToken,
  HashVerifier,
  NetworkGatewaysProvider,
  PriorityGatewayRouter,
  StaticGatewayRouter,
  StaticGatewaysProvider,
  TrustedGatewaysVerificationProvider,
  Wayfinder,
  mARIOToken,
} from '@ar.io/sdk/web';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import './App.css';
import { useArNSRecords } from './hooks/useArNS';
import { useGatewayDelegations, useGateways } from './hooks/useGatewayRegistry';

const ario = ARIO.testnet();
// @ts-ignore
const wayfinder = new Wayfinder<typeof fetch>({
  httpClient: fetch,
  router: new StaticGatewayRouter({
    gateway: 'https://permagate.io',
  }),
  verifier: new HashVerifier({
    trustedHashProvider: new TrustedGatewaysVerificationProvider({
      gatewaysProvider: new StaticGatewaysProvider({
        gateways: ['https://permagate.io'],
      }),
    }),
  }),
});

function App() {
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenRequestMessage, setTokenRequestMessage] = useState<string | null>(
    null,
  );
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [wayfinderUrl, setWayfinderUrl] = useState<string | null>(null);
  const [wayfinderVerified, setWayfinderVerified] = useState<boolean>(false);
  const [wayfinderVerificationProgress, setWayfinderVerificationProgress] =
    useState<number>(0);
  const [wayfinderVideoStream, setWayfinderVideoStream] = useState<Blob | null>(
    null,
  );
  const [wayfinderRenderPromiseRef, setWayfinderRenderPromiseRef] =
    useState<Promise<void> | null>(null);
  const [wayfinderInputTimeout, setWayfinderInputTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [nonVerifiedWayfinderResponse, setNonVerifiedWayfinderResponse] =
    useState<any>(null);
  const [verifiedWayfinderResponse, setVerifiedWayfinderResponse] =
    useState<any>(null);
  const [wayfinderStatusUpdates, setWayfinderStatusUpdates] = useState<
    Set<string>
  >(new Set());
  const [isUpdatingStatusUpdates, setIsUpdatingStatusUpdates] =
    useState<boolean>(false);

  // const {
  //   data: names,
  //   isLoading: namesLoading,
  //   error: namesError,
  // } = useArNSRecords({
  //   ario,
  //   limit: 10,
  //   cursor: undefined,
  //   sortBy: 'name',
  //   sortOrder: 'asc',
  // });

  // const {
  //   data: gateways,
  //   isLoading: gatewaysLoading,
  //   error: gatewaysError,
  // } = useGateways({
  //   ario,
  //   limit: 10,
  //   cursor: undefined,
  //   sortBy: 'startTimestamp',
  //   sortOrder: 'asc',
  // });

  // const namesTable = useReactTable({
  //   data: names?.items ?? [],
  //   columns: [
  //     {
  //       accessorKey: 'name',
  //       header: 'Name',
  //     },
  //     {
  //       accessorKey: 'processId',
  //       header: 'Process',
  //     },
  //     {
  //       accessorKey: 'type',
  //       header: 'Type',
  //     },
  //     {
  //       accessorKey: 'purchasePrice',
  //       header: 'Purchase Price',
  //       cell: ({ row }) => {
  //         return row.original.purchasePrice
  //           ? `${new mARIOToken(row.original.purchasePrice).toARIO().valueOf().toFixed(2)} ARIO`
  //           : 'N/A';
  //       },
  //     },
  //     {
  //       accessorKey: 'startTimestamp',
  //       header: 'Purchased',
  //       cell: ({ row }) => {
  //         return new Date(row.original.startTimestamp).toLocaleDateString();
  //       },
  //     },
  //     {
  //       accessorKey: 'endTimestamp',
  //       header: 'Expiry',
  //       cell: ({ row }) => {
  //         const endTimestamp =
  //           row.original.type === 'lease'
  //             ? row.original.endTimestamp
  //             : undefined;
  //         return endTimestamp
  //           ? new Date(endTimestamp).toLocaleDateString()
  //           : 'Infinite';
  //       },
  //     },
  //   ],
  //   getCoreRowModel: getCoreRowModel(),
  // });

  // const gatewaysTable = useReactTable({
  //   data: gateways?.items ?? [],
  //   columns: [
  //     {
  //       accessorKey: 'gatewayAddress',
  //       header: 'Address',
  //     },
  //     {
  //       accessorKey: 'observerAddress',
  //       header: 'Observer',
  //     },
  //     {
  //       accessorKey: 'status',
  //       header: 'Status',
  //     },
  //     {
  //       accessorKey: 'startTimestamp',
  //       header: 'Joined',
  //       cell: ({ row }) => {
  //         return new Date(row.original.startTimestamp).toLocaleDateString();
  //       },
  //     },
  //     {
  //       accessorKey: 'operatorStake',
  //       header: 'Operator Stake',
  //     },
  //     {
  //       accessorKey: 'totalDelegatedStake',
  //       header: 'Total Delegated Stake',
  //     },
  //     {
  //       accessorKey: 'totalDelegations',
  //       header: 'Total Delegations',
  //       cell: ({ row }) => {
  //         const { data: delegations, isLoading: delegationsLoading } =
  //           useGatewayDelegations({
  //             ario,
  //             gatewayAddress: row.original.gatewayAddress,
  //             limit: 10,
  //             cursor: undefined,
  //           });
  //         if (delegationsLoading) return 'Loading...';
  //         return delegations?.totalItems;
  //       },
  //     },
  //   ],
  //   getCoreRowModel: getCoreRowModel(),
  // });

  useEffect(() => {
    if (window.arweaveWallet) {
      window.arweaveWallet.getActiveAddress().then((address) => {
        setConnectedAddress(address);
        setSelectedAddress(address);
      });
    }
  }, [window.arweaveWallet]);

  useEffect(() => {
    fetchBalance();
  }, [ario, selectedAddress]);

  const fetchBalance = async () => {
    setBalance(null);
    if (!selectedAddress) return;
    await ario
      .getBalance({
        address: selectedAddress,
      })
      .then((balance) => {
        const arioBalance = new mARIOToken(balance).toARIO().valueOf();
        setBalance(arioBalance);
      });
  };

  async function requestTokens() {
    try {
      if (localStorage.getItem('ario-jwt')) {
        await ario.faucet
          .claimWithAuthToken({
            authToken: localStorage.getItem('ario-jwt') ?? '',
            recipient: await window.arweaveWallet.getActiveAddress(),
            quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
          })
          .then((res) => {
            // refetch balance
            fetchBalance();
            setTokenRequestMessage(`Successfully claimed 100 ARIO tokens!`);
          })
          .catch((err) => {
            setTokenRequestMessage(`Failed to claim tokens: ${err}`);
          });
      } else {
        const captchaUrl = await ario.faucet.captchaUrl();
        const newWindow = window.open(
          captchaUrl.captchaUrl,
          '_blank',
          'width=600,height=600',
        );
        window.parent.addEventListener('message', async (event) => {
          if (event.data.type === 'ario-jwt-success') {
            newWindow?.close();
            localStorage.setItem('ario-jwt', event.data.token);
            const res = await ario.faucet
              .claimWithAuthToken({
                authToken: localStorage.getItem('ario-jwt') ?? '',
                recipient: await window.arweaveWallet.getActiveAddress(),
                quantity: new ARIOToken(100).toMARIO().valueOf(), // 100 ARIO
              })
              .then((res) => {
                setTokenRequestMessage(`Successfully claimed 100 ARIO tokens!`);
              })
              .catch((err) => {
                setTokenRequestMessage(`Failed to claim tokens: ${err}`);
              });
          }
        });
      }
    } catch (error) {
      console.error('Failed to claim tokens:', error);
      alert('Failed to claim tokens. See console for details.');
    }
  }

  useEffect(() => {
    setWayfinderStatusUpdates(new Set());
    setNonVerifiedWayfinderResponse(null);
    setVerifiedWayfinderResponse(null);
    setWayfinderVerified(false);
    setWayfinderVerificationProgress(0);
    if (wayfinderUrl) {
      const fetchAndVerify = async () => {
        // fetch the data from the wayfinder url
        await new Promise((resolve) => setTimeout(resolve, 1000));
        wayfinder
          .request(wayfinderUrl, { redirect: 'follow', mode: 'cors' })
          .then(async (res: any) => {
            // consume the result //its video/mp4
            const result = await res.blob();
            setWayfinderVideoStream(result);
          })
          .catch((err: any) => {
            setWayfinderStatusUpdates((prevUpdates) => {
              prevUpdates.add(`Wayfinder request failed: ${err.message}`);
              return prevUpdates;
            });
          });
        // wayfinder.emitter.on('verification-passed', async (event) => {
        //   console.log('verification passed', event);
        //   setWayfinderVerified(true);
        //   await new Promise((resolve) => setTimeout(resolve, 2000));
        //   if (
        //     event.txId === nonVerifiedWayfinderResponse?.txId ||
        //     !nonVerifiedWayfinderResponse
        //   ) {
        //     setWayfinderVerificationStatus('Verification passed');
        //     setVerifiedWayfinderResponse({
        //       ...nonVerifiedWayfinderResponse,
        //       txId: event.txId,
        //       verified: true,
        //     });
        //   }
        // });
        wayfinder.emitter.on('wayfinder', (event) => {
          if (event.type === 'routing-failed') {
            setWayfinderStatusUpdates((prevUpdates) => {
              prevUpdates.add(`Routing failed: ${event.error.message}`);
              return prevUpdates;
            });
          }
          if (event.type === 'routing-succeeded') {
            setWayfinderStatusUpdates((prevUpdates) => {
              prevUpdates.add(`Routing request to: ${event.targetGateway}`);
              return prevUpdates;
            });
          }
          if (event.type === 'identified-transaction-id') {
            setWayfinderStatusUpdates((prevUpdates) => {
              prevUpdates.add(`Identified transaction id: ${event.txId}`);
              return prevUpdates;
            });
          }
          if (event.type === 'verification-passed') {
            setWayfinderVerified(true);
            setWayfinderStatusUpdates((prevUpdates) => {
              prevUpdates.add(`Verification passed: ${event.txId}`);
              return prevUpdates;
            });
          }
          if (event.type === 'verification-failed') {
            setWayfinderStatusUpdates((prevUpdates) => {
              prevUpdates.add(`Verification failed: ${event.error.message}`);
              return prevUpdates;
            });
          }
          if (event.type === 'verification-progress') {
            const newEventProcessedBytes =
              (event.processedBytes / (event.totalBytes ?? 1)) * 100;
            // for every 10% of progress, update the progress bar
            const newRoundedProgress =
              Math.round(newEventProcessedBytes / 10) * 10;
            if (
              newRoundedProgress >= wayfinderVerificationProgress &&
              newRoundedProgress > 0
            ) {
              setWayfinderStatusUpdates((prevUpdates) => {
                prevUpdates.add(`Verifying... ${newRoundedProgress}%`);
                return prevUpdates;
              });
              setWayfinderVerificationProgress(newRoundedProgress);
            }
          }
        });
      };
      fetchAndVerify();
    }
  }, [wayfinderUrl]);

  return (
    <div
      className="App"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '100px',
        width: '75%',
        margin: '0 auto',
      }}
    >
      {/* <div className="header">
        <h1>AR.IO Network Explorer</h1>
      </div> */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ textAlign: 'center' }}>
          Wayfinder Routing and Verification
        </h2>
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
            {(verifiedWayfinderResponse || nonVerifiedWayfinderResponse) && (
              <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(
                  verifiedWayfinderResponse || nonVerifiedWayfinderResponse,
                  null,
                  2,
                )}
              </pre>
            )}
            {wayfinderStatusUpdates.size > 0 && (
              <pre
                style={{
                  marginTop: '10px',
                  textAlign: 'left',
                }}
              >
                {Array.from(wayfinderStatusUpdates).map((update) => (
                  <div key={update}>{update}</div>
                ))}
              </pre>
            )}
            {wayfinderVideoStream && (
              <video
                src={URL.createObjectURL(wayfinderVideoStream)}
                controls
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px' }}>
        <hr />
      </div>
    </div>
  );
}

export default App;
