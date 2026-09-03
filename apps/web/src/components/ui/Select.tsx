'use client';
import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div>
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full rounded-lg border bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-1 ${
            error ? 'border-error focus:border-error focus:ring-error' : 'focus:border-brand-500 focus:ring-brand-500'
          } ${className}`}
          style={{ borderColor: error ? undefined : 'var(--border)' }}
          {...props}
          value={props.value ?? ''}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[var(--bg-card)]">{opt.label}</option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
