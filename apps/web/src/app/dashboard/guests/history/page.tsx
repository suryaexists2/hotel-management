'use client';

import React, { useState } from 'react';
import { Search, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGuestHistory } from '@/hooks/use-guest-management';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusVariant: Record<string, 'brand' | 'success' | 'default' | 'error' | 'warning' | 'info'> = {
  CONFIRMED: 'brand',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'default',
  CANCELLED: 'error',
  PENDING: 'warning',
  NO_SHOW: 'error',
  WAITLISTED: 'info',
};

interface HistoryRecord {
  id: string;
  guest: { firstName: string; lastName: string; email: string } | null;
  room: { roomNumber: string; roomType?: { name: string } } | null;
  roomType: { name: string; baseRate: number } | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  nights: number;
  totalAmount: number;
}

export default function GuestHistoryPage() {
  const [guestName, setGuestName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGuestHistory({
    ...(guestName ? { search: guestName } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page,
    limit: 20,
  });
  const currencySymbol = useCurrencySymbol();

  const formatCurrency = (amount: number) =>
    `${currencySymbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const columns: Column<HistoryRecord>[] = [
    {
      key: 'guestName',
      header: 'Guest Name',
      render: (r) => (
        <div className="text-sm font-medium text-white">
          {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : '—'}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-sm text-neutral-400">{r.guest?.email || '—'}</span>,
    },
    {
      key: 'roomNumber',
      header: 'Room Number',
      render: (r) => <span className="text-sm text-neutral-300">{r.room ? `Room ${r.room.roomNumber}` : '—'}</span>,
    },
    {
      key: 'roomType',
      header: 'Room Type',
      render: (r) => <span className="text-sm text-neutral-300">{r.roomType?.name || '—'}</span>,
    },
    {
      key: 'checkInDate',
      header: 'Check-in',
      render: (r) => (
        <span className="text-sm text-neutral-300">{new Date(r.checkInDate).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'checkOutDate',
      header: 'Check-out',
      render: (r) => (
        <span className="text-sm text-neutral-300">{new Date(r.checkOutDate).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge variant={statusVariant[r.status] || 'default'}>{r.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'nights',
      header: 'Nights',
      className: 'text-right',
      render: (r) => <span className="text-sm text-neutral-300">{r.nights}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      className: 'text-right',
      render: (r) => <span className="text-sm font-medium text-white">{formatCurrency(r.totalAmount)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Guest History" description="Search guest check-in/out records by date or name" />

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setPage(1); }}
              placeholder="Search by guest name..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-10 pr-3 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="w-40"><Input label="" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
          <div className="w-40"><Input label="" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
          <span className="text-sm text-neutral-500">
            {data?.total ?? 0} records found
          </span>
        </div>

        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyState={
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <Calendar className="mb-2 h-8 w-8" />
              <p className="text-lg">No records found</p>
              <p className="text-sm">Adjust your search or date range</p>
            </div>
          }
        />

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
            <span className="text-sm text-neutral-500">Page {page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
