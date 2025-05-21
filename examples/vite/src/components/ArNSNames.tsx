import { ARIO, mARIOToken } from '@ar.io/sdk/web';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import { useArNSRecords } from '../hooks/useArNS';

export const ArNSNamesExample = () => {
  const ario = useMemo(() => ARIO.mainnet(), []);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ textAlign: 'left' }}>ArNS Names</h1>
      {namesError && <div>Error: {namesError.message}</div>}
      {namesLoading && <div>Loading...</div>}
      {names && (
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
      )}
    </div>
  );
};
