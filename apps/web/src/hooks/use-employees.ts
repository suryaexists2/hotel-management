'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Employee {
  id: string;
  hotelId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  position: string;
  employeeCode: string;
  dateOfJoining: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string } | null;
}

interface EmployeeFilters {
  page?: number;
  limit?: number;
  department?: string;
  isActive?: boolean;
  search?: string;
}

export function useEmployees(filters: EmployeeFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => apiClient.getPaginated<Employee>(`/employees?${params}`),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiClient.get<Employee>(`/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      department: string;
      position: string;
      employeeCode: string;
      dateOfJoining?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
    }) => apiClient.post<Employee>('/employees', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      department: string;
      position: string;
      employeeCode: string;
      dateOfJoining: string;
      emergencyContact: string;
      emergencyPhone: string;
      isActive: boolean;
    }>) => apiClient.patch<Employee>(`/employees/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); },
  });
}