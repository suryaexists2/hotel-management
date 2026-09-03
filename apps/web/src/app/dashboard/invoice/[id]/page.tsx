'use client';

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Printer, ArrowLeft, CheckCircle,
  FileText, Mail, Phone, Building2, MapPin, Hash, Calendar,
  Users, Bed, CreditCard, Clock, AlertCircle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useInvoice } from '@/hooks/use-billing';
import { useHotel } from '@/hooks/use-hotel';

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { data: hotel, isLoading: hotelLoading } = useHotel();
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (isLoading || hotelLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
        <p>Invoice not found</p>
      </div>
    );
  }

  const folio = (invoice as any).folio;
  const inv = invoice as any;
  const reservation = folio?.reservation;
  const guest = reservation?.guest;

  const hotelName = hotel?.name || 'InnSight';
  const hotelPhone = hotel?.phone || '';
  const hotelEmail = hotel?.email || '';
  const hotelAddr = hotel?.address || '';
  const hotelCity = hotel?.city || '';
  const hotelState = hotel?.state || '';
  const hotelCountry = hotel?.country || '';
  const hotelZip = hotel?.zipCode || '';
  const hotelWebsite = hotel?.website || '';
  const logoUrl = hotel?.logoUrl || '';

  const paidAt = inv.paidAt ? new Date(inv.paidAt) : null;
  const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
  const isPaid = !!paidAt;
  const currency = inv.currency || 'USD';
  const lineItems = inv.lineItems || [];
  const payments = folio?.payments || [];
  const totalPayments = Number(folio?.totalPayments || 0);
  const grandTotal = Number(inv.grandTotal || 0);
  const balance = grandTotal - totalPayments;

  const checkIn = reservation?.checkInDate ? new Date(reservation.checkInDate) : null;
  const checkOut = reservation?.checkOutDate ? new Date(reservation.checkOutDate) : null;
  const nights = reservation?.nights || (checkIn && checkOut ? Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)) : 0);
  const allOccupants = reservation?.occupants || [];

  const formatDate = (d: Date | null, style: 'long' | 'short' = 'long') => {
    if (!d) return '—';
    return d.toLocaleDateString('en-US', style === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
    );
  };

  const fullAddress = [hotelAddr, hotelCity, hotelState, hotelZip, hotelCountry].filter(Boolean).join(', ');
  const guestFullName = guest ? `${guest.firstName} ${guest.lastName}` : inv.guestName;
  const guestAddress = guest ? [guest.address, guest.city, guest.country].filter(Boolean).join(', ') : '';

  const invoiceStyle = `
    /* Force standard (non-inverted) color palette inside invoice regardless of app theme */
    #invoice-root {
      --n50: 250, 250, 250;
      --n100: 244, 244, 245;
      --n200: 228, 228, 231;
      --n300: 212, 212, 216;
      --n400: 161, 161, 170;
      --n500: 113, 113, 122;
      --n600: 82, 82, 91;
      --n700: 63, 63, 70;
      --n800: 39, 39, 42;
      --n900: 24, 24, 27;
      --n950: 9, 9, 11;
      --color-white: #ffffff;
      --color-black: #000000;
    }
    /* ── Print styles ── */
    @page { size: A4; margin: 5mm 6mm; }
    @media print {
      html, body {
        background: white !important; margin: 0 !important; padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #invoice-root { background: white !important; min-height: 0 !important; }
      #invoice-content {
        background: white !important; border: none !important;
        box-shadow: none !important; border-radius: 0 !important;
        width: auto !important; min-height: 0 !important;
      }
      #invoice-root .invoice-a4-wrap {
        width: auto !important; min-height: 0 !important;
        padding: 2mm 4mm !important; margin: 0 !important;
      }
      /* Hide action bar */
      .no-print { display: none !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `;


  return (
    <div id="invoice-root" className="min-h-screen bg-neutral-100 print:min-h-0 print:bg-white print:p-0 print:m-0">
      <style>{invoiceStyle}</style>

      {/* Action Bar — hidden during print */}
      <div className="no-print sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" onClick={() => router.back()} className="text-neutral-600 hover:text-neutral-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handlePrint} className="text-neutral-700">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="print:my-0 print:mx-0 print:max-w-full">
        <div
          id="invoice-content"
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg print:rounded-none print:border-0 print:shadow-none"
        >
          <div className="invoice-page p-4 sm:p-5 md:p-6 print:p-0">

            {/* ── HEADER ── */}
            <div className="flex items-start justify-between border-b-2 border-neutral-800 pb-6 print:pb-1">
              <div className="flex items-start gap-4 print:gap-1">
                {logoUrl ? (
                  <img src={logoUrl} alt={hotelName} className="h-16 w-16 rounded object-cover print:h-10 print:w-10" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-neutral-900 print:h-10 print:w-10">
                    <Building2 className="h-8 w-8 text-white print:h-5 print:w-5" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-neutral-900 print:text-sm">{hotelName}</h1>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-600 print:mt-0">{fullAddress}</p>
                  <div className="mt-2 flex flex-col gap-0.5 text-xs text-neutral-600 print:mt-0.5">
                    {hotelPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {hotelPhone}</span>}
                    {hotelEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {hotelEmail}</span>}
                    {hotelWebsite && <span>{hotelWebsite}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold tracking-tight text-neutral-900 print:text-base">INVOICE</h2>
                <p className="mt-1 font-mono text-sm tracking-wider text-neutral-700 print:mt-0 print:text-xs">{inv.invoiceNumber}</p>
                <div className="mt-4 space-y-0.5 text-xs text-neutral-500 print:mt-1 print:text-[7pt]">
                  <p><span className="font-medium text-neutral-700">Issue Date:</span> {formatDate(new Date(inv.createdAt))}</p>
                  {dueDate && <p><span className="font-medium text-neutral-700">Due Date:</span> {formatDate(dueDate)}</p>}
                </div>
              </div>
            </div>

            {/* ── STATUS BAR ── */}
            <div className="mt-2 flex flex-wrap items-center gap-3 print:mt-1 print:gap-1">
              <div className={`status-badge inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold print:px-1.5 print:py-0.5 print:text-[7pt] print:gap-0.5 ${
                isPaid
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-amber-300 bg-amber-50 text-amber-700'
              }`}>
                {isPaid ? <CheckCircle className="h-3.5 w-3.5 print:h-2.5 print:w-2.5" /> : <Clock className="h-3.5 w-3.5 print:h-2.5 print:w-2.5" />}
                <span>{isPaid ? `PAID${paidAt ? ' on ' + formatDate(paidAt, 'short') : ''}` : 'UNPAID'}</span>
              </div>
              {folio?.folioNumber && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]">
                  <Hash className="h-3 w-3 print:h-2 print:w-2" /> Folio: <span className="font-mono font-semibold text-neutral-700">{folio.folioNumber}</span>
                </span>
              )}
              {reservation?.confirmationNo && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]">
                  <FileText className="h-3 w-3 print:h-2 print:w-2" /> Res#: <span className="font-mono font-semibold text-neutral-700">{reservation.confirmationNo}</span>
                </span>
              )}
            </div>

            {/* ── BILL TO + STAY DETAILS ── */}
            <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2 print:mt-2 print:gap-2">
              {/* Bill To */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 print:mb-1 print:text-[7pt]">Bill To</h3>
                <p className="text-base font-semibold text-neutral-900 print:text-xs">{guestFullName}</p>
                <div className="mt-1.5 space-y-1 text-sm text-neutral-600 print:mt-0.5 print:text-[7pt]">
                  {inv.guestEmail && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-neutral-400 print:h-2.5 print:w-2.5" /> {inv.guestEmail}</span>}
                  {guest?.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-neutral-400 print:h-2.5 print:w-2.5" /> {guest.phone}</span>}
                  {guestAddress && <span className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400 print:h-2.5 print:w-2.5" /> {guestAddress}</span>}
                </div>
              </div>

              {/* Stay Details */}
              {reservation && (
                <div className="stay-details-card rounded-lg border border-neutral-200 bg-neutral-50 p-4 print:p-1.5 print:rounded print:border print:border-neutral-200">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 print:mb-1 print:text-[7pt]">Stay Details</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 print:gap-x-2 print:gap-y-1">
                    <div>
                      <p className="flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]"><Bed className="h-3 w-3 print:h-2 print:w-2" /> Room</p>
                      <p className="text-sm font-semibold text-neutral-900 print:text-xs">{reservation.room?.roomNumber || '—'}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]"><Building2 className="h-3 w-3 print:h-2 print:w-2" /> Type</p>
                      <p className="text-sm font-semibold text-neutral-900 print:text-xs">{reservation.roomType?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]"><Calendar className="h-3 w-3 print:h-2 print:w-2" /> Check In</p>
                      <p className="text-sm font-semibold text-neutral-900 print:text-xs">{checkIn ? formatDate(checkIn, 'short') : '—'}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]"><Calendar className="h-3 w-3 print:h-2 print:w-2" /> Check Out</p>
                      <p className="text-sm font-semibold text-neutral-900 print:text-xs">{checkOut ? formatDate(checkOut, 'short') : '—'}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]"><Clock className="h-3 w-3 print:h-2 print:w-2" /> Nights</p>
                      <p className="text-sm font-semibold text-neutral-900 print:text-xs">{nights}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-neutral-500 print:text-[7pt]"><Users className="h-3 w-3 print:h-2 print:w-2" /> Guests</p>
                      <p className="text-sm font-semibold text-neutral-900 print:text-xs">
                        {reservation.adults || 0} Adult{reservation.adults !== 1 ? 's' : ''}
                        {reservation.children > 0 ? `, ${reservation.children} Child${reservation.children !== 1 ? 'ren' : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  {allOccupants.length > 0 && (
                    <div className="mt-2 border-t border-neutral-200 pt-2 print:pt-1">
                      <p className="text-xs font-medium text-neutral-500 print:text-[7pt]">Guests Staying</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 print:gap-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 print:px-1 print:py-0 print:text-[6pt]">
                          {guestFullName} <span className="text-brand-400">(Primary)</span>
                        </span>
                        {allOccupants.map((o: any) => (
                          <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 print:px-1 print:py-0 print:text-[6pt]">
                            {o.firstName} {o.lastName}
                            {o.relationship ? <span className="text-neutral-400">({o.relationship})</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CHARGES TABLE ── */}
            <div className="charges-table-wrap mt-3 print:mt-2">
              <div className="mb-3 flex items-center gap-2 print:mb-1">
                <FileText className="h-4 w-4 text-neutral-400 print:h-3 print:w-3" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 print:text-[7pt]">Charges</h3>
              </div>
              <table className="w-full text-left text-sm print:text-[7pt]">
                <thead>
                  <tr className="border-b-2 border-neutral-800 bg-neutral-50">
                    <th className="w-10 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-600 print:px-1 print:py-1 print:text-[6pt]">#</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-600 print:px-1 print:py-1 print:text-[6pt]">Description</th>
                    <th className="w-14 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-600 print:px-1 print:py-1 print:text-[6pt]">Qty</th>
                    <th className="w-24 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-600 print:px-1 print:py-1 print:text-[6pt]">Unit Price</th>
                    <th className="w-20 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-600 print:px-1 print:py-1 print:text-[6pt]">Tax</th>
                    <th className="w-24 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-600 print:px-1 print:py-1 print:text-[6pt]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-neutral-400 print:px-1 print:py-2">No charges</td>
                    </tr>
                  ) : (
                    lineItems.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-3 text-neutral-400 print:px-1 print:py-1">{i + 1}</td>
                        <td className="px-3 py-3 print:px-1 print:py-1">
                          <p className="font-medium text-neutral-900">{item.description}</p>
                          {item.category && <p className="text-xs text-neutral-500 print:text-[6pt]">{item.category}</p>}
                        </td>
                        <td className="px-3 py-3 text-right text-neutral-700 print:px-1 print:py-1">{item.quantity}</td>
                        <td className="px-3 py-3 text-right font-mono text-neutral-700 print:px-1 print:py-1">
                          {currency} {Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-neutral-700 print:px-1 print:py-1">
                          {currency} {Number(item.taxAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-neutral-900 print:px-1 print:py-1">
                          {currency} {Number(item.total).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── TAX BREAKDOWN ── */}
            {inv.taxBreakdown && typeof inv.taxBreakdown === 'object' && Object.keys(inv.taxBreakdown).length > 0 && (
              <div className="no-split mt-2 print:mt-1">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 print:mb-0.5 print:text-[7pt]">Tax Breakdown</h3>
                <div className="flex flex-wrap gap-2 print:gap-1">
                  {Object.entries(inv.taxBreakdown).map(([name, amount]) => (
                    <span key={name} className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 print:px-1 print:py-0.5 print:text-[6pt]">
                      {name}: {currency} {Number(amount).toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── TOTALS ── */}
            <div className="no-split mt-3 flex justify-end print:mt-2">
              <div className="w-72 space-y-1.5 border-t-2 border-neutral-800 pt-4 print:w-56 print:space-y-0.5 print:pt-1">
                <div className="flex justify-between text-sm print:text-[7pt]">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-mono font-medium text-neutral-900">{currency} {Number(inv.subtotal).toFixed(2)}</span>
                </div>
                {Number(inv.discountTotal) > 0 && (
                  <div className="flex justify-between text-sm print:text-[7pt]">
                    <span className="text-neutral-600">Discount</span>
                    <span className="font-mono font-medium text-emerald-600">-{currency} {Number(inv.discountTotal).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm print:text-[7pt]">
                  <span className="text-neutral-600">Tax</span>
                  <span className="font-mono font-medium text-neutral-900">{currency} {Number(inv.taxTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-300 pt-1.5 text-base font-bold print:pt-0.5 print:text-[8pt]">
                  <span className="text-neutral-900">Grand Total</span>
                  <span className="font-mono text-neutral-900">{currency} {grandTotal.toFixed(2)}</span>
                </div>
                {totalPayments > 0 && (
                  <div className="flex justify-between text-sm print:text-[7pt]">
                    <span className="text-neutral-600">Paid</span>
                    <span className="font-mono font-medium text-emerald-700">{currency} {totalPayments.toFixed(2)}</span>
                  </div>
                )}
                {balance > 0 && (
                  <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-sm font-semibold print:pt-0.5 print:text-[7pt]">
                    <span className="text-amber-700">Balance Due</span>
                    <span className="font-mono text-amber-700">{currency} {balance.toFixed(2)}</span>
                  </div>
                )}
                {balance <= 0 && totalPayments > 0 && (
                  <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-sm font-semibold print:pt-0.5 print:text-[7pt]">
                    <span className="text-emerald-700">Balance</span>
                    <span className="font-mono text-emerald-700">{currency} 0.00</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── PAYMENT INFORMATION ── */}
            <div className="payment-info-card no-split mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-5 print:mt-2 print:p-1.5 print:rounded print:border print:border-neutral-200">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-900 print:mb-1 print:text-[7pt]">
                <CreditCard className="h-4 w-4 text-neutral-500 print:h-3 print:w-3" />
                Payment Information
              </h3>
              {payments.length > 0 ? (
                <table className="w-full text-left text-sm print:text-[7pt]">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500 print:text-[6pt]">
                      <th className="pb-2 font-semibold print:pb-0.5">Method</th>
                      <th className="pb-2 font-semibold print:pb-0.5">Reference</th>
                      <th className="pb-2 text-right font-semibold print:pb-0.5">Amount</th>
                      <th className="pb-2 text-right font-semibold print:pb-0.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 font-medium text-neutral-900 print:py-0.5">{p.method?.replace(/_/g, ' ') || '—'}</td>
                        <td className="py-2 font-mono text-neutral-700 print:py-0.5">{p.referenceNo || '—'}</td>
                        <td className="py-2 text-right font-mono font-semibold text-neutral-900 print:py-0.5">
                          {currency} {Number(p.amount).toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-neutral-600 print:py-0.5">
                          {p.createdAt ? formatDate(new Date(p.createdAt), 'short') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>No payments recorded yet</span>
                </div>
              )}
              {totalPayments > 0 && (
                <div className="mt-3 flex justify-end border-t border-neutral-200 pt-2 text-sm font-semibold print:mt-1 print:pt-0.5 print:text-[7pt]">
                  <span className="text-neutral-600">Total Paid:&nbsp;</span>
                  <span className="font-mono text-emerald-700">{currency} {totalPayments.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* ── TERMS & SIGNATURE ── */}
            <div className="no-split mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2 print:mt-3 print:gap-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 print:mb-0.5 print:text-[7pt]">Terms & Conditions</h3>
                <ul className="space-y-1 text-xs leading-relaxed text-neutral-600 print:text-[6pt] print:space-y-0">
                  <li>Payment is due within 30 days of the invoice date.</li>
                  <li>Late payments may incur additional charges.</li>
                  <li>This invoice is valid only for the services described above.</li>
                  <li>For billing inquiries, please contact the hotel directly.</li>
                </ul>
                <p className="mt-4 text-xs font-semibold text-neutral-700 print:mt-1 print:text-[6pt]">Thank you for your stay!</p>
              </div>
              <div className="text-right">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 print:mb-0.5 print:text-[7pt]">Authorized Signature</h3>
                <div className="mt-8 border-b border-neutral-300 pb-1 print:mt-2 print:pb-0.5">
                  <p className="font-mono text-sm text-neutral-400 print:text-[7pt]">_________________________</p>
                </div>
                <p className="mt-1 text-xs text-neutral-500 print:mt-0 print:text-[6pt]">Authorized Signatory</p>
                <p className="mt-4 text-xs text-neutral-500 print:mt-1 print:text-[6pt]">{hotelName}</p>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="mt-4 border-t border-neutral-200 pt-5 text-center print:mt-3 print:pt-2">
              <p className="text-xs text-neutral-500 print:text-[6pt]">
                {hotelName}{hotelPhone ? ` | ${hotelPhone}` : ''}{hotelEmail ? ` | ${hotelEmail}` : ''}
              </p>
              <p className="mt-1 text-xs text-neutral-400 print:text-[6pt]">
                Invoice #{inv.invoiceNumber} &middot; Generated {formatDate(new Date(inv.createdAt))}
              </p>
              <p className="mt-1 text-xs text-neutral-400 print:text-[6pt]">
                This is a computer-generated invoice and does not require a physical signature.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
