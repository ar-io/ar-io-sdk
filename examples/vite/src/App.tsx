import { ARIO, ARIOToken, mARIOToken } from '@ar.io/sdk/web';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import './App.css';
import { useArNSRecords, useArNSReturnedNames } from './hooks/useArNS';
import { useGatewayDelegations, useGateways } from './hooks/useGatewayRegistry';

const ario = ARIO.testnet();

function App() {
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenRequestMessage, setTokenRequestMessage] = useState<string | null>(
    null,
  );

  const {
    data: names,
    isLoading: namesLoading,
    error: namesError,
  } = useArNSRecords({
    ario,
    limit: 10,
    cursor: undefined,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const {
    data: gateways,
    isLoading: gatewaysLoading,
    error: gatewaysError,
  } = useGateways({
    ario,
    limit: 10,
    cursor: undefined,
    sortBy: 'startTimestamp',
    sortOrder: 'asc',
  });

  const {
    data: returnedNames,
    isLoading: returnedNamesLoading,
    error: returnedNamesError,
  } = useArNSReturnedNames({
    ario,
    limit: 10,
    cursor: undefined,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const namesTable = useReactTable({
    data: names?.items ?? [],
    columns: [
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'processId',
        header: 'Process',
      },
      {
        accessorKey: 'type',
        header: 'Type',
      },
      {
        accessorKey: 'purchasePrice',
        header: 'Purchase Price',
        cell: ({ row }) => {
          return row.original.purchasePrice
            ? `${new mARIOToken(row.original.purchasePrice).toARIO().valueOf().toFixed(2)} ARIO`
            : 'N/A';
        },
      },
      {
        accessorKey: 'startTimestamp',
        header: 'Purchased',
        cell: ({ row }) => {
          return new Date(row.original.startTimestamp).toLocaleDateString();
        },
      },
      {
        accessorKey: 'endTimestamp',
        header: 'Expiry',
        cell: ({ row }) => {
          const endTimestamp =
            row.original.type === 'lease'
              ? row.original.endTimestamp
              : undefined;
          return endTimestamp
            ? new Date(endTimestamp).toLocaleDateString()
            : 'Infinite';
        },
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  const gatewaysTable = useReactTable({
    data: gateways?.items ?? [],
    columns: [
      {
        accessorKey: 'gatewayAddress',
        header: 'Address',
      },
      {
        accessorKey: 'observerAddress',
        header: 'Observer',
      },
      {
        accessorKey: 'status',
        header: 'Status',
      },
      {
        accessorKey: 'startTimestamp',
        header: 'Joined',
        cell: ({ row }) => {
          return new Date(row.original.startTimestamp).toLocaleDateString();
        },
      },
      {
        accessorKey: 'operatorStake',
        header: 'Operator Stake',
      },
      {
        accessorKey: 'totalDelegatedStake',
        header: 'Total Delegated Stake',
      },
      {
        accessorKey: 'totalDelegations',
        header: 'Total Delegations',
        cell: ({ row }) => {
          const { data: delegations, isLoading: delegationsLoading } =
            useGatewayDelegations({
              ario,
              gatewayAddress: row.original.gatewayAddress,
              limit: 10,
              cursor: undefined,
            });
          if (delegationsLoading) return 'Loading...';
          return delegations?.totalItems;
        },
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  const returnedNamesTable = useReactTable({
    data: returnedNames?.items ?? [],
    columns: [
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'startTimestamp',
        header: 'Starts',
      },
      {
        accessorKey: 'endTimestamp',
        header: 'Ends',
      },
      {
        accessorKey: 'premiumMultiplier',
        header: 'Base Fee',
      },
      {
        accessorKey: 'initiator',
        header: 'Initiator',
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    fetchBalance();
  }, [ario]);

  const fetchBalance = async () => {
    const activeAddress = await window.arweaveWallet.getActiveAddress();
    await ario
      .getBalance({
        address: activeAddress,
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

  return (
    <div
      className="App"
      style={{ display: 'flex', flexDirection: 'column', padding: '100px' }}
    >
      <div className="header">
        <h1>AR.IO Network Explorer</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>
            Current Balance:{' '}
            {balance ? `${balance.toFixed(2)} ARIO` : 'Loading...'}
          </span>

          <button onClick={requestTokens}>
            Request 100 AR.IO tokens (tARIO)
          </button>
          {tokenRequestMessage && (
            <span
              style={{
                color: 'green',
                opacity: tokenRequestMessage ? 1 : 0,
                transition: 'opacity 0.3s',
              }}
              onAnimationEnd={() => {
                setTimeout(() => {
                  setTokenRequestMessage(null);
                }, 5000);
              }}
            >
              {tokenRequestMessage}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ textAlign: 'left' }}>ArNS Names</h1>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {namesTable.getHeaderGroups().map((headerGroup) => {
              return (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ textAlign: 'left' }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              );
            })}
          </thead>
          <tbody>
            {namesTable.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ textAlign: 'left' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ textAlign: 'left' }}>ArNS Returned Names</h1>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {returnedNamesTable.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ textAlign: 'left' }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {returnedNamesTable.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ textAlign: 'left' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ textAlign: 'left' }}>Gateways</h1>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {gatewaysTable.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ textAlign: 'left' }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {gatewaysTable.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ textAlign: 'left' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
