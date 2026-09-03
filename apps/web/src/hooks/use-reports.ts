'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DashboardReport {
  occupancy: {
    rate: number;
    adr: number;
    revPar: number;
    roomRevenue: number;
  };
  rooms: {
    total: number;
    byStatus: Record<string, number>;
  };
  today: {
    arrivals: number;
    departures: number;
    inHouse: number;
  };
  folios: {
    open: number;
    outstandingBalance: number;
  };
  housekeeping: {
    pending: number;
  };
  maintenance: {
    open: number;
  };
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  pendingPayments: number;
  outstandingInvoices: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
  }>;
}

export function useDashboardReport() {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => apiClient.get<DashboardReport>('/reports/dashboard'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}