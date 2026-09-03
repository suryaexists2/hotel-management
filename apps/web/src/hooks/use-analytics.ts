'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DailyAnalytics {
  id: string;
  hotelId: string;
  date: string;
  totalGuests: number;
  totalReservations: number;
  checkIns: number;
  checkOuts: number;
  cancellations: number;
  totalRevenue: number;
  totalRoomsBooked: number;
  occupancyRate: number;
  avgNights: number;
}

export function useDailyAnalytics(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return useQuery({
    queryKey: ['daily-analytics', { from, to }],
    queryFn: () => apiClient.get<DailyAnalytics[]>(`/analytics${qs ? `?${qs}` : ''}`),
  });
}

export function useComputeAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => apiClient.post<DailyAnalytics>('/analytics/compute', date ? { date } : {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-analytics'] }); },
  });
}

export function useDeleteAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => apiClient.delete(`/analytics/${date}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-analytics'] }); },
  });
}

export function useSeedAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days?: number) => apiClient.post<{ generated: number }>('/analytics/seed', { days: days ?? 30 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-analytics'] }); },
  });
}
