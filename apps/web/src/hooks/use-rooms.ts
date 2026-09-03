'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Room {
  id: string;
  hotelId: string;
  roomNumber: string;
  floor: number;
  roomTypeId: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'CLEANING' | 'INSPECTED' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
  notes: string | null;
  lastCleanedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roomType: {
    id: string;
    name: string;
    baseRate: number;
    maxOccupancy: number;
  } | null;
}

export interface RoomFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  roomTypeId?: string;
  floor?: number;
}

export function useRooms(filters: RoomFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['rooms', filters],
    queryFn: () => apiClient.getPaginated<Room>(`/rooms?${params}`),
  });
}

export function useRoom(id: string) {
  return useQuery({
    queryKey: ['room', id],
    queryFn: () => apiClient.get<Room>(`/rooms/${id}`),
    enabled: !!id,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      roomNumber: string;
      floor: number;
      roomTypeId: string;
      status?: string;
      notes?: string;
    }) => apiClient.post<Room>('/rooms', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); },
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      roomNumber: string;
      floor: number;
      roomTypeId: string;
      notes: string;
    }>) => apiClient.patch<Room>(`/rooms/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); },
  });
}

export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch<Room>(`/rooms/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); },
  });
}
