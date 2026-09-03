'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCreateEmployee } from '@/hooks/use-employees';

const DEPARTMENTS = [
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function NewEmployeePage() {
  const router = useRouter();
  const createEmployee = useCreateEmployee();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('FRONT_DESK');
  const [position, setPosition] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEmployee.mutate({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      department,
      position,
      employeeCode,
      dateOfJoining: dateOfJoining || undefined,
      emergencyContact: emergencyContact || undefined,
      emergencyPhone: emergencyPhone || undefined,
    }, {
      onSuccess: () => router.push('/dashboard/employees'),
    });
  };

  return (
    <div>
      <PageHeader
        title="Add Employee"
        description="Create a new employee record"
        actions={
          <Button variant="ghost" onClick={() => router.push('/dashboard/employees')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Department" options={DEPARTMENTS} value={department} onChange={(e) => setDepartment(e.target.value)} />
            <Input label="Position" value={position} onChange={(e) => setPosition(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Employee Code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required placeholder="e.g. EMP001" />
            <Input label="Date of Joining" type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Emergency Contact" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
            <Input label="Emergency Phone" type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.push('/dashboard/employees')}>Cancel</Button>
            <Button type="submit" isLoading={createEmployee.isPending}>Create Employee</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
