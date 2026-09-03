'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMaintenanceOrders, useUpdateMaintenanceStatus } from '@/hooks/use-maintenance';
import type { MaintenanceOrder } from '@/hooks/use-maintenance';

const priorityBadge: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  P1_CRITICAL: 'error',
  P2_HIGH: 'warning',
  P3_MEDIUM: 'info',
  P4_LOW: 'default',
};

const statusBadge: Record<string, 'warning' | 'brand' | 'success' | 'error' | 'default' | 'info'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'brand',
  ON_HOLD: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'P1_CRITICAL', label: 'P1 Critical' },
  { value: 'P2_HIGH', label: 'P2 High' },
  { value: 'P3_MEDIUM', label: 'P3 Medium' },
  { value: 'P4_LOW', label: 'P4 Low' },
];

function formatPriority(p: string) {
  const map: Record<string, string> = {
    P1_CRITICAL: 'P1 Critical',
    P2_HIGH: 'P2 High',
    P3_MEDIUM: 'P3 Medium',
    P4_LOW: 'P4 Low',
  };
  return map[p] || p;
}

function formatStatus(s: string) {
  const map: Record<string, string> = {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return map[s] || s;
}

export default function MaintenancePage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const { data, isLoading } = useMaintenanceOrders({
    page,
    limit: 10,
    status: statusFilter,
    priority: priorityFilter,
  });
  const updateStatus = useUpdateMaintenanceStatus();

  const columns: Column<MaintenanceOrder>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (order) => (
        <span className="font-medium text-white truncate max-w-[200px] block">
          {order.title}
        </span>
      ),
    },
    {
      key: 'room',
      header: 'Room #',
      render: (order) =>
        order.room ? (
          <span className="font-medium text-white">
            {order.room.roomNumber}
            <span className="ml-1.5 text-xs text-neutral-500">F{order.room.floor}</span>
          </span>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (order) => <Badge variant={priorityBadge[order.priority]}>{formatPriority(order.priority)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <Badge variant={statusBadge[order.status]}>{formatStatus(order.status)}</Badge>,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (order) =>
        order.assignedEmployee ? (
          <span className="text-neutral-300">
            {order.assignedEmployee.firstName} {order.assignedEmployee.lastName}
          </span>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (order) => <span className="text-neutral-400">{new Date(order.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) => {
        if (order.status === 'OPEN') {
          return (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus.mutate({ id: order.id, status: 'IN_PROGRESS' });
              }}
            >
              Start
            </Button>
          );
        }
        if (order.status === 'IN_PROGRESS') {
          return (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: order.id, status: 'COMPLETED', resolution: 'Completed' });
                }}
              >
                Complete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ id: order.id, status: 'ON_HOLD' });
                }}
              >
                Hold
              </Button>
            </div>
          );
        }
        if (order.status === 'ON_HOLD') {
          return (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus.mutate({ id: order.id, status: 'IN_PROGRESS' });
              }}
            >
              Resume
            </Button>
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
        title="Maintenance"
        description="Track and manage maintenance orders"
        actions={
          <Button onClick={() => router.push('/dashboard/maintenance/new')}>
            <Plus className="h-4 w-4" />
            New Order
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
        </div>
      </Card>

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(o) => o.id}
          onRowClick={(order) => router.push(`/dashboard/maintenance/${order.id}`)}
          emptyState={
            <EmptyState
              title="No maintenance orders"
              description="Create a new maintenance order to get started"
              action={
                <Button onClick={() => router.push('/dashboard/maintenance/new')}>
                  <Plus className="h-4 w-4" />
                  New Order
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
