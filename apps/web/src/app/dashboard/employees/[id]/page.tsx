'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, User, Mail, Phone, Building2, BadgeInfo, Calendar, PhoneCall, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEmployee, useUpdateEmployee } from '@/hooks/use-employees';

const DEPARTMENTS = [
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: employee, isLoading } = useEmployee(params.id as string);
  const updateEmployee = useUpdateEmployee();

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    department: '', position: '', employeeCode: '',
    dateOfJoining: '', emergencyContact: '', emergencyPhone: '',
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner /></div>;
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-500">
        <p className="text-lg">Employee not found</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard/employees')} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </Button>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone || '',
      department: employee.department,
      position: employee.position,
      employeeCode: employee.employeeCode,
      dateOfJoining: employee.dateOfJoining || '',
      emergencyContact: employee.emergencyContact || '',
      emergencyPhone: employee.emergencyPhone || '',
    });
    setShowEdit(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateEmployee.mutate({
      id: employee.id,
      ...editForm,
      phone: editForm.phone || undefined,
      dateOfJoining: editForm.dateOfJoining || undefined,
      emergencyContact: editForm.emergencyContact || undefined,
      emergencyPhone: editForm.emergencyPhone || undefined,
    }, { onSuccess: () => setShowEdit(false) });
  };

  const toggleActive = () => {
    updateEmployee.mutate({ id: employee.id, isActive: !employee.isActive });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={employee.position}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard/employees')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={openEdit}>
              <Edit2 className="h-4 w-4" /> Edit
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
              <User className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold text-white">{employee.firstName} {employee.lastName}</h2>
            <p className="text-sm text-neutral-400">{employee.position}</p>
            <div className="mt-4">
              {employee.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="error">Inactive</Badge>}
            </div>
            <button
              onClick={toggleActive}
              disabled={updateEmployee.isPending}
              className="mt-3 flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
            >
              {employee.isActive ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5" />}
              {employee.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </Card>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-white">Contact Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Email</p>
                  <p className="text-sm text-white">{employee.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Phone</p>
                  <p className="text-sm text-white">{employee.phone || '—'}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-white">Employment Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Department</p>
                  <p className="text-sm text-white">{employee.department.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <BadgeInfo className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Employee Code</p>
                  <p className="text-sm font-mono text-white">{employee.employeeCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Date of Joining</p>
                  <p className="text-sm text-white">{employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            </div>
          </Card>

          {(employee.emergencyContact || employee.emergencyPhone) && (
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-white">Emergency Contact</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <PhoneCall className="h-5 w-5 text-neutral-500" />
                  <div>
                    <p className="text-xs text-neutral-500">Contact</p>
                    <p className="text-sm text-white">{employee.emergencyContact || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-neutral-500" />
                  <div>
                    <p className="text-xs text-neutral-500">Phone</p>
                    <p className="text-sm text-white">{employee.emergencyPhone || '—'}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <p className="text-xs text-neutral-600">
            Created {new Date(employee.createdAt).toLocaleString()} &middot; Updated {new Date(employee.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Employee" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First Name" value={editForm.firstName} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} required />
            <Input label="Last Name" value={editForm.lastName} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} required />
            <Input label="Phone" type="tel" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Department" options={DEPARTMENTS} value={editForm.department} onChange={(e) => setEditForm(f => ({ ...f, department: e.target.value }))} />
            <Input label="Position" value={editForm.position} onChange={(e) => setEditForm(f => ({ ...f, position: e.target.value }))} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Employee Code" value={editForm.employeeCode} onChange={(e) => setEditForm(f => ({ ...f, employeeCode: e.target.value }))} required />
            <Input label="Date of Joining" type="date" value={editForm.dateOfJoining} onChange={(e) => setEditForm(f => ({ ...f, dateOfJoining: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Emergency Contact" value={editForm.emergencyContact} onChange={(e) => setEditForm(f => ({ ...f, emergencyContact: e.target.value }))} />
            <Input label="Emergency Phone" type="tel" value={editForm.emergencyPhone} onChange={(e) => setEditForm(f => ({ ...f, emergencyPhone: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button type="submit" isLoading={updateEmployee.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
