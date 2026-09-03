'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCreateMaintenanceOrder } from '@/hooks/use-maintenance';
import { useRooms } from '@/hooks/use-rooms';
import { useEmployees } from '@/hooks/use-employees';
import { Spinner } from '@/components/ui/Spinner';

const priorityOptions = [
  { value: 'P3_MEDIUM', label: 'P3 Medium' },
  { value: 'P4_LOW', label: 'P4 Low' },
  { value: 'P2_HIGH', label: 'P2 High' },
  { value: 'P1_CRITICAL', label: 'P1 Critical' },
];

export default function NewMaintenanceOrderPage() {
  const router = useRouter();
  const { data: roomsData, isLoading: roomsLoading } = useRooms({ limit: 100 });
  const { data: employeesData, isLoading: employeesLoading } = useEmployees({ limit: 100, isActive: true });
  const createOrder = useCreateMaintenanceOrder();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roomId, setRoomId] = useState('');
  const [priority, setPriority] = useState('P3_MEDIUM');
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [error, setError] = useState('');

  const roomOptions = (roomsData?.items ?? []).map((r) => ({
    value: r.id,
    label: `Room ${r.roomNumber} (Floor ${r.floor})`,
  }));

  const employeeOptions = (employeesData?.items ?? []).map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} — ${e.position}`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }
    setError('');
    try {
      await createOrder.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        roomId: roomId || undefined,
        priority,
        assignedTo: assignedTo || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        scheduledDate: scheduledDate || undefined,
      });
      router.push('/dashboard/maintenance');
    } catch {
      setError('Failed to create maintenance order. Please try again.');
    }
  };

  if (roomsLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Maintenance Order"
        description="Create a maintenance or repair request"
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <Input
            label="Title *"
            placeholder="e.g. Leaking faucet, Broken AC"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-neutral-300">
              Description *
            </label>
            <textarea
              id="description"
              rows={4}
              placeholder="Detailed description of the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Room"
              placeholder="Select a room (optional)"
              options={roomOptions}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />

            <Select
              label="Priority"
              options={priorityOptions}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Assign To"
              placeholder="Select employee (optional)"
              options={employeeOptions}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />

            <Input
              label="Estimated Cost ($)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </div>

          <Input
            label="Scheduled Date"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" isLoading={createOrder.isPending}>
              Create Order
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
