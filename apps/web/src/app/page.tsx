'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Server, Sparkles, Building2, Key, BedDouble, Loader2, Check } from 'lucide-react';
import { apiClient, setAccessToken } from '@/lib/api-client';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const result = await apiClient.get<{ configured: boolean }>('/setup/check');
        setConfigured(result.configured);
        if (result.configured) {
          const token = localStorage.getItem('innsight_access_token');
          if (token) {
            router.replace('/dashboard');
            return;
          }
        }
      } catch {
        setConfigured(false);
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [router]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.postWithoutAuth<{ accessToken: string; hotelId: string }>('/setup', {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      setAccessToken(result.accessToken);
      setSuccess(true);
      setTimeout(() => router.replace('/dashboard'), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // First-time setup: show welcome form
  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 shadow-lg shadow-brand-500/20">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome to InnSight
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Set up your hotel to get started
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 backdrop-blur-sm">
            {success ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <h2 className="text-lg font-semibold text-white">Hotel Created!</h2>
                <p className="mt-1 text-sm text-neutral-400">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSetup} className="space-y-5">
                <div>
                  <label htmlFor="hotelName" className="mb-1.5 block text-sm font-medium text-neutral-300">
                    Hotel Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="hotelName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grand Palace Hotel"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-300">
                    Phone Number <span className="text-error">*</span>
                  </label>
                  <input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-neutral-300">
                    Address <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 123 Main Street, City"
                    rows={3}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
                  ) : (
                    'Create My Hotel'
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-neutral-600">
            Your hotel details can be edited later in Settings
          </p>
        </div>
      </div>
    );
  }

  // Configured: show marketing landing page
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100 selection:bg-brand-500 selection:text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-success/5 blur-[120px]" />
      </div>

      <header className="relative z-10 flex h-16 items-center justify-between border-b border-neutral-900 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-sans text-xl font-bold tracking-tight text-white">
            InnSight
          </span>
          <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-400 border border-brand-500/20">
            SaaS Ready
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <a href="/login" className="transition-colors hover:text-white">Sign In</a>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-xs text-brand-400 mb-6">
            <Sparkles className="h-3 w-3" />
            <span>Hotel Management Platform</span>
          </div>

          <h1 className="font-sans text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            InnSight Hotel Operations
          </h1>
          <p className="mt-6 text-lg text-neutral-400 leading-relaxed max-w-xl mx-auto">
            A production-ready hospitality system built with Next.js, Express, Turborepo, and PostgreSQL.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <a href="/login" className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600">
              Sign In to Dashboard
            </a>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-6 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-sans font-semibold text-white">Multi-tenant Architecture</h3>
              <p className="mt-2 text-sm text-neutral-400 leading-normal">
                Granular hotelId tenant isolation and strict RBAC controls embedded in schema.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-6 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success mb-4">
                <Key className="h-5 w-5" />
              </div>
              <h3 className="font-sans font-semibold text-white">Folio & Billing</h3>
              <p className="mt-2 text-sm text-neutral-400 leading-normal">
                Append-only financial records with multi-currency and abstracted payment providers.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-6 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info mb-4">
                <BedDouble className="h-5 w-5" />
              </div>
              <h3 className="font-sans font-semibold text-white">Full Lifecycle</h3>
              <p className="mt-2 text-sm text-neutral-400 leading-normal">
                Reservation lifecycle, housekeeping priority queue, and maintenance work orders.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-neutral-900 px-6 py-6 text-center text-xs text-neutral-500">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-success" />
            <span>PostgreSQL & Redis configuration ready</span>
          </div>
          <span>&copy; {new Date().getFullYear()} InnSight. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
