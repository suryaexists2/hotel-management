'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface HotelSettings {
  supportedCurrencies: string[];
  defaultTaxRate: number;
  allowOverbooking: boolean;
  overbookingLimit: number;
}

export interface HotelDTO {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  phone: string;
  email: string;
  website: string | null;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  currencySymbol: string;
  checkInTime: string;
  checkOutTime: string;
  createdAt: string;
  updatedAt: string;
  settings: HotelSettings;
}

export interface TaxRule {
  id: string;
  hotelId: string;
  name: string;
  rate: number;
  appliesTo: string[];
  isInclusive: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useHotel() {
  return useQuery({
    queryKey: ['hotel'],
    queryFn: () => apiClient.get<HotelDTO>('/hotel'),
  });
}

export function useUpdateHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<HotelDTO, 'id' | 'createdAt' | 'updatedAt' | 'settings'>>) =>
      apiClient.patch<HotelDTO>('/hotel', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hotel'] }); },
  });
}

export function useUpdateHotelSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HotelSettings>) =>
      apiClient.patch<HotelDTO>('/hotel/settings', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hotel'] }); },
  });
}

export function useTaxRules() {
  return useQuery({
    queryKey: ['taxRules'],
    queryFn: () => apiClient.get<TaxRule[]>('/hotel/tax-rules'),
  });
}

export function useCreateTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TaxRule, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>) =>
      apiClient.post<TaxRule>('/hotel/tax-rules', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taxRules'] }); },
  });
}

export function useUpdateTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Omit<TaxRule, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>>) =>
      apiClient.patch<TaxRule>(`/hotel/tax-rules/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taxRules'] }); },
  });
}

export function useDeleteTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/hotel/tax-rules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taxRules'] }); },
  });
}