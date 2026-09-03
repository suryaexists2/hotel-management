'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useReservations } from '@/hooks/use-reservations';
import type { Reservation } from '@/hooks/use-reservations';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CHECKED_IN', label: 'Checked In' },
  { value: 'CHECKED_OUT', label: 'Checked Out' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No Show' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
];

const statusVariant: Record<string, 'brand' | 'success' | 'default' | 'error' | 'warning' | 'info'> = {
  CONFIRMED: 'brand',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'default',
  CANCELLED: 'error',
  PENDING: 'warning',
  NO_SHOW: 'error',
  WAITLISTED: 'info',
};

const formatCurrency = (amount: number, symbol: string) =>
  `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ReservationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const limit = 15;

  const { data, isLoading } = useReservations({ page, limit, status: status || undefined, from: from || undefined, to: to || undefined });
  const currencySymbol = useCurrencySymbol();

  const columns: Column<Reservation>[] = [
    { key: 'confirmationNo', header: 'Confirmation#' },
    {
      key: 'guest',
      header: 'Guest Name',
      render: (r) => `${r.guest.firstName} ${r.guest.lastName}`,
    },
    { key: 'roomType', header: 'Room Type', render: (r) => r.roomType.name },
    { key: 'checkInDate', header: 'Check-in', render: (r) => formatDate(r.checkInDate) },
    { key: 'checkOutDate', header: 'Check-out', render: (r) => formatDate(r.checkOutDate) },
    { key: 'nights', header: 'Nights' },
    { key: 'totalAmount', header: 'Total', render: (r) => formatCurrency(r.totalAmount, currencySymbol) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20 text-right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/reservations/${r.id}`); }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reservations"
        description="Manage guest reservations"
        actions={
          <Button onClick={() => router.push('/dashboard/reservations/new')}>
            <Plus className="h-4 w-4" />
            New Reservation
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-44">
            <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="w-44">
            <Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div className="w-60">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                label="Search"
                placeholder="Name or confirmation..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/dashboard/reservations/${r.id}`)}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No reservations found"
              description="Try adjusting your filters or create a new reservation."
              action={
                <Button onClick={() => router.push('/dashboard/reservations/new')}>
                  <Plus className="h-4 w-4" />
                  New Reservation
                </Button>
              }
            />
          }
        />
      </Card>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}