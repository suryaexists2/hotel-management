'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode, createElement } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolved: 'dark',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolved, setResolved] = useState<'light' | 'dark'>('dark');
  const themeRef = useRef<Theme>('dark');

  const applyTheme = useCallback((t: Theme) => {
    const isDark =
      t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    setResolved(isDark ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      themeRef.current = t;
      setThemeState(t);
      localStorage.setItem('innsight-theme', t);
      applyTheme(t);
    },
    [applyTheme],
  );

  useEffect(() => {
    const stored = localStorage.getItem('innsight-theme') as Theme | null;
    const t = stored || 'dark';
    themeRef.current = t;
    setThemeState(t);
    applyTheme(t);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (themeRef.current === 'system') applyTheme('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyTheme]);

  return createElement(ThemeContext.Provider, { value: { theme, resolved, setTheme } }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}
