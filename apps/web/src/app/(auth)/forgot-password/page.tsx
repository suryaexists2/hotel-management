'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.postWithoutAuth('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Forgot Password" subtitle="Enter your email to receive a reset link">
      {error && (
        <div className="mb-4 animate-slideDown rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      )}

      {sent ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-[var(--text-primary)]">
            If an account with that email exists, a reset link has been sent.
          </div>
          <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-brand-500 hover:text-brand-400">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Reset Link
          </button>
          <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
