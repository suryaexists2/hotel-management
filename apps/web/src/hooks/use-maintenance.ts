'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface MaintenanceOrder {
  id: string;
  hotelId: string;
  roomId: string | null;
  title: string;
  description: string;
  priority: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  reportedBy: string | null;
  assignedTo: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  scheduledDate: string | null;
  resolution: string | null;
  images: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  room: { id: string; roomNumber: string; floor: number } | null;
  assignedEmployee: { id: string; firstName: string; lastName: string } | null;
  reportingEmployee: { id: string; firstName: string; lastName: string } | null;
}

interface MaintenanceFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  roomId?: string;
}

export function useMaintenanceOrders(filters: MaintenanceFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['maintenanceOrders', filters],
    queryFn: () => apiClient.getPaginated<MaintenanceOrder>(`/maintenance?${params}`),
  });
}

export function useMaintenanceOrder(id: string) {
  return useQuery({
    queryKey: ['maintenanceOrder', id],
    queryFn: () => apiClient.get<MaintenanceOrder>(`/maintenance/${id}`),
    enabled: !!id,
  });
}

export function useCreateMaintenanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      roomId?: string;
      title: string;
      description: string;
      priority?: string;
      assignedTo?: string;
      estimatedCost?: number;
      scheduledDate?: string;
    }) => apiClient.post<MaintenanceOrder>('/maintenance', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenanceOrders'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useUpdateMaintenanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      title: string;
      description: string;
      priority: string;
      assignedTo: string;
      estimatedCost: number;
      actualCost: number;
      scheduledDate: string;
      resolution: string;
    }>) => apiClient.patch<MaintenanceOrder>(`/maintenance/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenanceOrders'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution?: string }) =>
      apiClient.patch<MaintenanceOrder>(`/maintenance/${id}/status`, { status, resolution }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenanceOrders'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}