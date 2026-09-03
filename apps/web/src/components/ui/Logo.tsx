'use client';
import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { icon: 20, text: 'text-base', container: 'h-8 w-8' },
  md: { icon: 24, text: 'text-lg', container: 'h-10 w-10' },
  lg: { icon: 28, text: 'text-2xl', container: 'h-12 w-12' },
};

export function Logo({ className = '', iconOnly = false, size = 'md' }: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${s.container} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-400 shadow-lg shadow-brand-500/20`}>
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 21V9L12 3L21 9V21H14V15H10V21H3Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="7" y="10" width="3" height="2" rx="0.5" fill="white" fillOpacity="0.7" />
          <rect x="14" y="10" width="3" height="2" rx="0.5" fill="white" fillOpacity="0.7" />
          <rect x="7" y="13" width="3" height="2" rx="0.5" fill="white" fillOpacity="0.7" />
          <rect x="14" y="13" width="3" height="2" rx="0.5" fill="white" fillOpacity="0.7" />
        </svg>
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <span className={`${s.text} font-bold tracking-tight text-[var(--text-primary)] leading-none`}>InnSight</span>
          <span className="text-[10px] font-medium tracking-wider text-[var(--text-muted)] uppercase">Hotel Management</span>
        </div>
      )}
    </div>
  );
}
