'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCreateRoom } from '@/hooks/use-rooms';
import { useRoomTypes } from '@/hooks/use-room-types';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusOptions = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DIRTY', label: 'Dirty' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'OUT_OF_ORDER', label: 'Out of Order' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service' },
];

export default function NewRoomPage() {
  const router = useRouter();
  const createRoom = useCreateRoom();
  const { data: roomTypesData } = useRoomTypes({ limit: 100 });
  const [form, setForm] = useState({ roomNumber: '', floor: '', roomTypeId: '', status: 'AVAILABLE', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const currencySymbol = useCurrencySymbol();

  const roomTypeOptions = (roomTypesData?.items || []).map((rt) => ({
    value: rt.id,
    label: `${rt.name} (${currencySymbol}${rt.baseRate}/night)`,
  }));

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.roomNumber.trim()) errs.roomNumber = 'Room number is required';
    if (!form.floor) errs.floor = 'Floor is required';
    if (!form.roomTypeId) errs.roomTypeId = 'Room type is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    createRoom.mutate(
      {
        roomNumber: form.roomNumber.trim(),
        floor: parseInt(form.floor, 10),
        roomTypeId: form.roomTypeId,
        status: form.status,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => router.push('/dashboard/rooms'),
      },
    );
  }

  return (
    <div>
      <PageHeader
        title="Add Room"
        description="Create a new room in your hotel"
        actions={
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Room Number"
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              error={errors.roomNumber}
              placeholder="e.g. 101"
            />
            <Input
              label="Floor"
              type="number"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              error={errors.floor}
              placeholder="e.g. 1"
            />
          </div>

          <Select
            label="Room Type"
            options={roomTypeOptions}
            placeholder="Select a room type..."
            value={form.roomTypeId}
            onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
            error={errors.roomTypeId}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={createRoom.isPending}>
              Create Room
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/dashboard/rooms')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
