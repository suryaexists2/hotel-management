'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { PageHeader } from '@/components/layout/PageHeader';
import { useReservations, type Reservation } from '@/hooks/use-reservations';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'brand' | 'default'> = {
  CHECKED_IN: 'brand',
  CONFIRMED: 'info',
};

export default function BillingPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const currencySymbol = useCurrencySymbol();
  const { data, isLoading } = useReservations({
    status: 'CHECKED_IN,CONFIRMED',
    limit: 50,
  });

  const reservations = (data?.items || []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const guest = `${r.guest.firstName} ${r.guest.lastName}`.toLowerCase();
    return r.confirmationNo.toLowerCase().includes(q) || guest.includes(q);
  });

  const columns: Column<Reservation>[] = [
    { key: 'confirmationNo', header: 'Folio #', render: (r) => <span className="font-mono text-brand-400">{r.confirmationNo}</span> },
    { key: 'guest', header: 'Guest', render: (r) => `${r.guest.firstName} ${r.guest.lastName}` },
    { key: 'roomType', header: 'Room Type', render: (r) => r.roomType?.name || '—' },
    { key: 'checkInDate', header: 'Check In', render: (r) => new Date(r.checkInDate).toLocaleDateString() },
    { key: 'checkOutDate', header: 'Check Out', render: (r) => new Date(r.checkOutDate).toLocaleDateString() },
    { key: 'totalAmount', header: 'Balance', render: (r) => (
      <span className="font-mono text-error">{currencySymbol}{Number(r.totalAmount).toFixed(2)}</span>
    )},
    { key: 'status', header: 'Status', render: (r) => (
      <Badge variant={statusVariant[r.status] || 'default'}>{r.status.replace('_', ' ')}</Badge>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Manage guest folios and payments"
      />

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by folio or guest..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-10 pr-3 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <span className="text-sm text-neutral-500">{reservations.length} active folios</span>
        </div>

        <Table
          columns={columns}
          data={reservations}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/dashboard/billing/${r.id}`)}
          isLoading={isLoading}
          emptyState={
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <p className="text-lg">No active folios</p>
              <p className="text-sm">Check-ins will appear here automatically</p>
            </div>
          }
        />
      </Card>
    </div>
  );
}
