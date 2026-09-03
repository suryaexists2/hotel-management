'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, CalendarCheck, Sparkles, Wrench, Receipt,
  ArrowRight, BadgePercent, DoorOpen, LogOut, Hotel, Plus, Settings,
  BarChart3, ChevronLeft, ChevronRight, RefreshCw, TrendingUp, Users, DollarSign, Calendar,
  CreditCard, FileText, Clock
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { LiveClock } from '@/components/ui/LiveClock';
import { useDashboardReport } from '@/hooks/use-reports';
import { useRoomTypes } from '@/hooks/use-room-types';
import { useRooms } from '@/hooks/use-rooms';
import { useCurrencySymbol } from '@/hooks/use-currency';
import { useDailyAnalytics, useComputeAnalytics } from '@/hooks/use-analytics';

const statusLabels: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: 'Available', color: 'bg-success/10 text-success border-success/20' },
  OCCUPIED: { label: 'Occupied', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20' },
  DIRTY: { label: 'Dirty', color: 'bg-warning/10 text-warning border-warning/20' },
  CLEANING: { label: 'Cleaning', color: 'bg-info/10 text-info border-info/20' },
  OUT_OF_ORDER: { label: 'Out of Order', color: 'bg-error/10 text-error border-error/20' },
  OUT_OF_SERVICE: { label: 'Out of Service', color: 'bg-error/10 text-error border-error/20' },
  INSPECTED: { label: 'Inspected', color: 'bg-success/10 text-success border-success/20' },
};

function formatDate(d: Date) {
  const s = d.toISOString().split('T')[0];
  return s ?? '';
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useDashboardReport();
  const { data: roomTypesData } = useRoomTypes({ page: 1, limit: 1 });
  const { data: roomsData } = useRooms({ page: 1, limit: 1 });
  const currencySymbol = useCurrencySymbol();

  const today = formatDate(new Date());
  const [viewDate, setViewDate] = useState<string>(today);
  const { data: dailyAnalytics, isLoading: analyticsLoading } = useDailyAnalytics(viewDate, viewDate);
  const computeMutation = useComputeAnalytics();

  const hasRoomTypes = (roomTypesData?.total ?? 0) > 0;
  const hasRooms = (roomsData?.total ?? 0) > 0;
  const showWelcomeBanner = !hasRoomTypes || !hasRooms;

  const navDate = (dir: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + dir);
    setViewDate(formatDate(d));
  };

  const isToday = viewDate === today;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  const safeNum = (v: any, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  const stats = [
    { 
      label: 'Occupancy Rate', 
      value: data ? `${Math.round(safeNum(data.occupancy?.rate))}%` : '—',
      icon: <BadgePercent className="h-5 w-5" />,
      color: 'text-brand-400 bg-brand-500/10',
    },
    { 
      label: 'Room Revenue', 
      value: data ? `${currencySymbol}${safeNum(data.occupancy?.roomRevenue).toLocaleString()}` : '—',
      icon: <Receipt className="h-5 w-5" />,
      color: 'text-success bg-success/10',
    },
    { 
      label: 'ADR', 
      value: data ? `${currencySymbol}${Math.round(safeNum(data.occupancy?.adr))}` : '—',
      icon: <Building2 className="h-5 w-5" />,
      color: 'text-info bg-info/10',
    },
    { 
      label: 'RevPAR', 
      value: data ? `${currencySymbol}${Math.round(safeNum(data.occupancy?.revPar))}` : '—',
      icon: <BadgePercent className="h-5 w-5" />,
      color: 'text-warning bg-warning/10',
    },
  ];

  const todayStats = [
    { label: 'Arrivals Today', value: data?.today?.arrivals ?? '—', icon: <CalendarCheck className="h-5 w-5" />, color: 'text-success bg-success/10' },
    { label: 'Departures Today', value: data?.today?.departures ?? '—', icon: <LogOut className="h-5 w-5" />, color: 'text-warning bg-warning/10' },
    { label: 'In-House', value: data?.today?.inHouse ?? '—', icon: <DoorOpen className="h-5 w-5" />, color: 'text-brand-400 bg-brand-500/10' },
    { label: 'Open Folios', value: data?.folios?.open ?? '—', icon: <Receipt className="h-5 w-5" />, color: 'text-info bg-info/10' },
  ];

  const taskStats = [
    { label: 'Pending Housekeeping', value: data?.housekeeping.pending ?? '—', icon: <Sparkles className="h-5 w-5" />, color: 'text-warning bg-warning/10', href: '/dashboard/housekeeping' },
    { label: 'Open Maintenance', value: data?.maintenance.open ?? '—', icon: <Wrench className="h-5 w-5" />, color: 'text-error bg-error/10', href: '/dashboard/maintenance' },
  ];

  const quickActions = [
    { label: 'New Reservation', href: '/dashboard/reservations/new', icon: <CalendarCheck className="h-4 w-4" /> },
    { label: 'Check-In Guest', href: '/dashboard/reservations', icon: <DoorOpen className="h-4 w-4" /> },
    { label: 'View Rooms', href: '/dashboard/rooms', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  const dayData = Array.isArray(dailyAnalytics) && dailyAnalytics.length > 0 ? dailyAnalytics[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-400">Overview of your hotel operations</p>
        </div>
        <LiveClock />
      </div>

      {/* Welcome Banner */}
      {showWelcomeBanner && (
        <Card className="border-brand-500/30 bg-gradient-to-br from-brand-500/5 to-neutral-900">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500/20">
                <Hotel className="h-7 w-7 text-brand-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Welcome to InnSight!</h2>
                <p className="mt-1 text-sm text-neutral-400 max-w-xl">
                  Your hotel is set up and ready to go. Get started by adding room types and rooms so you can begin taking reservations.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {!hasRoomTypes && (
              <Button onClick={() => router.push('/dashboard/room-types/new')}>
                <Plus className="h-4 w-4" />
                Create First Room Type
              </Button>
            )}
            {!hasRooms && (
              <Button variant="secondary" onClick={() => router.push('/dashboard/rooms/new')}>
                <Plus className="h-4 w-4" />
                Create First Room
              </Button>
            )}
            <Button variant="ghost" onClick={() => router.push('/dashboard/settings')}>
              <Settings className="h-4 w-4" />
              Complete Hotel Details
            </Button>
          </div>
        </Card>
      )}

      {/* Revenue Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-neutral-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-white">Revenue Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><DollarSign className="h-3.5 w-3.5" /> Today</div>
            <p className="text-xl font-bold text-white">{currencySymbol}{(data?.revenue?.today ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><Calendar className="h-3.5 w-3.5" /> This Week</div>
            <p className="text-xl font-bold text-white">{currencySymbol}{(data?.revenue?.thisWeek ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><Calendar className="h-3.5 w-3.5" /> This Month</div>
            <p className="text-xl font-bold text-white">{currencySymbol}{(data?.revenue?.thisMonth ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><TrendingUp className="h-3.5 w-3.5" /> All Time</div>
            <p className="text-xl font-bold text-white">{currencySymbol}{(data?.revenue?.total ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Today + Tasks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Overview */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Today's Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            {todayStats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{stat.label}</p>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Operations */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Operations</h2>
          <div className="space-y-3">
            {taskStats.map((stat) => (
              <button
                key={stat.label}
                onClick={() => router.push(stat.href)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 transition-colors hover:bg-neutral-800/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <span className="text-sm text-neutral-300">{stat.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">{stat.value}</span>
                  <ArrowRight className="h-4 w-4 text-neutral-500" />
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Financial Health */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Financial Health</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-warning bg-warning/10">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Pending Payments</p>
                <p className="text-xl font-bold text-white">{currencySymbol}{(data?.pendingPayments ?? 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-info bg-info/10">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Outstanding Invoices</p>
                <p className="text-xl font-bold text-white">{data?.outstandingInvoices ?? 0}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {data.recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-400 bg-brand-500/10">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-300 truncate">{activity.description}</p>
                    <p className="text-xs text-neutral-500">{new Date(activity.date).toLocaleDateString()} {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="text-sm font-medium text-white">{activity.currency} {Number(activity.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-neutral-500">
              <Clock className="mb-2 h-6 w-6" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </Card>
      </div>

      {/* Daily Analytics */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Daily Analytics</h2>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 p-1">
              <button onClick={() => navDate(-1)} className="rounded p-1 text-neutral-400 hover:text-white hover:bg-neutral-700"><ChevronLeft className="h-4 w-4" /></button>
              <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="w-36 bg-transparent px-2 py-1 text-sm text-white text-center border-0 outline-none [color-scheme:dark]" style={{ colorScheme: 'dark' }} />
              <button onClick={() => navDate(1)} className="rounded p-1 text-neutral-400 hover:text-white hover:bg-neutral-700"><ChevronRight className="h-4 w-4" /></button>
            </div>
            {!isToday && (
              <button onClick={() => setViewDate(today)} className="text-xs text-brand-400 hover:underline">Today</button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => computeMutation.mutate(viewDate)} disabled={computeMutation.isPending}>
              <RefreshCw className={`h-4 w-4 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
              Compute
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/analytics')}>
              <BarChart3 className="h-4 w-4" />
              Full Analytics
            </Button>
          </div>
        </div>
        {analyticsLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : dayData ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><Users className="h-3.5 w-3.5" /> Total Guests</div>
              <p className="text-xl font-bold text-white">{dayData.totalGuests}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><CalendarCheck className="h-3.5 w-3.5" /> Check-ins</div>
              <p className="text-xl font-bold text-success">{dayData.checkIns}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><LogOut className="h-3.5 w-3.5" /> Check-outs</div>
              <p className="text-xl font-bold text-warning">{dayData.checkOuts}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><DollarSign className="h-3.5 w-3.5" /> Revenue</div>
              <p className="text-xl font-bold text-white">{currencySymbol}{Number(dayData.totalRevenue).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><Building2 className="h-3.5 w-3.5" /> Rooms Booked</div>
              <p className="text-xl font-bold text-white">{dayData.totalRoomsBooked}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1"><TrendingUp className="h-3.5 w-3.5" /> Occupancy</div>
              <p className="text-xl font-bold text-white">{Math.round(dayData.occupancyRate)}%</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-neutral-500">
            <Calendar className="mb-2 h-8 w-8" />
            <p className="text-sm">No analytics data for {new Date(viewDate).toLocaleDateString()}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => computeMutation.mutate(viewDate)} disabled={computeMutation.isPending}>
              <RefreshCw className={`h-4 w-4 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
              Compute Now
            </Button>
          </div>
        )}
      </Card>

      {/* Room Status Breakdown */}
      {data?.rooms?.byStatus && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Room Status Overview</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {Object.entries(data.rooms.byStatus).map(([status, count]) => {
              const info = statusLabels[status] || { label: status, color: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
              return (
                <div key={status} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${info.color}`}>
                    {info.label}
                  </span>
                  <span className="text-lg font-bold text-white">{count as number}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-neutral-500">Total Rooms: {data.rooms.total}</div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
