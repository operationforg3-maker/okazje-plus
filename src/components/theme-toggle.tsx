"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// Minimal theme manager without external deps
// Persists in localStorage under 'okp_theme' as 'light' | 'dark'
// No 'system' mode - only light and dark

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'okp_theme';

function applyTheme(theme: Theme) {
  try {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch {}
}

export function ThemeToggle({
  className,
  size = 'icon',
}: { className?: string; size?: 'icon' | 'sm' | 'default' }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const t = useTranslations('common');

  // Initialize from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
      setTheme(initial);
      applyTheme(initial);
    } catch {}
  }, []);

  // No need for system listener anymore - just light/dark

  const cycle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    applyTheme(next);
  };

  const label = useMemo(() => {
    return theme === 'light' ? t('theme.light') : t('theme.dark');
  }, [theme, t]);

  return (
    <Button
      variant="outline"
      size={size}
      className={cn('rounded-full', className)}
      onClick={cycle}
      aria-label={label}
      title={label}
    >
      {theme === 'light' && <Sun className="h-5 w-5" />}
      {theme === 'dark' && <Moon className="h-5 w-5" />}
    </Button>
  );
}
