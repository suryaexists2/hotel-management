'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRoomType, useUpdateRoomType } from '@/hooks/use-room-types';

export default function EditRoomTypePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: roomType, isLoading } = useRoomType(params.id);
  const updateRoomType = useUpdateRoomType();
  const [form, setForm] = useState({
    name: '',
    description: '',
    baseRate: '',
    maxOccupancy: '',
    maxAdults: '',
    maxChildren: '',
    amenities: '',
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (roomType) {
      setForm({
        name: roomType.name,
        description: roomType.description || '',
        baseRate: String(roomType.baseRate),
        maxOccupancy: String(roomType.maxOccupancy),
        maxAdults: String(roomType.maxAdults),
        maxChildren: String(roomType.maxChildren),
        amenities: roomType.amenities.join(', '),
        isActive: roomType.isActive,
      });
    }
  }, [roomType]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.baseRate || Number(form.baseRate) <= 0) errs.baseRate = 'Valid rate is required';
    if (!form.maxOccupancy || Number(form.maxOccupancy) <= 0) errs.maxOccupancy = 'Max occupancy is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitError(null);
    updateRoomType.mutate(
      {
        id: params.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        baseRate: parseFloat(form.baseRate),
        maxOccupancy: parseInt(form.maxOccupancy, 10),
        maxAdults: parseInt(form.maxAdults || form.maxOccupancy, 10),
        maxChildren: parseInt(form.maxChildren || '0', 10),
        amenities: form.amenities ? form.amenities.split(',').map((a) => a.trim()).filter(Boolean) : [],
        isActive: form.isActive,
      },
      {
        onSuccess: () => router.push('/dashboard/room-types'),
        onError: (err: Error) => setSubmitError(err.message),
      },
    );
  }

  if (isLoading) return <Spinner className="min-h-[60vh]" />;
  if (!roomType) return <div className="text-center text-neutral-500 py-16">Room type not found</div>;

  return (
    <div>
      <PageHeader
        title={`Edit: ${roomType.name}`}
        description="Update room type details and pricing"
        actions={
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <Card className="max-w-2xl">
        {submitError && (
          <div className="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            placeholder="e.g. Deluxe Suite"
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the room type..."
              rows={3}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Input
              label="Base Rate ($)"
              type="number"
              step="0.01"
              value={form.baseRate}
              onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
              error={errors.baseRate}
              placeholder="199.00"
            />
            <Input
              label="Max Occupancy"
              type="number"
              value={form.maxOccupancy}
              onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })}
              error={errors.maxOccupancy}
              placeholder="4"
            />
            <Input
              label="Max Adults"
              type="number"
              value={form.maxAdults}
              onChange={(e) => setForm({ ...form, maxAdults: e.target.value })}
              placeholder="2"
            />
          </div>

          <Input
            label="Max Children"
            type="number"
            value={form.maxChildren}
            onChange={(e) => setForm({ ...form, maxChildren: e.target.value })}
            placeholder="2"
          />

          <Input
            label="Amenities (comma-separated)"
            value={form.amenities}
            onChange={(e) => setForm({ ...form, amenities: e.target.value })}
            placeholder="WiFi, TV, Mini Bar, Air Conditioning"
          />

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-neutral-300">Active</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={updateRoomType.isPending}>
              Save Changes
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/dashboard/room-types')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
