'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, CheckCircle2, SkipForward, ClipboardCheck, Edit3, Calendar, User, MapPin, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { useHousekeepingTask, useUpdateHousekeepingStatus, useInspectTask, useUpdateHousekeepingTask } from '@/hooks/use-housekeeping';

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

const statusLabel: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  REASSIGNED: 'Reassigned',
};

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

export default function HousekeepingTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: task, isLoading } = useHousekeepingTask(id);
  const updateStatus = useUpdateHousekeepingStatus();
  const inspectTask = useInspectTask();
  const updateTask = useUpdateHousekeepingTask();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const openEdit = () => {
    if (!task) return;
    setEditType(task.type);
    setEditNotes(task.notes ?? '');
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!task) return;
    await updateTask.mutateAsync({ id: task.id, type: editType, notes: editNotes || undefined });
    setShowEditModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-400">Task not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Task — Room ${task.room.roomNumber}`}
        description={`${task.type} • ${statusLabel[task.status]}`}
        actions={
          <Button variant="ghost" onClick={() => router.push('/dashboard/housekeeping')}>
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Task Details</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="Task Type"
                value={<span className="capitalize font-medium">{task.type.toLowerCase()}</span>}
              />
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="Priority"
                value={<Badge variant={priorityBadge[task.priority]}>{task.priority}</Badge>}
              />
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="Status"
                value={<Badge variant={statusBadge[task.status]}>{statusLabel[task.status]}</Badge>}
              />
              <DetailRow
                icon={<MapPin className="h-4 w-4" />}
                label="Room"
                value={
                  <span>
                    Room {task.room.roomNumber} — Floor {task.room.floor}
                  </span>
                }
              />
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label="Assigned To"
                value={
                  task.assignedEmployee
                    ? `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`
                    : <span className="text-neutral-500">Unassigned</span>
                }
              />
              <DetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="Created"
                value={new Date(task.createdAt).toLocaleString()}
              />
              {task.startedAt && (
                <DetailRow
                  icon={<Play className="h-4 w-4" />}
                  label="Started At"
                  value={new Date(task.startedAt).toLocaleString()}
                />
              )}
              {task.completedAt && (
                <DetailRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Completed At"
                  value={new Date(task.completedAt).toLocaleString()}
                />
              )}
              {task.inspectedAt && (
                <DetailRow
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  label="Inspected At"
                  value={new Date(task.inspectedAt).toLocaleString()}
                />
              )}
            </div>
          </Card>

          {task.notes && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-white">Notes</h2>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">{task.notes}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Timeline</h2>
            <div className="space-y-3">
              <TimelineItem
                icon={<FileText className="h-4 w-4" />}
                label="Task Created"
                time={task.createdAt}
                active
              />
              {task.startedAt && (
                <TimelineItem
                  icon={<Play className="h-4 w-4" />}
                  label="Work Started"
                  time={task.startedAt}
                  active
                />
              )}
              {task.completedAt && (
                <TimelineItem
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Completed"
                  time={task.completedAt}
                  active
                />
              )}
              {task.inspectedAt && (
                <TimelineItem
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  label="Inspected"
                  time={task.inspectedAt}
                  active
                />
              )}
              {!task.completedAt && !task.inspectedAt && (
                <TimelineItem
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Pending Completion"
                  time={null}
                  active={false}
                />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Actions</h2>
            <div className="space-y-3">
              {task.status === 'PENDING' && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}
                  isLoading={updateStatus.isPending}
                >
                  <Play className="h-4 w-4" />
                  Start Task
                </Button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => updateStatus.mutate({ id: task.id, status: 'COMPLETED' })}
                    isLoading={updateStatus.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Completed
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => updateStatus.mutate({ id: task.id, status: 'SKIPPED' })}
                    isLoading={updateStatus.isPending}
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip Task
                  </Button>
                </>
              )}
              {task.status === 'COMPLETED' && !task.inspectedAt && (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => inspectTask.mutate({ id: task.id })}
                  isLoading={inspectTask.isPending}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Inspect Task
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

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Task Details">
        <div className="space-y-4">
          <Input
            label="Task Type"
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
          />
          <div>
            <label htmlFor="edit-notes" className="mb-1.5 block text-sm font-medium text-neutral-300">
              Notes
            </label>
            <textarea
              id="edit-notes"
              rows={4}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleEdit} isLoading={updateTask.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TimelineItem({ icon, label, time, active }: { icon: React.ReactNode; label: string; time: string | null; active: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-brand-500/10 text-brand-400' : 'bg-neutral-800 text-neutral-600'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${active ? 'text-neutral-200' : 'text-neutral-600'}`}>{label}</p>
        {time && <p className="text-xs text-neutral-500">{new Date(time).toLocaleString()}</p>}
      </div>
    </div>
  );
}
