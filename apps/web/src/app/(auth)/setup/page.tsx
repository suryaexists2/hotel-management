'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { apiClient } from '@/lib/api-client';
import { setAccessToken } from '@/lib/api-client';

const hotelProfileSchema = z.object({
  name: z.string().trim().min(1, 'Hotel name is required').max(160),
  address: z.string().trim().min(1, 'Address is required').max(240),
  city: z.string().trim().min(1, 'City is required').max(120),
  country: z.string().trim().min(1, 'Country is required').max(120),
  phone: z.string().trim().min(1, 'Phone is required').max(40),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  timezone: z.string().trim().min(1, 'Timezone is required').max(64),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter code'),
});

const hotelSettingsSchema = z.object({
  defaultTaxRate: z.coerce.number().min(0, 'Must be 0 or greater').max(1, 'Must be 1 or less'),
  supportedCurrencies: z.string().trim().min(1, 'At least one currency required'),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'),
});

const adminUserSchema = z.object({
  firstName: z.string().trim().min(2, 'At least 2 characters').max(80),
  lastName: z.string().trim().min(2, 'At least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(72, 'At most 72 characters'),
});

type HotelProfileData = z.infer<typeof hotelProfileSchema>;
type HotelSettingsData = z.infer<typeof hotelSettingsSchema>;
type AdminUserData = z.infer<typeof adminUserSchema>;

interface SetupData {
  profile?: HotelProfileData;
  settings?: HotelSettingsData;
  admin?: AdminUserData;
}

const STEPS = ['Hotel Profile', 'Settings', 'Admin User', 'Confirmation'] as const;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [setupData, setSetupData] = React.useState<SetupData>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const profileForm = useForm<HotelProfileData>({
    resolver: zodResolver(hotelProfileSchema),
    defaultValues: { ...setupData.profile },
  });

  const settingsForm = useForm<HotelSettingsData>({
    resolver: zodResolver(hotelSettingsSchema),
    defaultValues: {
      defaultTaxRate: 0.1,
      supportedCurrencies: 'USD',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      ...setupData.settings,
    },
  });

  const adminForm = useForm<AdminUserData>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { ...setupData.admin },
  });

  const saveProfile = (data: HotelProfileData) => {
    setSetupData((prev) => ({ ...prev, profile: data }));
    setStep(1);
  };

  const saveSettings = (data: HotelSettingsData) => {
    setSetupData((prev) => ({ ...prev, settings: data }));
    setStep(2);
  };

  const saveAdmin = (data: AdminUserData) => {
    setSetupData((prev) => ({ ...prev, admin: data }));
    setStep(3);
  };

  const handleSubmitAll = async () => {
    const { profile, settings, admin } = setupData;
    if (!profile || !settings || !admin) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await apiClient.postWithoutAuth<{
        hotelId: string;
        accessToken: string;
        message: string;
      }>('/setup', {
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        email: admin.email,
        password: admin.password,
      });

      setAccessToken(result.accessToken);
      router.push('/dashboard');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Setup failed. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Set Up Your Hotel
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Get started with InnSight in minutes
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-1">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && (
                <div
                  className={`h-px w-6 transition-colors ${
                    i <= step ? 'bg-brand-500' : ''
                  }`}
                  style={{ backgroundColor: i > step ? 'var(--border)' : undefined }}
                />
              )}
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all ${
                  i < step
                    ? 'bg-brand-500 text-white'
                    : i === step
                      ? 'border border-brand-500 text-brand-500'
                      : 'border text-[var(--text-muted)]'
                }`}
                style={{ borderColor: i > step ? 'var(--border)' : undefined }}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="card p-6">
          {/* Step 0: Hotel Profile */}
          {step === 0 && (
            <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Hotel Profile</h2>
              <Field label="Hotel Name" error={profileForm.formState.errors.name?.message}>
                <input
                  {...profileForm.register('name')}
                  placeholder="Grand Palace Hotel"
                  className="input-field"
                />
              </Field>
              <Field label="Address" error={profileForm.formState.errors.address?.message}>
                <input
                  {...profileForm.register('address')}
                  placeholder="123 Main Street"
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" error={profileForm.formState.errors.city?.message}>
                  <input
                    {...profileForm.register('city')}
                    placeholder="New York"
                    className="input-field"
                  />
                </Field>
                <Field label="Country" error={profileForm.formState.errors.country?.message}>
                  <input
                    {...profileForm.register('country')}
                    placeholder="United States"
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" error={profileForm.formState.errors.phone?.message}>
                  <input
                    {...profileForm.register('phone')}
                    placeholder="+1 555-0000"
                    className="input-field"
                  />
                </Field>
                <Field label="Email" error={profileForm.formState.errors.email?.message}>
                  <input
                    type="email"
                    {...profileForm.register('email')}
                    placeholder="info@grandpalace.com"
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Timezone"
                  error={profileForm.formState.errors.timezone?.message}
                >
                  <input
                    {...profileForm.register('timezone')}
                    placeholder="America/New_York"
                    className="input-field"
                  />
                </Field>
                <Field
                  label="Currency"
                  error={profileForm.formState.errors.currency?.message}
                >
                  <input
                    {...profileForm.register('currency')}
                    placeholder="USD"
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary">
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* Step 1: Hotel Settings */}
          {step === 1 && (
            <form onSubmit={settingsForm.handleSubmit(saveSettings)} className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Hotel Settings</h2>
              <Field
                label="Default Tax Rate (0-1)"
                error={settingsForm.formState.errors.defaultTaxRate?.message}
              >
                <input
                  type="number"
                  step="0.01"
                  {...settingsForm.register('defaultTaxRate')}
                  placeholder="0.10"
                  className="input-field"
                />
              </Field>
              <Field
                label="Supported Currencies (comma-separated)"
                error={settingsForm.formState.errors.supportedCurrencies?.message}
              >
                <input
                  {...settingsForm.register('supportedCurrencies')}
                  placeholder="USD, EUR, GBP"
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Check-in Time"
                  error={settingsForm.formState.errors.checkInTime?.message}
                >
                  <input
                    {...settingsForm.register('checkInTime')}
                    placeholder="15:00"
                    className="input-field"
                  />
                </Field>
                <Field
                  label="Check-out Time"
                  error={settingsForm.formState.errors.checkOutTime?.message}
                >
                  <input
                    {...settingsForm.register('checkOutTime')}
                    placeholder="11:00"
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </button>
                <button type="submit" className="btn-primary">
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Admin User */}
          {step === 2 && (
            <form onSubmit={adminForm.handleSubmit(saveAdmin)} className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Admin User</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                This will be the primary admin account for your hotel.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="First Name"
                  error={adminForm.formState.errors.firstName?.message}
                >
                  <input
                    {...adminForm.register('firstName')}
                    placeholder="John"
                    className="input-field"
                  />
                </Field>
                <Field
                  label="Last Name"
                  error={adminForm.formState.errors.lastName?.message}
                >
                  <input
                    {...adminForm.register('lastName')}
                    placeholder="Doe"
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Email" error={adminForm.formState.errors.email?.message}>
                <input
                  type="email"
                  {...adminForm.register('email')}
                  placeholder="admin@grandpalace.com"
                  className="input-field"
                />
              </Field>
              <Field
                label="Password"
                error={adminForm.formState.errors.password?.message}
              >
                <input
                  type="password"
                  {...adminForm.register('password')}
                  placeholder="At least 8 characters"
                  className="input-field"
                />
              </Field>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </button>
                <button type="submit" className="btn-primary">
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      Almost done!
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Review your setup and complete onboarding.
                    </p>
                  </div>
                </div>

              {setupData.profile && (
                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                  <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
                    Hotel Profile
                  </h3>
                  <div className="space-y-1 text-sm text-[var(--text-muted)]">
                    <p>
                      <span className="text-[var(--text-muted)]">Name:</span>{' '}
                      {setupData.profile.name}
                    </p>
                    <p>
                      <span className="text-neutral-500">Location:</span>{' '}
                      {setupData.profile.city}, {setupData.profile.country}
                    </p>
                    <p>
                      <span className="text-neutral-500">Timezone:</span>{' '}
                      {setupData.profile.timezone}
                    </p>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleSubmitAll}
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}