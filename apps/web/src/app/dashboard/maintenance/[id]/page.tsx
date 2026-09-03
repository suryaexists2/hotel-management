'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, CheckCircle2, Pause, XCircle, Edit3, Calendar, User, MapPin, FileText, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMaintenanceOrder, useUpdateMaintenanceStatus, useUpdateMaintenanceOrder } from '@/hooks/use-maintenance';
import { useEmployees } from '@/hooks/use-employees';
import { useCurrencySymbol } from '@/hooks/use-currency';

const priorityBadge: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  P1_CRITICAL: 'error',
  P2_HIGH: 'warning',
  P3_MEDIUM: 'info',
  P4_LOW: 'default',
};

const statusBadge: Record<string, 'warning' | 'brand' | 'success' | 'error' | 'info'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'brand',
  ON_HOLD: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const statusLabel: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatPriority(p: string) {
  const map: Record<string, string> = {
    P1_CRITICAL: 'P1 Critical',
    P2_HIGH: 'P2 High',
    P3_MEDIUM: 'P3 Medium',
    P4_LOW: 'P4 Low',
  };
  return map[p] || p;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-neutral-500">{icon}</div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <div className="mt-0.5 text-sm text-neutral-200">{value}</div>
      </div>
    </div>
  );
}

export default function MaintenanceOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: order, isLoading } = useMaintenanceOrder(id);
  const updateStatus = useUpdateMaintenanceStatus();
  const updateOrder = useUpdateMaintenanceOrder();
  const { data: employeesData } = useEmployees({ limit: 100, isActive: true });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editEstimatedCost, setEditEstimatedCost] = useState('');
  const [editActualCost, setEditActualCost] = useState('');
  const [editScheduledDate, setEditScheduledDate] = useState('');

  const openEdit = () => {
    if (!order) return;
    setEditTitle(order.title);
    setEditDescription(order.description);
    setEditPriority(order.priority);
    setEditAssignedTo(order.assignedTo ?? '');
    setEditEstimatedCost(order.estimatedCost?.toString() ?? '');
    setEditActualCost(order.actualCost?.toString() ?? '');
    setEditScheduledDate(order.scheduledDate?.split('T')[0] ?? '');
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!order) return;
    await updateOrder.mutateAsync({
      id: order.id,
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      assignedTo: editAssignedTo || undefined,
      estimatedCost: editEstimatedCost ? Number(editEstimatedCost) : undefined,
      actualCost: editActualCost ? Number(editActualCost) : undefined,
      scheduledDate: editScheduledDate || undefined,
    });
    setShowEditModal(false);
  };

  const employeeOptions = (employeesData?.items ?? []).map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} — ${e.position}`,
  }));

  const currencySymbol = useCurrencySymbol();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-400">Order not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.title}
        description={`Maintenance Order • ${statusLabel[order.status]}`}
        actions={
          <Button variant="ghost" onClick={() => router.push('/dashboard/maintenance')}>
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Order Details</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <DetailRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Description"
                  value={<p className="whitespace-pre-wrap text-neutral-300">{order.description}</p>}
                />
              </div>
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="Priority"
                value={<Badge variant={priorityBadge[order.priority]}>{formatPriority(order.priority)}</Badge>}
              />
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="Status"
                value={<Badge variant={statusBadge[order.status]}>{statusLabel[order.status]}</Badge>}
              />
              <DetailRow
                icon={<MapPin className="h-4 w-4" />}
                label="Room"
                value={
                  order.room
                    ? `Room ${order.room.roomNumber} — Floor ${order.room.floor}`
                    : <span className="text-neutral-500">Not assigned to a room</span>
                }
              />
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label="Assigned To"
                value={
                  order.assignedEmployee
                    ? `${order.assignedEmployee.firstName} ${order.assignedEmployee.lastName}`
                    : <span className="text-neutral-500">Unassigned</span>
                }
              />
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label="Reported By"
                value={
                  order.reportingEmployee
                    ? `${order.reportingEmployee.firstName} ${order.reportingEmployee.lastName}`
                    : <span className="text-neutral-500">—</span>
                }
              />
              <DetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="Created"
                value={new Date(order.createdAt).toLocaleString()}
              />
              {order.scheduledDate && (
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Scheduled Date"
                  value={new Date(order.scheduledDate).toLocaleDateString()}
                />
              )}
              {order.startedAt && (
                <DetailRow
                  icon={<Play className="h-4 w-4" />}
                  label="Started At"
                  value={new Date(order.startedAt).toLocaleString()}
                />
              )}
              {order.completedAt && (
                <DetailRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Completed At"
                  value={new Date(order.completedAt).toLocaleString()}
                />
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Cost Information</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Estimated Cost"
                value={
                  order.estimatedCost != null
                    ? <span className="text-lg font-semibold text-neutral-200">{currencySymbol}{Number(order.estimatedCost).toFixed(2)}</span>
                    : <span className="text-neutral-500">Not set</span>
                }
              />
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Actual Cost"
                value={
                  order.actualCost != null
                    ? <span className="text-lg font-semibold text-neutral-200">{currencySymbol}{Number(order.actualCost).toFixed(2)}</span>
                    : <span className="text-neutral-500">Not recorded</span>
                }
              />
              {order.estimatedCost != null && order.actualCost != null && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Variance</p>
                  <p className={`mt-0.5 text-sm font-medium ${Number(order.actualCost) <= Number(order.estimatedCost) ? 'text-success' : 'text-error'}`}>
                    {Number(order.actualCost) <= Number(order.estimatedCost) ? 'Under budget' : 'Over budget'} by {currencySymbol}{Math.abs(Number(order.actualCost) - Number(order.estimatedCost)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {order.resolution && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-white">Resolution Notes</h2>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">{order.resolution}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Actions</h2>
            <div className="space-y-3">
              {order.status === 'OPEN' && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus.mutate({ id: order.id, status: 'IN_PROGRESS' })}
                  isLoading={updateStatus.isPending}
                >
                  <Play className="h-4 w-4" />
                  Start Work
                </Button>
              )}
              {order.status === 'IN_PROGRESS' && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => updateStatus.mutate({ id: order.id, status: 'COMPLETED', resolution: 'Completed' })}
                    isLoading={updateStatus.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Completed
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => updateStatus.mutate({ id: order.id, status: 'ON_HOLD' })}
                    isLoading={updateStatus.isPending}
                  >
                    <Pause className="h-4 w-4" />
                    Put on Hold
                  </Button>
                </>
              )}
              {order.status === 'ON_HOLD' && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus.mutate({ id: order.id, status: 'IN_PROGRESS' })}
                  isLoading={updateStatus.isPending}
                >
                  <Play className="h-4 w-4" />
                  Resume Work
                </Button>
              )}
              {(order.status === 'OPEN' || order.status === 'IN_PROGRESS' || order.status === 'ON_HOLD') && (
                <Button
                  className="w-full"
                  variant="danger"
                  onClick={() => updateStatus.mutate({ id: order.id, status: 'CANCELLED' })}
                  isLoading={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </Button>
              )}
              <Button
                className="w-full"
                variant="secondary"
                onClick={openEdit}
              >
                <Edit3 className="h-4 w-4" />
                Edit Details
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Maintenance Order" size="lg">
        <div className="space-y-4">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <div>
            <label htmlFor="edit-description" className="mb-1.5 block text-sm font-medium text-neutral-300">
              Description
            </label>
            <textarea
              id="edit-description"
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500 resize-none"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Priority"
              options={[
                { value: 'P1_CRITICAL', label: 'P1 Critical' },
                { value: 'P2_HIGH', label: 'P2 High' },
                { value: 'P3_MEDIUM', label: 'P3 Medium' },
                { value: 'P4_LOW', label: 'P4 Low' },
              ]}
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
            />
            <Select
              label="Assigned To"
              placeholder="Select employee"
              options={employeeOptions}
              value={editAssignedTo}
              onChange={(e) => setEditAssignedTo(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={`Estimated Cost (${currencySymbol})`}
              type="number"
              min="0"
              step="0.01"
              value={editEstimatedCost}
              onChange={(e) => setEditEstimatedCost(e.target.value)}
            />
            <Input
              label={`Actual Cost (${currencySymbol})`}
              type="number"
              min="0"
              step="0.01"
              value={editActualCost}
              onChange={(e) => setEditActualCost(e.target.value)}
            />
          </div>
          <Input
            label="Scheduled Date"
            type="date"
            value={editScheduledDate}
            onChange={(e) => setEditScheduledDate(e.target.value)}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleEdit} isLoading={updateOrder.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
