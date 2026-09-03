'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Plus, Search, Trash2, Calendar, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useGuests,
  useDeleteGuest,
  useBulkDeleteGuests,
  useDeleteGuestsByDateRange,
  useClearAllGuests,
} from '@/hooks/use-guests';
import type { Guest } from '@/hooks/use-guests';

const vipOptions = [
  { value: '', label: 'All Levels' },
  { value: '0', label: 'Regular (0)' },
  { value: '1', label: 'VIP 1' },
  { value: '2', label: 'VIP 2' },
  { value: '3', label: 'VIP 3' },
  { value: '4', label: 'VIP 4' },
  { value: '5', label: 'VIP 5' },
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function GuestsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vipLevel, setVipLevel] = useState('');
  const limit = 15;

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  const { data, isLoading } = useGuests({ page, limit, search: search || undefined, vipLevel: vipLevel || undefined });
  const deleteGuest = useDeleteGuest();
  const bulkDeleteGuests = useBulkDeleteGuests();
  const deleteByDateRange = useDeleteGuestsByDateRange();
  const clearAllGuests = useClearAllGuests();

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} guest(s)?`)) return;
    try {
      await bulkDeleteGuests.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {}
  };

  const handleDeleteByDateRange = async () => {
    if (!dateFrom || !dateTo) return;
    try {
      await deleteByDateRange.mutateAsync({ from: dateFrom, to: dateTo });
      setShowDateRangeModal(false);
      setDateFrom('');
      setDateTo('');
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await clearAllGuests.mutateAsync();
      setShowClearAllModal(false);
    } catch {}
  };

  const handleDeleteGuest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this guest?')) return;
    try {
      await deleteGuest.mutateAsync(id);
    } catch {}
  };

  const columns: Column<Guest>[] = [
    ...(selectionMode
      ? [
          {
            key: 'select',
            header: '',
            className: 'w-10',
            render: (g: Guest) => (
              <input
                type="checkbox"
                checked={selectedIds.has(g.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => {
                  const next = new Set(selectedIds);
                  if (next.has(g.id)) next.delete(g.id);
                  else next.add(g.id);
                  setSelectedIds(next);
                }}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-brand-500 focus:ring-brand-500"
              />
            ),
          },
        ]
      : []),
    {
      key: 'name',
      header: 'Name',
      render: (g) => `${g.firstName} ${g.lastName}`,
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone', render: (g) => g.phone || '—' },
    { key: 'nationality', header: 'Nationality', render: (g) => g.nationality || '—' },
    {
      key: 'vipLevel',
      header: 'VIP Level',
      render: (g) => (
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${i < Number(g.vipLevel) ? 'fill-warning text-warning' : 'text-neutral-700'}`}
            />
          ))}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Created', render: (g) => formatDate(g.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (g) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/guests/${g.id}`); }}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteGuest(g.id); }}>
            <Trash2 className="h-3.5 w-3.5 text-error" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Manage guest profiles"
        actions={
          <Button onClick={() => router.push('/dashboard/guests/new')}>
            <Plus className="h-4 w-4" />
            Add Guest
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-60">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                label="Search"
                placeholder="Name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-44">
            <Select
              label="VIP Level"
              options={vipOptions}
              value={vipLevel}
              onChange={(e) => { setVipLevel(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </Card>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          variant={selectionMode ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
        >
          {selectionMode ? 'Cancel Selection' : 'Bulk Delete'}
        </Button>
        {selectionMode && selectedIds.size > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            isLoading={bulkDeleteGuests.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected ({selectedIds.size})
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setShowDateRangeModal(true)}>
          <Calendar className="h-4 w-4" />
          Delete by Date Range
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowClearAllModal(true)}>
          <AlertTriangle className="h-4 w-4" />
          Clear All Data
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/guests/restore')}>
          <RotateCcw className="h-4 w-4" />
          Restore Deleted
        </Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(g) => g.id}
          onRowClick={(g) => router.push(`/dashboard/guests/${g.id}`)}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No guests found"
              description="Try adjusting your search or add a new guest."
              action={
                <Button onClick={() => router.push('/dashboard/guests/new')}>
                  <Plus className="h-4 w-4" />
                  Add Guest
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

      <Modal isOpen={showDateRangeModal} onClose={() => setShowDateRangeModal(false)} title="Delete by Date Range">
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            Delete all guests created within the selected date range. This action cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowDateRangeModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleDeleteByDateRange}
              isLoading={deleteByDateRange.isPending}
              disabled={!dateFrom || !dateTo}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showClearAllModal} onClose={() => setShowClearAllModal(false)} title="Clear All Guests">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-error/20 bg-error/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error" />
            <div>
              <p className="text-sm font-medium text-white">Warning</p>
              <p className="mt-1 text-sm text-neutral-400">
                This will permanently delete all guest records. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowClearAllModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleClearAll} isLoading={clearAllGuests.isPending}>
              Clear All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
