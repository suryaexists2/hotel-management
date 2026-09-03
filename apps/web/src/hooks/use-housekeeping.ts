'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface HousekeepingTask {
  id: string;
  hotelId: string;
  roomId: string;
  assignedTo: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'REASSIGNED';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  inspectedAt: string | null;
  inspectedBy: string | null;
  createdAt: string;
  updatedAt: string;
  room: { id: string; roomNumber: string; floor: number };
  assignedEmployee: { id: string; firstName: string; lastName: string } | null;
}

interface HousekeepingFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  roomId?: string;
}

export function useHousekeepingTasks(filters: HousekeepingFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['housekeepingTasks', filters],
    queryFn: () => apiClient.getPaginated<HousekeepingTask>(`/housekeeping?${params}`),
  });
}

export function useHousekeepingTask(id: string) {
  return useQuery({
    queryKey: ['housekeepingTask', id],
    queryFn: () => apiClient.get<HousekeepingTask>(`/housekeeping/${id}`),
    enabled: !!id,
  });
}

export function useCreateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      roomId: string;
      assignedTo?: string;
      priority?: string;
      type: string;
      notes?: string;
    }) => apiClient.post<HousekeepingTask>('/housekeeping', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeepingTasks'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useUpdateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      assignedTo: string;
      priority: string;
      type: string;
      notes: string;
    }>) => apiClient.patch<HousekeepingTask>(`/housekeeping/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeepingTasks'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useUpdateHousekeepingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiClient.patch<HousekeepingTask>(`/housekeeping/${id}/status`, { status, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeepingTasks'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useInspectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiClient.patch<HousekeepingTask>(`/housekeeping/${id}/inspect`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeepingTasks'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}