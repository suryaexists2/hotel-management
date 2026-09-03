'use client';

import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGuests } from '@/hooks/use-guests';
import { useBulkDeleteGuests, useDeleteByDateRange, useClearAllGuests, useListBackups, useRestoreGuest } from '@/hooks/use-guest-management';

export default function GuestManagementPage() {
  const { data: guestsData } = useGuests({ limit: 100 });
  const { data: backups } = useListBackups();
  const bulkDelete = useBulkDeleteGuests();
  const deleteByRange = useDeleteByDateRange();
  const clearAll = useClearAllGuests();
  const restore = useRestoreGuest();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const guests = guestsData?.items || [];

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await bulkDelete.mutateAsync(selectedIds);
      setResult(`Deleted ${selectedIds.length} guest(s)`);
      setSelectedIds([]);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteByRange = async () => {
    if (!from || !to) return;
    try {
      await deleteByRange.mutateAsync({ from, to });
      setResult(`Deleted guests from ${from} to ${to}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll.mutateAsync();
      setResult('All guest records cleared');
      setShowClearConfirm(false);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Clear failed');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restore.mutateAsync(id);
      setResult('Guest restored successfully');
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Restore failed');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Record Management" description="Delete or restore guest records" />

      {result && (
        <div className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-400">
          {result}
          <button onClick={() => setResult(null)} className="ml-2 text-neutral-500 hover:text-white">&times;</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bulk Delete */}
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error/10">
              <Trash2 className="h-5 w-5 text-error" />
            </div>
            <h2 className="text-lg font-semibold text-white">Delete Multiple Records</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-400">
            Select guests to delete. A backup is created automatically before deletion.
          </p>
          <div className="mb-4 max-h-60 space-y-1 overflow-y-auto">
            {guests.map((g) => (
              <label key={g.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2 hover:bg-neutral-800/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(g.id)}
                  onChange={() => toggleSelect(g.id)}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-brand-500"
                />
                <span className="text-sm text-neutral-300">{g.firstName} {g.lastName}</span>
                <span className="ml-auto text-xs text-neutral-500">{g.email || g.phone}</span>
              </label>
            ))}
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0 || bulkDelete.isPending}
            isLoading={bulkDelete.isPending}
          >
            Delete Selected ({selectedIds.length})
          </Button>
        </Card>

        {/* Delete by Date Range */}
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-white">Delete by Date Range</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-400">
            Delete all guest records created within a date range.
          </p>
          <div className="flex gap-3">
            <div className="flex-1"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" /></div>
            <div className="flex-1"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" /></div>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="mt-4"
            onClick={handleDeleteByRange}
            disabled={!from || !to || deleteByRange.isPending}
            isLoading={deleteByRange.isPending}
          >
            Delete in Range
          </Button>
        </Card>

        {/* Clear All */}
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error/10">
              <Trash2 className="h-5 w-5 text-error" />
            </div>
            <h2 className="text-lg font-semibold text-white">Clear All Records</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-400">
            Delete every guest record. Each record is backed up before deletion.
          </p>
          <Button variant="danger" onClick={() => setShowClearConfirm(true)}>
            Clear All Data
          </Button>
        </Card>

        {/* Restore */}
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <RotateCcw className="h-5 w-5 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-white">Restore Deleted Records</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-400">
            Recently deleted records are backed up. Restore them here.
          </p>
          {(!backups || backups.length === 0) ? (
            <p className="text-sm text-neutral-500">No backups available</p>
          ) : (
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                  <div>
                    <p className="text-sm text-neutral-300">{b.firstName} {b.lastName}</p>
                    <p className="text-xs text-neutral-500">{b.email || b.phone} &middot; Deleted {new Date(b.backedUpAt).toLocaleDateString()}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handleRestore(b.id.replace('backup-', ''))} isLoading={restore.isPending}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear All Guest Records?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            This will delete <strong className="text-white">{guests.length} guest records</strong>.
            Each record is automatically backed up before deletion and can be restored later.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleClearAll} isLoading={clearAll.isPending}>
              Yes, Clear All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
