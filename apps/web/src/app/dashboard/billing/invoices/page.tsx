'use client';

import React, { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useInvoices, type Invoice } from '@/hooks/use-billing';

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useInvoices(page, 20);
  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (inv) => (
      <span className="font-mono text-brand-400">{inv.invoiceNumber}</span>
    )},
    { key: 'guestName', header: 'Guest' },
    { key: 'guestEmail', header: 'Email' },
    { key: 'grandTotal', header: 'Total', render: (inv) => `${inv.currency} ${Number(inv.grandTotal).toFixed(2)}` },
    { key: 'createdAt', header: 'Date', render: (inv) => new Date(inv.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (inv) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.open(`/dashboard/invoice/${inv.id}`, '_blank'); }}>
          <ExternalLink className="h-4 w-4 mr-1" /> View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="View all generated invoices"
      />

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(inv) => inv.id}
          onRowClick={(inv) => window.open(`/dashboard/invoice/${inv.id}`, '_blank')}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              title="No invoices yet"
              description="Generate an invoice from a settled folio to see it here."
              icon={<FileText className="h-12 w-12 text-neutral-600" />}
            />
          }
        />

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
            <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
