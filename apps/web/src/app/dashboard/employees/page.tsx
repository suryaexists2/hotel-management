'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEmployees, type Employee } from '@/hooks/use-employees';

const DEPARTMENTS = [
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function EmployeesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useEmployees({ page, limit: 20, department: department || undefined, search: search || undefined });

  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Name', render: (e) => `${e.firstName} ${e.lastName}` },
    { key: 'email', header: 'Email' },
    { key: 'department', header: 'Department', render: (e) => (
      <Badge variant="info">{e.department.replace('_', ' ')}</Badge>
    )},
    { key: 'position', header: 'Position' },
    { key: 'employeeCode', header: 'Employee Code', render: (e) => <span className="font-mono text-neutral-400">{e.employeeCode}</span> },
    { key: 'isActive', header: 'Status', render: (e) => e.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="error">Inactive</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your hotel staff"
        actions={
          <Button onClick={() => router.push('/dashboard/employees/new')}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        }
      />

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search employees..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-10 pr-3 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <Table
          columns={columns}
          data={data?.items || []}
          keyExtractor={(e) => e.id}
          onRowClick={(e) => router.push(`/dashboard/employees/${e.id}`)}
          isLoading={isLoading}
          emptyState={
            <div className="flex flex-col items-center py-16 text-neutral-500">
              <p className="text-lg">No employees found</p>
              <p className="text-sm">Add your first employee to get started</p>
            </div>
          }
        />

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
            <p className="text-sm text-neutral-500">Page {data.page} of {data.totalPages} ({data.total} employees)</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">Previous</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
