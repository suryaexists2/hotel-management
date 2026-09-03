'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useSetupCheck() {
  return useQuery({
    queryKey: ['setup', 'check'],
    queryFn: () => apiClient.get<{ configured: boolean }>('/setup/check'),
    retry: false,
  });
}

export function useSetupHotel() {
  return useMutation({
    mutationFn: (data: { name: string; phone: string; address: string }) =>
      apiClient.post<{ message: string }>('/setup', data),
  });
}
