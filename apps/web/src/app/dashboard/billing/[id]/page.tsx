'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, ArrowLeft, XCircle, Undo2, FileText, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { useFolio, useAddCharge, useAddPayment, useVoidCharge, useRefundPayment, useUpdatePayment, useVoidPayment, useGenerateInvoice, type Payment } from '@/hooks/use-billing';

const CATEGORIES = [
  { value: 'ROOM', label: 'Room' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'ROOM_SERVICE', label: 'Room Service' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'MINIBAR', label: 'Minibar' },
  { value: 'SPA', label: 'Spa' },
  { value: 'TELEPHONE', label: 'Telephone' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CORPORATE_CREDIT', label: 'Corporate Credit' },
  { value: 'OTHER', label: 'Other' },
];

export default function FolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const { data: folio, isLoading } = useFolio(reservationId);
  const addCharge = useAddCharge();
  const addPayment = useAddPayment();
  const voidCharge = useVoidCharge();
  const refundPayment = useRefundPayment();
  const updatePayment = useUpdatePayment();
  const voidPayment = useVoidPayment();
  const generateInvoice = useGenerateInvoice();

  const [activeTab, setActiveTab] = useState('charges');
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAction, setPaymentAction] = useState<{ payment: Payment; mode: 'edit' | 'refund' | 'void' } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner /></div>;
  }

  if (!folio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-500">
        <p className="text-lg">Folio not found</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard/billing')} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to Billing
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'charges', label: 'Charges', count: folio.charges?.length },
    { id: 'payments', label: 'Payments', count: folio.payments?.length },
    { id: 'invoice', label: 'Invoice' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/dashboard/billing')} className="mb-2 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300">
            <ArrowLeft className="h-4 w-4" /> Back to Billing
          </button>
          <h1 className="text-2xl font-bold text-white">Folio #{folio.folioNumber}</h1>
          <p className="mt-1 text-sm text-neutral-400">{folio.currency}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-500">Balance</p>
          <p className={`text-3xl font-bold ${folio.balance > 0 ? 'text-error' : 'text-success'}`}>
            {folio.balance > 0 ? '+' : ''}{folio.currency} {Math.abs(Number(folio.balance)).toFixed(2)}
          </p>
          <Badge variant={folio.status === 'OPEN' ? 'brand' : 'default'}>{folio.status}</Badge>
        </div>
      </div>

      {/* Balance Summary */}
      <Card>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-neutral-500">Total Charges</p>
            <p className="text-xl font-bold text-white">{folio.currency} {Number(folio.totalCharges).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Discounts</p>
            <p className="text-xl font-bold text-white">{folio.currency} {Number(folio.totalDiscounts).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Payments</p>
            <p className="text-xl font-bold text-white">{folio.currency} {Number(folio.totalPayments).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Balance</p>
            <p className={`text-xl font-bold ${folio.balance > 0 ? 'text-error' : 'text-success'}`}>
              {folio.currency} {Number(folio.balance).toFixed(2)}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Charges Tab */}
      {activeTab === 'charges' && (
        <Card padding={false}>
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h3 className="text-sm font-medium text-neutral-300">All Charges</h3>
            <Button size="sm" onClick={() => setShowAddCharge(true)}>
              <Plus className="h-4 w-4" /> Add Charge
            </Button>
          </div>
          <Table
            columns={[
              { key: 'category', header: 'Category', render: (c) => <Badge variant="info">{c.category}</Badge> },
              { key: 'description', header: 'Description' },
              { key: 'quantity', header: 'Qty' },
              { key: 'unitPrice', header: 'Unit Price', render: (c) => `${folio.currency} ${Number(c.unitPrice).toFixed(2)}` },
              { key: 'total', header: 'Total', render: (c) => `${folio.currency} ${Number(c.total).toFixed(2)}` },
              { key: 'taxAmount', header: 'Tax', render: (c) => `${folio.currency} ${Number(c.taxAmount).toFixed(2)}` },
              { key: 'voidedAt', header: 'Status', render: (c) => c.voidedAt ? <Badge variant="error">Voided</Badge> : <Badge variant="success">Active</Badge> },
              { key: 'actions', header: '', render: (c) => !c.voidedAt ? (
                <button
                  onClick={(e) => { e.stopPropagation(); voidCharge.mutate({ folioId: folio.id, chargeId: c.id }); }}
                  className="text-neutral-500 hover:text-error transition-colors"
                  title="Void charge"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              ) : null },
            ]}
            data={folio.charges || []}
            keyExtractor={(c) => c.id}
          />
        </Card>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card padding={false}>
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h3 className="text-sm font-medium text-neutral-300">All Payments</h3>
            <Button size="sm" onClick={() => setShowAddPayment(true)}>
              <Plus className="h-4 w-4" /> Add Payment
            </Button>
          </div>
          <Table
            columns={[
              { key: 'method', header: 'Method', render: (p) => <Badge>{p.method.replace('_', ' ')}</Badge> },
              { key: 'amount', header: 'Amount', render: (p) => `${folio.currency} ${Number(p.amount).toFixed(2)}` },
              { key: 'referenceNo', header: 'Reference', render: (p) => p.referenceNo || '—' },
              { key: 'notes', header: 'Notes', render: (p) => p.notes || '—' },
              { key: 'refundedAt', header: 'Status', render: (p) => p.voidedAt ? <Badge variant="error">Voided</Badge> : p.refundedAt ? <Badge variant="error">Refunded ({folio.currency} {p.refundedAmount ? Number(p.refundedAmount).toFixed(2) : ''})</Badge> : <Badge variant="success">Active</Badge> },
              { key: 'createdAt', header: 'Date', render: (p) => new Date(p.createdAt).toLocaleDateString() },
              { key: 'actions', header: '', render: (p) => !p.voidedAt ? (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPaymentError(null); setPaymentAction({ payment: p, mode: 'edit' }); }}
                    className="text-neutral-500 hover:text-brand-300 transition-colors"
                    title="Edit payment"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!p.refundedAt && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPaymentError(null); setPaymentAction({ payment: p, mode: 'refund' }); }}
                      className="text-neutral-500 hover:text-warning transition-colors"
                      title="Refund payment"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPaymentError(null); setPaymentAction({ payment: p, mode: 'void' }); }}
                    className="text-neutral-500 hover:text-error transition-colors"
                    title="Delete payment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null },
            ]}
            data={folio.payments || []}
            keyExtractor={(p) => p.id}
          />
        </Card>
      )}

      {/* Invoice Tab */}
      {activeTab === 'invoice' && (
        <Card>
          <div className="flex flex-col items-center py-12">
            <FileText className="mb-4 h-12 w-12 text-neutral-600" />
            <h3 className="text-lg font-semibold text-neutral-300">Invoice</h3>
            <p className="mt-1 text-sm text-neutral-500">Generate a professional invoice for this folio</p>
            <Button onClick={() => generateInvoice.mutate({ folioId: folio.id }, {
              onSuccess: (inv) => {
                if (inv && inv.id) window.location.href = `/dashboard/invoice/${inv.id}`;
              },
              onError: (err) => setInvoiceError(err instanceof Error ? err.message : 'Invoice generation failed'),
            })} isLoading={generateInvoice.isPending} className="mt-6">
              <FileText className="h-4 w-4" /> Generate Invoice
            </Button>
            {invoiceError && <p className="mt-3 text-sm text-error">{invoiceError}</p>}
          </div>
        </Card>
      )}

      {/* Add Charge Modal */}
      <AddChargeModal
        isOpen={showAddCharge}
        onClose={() => setShowAddCharge(false)}
        folioId={folio.id}
        currency={folio.currency}
        onSubmit={(data) => {
          addCharge.mutate(data, { onSuccess: () => setShowAddCharge(false) });
        }}
        isPending={addCharge.isPending}
      />

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={showAddPayment}
        onClose={() => setShowAddPayment(false)}
        folioId={folio.id}
        currency={folio.currency}
        onSubmit={(data) => {
          addPayment.mutate(data, { onSuccess: () => setShowAddPayment(false) });
        }}
        isPending={addPayment.isPending}
      />

      {/* Payment Edit / Refund / Void Modal */}
      <PaymentActionModal
        currency={folio.currency}
        action={paymentAction}
        error={paymentError}
        onClose={() => setPaymentAction(null)}
        onSubmit={(input) => {
          if (!paymentAction) return;
          const { payment, mode } = paymentAction;
          if (mode === 'edit') {
            updatePayment.mutate({
              folioId: folio.id,
              paymentId: payment.id,
              data: {
                amount: input.amount as number,
                method: input.method as string,
                referenceNo: input.referenceNo ?? null,
                notes: input.notes ?? null,
              },
            }, {
              onSuccess: () => { setPaymentAction(null); setPaymentError(null); },
              onError: (err) => setPaymentError(err instanceof Error ? err.message : 'Failed to edit payment'),
            });
          } else if (mode === 'refund') {
            refundPayment.mutate({ folioId: folio.id, paymentId: payment.id, amount: input.amount as number, reason: input.reason as string }, {
              onSuccess: () => { setPaymentAction(null); setPaymentError(null); },
              onError: (err) => setPaymentError(err instanceof Error ? err.message : 'Failed to refund payment'),
            });
          } else {
            voidPayment.mutate({ folioId: folio.id, paymentId: payment.id, reason: input.reason as string }, {
              onSuccess: () => { setPaymentAction(null); setPaymentError(null); },
              onError: (err) => setPaymentError(err instanceof Error ? err.message : 'Failed to delete payment'),
            });
          }
        }}
      />
    </div>
  );
}

function AddChargeModal({
  isOpen, onClose, folioId, currency, onSubmit, isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  folioId: string;
  currency: string;
  onSubmit: (data: { folioId: string; category: string; description: string; unitPrice: number; quantity: number; taxRate?: number }) => void;
  isPending: boolean;
}) {
  const [category, setCategory] = useState('MISCELLANEOUS');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [taxRate, setTaxRate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      folioId,
      category,
      description,
      unitPrice: parseFloat(unitPrice),
      quantity: parseInt(quantity) || 1,
      ...(taxRate ? { taxRate: parseFloat(taxRate) } : {}),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Charge">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Category" options={CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
        <Input label={`Unit Price (${currency})`} type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
        <Input label="Quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input label="Tax Rate (%)" type="number" step="0.1" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isPending}>Add Charge</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddPaymentModal({
  isOpen, onClose, folioId, currency, onSubmit, isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  folioId: string;
  currency: string;
  onSubmit: (data: { folioId: string; amount: number; method: string; referenceNo?: string; notes?: string }) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      folioId,
      amount: parseFloat(amount),
      method,
      ...(referenceNo ? { referenceNo } : {}),
      ...(notes ? { notes } : {}),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={`Amount (${currency})`} type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Select label="Payment Method" options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value)} />
        <Input label="Reference No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isPending}>Add Payment</Button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentActionModal({
  currency,
  action,
  error,
  onClose,
  onSubmit,
}: {
  currency: string;
  action: { payment: Payment; mode: 'edit' | 'refund' | 'void' } | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { amount?: number; method?: string; referenceNo?: string | null; notes?: string | null; reason?: string }) => void;
}) {
  const payment = action?.payment ?? null;
  const mode = action?.mode ?? null;
  const isOpen = !!action;

  const remaining = payment ? Number(payment.amount) - Number(payment.refundedAmount || 0) : 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (action) {
      setAmount(mode === 'refund' ? remaining.toFixed(2) : String(Number(payment?.amount).toFixed(2)));
      setMethod(payment?.method || 'CASH');
      setReferenceNo(payment?.referenceNo || '');
      setNotes(payment?.notes || '');
      setReason('');
    }
  }, [action]);

  if (!mode || !payment) return null;

  const title = mode === 'edit' ? 'Edit Payment' : mode === 'refund' ? 'Refund Payment' : 'Delete Payment';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'edit') {
      onSubmit({ amount: parseFloat(amount), method, referenceNo: referenceNo || null, notes: notes || null });
    } else {
      onSubmit({ amount: mode === 'refund' ? parseFloat(amount) : undefined, reason });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode !== 'void' && (
          <>
            <Input label={`Amount (${currency})`} type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            {mode === 'edit' && (
              <>
                <Select label="Payment Method" options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value)} />
                <Input label="Reference No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </>
            )}
            {mode === 'refund' && (
              <p className="text-sm text-neutral-400">
                Remaining refundable on this payment: {currency} {remaining.toFixed(2)}
              </p>
            )}
          </>
        )}
        {mode === 'void' && (
          <p className="text-sm text-neutral-400">
            This will remove the payment of {currency} {Number(payment.amount).toFixed(2)} from the folio. This cannot be undone.
          </p>
        )}
        {mode !== 'edit' && (
          <Input label={mode === 'void' ? 'Reason (required)' : 'Reason'} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder={mode === 'void' ? 'e.g. Duplicate payment entered by mistake' : 'e.g. Refunded at the desk'} />
        )}
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{mode === 'edit' ? 'Save Changes' : mode === 'refund' ? 'Refund' : 'Delete Payment'}</Button>
        </div>
      </form>
    </Modal>
  );
}
