'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, type Column } from '@/components/ui/Table';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRoomTypes, useDeleteRoomType, type RoomType } from '@/hooks/use-room-types';
import { useCurrencySymbol } from '@/hooks/use-currency';

export default function RoomTypesPage() {
  const router = useRouter();
  const { data, isLoading } = useRoomTypes({ limit: 100 });
  const deleteRoomType = useDeleteRoomType();
  const currencySymbol = useCurrencySymbol();
  const [deleteTarget, setDeleteTarget] = useState<RoomType | null>(null);

  const columns: Column<RoomType>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'description', header: 'Description', render: (r) => r.description || '—' },
    { key: 'baseRate', header: 'Rate', render: (r) => `${currencySymbol}${r.baseRate}/night` },
    { key: 'maxOccupancy', header: 'Max Occupancy', render: (r) => r.maxOccupancy },
    { key: '_count', header: 'Rooms', render: (r) => r._count?.rooms ?? 0 },
    { key: 'isActive', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/room-types/${r.id}`); }}
            className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
            className="rounded-lg p-1.5 text-neutral-500 hover:text-error hover:bg-neutral-800"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Room Types"
        description="Manage room categories and pricing"
        actions={
          <Button onClick={() => router.push('/dashboard/room-types/new')}>
            <Plus className="h-4 w-4" /> Add Room Type
          </Button>
        }
      />

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyState={
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <p className="text-lg">No room types found</p>
              <p className="text-sm">Add your first room type to get started</p>
            </div>
          }
        />
      </Card>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Room Type"
        size="sm"
      >
        <p className="text-sm text-neutral-400 mb-4">
          Are you sure you want to delete <strong className="text-neutral-200">{deleteTarget?.name}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            isLoading={deleteRoomType.isPending}
            onClick={() => {
              if (deleteTarget) {
                deleteRoomType.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
