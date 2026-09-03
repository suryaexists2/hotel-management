'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Building, DollarSign, Users, Plus, X, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useReservation, useCheckIn, useCheckOut, useCancelReservation, useOccupants, useAddOccupant, useUpdateOccupant, useRemoveOccupant } from '@/hooks/use-reservations';
import { useRooms } from '@/hooks/use-rooms';
import { useCurrencySymbol } from '@/hooks/use-currency';

const statusVariant: Record<string, 'brand' | 'success' | 'default' | 'error' | 'warning' | 'info'> = {
  CONFIRMED: 'brand',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'default',
  CANCELLED: 'error',
  PENDING: 'warning',
  NO_SHOW: 'error',
  WAITLISTED: 'info',
};

const formatCurrency = (amount: number, symbol: string) =>
  `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-800/50 py-3 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-200">{value}</span>
    </div>
  );
}

export default function ReservationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: reservation, isLoading } = useReservation(id);
  const { data: roomsData } = useRooms({ roomTypeId: reservation?.roomTypeId, status: 'AVAILABLE', limit: 100 });
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const cancel = useCancelReservation();
  const currencySymbol = useCurrencySymbol();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: occupants } = useOccupants(id);
  const addOccupant = useAddOccupant();
  const updateOccupant = useUpdateOccupant();
  const removeOccupant = useRemoveOccupant();
  const [showOccupantModal, setShowOccupantModal] = useState(false);
  const [editingOccupant, setEditingOccupant] = useState<any>(null);
  const [occForm, setOccForm] = useState({ firstName: '', lastName: '', gender: '', dateOfBirth: '', phone: '', email: '', idType: '', idNumber: '', relationship: '' });

  if (isLoading) return <Spinner className="min-h-[60vh]" />;
  if (!reservation) return <p className="text-neutral-400">Reservation not found.</p>;

  const r = reservation;

  const handleCheckIn = async () => {
    setActionError(null);
    try {
      await checkIn.mutateAsync({ id: r.id, roomId: selectedRoomId || undefined });
      setShowCheckInModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    setActionError(null);
    try {
      await checkOut.mutateAsync({ id: r.id });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Check-out failed');
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    try {
      await cancel.mutateAsync({ id: r.id, reason: cancelReason || undefined });
      setShowCancelModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed');
    }
  };

  const roomOptions = (roomsData?.items || []).map((rm) => ({
    value: rm.id,
    label: `Room ${rm.roomNumber} (Floor ${rm.floor})`,
  }));

  const canCheckIn = r.status === 'CONFIRMED';
  const canCheckOut = r.status === 'CHECKED_IN';
  const canCancel = r.status === 'CONFIRMED' || r.status === 'CHECKED_IN';

  return (
    <div>
      <PageHeader
        title={`Reservation #${r.confirmationNo}`}
        description={`Status: ${r.status.replace('_', ' ')}`}
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {canCheckIn && (
                <Button onClick={() => setShowCheckInModal(true)} isLoading={checkIn.isPending}>
                  Check In
                </Button>
              )}
              {canCheckOut && (
                <Button variant="primary" onClick={handleCheckOut} isLoading={checkOut.isPending}>
                  Check Out
                </Button>
              )}
              {canCancel && (
                <Button variant="danger" onClick={() => setShowCancelModal(true)}>
                  Cancel Reservation
                </Button>
              )}
            </div>
            {actionError && (
              <p className="text-sm text-error">{actionError}</p>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Reservation Details */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Reservation Details</h2>
              <Badge variant={statusVariant[r.status] || 'default'}>{r.status.replace('_', ' ')}</Badge>
            </div>
            <div className="space-y-1">
              <DetailRow label="Confirmation #" value={r.confirmationNo} />
              <DetailRow label="Check-in" value={formatDate(r.checkInDate)} />
              <DetailRow label="Check-out" value={formatDate(r.checkOutDate)} />
              <DetailRow label="Nights" value={r.nights} />
              <DetailRow label="Adults / Children" value={`${r.adults} / ${r.children}`} />
              <DetailRow label="Rate/Night" value={formatCurrency(r.ratePerNight, currencySymbol)} />
              <DetailRow label="Total Amount" value={<span className="text-white font-semibold">{formatCurrency(r.totalAmount, currencySymbol)}</span>} />
              <DetailRow label="Source" value={r.source || '—'} />
            </div>
          </Card>

          {/* Special Requests & Notes */}
          {(r.specialRequests || r.internalNotes) && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-white">Notes</h2>
              {r.specialRequests && (
                <div className="mb-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">Special Requests</p>
                  <p className="text-sm text-neutral-300">{r.specialRequests}</p>
                </div>
              )}
              {r.internalNotes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">Internal Notes</p>
                  <p className="text-sm text-neutral-300">{r.internalNotes}</p>
                </div>
              )}
            </Card>
          )}

          {/* Timeline */}
          {(r.checkedInAt || r.checkedOutAt || r.cancelledAt) && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-white">Timeline</h2>
              <div className="space-y-3">
                {r.checkedInAt && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <div>
                      <p className="text-sm text-neutral-200">Checked In</p>
                      <p className="text-xs text-neutral-500">{formatDateTime(r.checkedInAt)}</p>
                    </div>
                  </div>
                )}
                {r.checkedOutAt && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-brand-400" />
                    <div>
                      <p className="text-sm text-neutral-200">Checked Out</p>
                      <p className="text-xs text-neutral-500">{formatDateTime(r.checkedOutAt)}</p>
                    </div>
                  </div>
                )}
                {r.cancelledAt && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-error" />
                    <div>
                      <p className="text-sm text-neutral-200">Cancelled</p>
                      <p className="text-xs text-neutral-500">{formatDateTime(r.cancelledAt)}</p>
                      {r.cancellationReason && <p className="text-xs text-neutral-500">Reason: {r.cancellationReason}</p>}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Billing link */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Billing</h2>
            <Button
              variant="secondary"
              onClick={() => router.push(`/dashboard/billing?reservationId=${r.id}`)}
            >
              <DollarSign className="h-4 w-4" />
              View Folio & Charges
            </Button>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Guest Info */}
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                <User className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{r.guest.firstName} {r.guest.lastName}</h2>
              </div>
            </div>
            <div className="space-y-1">
              <DetailRow label="Email" value={r.guest.email} />
              <DetailRow label="VIP Level" value={'★'.repeat(Number(r.guest.vipLevel))} />
              <DetailRow
                label="Profile"
                value={
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/guests/${r.guestId}`)}>
                    View Profile
                  </Button>
                }
              />
            </div>
          </Card>

          {/* Room Info */}
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                <Building className="h-5 w-5 text-info" />
              </div>
              <h2 className="text-lg font-semibold text-white">Room</h2>
            </div>
            {r.room ? (
              <div className="space-y-1">
                <DetailRow label="Room #" value={r.room.roomNumber} />
                <DetailRow label="Floor" value={r.room.floor} />
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No room assigned yet</p>
            )}
            <DetailRow label="Room Type" value={r.roomType.name} />
            <DetailRow label="Base Rate" value={formatCurrency(r.roomType.baseRate, currencySymbol)} />
            <DetailRow label="Occupants" value={`${1 + (occupants?.length || 0)} Guest${1 + (occupants?.length || 0) !== 1 ? 's' : ''}`} />
          </Card>

          {/* Occupants / Companion Guests */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                  <Users className="h-5 w-5 text-brand-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Occupants</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setEditingOccupant(null); setOccForm({ firstName: '', lastName: '', gender: '', dateOfBirth: '', phone: '', email: '', idType: '', idNumber: '', relationship: '' }); setShowOccupantModal(true); }}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {occupants && occupants.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-neutral-800/50 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-400">
                    {r.guest.firstName[0]}{r.guest.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.guest.firstName} {r.guest.lastName}</p>
                    <p className="text-xs text-neutral-500">Primary Guest</p>
                  </div>
                </div>
                {occupants.map((o: any) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-lg bg-neutral-800/50 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 text-xs font-bold text-neutral-300">
                      {o.firstName[0]}{o.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{o.firstName} {o.lastName}</p>
                      <p className="text-xs text-neutral-500">{o.relationship || 'Companion'}</p>
                    </div>
                    <button onClick={() => { setEditingOccupant(o); setOccForm({ firstName: o.firstName, lastName: o.lastName, gender: o.gender || '', dateOfBirth: o.dateOfBirth ? o.dateOfBirth.substring(0, 10) : '', phone: o.phone || '', email: o.email || '', idType: o.idType || '', idNumber: o.idNumber || '', relationship: o.relationship || '' }); setShowOccupantModal(true); }} className="text-neutral-500 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeOccupant.mutate({ reservationId: id, occupantId: o.id })} className="text-neutral-500 hover:text-error">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No additional occupants</p>
            )}
          </Card>
        </div>
      </div>

      {/* Check-In Modal */}
      <Modal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} title="Check In Guest" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            Assign a room to <span className="text-white">{r.guest.firstName} {r.guest.lastName}</span>
          </p>
          <Select
            label="Room"
            placeholder="Select a room..."
            options={roomOptions}
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCheckInModal(false)}>Cancel</Button>
            <Button onClick={handleCheckIn} isLoading={checkIn.isPending}>Confirm Check-In</Button>
          </div>
        </div>
      </Modal>

      {/* Occupant Modal */}
      <Modal isOpen={showOccupantModal} onClose={() => setShowOccupantModal(false)} title={editingOccupant ? 'Edit Occupant' : 'Add Occupant'} size="md">
        <form onSubmit={(e) => { e.preventDefault(); const payload = { reservationId: id, ...occForm, gender: occForm.gender || undefined, phone: occForm.phone || undefined, email: occForm.email || undefined, idType: occForm.idType || undefined, idNumber: occForm.idNumber || undefined, relationship: occForm.relationship || undefined }; if (editingOccupant) { updateOccupant.mutate({ ...payload, occupantId: editingOccupant.id }, { onSuccess: () => setShowOccupantModal(false) }); } else { addOccupant.mutate(payload, { onSuccess: () => setShowOccupantModal(false) }); } }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={occForm.firstName} onChange={(e) => setOccForm({ ...occForm, firstName: e.target.value })} required />
            <Input label="Last Name" value={occForm.lastName} onChange={(e) => setOccForm({ ...occForm, lastName: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Gender" options={[{ value: '', label: 'Select...' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} value={occForm.gender} onChange={(e) => setOccForm({ ...occForm, gender: e.target.value })} />
            <Input label="Date of Birth" type="date" value={occForm.dateOfBirth || ''} onChange={(e) => setOccForm({ ...occForm, dateOfBirth: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={occForm.phone} onChange={(e) => setOccForm({ ...occForm, phone: e.target.value })} />
            <Input label="Email" type="email" value={occForm.email} onChange={(e) => setOccForm({ ...occForm, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="ID Type (e.g. Passport, Aadhaar)" value={occForm.idType} onChange={(e) => setOccForm({ ...occForm, idType: e.target.value })} />
            <Input label="ID Number" value={occForm.idNumber} onChange={(e) => setOccForm({ ...occForm, idNumber: e.target.value })} />
          </div>
          <Input label="Relationship (e.g. Spouse, Child)" value={occForm.relationship} onChange={(e) => setOccForm({ ...occForm, relationship: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowOccupantModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={addOccupant.isPending || updateOccupant.isPending}>{editingOccupant ? 'Update' : 'Add'} Occupant</Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Reservation" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            Are you sure you want to cancel reservation <strong className="text-white">#{r.confirmationNo}</strong>?
          </p>
          <Input
            label="Cancellation Reason (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Guest requested cancellation"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>Keep Reservation</Button>
            <Button variant="danger" onClick={handleCancel} isLoading={cancel.isPending}>Cancel Reservation</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}