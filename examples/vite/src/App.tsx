import { ARIO, ARIO_DEVNET_PROCESS_ID, mARIOToken } from '@ar.io/sdk/web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import './App.css';
import { useArNSRecords, useArNSReturnedNames } from './hooks/useArNS';
import { useGatewayDelegations, useGateways } from './hooks/useGatewayRegistry';

const ario = ARIO.init({ processId: ARIO_DEVNET_PROCESS_ID });

function App() {
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

  return (
    <div
      className="App"
      style={{ display: 'flex', flexDirection: 'column', padding: '100px' }}
    >
      <div className="header">
        <h1>AR.IO Network Explorer</h1>
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
