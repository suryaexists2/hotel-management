'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, Bell, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useLogout } from '@/hooks/use-auth';
import { Sidebar } from './Sidebar';
import { Logo } from '@/components/ui/Logo';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)] print:bg-white">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col lg:pl-60 print:pl-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 print:hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-app) 80%, transparent)' }}>
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-4">
            <button className="rounded-lg p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-[var(--text-muted)]">{user?.role?.name?.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
                <User className="h-5 w-5" />
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              style={{ borderColor: 'var(--border)' }}
            >
              {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
