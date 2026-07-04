"use client";

import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useUX } from '@/context/UXContext';

export function ThemeToggle({
  className,
  size = 'icon',
}: { className?: string; size?: 'icon' | 'sm' | 'default' }) {
  const { themeMode, toggleThemeMode } = useUX();
  const t = useTranslations('common');

  const label = themeMode === 'light' ? t('theme.light') : t('theme.dark');

  return (
    <Button
      variant="outline"
      size={size}
      className={cn('rounded-full', className)}
      onClick={toggleThemeMode}
      aria-label={label}
      title={label}
    >
      {themeMode === 'light' && <Sun className="h-5 w-5" />}
      {themeMode === 'dark' && <Moon className="h-5 w-5" />}
    </Button>
  );
}
