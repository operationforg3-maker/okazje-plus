"use client";

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// Simple theme variant manager
// Stores variant in localStorage under 'okp_theme_variant'
// Applies a CSS class to <html> element: 'theme-{variant}'
// Variants: classic, v4, v5, neon (you can extend with actual styles)

export function UxMenu() {
  const t = useTranslations('common');
  const [variant, setVariant] = useState<string>('classic');

  // Initialize from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('okp_theme_variant');
      if (stored) {
        setVariant(stored);
        applyVariant(stored);
      } else {
        applyVariant('classic');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyVariant = (v: string) => {
    const html = document.documentElement;
    // Remove any previous theme- classes
    html.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) html.classList.remove(cls);
    });
    if (v && v !== 'light' && v !== 'dark') {
      html.classList.add(`theme-${v}`);
    }
  };

  const onSelect = (v: string) => {
    setVariant(v);
    try {
      localStorage.setItem('okp_theme_variant', v);
    } catch {}
    applyVariant(v);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Light/Dark toggle */}
      <ThemeToggle />
      {/* Theme variant selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t('theme.variant')}>🧩</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('theme.variant')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onSelect('classic')}>Classic</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSelect('v4')}>V4 / Amber</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSelect('v5')}>V5 / Teal</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSelect('neon')}>Neon</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
