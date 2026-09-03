'use client';
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, className = '', padding = true, hover = false }: CardProps) {
  return (
    <div className={`rounded-xl border bg-[var(--bg-card)] backdrop-blur-sm transition-all duration-200 ${hover ? 'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20' : ''} ${padding ? 'p-6' : ''} ${className}`} style={{ borderColor: 'var(--border)' }}>
      {children}
    </div>
  );
}
