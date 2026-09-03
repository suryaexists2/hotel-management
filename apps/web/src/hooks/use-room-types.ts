'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  baseRate: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  amenities: string[];
  images: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { rooms: number };
}

interface RoomTypeFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

export function useRoomTypes(filters: RoomTypeFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['roomTypes', filters],
    queryFn: () => apiClient.getPaginated<RoomType>(`/room-types?${params}`),
  });
}

export function useRoomType(id: string) {
  return useQuery({
    queryKey: ['roomType', id],
    queryFn: () => apiClient.get<RoomType>(`/room-types/${id}`),
    enabled: !!id,
  });
}

export function useCreateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<RoomType, 'id' | 'hotelId' | 'createdAt' | 'updatedAt' | '_count'>) =>
      apiClient.post<RoomType>('/room-types', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roomTypes'] }); },
  });
}

export function useUpdateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Omit<RoomType, 'id' | 'hotelId' | 'createdAt' | 'updatedAt' | '_count'>>) =>
      apiClient.patch<RoomType>(`/room-types/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roomTypes'] }); },
  });
}

export function useDeleteRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/room-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roomTypes'] }); },
  });
}