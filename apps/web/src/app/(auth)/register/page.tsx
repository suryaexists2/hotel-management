'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { apiClient, setAccessToken } from '@/lib/api-client';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    hotelName: '',
    hotelPhone: '',
    hotelAddress: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!form.hotelName.trim()) {
      setError('Hotel name is required');
      return;
    }
    if (!form.hotelPhone.trim()) {
      setError('Hotel phone is required');
      return;
    }
    if (!form.hotelAddress.trim()) {
      setError('Hotel address is required');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.postWithoutAuth<{ user: unknown; accessToken: string }>('/auth/register', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        hotelName: form.hotelName.trim(),
        hotelPhone: form.hotelPhone.trim(),
        hotelAddress: form.hotelAddress.trim(),
      });
      if (res.accessToken) {
        setAccessToken(res.accessToken);
      }
      router.push('/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Register Your Hotel" subtitle="Create your account and hotel profile">
      {error && (
        <div className="mb-4 animate-slideDown rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">First Name</label>
            <input type="text" value={form.firstName} onChange={update('firstName')} placeholder="John" required className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Last Name</label>
            <input type="text" value={form.lastName} onChange={update('lastName')} placeholder="Doe" required className="input-field" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Email</label>
          <input type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required autoComplete="email" className="input-field" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} placeholder="Min 8 chars" required className="input-field pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Confirm Password</label>
            <input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Repeat password" required className="input-field" />
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hotel Name</label>
          <input type="text" value={form.hotelName} onChange={update('hotelName')} placeholder="Grand Palace Hotel" required className="input-field" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hotel Phone</label>
          <input type="tel" value={form.hotelPhone} onChange={update('hotelPhone')} placeholder="+1-555-0000" required className="input-field" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hotel Address</label>
          <textarea value={form.hotelAddress} onChange={update('hotelAddress')} placeholder="123 Main Street, City, Country" required rows={2} className="input-field" />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-500 hover:text-brand-400">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
