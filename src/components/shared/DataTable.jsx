import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SearchBar from './SearchBar';
import { useState } from 'react';

export default function DataTable({
  columns,
  data,
  searchPlaceholder = 'Search...',
  pageSize = 10,
}) {
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <SearchBar
          value={globalFilter ?? ''}
          onChange={setGlobalFilter}
          placeholder={searchPlaceholder}
          className="w-64"
        />
      </div>
      <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
        <table className="w-full min-w-[640px]">
          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#F8FAFC]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-[#0F172A]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getFilteredRowModel().rows.length > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#64748B]">
            Showing {table.getState().pagination.pageIndex * pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
