'use client';
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const icon = theme === 'system' ? <Monitor className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />;

  return (
    <button
      onClick={cycleTheme}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] ${className}`}
      title={`Theme: ${theme}`}
    >
      {icon}
      <span className="capitalize">{theme}</span>
    </button>
  );
}
