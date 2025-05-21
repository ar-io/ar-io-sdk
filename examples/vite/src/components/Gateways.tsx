import { ARIO } from '@ar.io/sdk/web';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import {
  useGatewayDelegations,
  useGateways,
} from '../hooks/useGatewayRegistry';

export const GatewaysExample = () => {
  const ario = useMemo(() => ARIO.testnet(), []);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ textAlign: 'left' }}>Gateways</h1>
      {gatewaysError && <div>Error: {gatewaysError.message}</div>}
      {gatewaysLoading && <div>Loading...</div>}
      {gateways && (
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
      )}
    </div>
  );
};
