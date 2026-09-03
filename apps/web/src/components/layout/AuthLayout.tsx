'use client';
import React from 'react';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const features = [
  { label: 'Smart Dashboard', desc: 'Real-time occupancy & revenue analytics' },
  { label: 'Front Desk', desc: 'Streamlined check-in/out & reservation management' },
  { label: 'Housekeeping', desc: 'Automated room status & cleaning schedules' },
  { label: 'Billing & Invoicing', desc: 'Folio management with tax & invoice automation' },
];

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Hero Side */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-12 lg:flex">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative">
          <Logo size="lg" />
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight text-[#fff]">
              Everything you need to run your hotel
            </h2>
            <p className="mt-3 text-lg text-brand-100/80">
              From front desk to housekeeping — manage every aspect of your property in one place.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fff]/20">
                  <svg className="h-3 w-3 text-[#fff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#fff]">{f.label}</p>
                  <p className="text-sm text-brand-100/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-sm text-brand-100/60">&copy; {new Date().getFullYear()} InnSight. All rights reserved.</p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-app)] px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <Logo size="md" />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
