'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGuests } from '@/hooks/use-guests';
import { useRoomTypes } from '@/hooks/use-room-types';
import { useCreateReservation, useCheckAvailability } from '@/hooks/use-reservations';
import { useCurrencySymbol, formatPrice } from '@/hooks/use-currency';

export default function NewReservationPage() {
  const router = useRouter();
  const { data: guestsData } = useGuests({ limit: 100 });
  const { data: roomTypesData } = useRoomTypes({ limit: 100 });
  const createReservation = useCreateReservation();

  const [guestId, setGuestId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [specialRequests, setSpecialRequests] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<{ loading: boolean; available: number | null }>({ loading: false, available: null });
  const currencySymbol = useCurrencySymbol();
  const checkAvailability = useCheckAvailability();

  const selectedRoomType = useMemo(() => {
    if (!roomTypesData?.items) return null;
    return roomTypesData.items.find((rt) => rt.id === roomTypeId) || null;
  }, [roomTypeId, roomTypesData]);

  useEffect(() => {
    if (!roomTypeId || !checkInDate || !checkOutDate) return;
    if (new Date(checkOutDate) <= new Date(checkInDate)) return;
    setAvailability({ loading: true, available: null });
    checkAvailability.mutate(
      { checkInDate, checkOutDate, roomTypeId },
      {
        onSuccess: (data) => setAvailability({ loading: false, available: data.available }),
        onError: () => setAvailability({ loading: false, available: null }),
      },
    );
  }, [roomTypeId, checkInDate, checkOutDate]);

  const guestOptions = (guestsData?.items || []).map((g) => ({
    value: g.id,
    label: `${g.firstName} ${g.lastName}${g.email ? ` (${g.email})` : ''}`,
  }));

  const roomTypeOptions = (roomTypesData?.items || []).map((rt) => ({
    value: rt.id,
    label: `${rt.name} - ${currencySymbol}${rt.baseRate}/night`,
  }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!guestId) errs.guestId = 'Guest is required';
    if (!roomTypeId) errs.roomTypeId = 'Room type is required';
    if (!checkInDate) errs.checkInDate = 'Check-in date is required';
    if (!checkOutDate) errs.checkOutDate = 'Check-out date is required';
    if (checkInDate && checkOutDate && new Date(checkOutDate) <= new Date(checkInDate)) {
      errs.checkOutDate = 'Check-out must be after check-in';
    }
    const a = parseInt(adults);
    if (!adults || a < 1) errs.adults = 'At least 1 adult required';
    if (selectedRoomType && a > selectedRoomType.maxAdults) errs.adults = `Max adults is ${selectedRoomType.maxAdults}`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createReservation.mutateAsync({
        guestId,
        roomTypeId,
        checkInDate,
        checkOutDate,
        adults: parseInt(adults),
        children: parseInt(children) || 0,
        ratePerNight: selectedRoomType?.baseRate || 0,
        specialRequests: specialRequests || undefined,
      });
      router.push('/dashboard/reservations');
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to create reservation. Please try again.' });
    }
  };

  return (
    <div>
      <PageHeader title="New Reservation" description="Create a new guest reservation" />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Select
            label="Guest"
            placeholder="Select a guest..."
            options={guestOptions}
            value={guestId}
            onChange={(e) => setGuestId(e.target.value)}
            error={errors.guestId}
          />

          <Select
            label="Room Type"
            placeholder="Select room type..."
            options={roomTypeOptions}
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            error={errors.roomTypeId}
          />

          {selectedRoomType && (
            <p className="text-sm text-neutral-400">
              Rate: <span className="font-semibold text-white">{formatPrice(selectedRoomType.baseRate, currencySymbol)}/night</span>
              &nbsp;&middot; Max occupancy: {selectedRoomType.maxOccupancy} guests
              {availability.loading && <span className="ml-2 text-neutral-500">Checking availability...</span>}
              {!availability.loading && availability.available !== null && (
                <span className={`ml-2 ${availability.available > 0 ? 'text-success' : 'text-error'}`}>
                  {availability.available > 0 ? `${availability.available} room(s) available` : 'Fully booked for these dates'}
                </span>
              )}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Check-in Date"
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              error={errors.checkInDate}
            />
            <Input
              label="Check-out Date"
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              error={errors.checkOutDate}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Adults"
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              error={errors.adults}
            />
            <Input
              label="Children"
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Special Requests</label>
            <textarea
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500"
              rows={3}
              placeholder="Any special requests..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </div>

          {errors.form && <p className="text-sm text-error">{errors.form}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" isLoading={createReservation.isPending}>Create Reservation</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}