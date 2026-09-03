'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useUploadIdProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, front, back }: { id: string; front?: File; back?: File }) => {
      const formData = new FormData();
      if (front) formData.append('idProofFront', front);
      if (back) formData.append('idProofBack', back);
      const token = localStorage.getItem('innsight_access_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/guests/${id}/id-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Upload failed');
      return json.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guest'] }); },
  });
}

export function useGuestHistory(filters: { guestId?: string; search?: string; from?: string; to?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['guest-history', filters],
    queryFn: () => apiClient.getPaginated<any>(`/guests/history?${params}`),
  });
}

export function useBulkDeleteGuests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/guests/bulk-delete', { ids }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); },
  });
}

export function useDeleteByDateRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => apiClient.post('/guests/delete-by-date-range', { from, to }),
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); qc.invalidateQueries({ queryKey: ['guest-backups'] }); },
  });
}

export function useListBackups() {
  return useQuery({
    queryKey: ['guest-backups'],
    queryFn: () => apiClient.get<any[]>('/guests/backups'),
  });
}
