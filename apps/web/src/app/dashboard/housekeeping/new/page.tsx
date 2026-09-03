'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCreateHousekeepingTask } from '@/hooks/use-housekeeping';
import { useRooms } from '@/hooks/use-rooms';
import { useEmployees } from '@/hooks/use-employees';
import { Spinner } from '@/components/ui/Spinner';

const priorityOptions = [
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function NewHousekeepingTaskPage() {
  const router = useRouter();
  const { data: roomsData, isLoading: roomsLoading } = useRooms({ limit: 100 });
  const { data: employeesData, isLoading: employeesLoading } = useEmployees({ limit: 100, isActive: true });
  const createTask = useCreateHousekeepingTask();

  const [roomId, setRoomId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
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
    if (!roomId || !type.trim()) {
      setError('Room and task type are required');
      return;
    }
    setError('');
    try {
      await createTask.mutateAsync({
        roomId,
        assignedTo: assignedTo || undefined,
        priority,
        type: type.trim(),
        notes: notes.trim() || undefined,
      });
      router.push('/dashboard/housekeeping');
    } catch {
      setError('Failed to create task. Please try again.');
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
        title="New Housekeeping Task"
        description="Assign a cleaning or inspection task"
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <Select
            label="Room *"
            placeholder="Select a room"
            options={roomOptions}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />

          <Select
            label="Assign To"
            placeholder="Select employee (optional)"
            options={employeeOptions}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />

          <Select
            label="Priority"
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />

          <Input
            label="Task Type *"
            placeholder="e.g. Deep clean, Turndown, Inspection"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />

          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-neutral-300">
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" isLoading={createTask.isPending}>
              Create Task
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
