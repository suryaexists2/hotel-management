'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, CheckCircle2, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useHousekeepingTasks, useUpdateHousekeepingStatus } from '@/hooks/use-housekeeping';
import type { HousekeepingTask } from '@/hooks/use-housekeeping';

const priorityBadge: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  URGENT: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
};

const statusBadge: Record<string, 'warning' | 'brand' | 'success' | 'default' | 'info'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  SKIPPED: 'default',
  REASSIGNED: 'info',
};

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'REASSIGNED', label: 'Reassigned' },
];

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export default function HousekeepingPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const { data, isLoading } = useHousekeepingTasks({
    page,
    limit: 10,
    status: statusFilter,
    priority: priorityFilter,
  });
  const updateStatus = useUpdateHousekeepingStatus();

  const filteredData = data?.items?.filter((task) => {
    if (roomSearch) {
      return task.room.roomNumber.toLowerCase().includes(roomSearch.toLowerCase());
    }
    return true;
  });

  const columns: Column<HousekeepingTask>[] = [
    {
      key: 'room',
      header: 'Room #',
      render: (task) => (
        <span className="font-medium text-white">
          {task.room.roomNumber}
          <span className="ml-1.5 text-xs text-neutral-500">F{task.room.floor}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Task Type',
      render: (task) => <span className="capitalize">{task.type.toLowerCase()}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (task) => <Badge variant={priorityBadge[task.priority]}>{task.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (task) => {
        const label = task.status === 'IN_PROGRESS' ? 'In Progress' : task.status.charAt(0) + task.status.slice(1).toLowerCase();
        return <Badge variant={statusBadge[task.status]}>{label}</Badge>;
      },
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (task) =>
        task.assignedEmployee ? (
          <span className="text-neutral-300">
            {task.assignedEmployee.firstName} {task.assignedEmployee.lastName}
          </span>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (task) => <span className="text-neutral-400">{new Date(task.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (task) => {
        if (task.status === 'PENDING') {
          return (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' });
              }}
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
          );
        }
        if (task.status === 'IN_PROGRESS') {
          return (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: task.id, status: 'COMPLETED' });
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: task.id, status: 'SKIPPED' });
                }}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            </div>
          );
        }
        return <span className="text-xs text-neutral-500">—</span>;
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Housekeeping"
        description="Manage cleaning tasks and room inspections"
        actions={
          <Button onClick={() => router.push('/dashboard/housekeeping/new')}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap gap-4">
          <div className="w-40">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-40">
            <Select
              options={priorityOptions}
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-60">
            <Input
              placeholder="Search by room number..."
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <Table
          columns={columns}
          data={filteredData ?? []}
          keyExtractor={(t) => t.id}
          onRowClick={(task) => router.push(`/dashboard/housekeeping/${task.id}`)}
          emptyState={
            <EmptyState
              title="No housekeeping tasks"
              description="Create a new housekeeping task to get started"
              action={
                <Button onClick={() => router.push('/dashboard/housekeeping/new')}>
                  <Plus className="h-4 w-4" />
                  New Task
                </Button>
              }
            />
          }
        />
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
