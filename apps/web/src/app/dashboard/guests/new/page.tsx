'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCreateGuest } from '@/hooks/use-guests';

const vipOptions = [
  { value: '0', label: 'Regular (0)' },
  { value: '1', label: 'VIP 1' },
  { value: '2', label: 'VIP 2' },
  { value: '3', label: 'VIP 3' },
  { value: '4', label: 'VIP 4' },
  { value: '5', label: 'VIP 5' },
];

export default function NewGuestPage() {
  const router = useRouter();
  const createGuest = useCreateGuest();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: '',
    vipLevel: '0',
    address: '',
    city: '',
    country: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createGuest.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone || null,
        dateOfBirth: null,
        nationality: form.nationality || null,
        idType: null,
        idNumber: null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        vipLevel: form.vipLevel,
        preferences: null,
        notes: form.notes || null,
      });
      router.push('/dashboard/guests');
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to create guest. Please try again.' });
    }
  };

  return (
    <div>
      <PageHeader title="Add Guest" description="Create a new guest profile" />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={update('firstName')} error={errors.firstName} />
            <Input label="Last Name" value={form.lastName} onChange={update('lastName')} error={errors.lastName} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} />
            <Input label="Phone" value={form.phone} onChange={update('phone')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Nationality" value={form.nationality} onChange={update('nationality')} />
            <Select label="VIP Level" options={vipOptions} value={form.vipLevel} onChange={update('vipLevel')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Address" value={form.address} onChange={update('address')} />
            <Input label="City" value={form.city} onChange={update('city')} />
          </div>

          <Input label="Country" value={form.country} onChange={update('country')} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Notes</label>
            <textarea
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500"
              rows={3}
              placeholder="Any notes about this guest..."
              value={form.notes}
              onChange={update('notes')}
            />
          </div>

          {errors.form && <p className="text-sm text-error">{errors.form}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" isLoading={createGuest.isPending}>Create Guest</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}