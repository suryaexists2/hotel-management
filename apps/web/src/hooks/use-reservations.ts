'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Reservation {
  id: string;
  hotelId: string;
  confirmationNo: string;
  guestId: string;
  roomTypeId: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  ratePerNight: number;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'WAITLISTED';
  source: string;
  specialRequests: string | null;
  internalNotes: string | null;
  createdBy: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  guest: { id: string; firstName: string; lastName: string; email: string; vipLevel: string };
  roomType: { id: string; name: string; baseRate: number };
  room: { id: string; roomNumber: string; floor: number } | null;
  occupants?: { id: string; firstName: string; lastName: string; gender: string | null; dateOfBirth: string | null; phone: string | null; email: string | null; idType: string | null; idNumber: string | null; relationship: string | null }[];
}

interface ReservationFilters {
  page?: number;
  limit?: number;
  status?: string;
  guestId?: string;
  roomId?: string;
  from?: string;
  to?: string;
}

interface AvailabilityQuery {
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
}

export function useReservations(filters: ReservationFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => apiClient.getPaginated<Reservation>(`/reservations?${params}`),
  });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => apiClient.get<Reservation>(`/reservations/${id}`),
    enabled: !!id,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      guestId: string;
      roomTypeId: string;
      checkInDate: string;
      checkOutDate: string;
      adults: number;
      children?: number;
      ratePerNight: number;
      source?: string;
      specialRequests?: string;
      internalNotes?: string;
    }) => apiClient.post<Reservation>('/reservations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId?: string }) =>
      apiClient.post<Reservation>(`/reservations/${id}/check-in`, { roomId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiClient.post<Reservation>(`/reservations/${id}/check-out`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.post<Reservation>(`/reservations/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useCheckAvailability() {
  return useMutation({
    mutationFn: (query: AvailabilityQuery) =>
      apiClient.get<{ roomTypeId: string; available: number; checkInDate: string; checkOutDate: string }>(
        `/reservations/availability?checkInDate=${query.checkInDate}&checkOutDate=${query.checkOutDate}${query.roomTypeId ? `&roomTypeId=${query.roomTypeId}` : ''}`,
      ),
  });
}

// ── Occupant / Companion Management ──

export interface Occupant {
  id: string;
  reservationId: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  idType: string | null;
  idNumber: string | null;
  relationship: string | null;
}

export function useOccupants(reservationId: string) {
  return useQuery({
    queryKey: ['occupants', reservationId],
    queryFn: () => apiClient.get<Occupant[]>(`/reservations/${reservationId}/occupants`),
    enabled: !!reservationId,
  });
}

export function useAddOccupant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, ...data }: { reservationId: string; firstName: string; lastName: string; gender?: string; dateOfBirth?: string; phone?: string; email?: string; idType?: string; idNumber?: string; relationship?: string }) =>
      apiClient.post<Occupant>(`/reservations/${reservationId}/occupants`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['occupants'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
    },
  });
}

export function useUpdateOccupant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, occupantId, ...data }: { reservationId: string; occupantId: string; firstName?: string; lastName?: string; gender?: string; dateOfBirth?: string; phone?: string; email?: string; idType?: string; idNumber?: string; relationship?: string }) =>
      apiClient.patch<Occupant>(`/reservations/${reservationId}/occupants/${occupantId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['occupants'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
    },
  });
}

export function useRemoveOccupant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, occupantId }: { reservationId: string; occupantId: string }) =>
      apiClient.delete(`/reservations/${reservationId}/occupants/${occupantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['occupants'] });
      qc.invalidateQueries({ queryKey: ['reservation'] });
    },
  });
}