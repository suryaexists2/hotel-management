'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRoom, useUpdateRoom, useUpdateRoomStatus } from '@/hooks/use-rooms';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'brand' | 'default'> = {
  AVAILABLE: 'success', OCCUPIED: 'brand', DIRTY: 'warning',
  CLEANING: 'info', INSPECTED: 'success', OUT_OF_ORDER: 'error', OUT_OF_SERVICE: 'error',
};

const statusLabels: Record<string, string> = {
  AVAILABLE: 'Available', OCCUPIED: 'Occupied', DIRTY: 'Dirty',
  CLEANING: 'Cleaning', INSPECTED: 'Inspected', OUT_OF_ORDER: 'Out of Order', OUT_OF_SERVICE: 'Out of Service',
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: room, isLoading } = useRoom(params.id);
  const updateRoom = useUpdateRoom();
  const updateStatus = useUpdateRoomStatus();
  const currencySymbol = useCurrencySymbol();

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [editForm, setEditForm] = useState({ roomNumber: '', floor: '', notes: '' });

  React.useEffect(() => {
    if (room) {
      setNewStatus(room.status);
      setEditForm({ roomNumber: room.roomNumber, floor: String(room.floor), notes: room.notes || '' });
    }
  }, [room]);

  if (isLoading) return <Spinner className="min-h-[60vh]" />;
  if (!room) return <div className="text-center text-neutral-500 py-16">Room not found</div>;

  function handleStatusChange() {
    if (!room) return;
    updateStatus.mutate(
      { id: room.id, status: newStatus },
      { onSuccess: () => setShowStatusModal(false) },
    );
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!room) return;
    updateRoom.mutate(
      {
        id: room.id,
        roomNumber: editForm.roomNumber.trim(),
        floor: parseInt(editForm.floor, 10),
        notes: editForm.notes.trim() || undefined,
      },
      { onSuccess: () => setShowEditModal(false) },
    );
  }

  return (
    <div>
      <PageHeader
        title={`Room ${room.roomNumber}`}
        description={`Floor ${room.floor} — ${room.roomType?.name || 'No type'}`}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setShowStatusModal(true)}>
              Change Status
            </Button>
            <Button variant="secondary" onClick={() => setShowEditModal(true)}>
              <Edit3 className="h-4 w-4" /> Edit
            </Button>
            <Button variant="secondary" onClick={() => router.push('/dashboard/rooms')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-white">Room Details</h2>
          <dl className="space-y-4">
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Room Number</dt>
              <dd className="text-sm font-medium text-white">{room.roomNumber}</dd>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Floor</dt>
              <dd className="text-sm font-medium text-white">{room.floor}</dd>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Room Type</dt>
              <dd className="text-sm font-medium text-white">{room.roomType?.name || '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Base Rate</dt>
              <dd className="text-sm font-medium text-white">{room.roomType ? `${currencySymbol}${room.roomType.baseRate}/night` : '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Max Occupancy</dt>
              <dd className="text-sm font-medium text-white">{room.roomType?.maxOccupancy ?? '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Status</dt>
              <dd><Badge variant={statusVariant[room.status] || 'default'}>{statusLabels[room.status] || room.status}</Badge></dd>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-3">
              <dt className="text-sm text-neutral-500">Last Cleaned</dt>
              <dd className="text-sm font-medium text-white">{room.lastCleanedAt ? new Date(room.lastCleanedAt).toLocaleDateString() : '—'}</dd>
            </div>
            {room.notes && (
              <div className="flex justify-between pb-3">
                <dt className="text-sm text-neutral-500">Notes</dt>
                <dd className="text-sm font-medium text-white max-w-xs text-right">{room.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
          <div className="space-y-3">
            <Button className="w-full" variant="secondary" onClick={() => setShowStatusModal(true)}>
              Change Status
            </Button>
            <Button className="w-full" variant="secondary" onClick={() => setShowEditModal(true)}>
              Edit Room Details
            </Button>
          </div>
        </Card>
      </div>

      {/* Status Change Modal */}
      <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Change Room Status">
        <div className="space-y-4">
          <Select
            label="New Status"
            options={statusOptions}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>Cancel</Button>
            <Button onClick={handleStatusChange} isLoading={updateStatus.isPending}>Update Status</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Room Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Room">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Room Number"
              value={editForm.roomNumber}
              onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
              placeholder="Room number"
            />
            <Input
              label="Floor"
              type="number"
              value={editForm.floor}
              onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })}
              placeholder="Floor"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={updateRoom.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
