'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface FolioCharge {
  id: string;
  folioId: string;
  category: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
  taxAmount: number;
  taxRate: number;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  folioId: string;
  amount: number;
  method: string;
  referenceNo: string | null;
  notes: string | null;
  status: string;
  refundedAmount: number | null;
  refundedAt: string | null;
  refundReason: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface Folio {
  id: string;
  hotelId: string;
  reservationId: string;
  guestId: string;
  folioNumber: string;
  currency: string;
  status: string;
  totalCharges: number;
  totalDiscounts: number;
  totalTax: number;
  totalPayments: number;
  balance: number;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  charges: FolioCharge[];
  payments: Payment[];
}

export interface Invoice {
  id: string;
  hotelId: string;
  folioId: string;
  invoiceNumber: string;
  guestName: string;
  guestEmail: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: string;
  taxBreakdown: Record<string, number>;
  lineItems: { description: string; category: string; quantity: number; unitPrice: number; taxAmount: number; total: number }[];
  createdAt: string;
}

export function useFolio(reservationId: string) {
  return useQuery({
    queryKey: ['folio', 'reservation', reservationId],
    queryFn: () => apiClient.get<Folio>(`/billing/reservations/${reservationId}/folio`),
    enabled: !!reservationId,
  });
}

export function useFolioById(folioId: string) {
  return useQuery({
    queryKey: ['folio', folioId],
    queryFn: () => apiClient.get<Folio>(`/billing/folios/${folioId}`),
    enabled: !!folioId,
  });
}

export function useAddCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      folioId: string;
      category: string;
      description: string;
      unitPrice: number;
      quantity?: number;
      taxRate?: number;
    }) => apiClient.post<Folio>(`/billing/folios/${data.folioId}/charges`, {
      category: data.category,
      description: data.description,
      unitPrice: data.unitPrice,
      quantity: data.quantity,
      taxAmount: data.taxRate ? Math.round(data.unitPrice * (data.quantity || 1) * data.taxRate) / 100 : 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      folioId: string;
      amount: number;
      method: string;
      referenceNo?: string;
      notes?: string;
    }) => apiClient.post<Folio>(`/billing/folios/${data.folioId}/payments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useVoidCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folioId, chargeId, reason }: { folioId: string; chargeId: string; reason?: string }) =>
      apiClient.post<Folio>(`/billing/folios/${folioId}/charges/${chargeId}/void`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folioId, paymentId, amount, reason }: { folioId: string; paymentId: string; amount: number; reason: string }) =>
      apiClient.post<Folio>(`/billing/folios/${folioId}/payments/${paymentId}/refund`, { amount, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folioId, paymentId, data }: {
      folioId: string;
      paymentId: string;
      data: { amount: number; method: string; referenceNo?: string | null; notes?: string | null };
    }) => apiClient.patch<Folio>(`/billing/folios/${folioId}/payments/${paymentId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useVoidPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folioId, paymentId, reason }: { folioId: string; paymentId: string; reason: string }) =>
      apiClient.post<Folio>(`/billing/folios/${folioId}/payments/${paymentId}/void`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folioId }: { folioId: string }) =>
      apiClient.post<Invoice>(`/billing/folios/${folioId}/invoice`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folio'] });
      qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
}

export function useInvoices(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['invoices', page, limit],
    queryFn: () =>
      apiClient.get<{ items: Invoice[]; total: number; page: number; limit: number }>(
        `/billing/invoices?page=${page}&limit=${limit}`,
      ),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () =>
      apiClient.get<Invoice & {
        folio: Folio & {
          reservation: {
            id: string;
            confirmationNo: string;
            room: { roomNumber: string };
            roomType: { name: string };
            guest: { firstName: string; lastName: string; email: string; phone: string | null; address: string | null; city: string | null; country: string | null };
            occupants: { id: string; firstName: string; lastName: string; relationship: string | null }[];
            checkInDate: string;
            checkOutDate: string;
            nights: number;
            adults: number;
            children: number;
          };
        };
      }>(`/billing/invoices/${id}`),
    enabled: !!id,
  });
}