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
import { useTranslations } from 'next-intl';
import { useUX } from '@/context/UXContext';

export function UxMenu() {
  const t = useTranslations('common');
  const { themeFamily, setThemeFamily } = useUX();

  return (
    <div className="flex items-center gap-2">
      {/* Light/Dark toggle */}
      <ThemeToggle />
      {/* Theme variant selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t('theme.variant')}>
            🧩
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('theme.variant')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onSelect={() => setThemeFamily('classic')} 
            className={themeFamily === 'classic' ? 'bg-accent/10 font-semibold' : ''}
          >
            Classic
          </DropdownMenuItem>
          <DropdownMenuItem 
            onSelect={() => setThemeFamily('v4')} 
            className={themeFamily === 'v4' ? 'bg-accent/10 font-semibold' : ''}
          >
            V4 / Amber
          </DropdownMenuItem>
          <DropdownMenuItem 
            onSelect={() => setThemeFamily('v5')} 
            className={themeFamily === 'v5' ? 'bg-accent/10 font-semibold' : ''}
          >
            V5 / Teal
          </DropdownMenuItem>
          <DropdownMenuItem 
            onSelect={() => setThemeFamily('neon')} 
            className={themeFamily === 'neon' ? 'bg-accent/10 font-semibold' : ''}
          >
            Neon
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
