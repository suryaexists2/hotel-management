'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { CURRENCIES } from '@innsight/shared';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useHotel, useUpdateHotel, useUpdateHotelSettings,
  useTaxRules, useCreateTaxRule, useUpdateTaxRule, useDeleteTaxRule,
} from '@/hooks/use-hotel';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { data: hotel, isLoading } = useHotel();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner /></div>;
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'settings', label: 'Settings' },
    { id: 'taxRules', label: 'Tax Rules' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your hotel configuration"
      />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'general' && <GeneralTab hotel={hotel!} />}
      {activeTab === 'settings' && <SettingsTab hotel={hotel!} />}
      {activeTab === 'taxRules' && <TaxRulesTab />}
    </div>
  );
}

function GeneralTab({ hotel }: { hotel: NonNullable<ReturnType<typeof useHotel>['data']> }) {
  const updateHotel = useUpdateHotel();
  const [form, setForm] = useState({
    name: hotel.name ?? '',
    address: hotel.address ?? '',
    city: hotel.city ?? '',
    state: hotel.state ?? '',
    country: hotel.country ?? '',
    zipCode: hotel.zipCode ?? '',
    phone: hotel.phone ?? '',
    email: hotel.email ?? '',
    timezone: hotel.timezone ?? '',
    currency: hotel.currency ?? '',
    currencySymbol: hotel.currencySymbol ?? '',
  });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { currencySymbol, ...payload } = form;
    updateHotel.mutate(payload, {
      onSuccess: () => setEditing(false),
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update hotel details'),
    });
  };

  if (!editing) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Hotel Information</h3>
          <Button size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-xs text-neutral-500">Name</p><p className="text-sm text-white">{hotel.name}</p></div>
          <div><p className="text-xs text-neutral-500">Address</p><p className="text-sm text-white">{hotel.address}</p></div>
          <div><p className="text-xs text-neutral-500">City</p><p className="text-sm text-white">{hotel.city}</p></div>
          <div><p className="text-xs text-neutral-500">State</p><p className="text-sm text-white">{hotel.state}</p></div>
          <div><p className="text-xs text-neutral-500">Country</p><p className="text-sm text-white">{hotel.country}</p></div>
          <div><p className="text-xs text-neutral-500">ZIP Code</p><p className="text-sm text-white">{hotel.zipCode}</p></div>
          <div><p className="text-xs text-neutral-500">Phone</p><p className="text-sm text-white">{hotel.phone}</p></div>
          <div><p className="text-xs text-neutral-500">Email</p><p className="text-sm text-white">{hotel.email}</p></div>
          <div><p className="text-xs text-neutral-500">Timezone</p><p className="text-sm text-white">{hotel.timezone}</p></div>
          <div><p className="text-xs text-neutral-500">Currency</p><p className="text-sm text-white">{hotel.currency} ({hotel.currencySymbol})</p></div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-6 text-lg font-semibold text-white">Edit Hotel Information</h3>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Hotel Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Address" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="City" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} required />
          <Input label="State" value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} required />
          <Input label="Country" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="ZIP Code" value={form.zipCode} onChange={(e) => setForm(f => ({ ...f, zipCode: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
          <Input label="Timezone" value={form.timezone} onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Currency"
            value={form.currency}
            onChange={(e) => {
              const selected = CURRENCIES.find(c => c.code === e.target.value);
              setForm(f => ({ ...f, currency: e.target.value, currencySymbol: selected?.symbol || '' }));
            }}
            options={CURRENCIES.map(c => ({ value: c.code, label: `${c.code} (${c.symbol}) - ${c.name}` }))}
            required
          />
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="submit" isLoading={updateHotel.isPending}>Save Changes</Button>
        </div>
      </form>
    </Card>
  );
}

function SettingsTab({ hotel }: { hotel: NonNullable<ReturnType<typeof useHotel>['data']> }) {
  const updateHotel = useUpdateHotel();
  const updateSettings = useUpdateHotelSettings();
  const [form, setForm] = useState({
    defaultTaxRate: hotel.settings.defaultTaxRate ?? 0,
    supportedCurrencies: (hotel.settings.supportedCurrencies ?? []).join(', '),
    checkInTime: hotel.checkInTime ?? '',
    checkOutTime: hotel.checkOutTime ?? '',
    allowOverbooking: hotel.settings.allowOverbooking ?? false,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    updateHotel.mutate(
      { checkInTime: form.checkInTime, checkOutTime: form.checkOutTime },
      {
        onSuccess: () => {
          updateSettings.mutate({
            defaultTaxRate: form.defaultTaxRate,
            supportedCurrencies: form.supportedCurrencies.split(',').map(s => s.trim()).filter(Boolean),
            allowOverbooking: form.allowOverbooking,
          });
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update settings'),
      },
    );
  };

  return (
    <Card>
      <h3 className="mb-6 text-lg font-semibold text-white">Hotel Settings</h3>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Default Tax Rate (%)"
            type="number"
            step="0.1"
            min="0"
            value={form.defaultTaxRate}
            onChange={(e) => setForm(f => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Supported Currencies"
            value={form.supportedCurrencies}
            onChange={(e) => setForm(f => ({ ...f, supportedCurrencies: e.target.value }))}
            placeholder="USD, EUR, GBP"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Check-In Time"
            type="time"
            value={form.checkInTime}
            onChange={(e) => setForm(f => ({ ...f, checkInTime: e.target.value }))}
          />
          <Input
            label="Check-Out Time"
            type="time"
            value={form.checkOutTime}
            onChange={(e) => setForm(f => ({ ...f, checkOutTime: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="allowOverbooking"
            checked={form.allowOverbooking}
            onChange={(e) => setForm(f => ({ ...f, allowOverbooking: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="allowOverbooking" className="text-sm text-neutral-300">Allow Overbooking</label>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex justify-end pt-2">
          <Button type="submit" isLoading={updateHotel.isPending || updateSettings.isPending}>Save Settings</Button>
        </div>
      </form>
    </Card>
  );
}

function TaxRulesTab() {
  const { data: rules, isLoading } = useTaxRules();
  const createRule = useCreateTaxRule();
  const updateRule = useUpdateTaxRule();
  const deleteRule = useDeleteTaxRule();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', rate: 0, appliesTo: '', isInclusive: false, isActive: true });

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', rate: 0, appliesTo: '', isInclusive: false, isActive: true });
    setShowModal(true);
  };

  const openEdit = (rule: NonNullable<typeof rules>[number]) => {
    setEditId(rule.id);
    setForm({
      name: rule.name,
      rate: rule.rate,
      appliesTo: rule.appliesTo.join(', '),
      isInclusive: rule.isInclusive,
      isActive: rule.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      rate: form.rate,
      appliesTo: form.appliesTo.split(',').map(s => s.trim()).filter(Boolean),
      isInclusive: form.isInclusive,
      isActive: form.isActive,
    };

    if (editId) {
      updateRule.mutate({ id: editId, ...data }, { onSuccess: () => setShowModal(false) });
    } else {
      createRule.mutate(data, { onSuccess: () => setShowModal(false) });
    }
  };

  if (isLoading) {
    return <div className="py-16 text-center"><Spinner /></div>;
  }

  return (
    <div>
      <Card padding={false}>
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h3 className="text-sm font-medium text-neutral-300">Tax Rules</h3>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add Rule</Button>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Rate</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Applies To</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Inclusive</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {(rules || []).map((rule) => (
              <tr key={rule.id} className="text-neutral-300 hover:bg-neutral-800/30">
                <td className="px-4 py-3 font-medium text-white">{rule.name}</td>
                <td className="px-4 py-3">{rule.rate}%</td>
                <td className="px-4 py-3">{rule.appliesTo.join(', ') || '—'}</td>
                <td className="px-4 py-3">{rule.isInclusive ? <Badge variant="info">Inclusive</Badge> : <Badge variant="default">Exclusive</Badge>}</td>
                <td className="px-4 py-3">{rule.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="error">Inactive</Badge>}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(rule)} className="text-neutral-500 hover:text-brand-400 transition-colors" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this tax rule?')) deleteRule.mutate(rule.id); }}
                      className="text-neutral-500 hover:text-error transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!rules || rules.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-neutral-500">No tax rules configured</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Tax Rule' : 'Add Tax Rule'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Rule Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Rate (%)" type="number" step="0.1" min="0" max="100" value={form.rate} onChange={(e) => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))} required />
          <Input label="Applies To (comma-separated)" value={form.appliesTo} onChange={(e) => setForm(f => ({ ...f, appliesTo: e.target.value }))} placeholder="ROOM, RESTAURANT" />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isInclusive"
              checked={form.isInclusive}
              onChange={(e) => setForm(f => ({ ...f, isInclusive: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="isInclusive" className="text-sm text-neutral-300">Tax is inclusive in pricing</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="isActive" className="text-sm text-neutral-300">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={createRule.isPending || updateRule.isPending}>
              {editId ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
