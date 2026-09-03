'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGuestBackups, useRestoreGuest } from '@/hooks/use-guests';
import type { GuestBackup } from '@/hooks/use-guests';

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function RestoreGuestsPage() {
  const router = useRouter();
  const { data: backups, isLoading } = useGuestBackups();
  const restoreGuest = useRestoreGuest();

  const handleRestore = async (backup: GuestBackup) => {
    try {
      await restoreGuest.mutateAsync(backup.id);
    } catch {}
  };

  const columns: Column<GuestBackup>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (b) => `${b.firstName} ${b.lastName}`,
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone', render: (b) => b.phone || '—' },
    {
      key: 'backedUpAt',
      header: 'Deleted At',
      render: (b) => formatDate(b.backedUpAt),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (b) => (
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleRestore(b);
          }}
          isLoading={restoreGuest.isPending}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restore
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Restore Deleted Guests"
        description="Recover previously deleted guest profiles"
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      <Card padding={false}>
        <Table
          columns={columns}
          data={backups || []}
          keyExtractor={(b) => b.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No backups found"
              description="Deleted guest records will appear here."
            />
          }
        />
      </Card>
    </div>
  );
}
