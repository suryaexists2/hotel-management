'use client';

import React, { useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Upload, Star, Camera, Eye, X, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useGuest } from '@/hooks/use-guests';
import { useUploadIdProof } from '@/hooks/use-guest-management';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const API_BASE = API_URL.replace(/\/api\/v1\/?$/, '');

export default function GuestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: guest, isLoading } = useGuest(id);
  const uploadMutation = useUploadIdProof();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleUpload = async (side: 'front' | 'back', file: File | undefined) => {
    if (!file) return;
    setUploadStatus(`Uploading ${side}...`);
    try {
      await uploadMutation.mutateAsync({
        id: params.id,
        ...(side === 'front' ? { front: file } : { back: file }),
      });
      setUploadStatus(`${side === 'front' ? 'Front' : 'Back'} ID uploaded successfully`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="py-16 text-center text-neutral-500">
        <p className="text-lg">Guest not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        description="Guest profile and identification documents"
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      {uploadStatus && (
        <div className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-400">
          {uploadStatus}
          <button onClick={() => setUploadStatus(null)} className="ml-2 text-neutral-500 hover:text-white">&times;</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Basic Info */}
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-white">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-500">First Name</p>
              <p className="text-sm text-white">{guest.firstName}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Last Name</p>
              <p className="text-sm text-white">{guest.lastName}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Email</p>
              <p className="text-sm text-white">{guest.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Phone</p>
              <p className="text-sm text-white">{guest.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Nationality</p>
              <p className="text-sm text-white">{guest.nationality || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">VIP Level</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < Number(guest.vipLevel) ? 'fill-warning text-warning' : 'text-neutral-700'}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-neutral-500">ID Type</p>
              <p className="text-sm text-white">{guest.idType || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">ID Number</p>
              <p className="text-sm text-white">{guest.idNumber || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-neutral-500">Address</p>
              <p className="text-sm text-white">{guest.address || '—'}</p>
            </div>
            {guest.notes && (
              <div className="col-span-2">
                <p className="text-xs text-neutral-500">Notes</p>
                <p className="text-sm text-white">{guest.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* ID Proof Upload */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">ID Proof</h2>
          <div className="space-y-4">
            {/* Front */}
            <div>
              <p className="mb-2 text-xs text-neutral-500">Front Side</p>
              {guest.idProofFront ? (
                <div className="relative group">
                  {guest.idProofFront.endsWith('.pdf') ? (
                    <a href={`${API_BASE}${guest.idProofFront}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/50 py-8 text-sm text-neutral-400 hover:text-brand-400 transition-colors">
                      <FileText className="h-8 w-8" />
                      View PDF
                    </a>
                  ) : (
                    <img
                      src={`${API_BASE}${guest.idProofFront}`}
                      alt="ID Front"
                      className="w-full rounded-lg border border-neutral-700 object-cover cursor-pointer"
                      onClick={() => setLightbox(`${API_BASE}${guest.idProofFront}`)}
                    />
                  )}
                  <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!guest.idProofFront.endsWith('.pdf') && (
                      <button
                        onClick={() => setLightbox(`${API_BASE}${guest.idProofFront}`)}
                        className="rounded-lg bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-white"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => frontRef.current?.click()}
                      className="rounded-lg bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-white"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => frontRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-700 py-8 text-sm text-neutral-500 hover:border-brand-500 hover:text-brand-400 transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  Upload Front
                </button>
              )}
              <input ref={frontRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleUpload('front', e.target.files?.[0])} />
            </div>

            {/* Back */}
            <div>
              <p className="mb-2 text-xs text-neutral-500">Back Side</p>
              {guest.idProofBack ? (
                <div className="relative group">
                  {guest.idProofBack.endsWith('.pdf') ? (
                    <a href={`${API_BASE}${guest.idProofBack}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/50 py-8 text-sm text-neutral-400 hover:text-brand-400 transition-colors">
                      <FileText className="h-8 w-8" />
                      View PDF
                    </a>
                  ) : (
                    <img
                      src={`${API_BASE}${guest.idProofBack}`}
                      alt="ID Back"
                      className="w-full rounded-lg border border-neutral-700 object-cover cursor-pointer"
                      onClick={() => setLightbox(`${API_BASE}${guest.idProofBack}`)}
                    />
                  )}
                  <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!guest.idProofBack.endsWith('.pdf') && (
                      <button
                        onClick={() => setLightbox(`${API_BASE}${guest.idProofBack}`)}
                        className="rounded-lg bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-white"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => backRef.current?.click()}
                      className="rounded-lg bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-white"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => backRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-700 py-8 text-sm text-neutral-500 hover:border-brand-500 hover:text-brand-400 transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  Upload Back
                </button>
              )}
              <input ref={backRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleUpload('back', e.target.files?.[0])} />
            </div>
          </div>
        </Card>
      </div>

      {/* Reservation History */}
      {guest.reservations && guest.reservations.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Stay History ({guest.reservations.length})</h2>
          <div className="space-y-2">
            {guest.reservations.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-neutral-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">
                      {r.room ? `Room ${r.room.roomNumber}` : '—'} &middot;{' '}
                      {new Date(r.checkInDate).toLocaleDateString()} — {new Date(r.checkOutDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.adults} Adult{r.adults > 1 ? 's' : ''} / {r.children} Child{r.children > 1 ? 'ren' : ''} &middot; Confirmation: {r.confirmationNo}
                    </p>
                  </div>
                  <Badge variant={
                    r.status === 'CHECKED_OUT' ? 'default' :
                    r.status === 'CHECKED_IN' ? 'success' :
                    r.status === 'CANCELLED' ? 'error' :
                    r.status === 'CONFIRMED' ? 'brand' : 'warning'
                  }>
                    {r.status.replace('_', ' ')}
                  </Badge>
                </div>
                {r.occupants && r.occupants.length > 0 && (
                  <div className="mt-2 border-t border-neutral-800 pt-2">
                    <p className="text-xs font-medium text-neutral-500">Travelling With</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.occupants.map((o: any) => (
                        <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs text-neutral-300">
                          {o.firstName} {o.lastName}
                          {o.relationship ? <span className="text-neutral-500">({o.relationship})</span> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 z-10 rounded-full bg-neutral-900 p-1.5 text-neutral-400 hover:text-white shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={lightbox} alt="ID Proof" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
