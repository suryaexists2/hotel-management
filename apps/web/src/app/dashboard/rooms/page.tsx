'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRooms, type Room } from '@/hooks/use-rooms';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'brand' | 'default'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'brand',
  DIRTY: 'warning',
  CLEANING: 'info',
  INSPECTED: 'success',
  OUT_OF_ORDER: 'error',
  OUT_OF_SERVICE: 'error',
};

const statusLabels: Record<string, string> = {
  AVAILABLE: 'Available', OCCUPIED: 'Occupied', DIRTY: 'Dirty',
  CLEANING: 'Cleaning', INSPECTED: 'Inspected', OUT_OF_ORDER: 'Out of Order', OUT_OF_SERVICE: 'Out of Service',
};

export default function RoomsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useRooms({ page, limit: 20, status: statusFilter || undefined, search: search || undefined });
  const currencySymbol = useCurrencySymbol();

  const columns: Column<Room>[] = [
    { key: 'roomNumber', header: 'Room', sortable: true },
    { key: 'floor', header: 'Floor', render: (r) => `Floor ${r.floor}` },
    { key: 'roomType', header: 'Type', render: (r) => r.roomType?.name || '—' },
    { key: 'ratePerNight', header: 'Rate', render: (r) => r.roomType ? `${currencySymbol}${r.roomType.baseRate}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={statusVariant[r.status] || 'default'}>{statusLabels[r.status] || r.status}</Badge> },
    { key: 'lastCleanedAt', header: 'Last Cleaned', render: (r) => r.lastCleanedAt ? new Date(r.lastCleanedAt).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Manage your hotel rooms and their status"
        actions={
          <Button onClick={() => router.push('/dashboard/rooms/new')}>
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        }
      />

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search rooms..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-10 pr-3 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">All Status</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/dashboard/rooms/${r.id}`)}
          isLoading={isLoading}
          emptyState={
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <p className="text-lg">No rooms found</p>
              <p className="text-sm">Add your first room to get started</p>
            </div>
          }
        />

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
            <p className="text-sm text-neutral-500">Page {data.page} of {data.totalPages} ({data.total} rooms)</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">Previous</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
