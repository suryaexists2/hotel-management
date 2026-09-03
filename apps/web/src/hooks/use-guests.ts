'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Guest {
  id: string;
  hotelId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  idProofFront: string | null;
  idProofBack: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  vipLevel: string;
  preferences: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  reservations?: any[];
  backup?: any;
}

interface GuestFilters {
  page?: number;
  limit?: number;
  search?: string;
  vipLevel?: string;
}

export function useGuests(filters: GuestFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['guests', filters],
    queryFn: () => apiClient.getPaginated<Guest>(`/guests?${params}`),
  });
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: ['guest', id],
    queryFn: () => apiClient.get<Guest>(`/guests/${id}`),
    enabled: !!id,
  });
}

export function useCreateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Guest, 'id' | 'hotelId' | 'createdAt' | 'updatedAt' | 'idProofFront' | 'idProofBack' | 'reservations' | 'backup'>) =>
      apiClient.post<Guest>('/guests', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Omit<Guest, 'id' | 'hotelId' | 'createdAt' | 'updatedAt' | 'idProofFront' | 'idProofBack' | 'reservations' | 'backup'>>) =>
      apiClient.patch<Guest>(`/guests/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}

export interface GuestBackup {
  id: string;
  guestId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  backedUpAt: string;
  createdAt: string;
  updatedAt: string;
}

export function useGuestBackups() {
  return useQuery({
    queryKey: ['guest-backups'],
    queryFn: () => apiClient.get<GuestBackup[]>('/guests/backups'),
  });
}

export function useBulkDeleteGuests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/guests/bulk-delete', { ids }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}

export function useDeleteGuestsByDateRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (range: { from: string; to: string }) =>
      apiClient.post('/guests/delete-by-date-range', range),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}

export function useClearAllGuests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/guests/clear-all'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}

export function useRestoreGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/guests/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['guest-backups'] });
    },
  });
}

export function useDeleteGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/guests/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}