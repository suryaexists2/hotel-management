'use client';

import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, Users, DollarSign,
  Calendar, Trash2, RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCurrencySymbol } from '@/hooks/use-currency';
import { useDailyAnalytics, useComputeAnalytics, useDeleteAnalytics } from '@/hooks/use-analytics';
import { Modal } from '@/components/ui/Modal';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function get30DaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().split('T')[0];
}

export default function AnalyticsPage() {
  const currencySymbol = useCurrencySymbol();
  const [from, setFrom] = useState(get30DaysAgo());
  const [to, setTo] = useState(getToday());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading, refetch } = useDailyAnalytics(from, to);
  const computeMutation = useComputeAnalytics();
  const deleteMutation = useDeleteAnalytics();

  const analytics = Array.isArray(data) ? data : [];

  const totalRevenue = analytics.reduce((s, a) => s + Number(a.totalRevenue), 0);
  const totalGuests = analytics.reduce((s, a) => s + a.totalGuests, 0);

  const handleCompute = () => {
    computeMutation.mutate(getToday(), {
      onSuccess: () => refetch(),
    });
  };

  const handleDelete = async (date: string) => {
    try {
      await deleteMutation.mutateAsync(date);
      setDeleteConfirm(null);
      refetch();
    } catch {
      // handled by mutation state
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Analytics"
        description="View and manage daily hotel performance data"
        actions={
          <Button variant="secondary" onClick={handleCompute} disabled={computeMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
            Compute Today
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg text-brand-400 bg-brand-500/10">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Total Days</p>
              <p className="text-2xl font-bold text-white">{analytics.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg text-success bg-success/10">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Total Guests</p>
              <p className="text-2xl font-bold text-white">{totalGuests.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg text-warning bg-warning/10">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Total Revenue</p>
              <p className="text-2xl font-bold text-white">{currencySymbol}{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg text-info bg-info/10">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-neutral-400">Avg Occupancy</p>
              <p className="text-2xl font-bold text-white">
                {analytics.length > 0
                  ? `${Math.round(analytics.reduce((s, a) => s + a.occupancyRate, 0) / analytics.length)}%`
                  : '—'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span className="text-sm text-neutral-400">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white [color-scheme:dark]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white [color-scheme:dark]" />
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setFrom(get30DaysAgo()); setTo(getToday()); }}>
            Last 30 Days
          </Button>
          <span className="text-sm text-neutral-500 ml-auto">{analytics.length} records</span>
        </div>
      </Card>

      {/* Analytics Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : analytics.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <BarChart3 className="mb-2 h-10 w-10" />
              <p className="text-lg">No analytics data</p>
              <p className="text-sm">Click "Compute Today" to generate data for today, or adjust the date range</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Guests</th>
                  <th className="px-4 py-3 font-medium text-right">Reservations</th>
                  <th className="px-4 py-3 font-medium text-right">Check-ins</th>
                  <th className="px-4 py-3 font-medium text-right">Check-outs</th>
                  <th className="px-4 py-3 font-medium text-right">Cancellations</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                  <th className="px-4 py-3 font-medium text-right">Rooms Booked</th>
                  <th className="px-4 py-3 font-medium text-right">Occupancy</th>
                  <th className="px-4 py-3 font-medium text-right">Avg Nights</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {analytics.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3 text-white whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-right text-white">{row.totalGuests}</td>
                    <td className="px-4 py-3 text-right text-white">{row.totalReservations}</td>
                    <td className="px-4 py-3 text-right text-success">{row.checkIns}</td>
                    <td className="px-4 py-3 text-right text-warning">{row.checkOuts}</td>
                    <td className="px-4 py-3 text-right text-error">{row.cancellations}</td>
                    <td className="px-4 py-3 text-right text-white">{currencySymbol}{Number(row.totalRevenue).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white">{row.totalRoomsBooked}</td>
                    <td className="px-4 py-3 text-right text-white">{Math.round(row.occupancyRate)}%</td>
                    <td className="px-4 py-3 text-right text-white">{Number(row.avgNights).toFixed(1)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteConfirm(row.date)}
                        className="rounded-lg p-1.5 text-neutral-500 hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete this day's data"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal isOpen onClose={() => setDeleteConfirm(null)} title="Delete Analytics Data">
          <p className="text-sm text-neutral-400 mb-6">
            Are you sure you want to delete analytics data for <strong className="text-white">{formatDate(deleteConfirm)}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirm)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
