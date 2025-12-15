"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// Minimal theme manager without external deps
// Persists in localStorage under 'okp_theme' as 'light' | 'dark' | 'system'

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'okp_theme';

function applyTheme(theme: Theme) {
  try {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch {}
}

export function ThemeToggle({
  className,
  size = 'icon',
}: { className?: string; size?: 'icon' | 'sm' | 'default' }) {
  const [theme, setTheme] = useState<Theme>('system');
  const t = useTranslations('common');

  // Initialize from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      setTheme(initial);
      applyTheme(initial);
    } catch {}
  }, []);

  // React to system theme changes when in 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    try {
      mq.addEventListener('change', handler);
    } catch {
      // Safari
      mq.addListener(handler);
    }
    return () => {
      try { mq.removeEventListener('change', handler); } catch { mq.removeListener(handler); }
    };
  }, [theme]);

  const cycle = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    applyTheme(next);
  };

  const label = useMemo(() => {
    return theme === 'light' ? t('theme.light') : theme === 'dark' ? t('theme.dark') : t('theme.system');
  }, [theme, t]);

  return (
    <Button
      variant="outline"
      size={size}
      className={cn('rounded-full', className)}
      onClick={cycle}
      aria-label={label}
      title={`${label} (${t('theme.hint')})`}
    >
      {theme === 'light' && <Sun className="h-5 w-5" />}
      {theme === 'dark' && <Moon className="h-5 w-5" />}
      {theme === 'system' && <Laptop className="h-5 w-5" />}
    </Button>
  );
}
